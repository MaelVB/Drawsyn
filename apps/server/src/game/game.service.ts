import { Injectable, Logger } from '@nestjs/common';

import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomSettingsDto } from './dto/update-room-settings.dto';
import { GuessDto } from './dto/guess.dto';
import { LobbyService } from './lobby.service';
import { PlayerState, RoomState } from './types/game-state';

interface JoinContext {
  roomId: string;
  userId: string;
  pseudo: string;
}

export interface JoinRoomResult {
  room: RoomState;
  player: PlayerState;
}

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private readonly words = ['maison', 'chat', 'lune', 'ordinateur', 'montagne', 'licorne'];

  constructor(private readonly lobby: LobbyService) {}

  listRooms(): RoomState[] {
    return this.lobby.listRooms();
  }

  createRoom(dto: CreateRoomDto): RoomState {
    return this.lobby.createRoom(dto);
  }

  updateRoomSettings(roomId: string, dto: UpdateRoomSettingsDto): RoomState {
    const room = this.lobby.getRoom(roomId);
    if (!room) {
      this.logger.warn(`updateRoomSettings: Room ${roomId} not found`);
      throw new Error('Room not found');
    }
    if (room.status !== 'lobby') {
      this.logger.warn(`updateRoomSettings: Cannot update settings while game running (${room.status})`);
      throw new Error('Impossible de modifier les paramètres pendant une manche');
    }

    // Appliquer uniquement si présents
    if (typeof dto.maxPlayers === 'number') {
      room.maxPlayers = dto.maxPlayers;
    }
    if (typeof dto.roundDuration === 'number') {
      room.roundDuration = dto.roundDuration;
    }
    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);
    return room;
  }

  joinRoom(context: JoinContext): JoinRoomResult {
    const room = this.lobby.getRoom(context.roomId);
    if (!room) {
      this.logger.error(`joinRoom: Room ${context.roomId} not found`);
      throw new Error('Room not found');
    }

    const existing = room.players[context.userId];
    const connectedPlayers = Object.values(room.players).filter(p => p.connected && p.id !== context.userId);
    
    if (existing) {
      this.logger.log(`Player ${context.pseudo} reconnecting to room ${room.name} (score: ${existing.score})`);
    } else {
      this.logger.log(`New player ${context.pseudo} joining room ${room.name}`);
    }
    
    if (!existing && connectedPlayers.length >= room.maxPlayers) {
      this.logger.warn(`Room ${room.name} is full (${connectedPlayers.length}/${room.maxPlayers})`);
      throw new Error('Room is full');
    }
    
    const player: PlayerState = existing
      ? {
          ...existing,
          name: context.pseudo,
          connected: true
        }
      : {
          id: context.userId,
          name: context.pseudo,
          score: 0,
          isDrawing: false,
          connected: true
        };

    room.players[player.id] = player;
    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);

    this.logger.log(`Room ${room.name} now has ${Object.values(room.players).filter(p => p.connected).length} connected players`);

    return { room, player };
  }

  leaveRoom(roomId: string, playerId: string): RoomState | undefined {
    const room = this.lobby.getRoom(roomId);
    if (!room) {
      this.logger.warn(`leaveRoom: Room ${roomId} not found`);
      return undefined;
    }

    const player = room.players[playerId];
    if (!player) {
      this.logger.warn(`leaveRoom: Player ${playerId} not found in room ${roomId}`);
      return room;
    }

    this.logger.log(`Player ${player.name} (${playerId}) leaving room ${room.name} (${roomId})`);

    // Marquer le joueur comme déconnecté au lieu de le supprimer
    player.connected = false;
    room.lastActivityAt = Date.now();

    const connectedPlayers = Object.values(room.players).filter(p => p.connected);
    this.logger.log(`Joueurs restants connectés: ${connectedPlayers.length}/${Object.keys(room.players).length}`);

    // Si le dessinateur se déconnecte, annuler le round
    if (room.round?.drawerId === playerId) {
      this.logger.warn(`Drawer ${player.name} left room ${room.name}, ending round`);
      room.round = undefined;
      room.status = 'lobby';
    }

    this.lobby.upsertRoom(room);
    return room;
  }

  canDraw(playerId: string, roomId: string): boolean {
    const room = this.lobby.getRoom(roomId);
    return Boolean(room?.round && room.round.drawerId === playerId);
  }

  updateRoomActivity(roomId: string): void {
    const room = this.lobby.getRoom(roomId);
    if (room) {
      room.lastActivityAt = Date.now();
      this.lobby.upsertRoom(room);
    }
  }

  submitGuess(playerId: string, dto: GuessDto) {
    const room = this.lobby.getRoom(dto.roomId);
    if (!room || !room.round) {
      return { correct: false, room: undefined };
    }

    room.lastActivityAt = Date.now();

    const normalized = dto.text.trim().toLowerCase();
    const expected = room.round.word.toLowerCase();

    if (normalized === expected && room.round.drawerId !== playerId) {
      const player = room.players[playerId];
      if (player) {
        player.score += 50;
      }
      const word = room.round.word;
      room.round = undefined;
      room.status = 'lobby';
      this.lobby.upsertRoom(room);
      return { correct: true, room, word, playerId };
    }

    return { correct: false, room };
  }

  ensureRound(roomId: string) {
    const room = this.lobby.getRoom(roomId);
    if (!room) return undefined;

    const currentRound = room.round;
    const previousDrawerId = currentRound?.drawerId;
    if (currentRound) return currentRound;

    // Ne compter que les joueurs connectés
    const connectedPlayers = Object.values(room.players).filter(p => p.connected);
    if (connectedPlayers.length < 2) return undefined;

    const nextDrawer = this.pickDrawer(connectedPlayers, previousDrawerId);
    connectedPlayers.forEach((p) => (p.isDrawing = false));
    nextDrawer.isDrawing = true;

    const word = this.words[Math.floor(Math.random() * this.words.length)];
    const round = {
      word,
      revealed: word.replace(/./g, '_'),
      drawerId: nextDrawer.id,
      startedAt: Date.now(),
      roundEndsAt: Date.now() + room.roundDuration * 1000
    };

    room.round = round;
    room.status = 'running';
    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);
    return round;
  }

  startGame(roomId: string) {
    const room = this.lobby.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'lobby') {
      return room.round; // Déjà en cours
    }
    return this.ensureRound(roomId);
  }

  private pickDrawer(players: PlayerState[], previousDrawerId?: string) {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    return (
      shuffled.find((player) => player.id !== previousDrawerId) ?? shuffled[0]
    );
  }
}
