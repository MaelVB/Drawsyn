import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

import { CreateRoomDto } from './dto/create-room.dto';
import { GuessDto } from './dto/guess.dto';
import { UpdateRoomSettingsDto } from './dto/update-room-settings.dto';
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
  private server?: Server; // Attaché par le gateway pour pouvoir émettre des events
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly lobby: LobbyService) {}

  listRooms(): RoomState[] {
    return this.lobby.listRooms();
  }

  createRoom(dto: CreateRoomDto): RoomState {
    return this.lobby.createRoom({
      name: dto.name,
      maxPlayers: dto.maxPlayers,
      roundDuration: dto.roundDuration,
      totalRounds: dto.totalRounds
    });
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
    if (typeof dto.totalRounds === 'number') {
      room.totalRounds = dto.totalRounds;
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
          connected: true,
          joinOrder: Object.values(room.players).length // ordre actuel avant insertion
        };

    room.players[player.id] = player;

    // Maintenir l'ordre déterministe des dessinateurs
    if (!room.drawerOrder) room.drawerOrder = [];
    if (!room.drawerOrder.includes(player.id)) {
      room.drawerOrder.push(player.id);
    }
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
      this.cancelCurrentTurn(room, 'cancelled');
    }

    // Si plus aucun joueur connecté, arrêter le timer
    if (connectedPlayers.length === 0) {
      this.clearTimer(room.id);
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
        player.score += 50; // Score identique pour tous ceux qui trouvent
      }
      if (!room.round.guessedPlayerIds.includes(playerId)) {
        room.round.guessedPlayerIds.push(playerId);
      }
      this.lobby.upsertRoom(room);

      // Vérifier si tout le monde (hors dessinateur) a trouvé
      const connectedPlayers = Object.values(room.players).filter(p => p.connected && p.id !== room.round!.drawerId);
      const allGuessed = room.round.guessedPlayerIds.length >= connectedPlayers.length;
      if (allGuessed) {
        this.endTurn(room.id, 'all-guessed');
      } else {
        // Notifier juste la bonne réponse
        this.emitToRoom(room.id, 'guess:correct', { playerId, word: room.round.word });
      }
      return { correct: true, room, playerId };
    }

    return { correct: false, room };
  }

  private startTurn(room: RoomState) {
    // Assurer données de séquence
    if (!room.drawerOrder) {
      room.drawerOrder = Object.values(room.players)
        .sort((a, b) => (a.joinOrder ?? 0) - (b.joinOrder ?? 0))
        .map(p => p.id);
    }
    if (room.currentDrawerIndex == null || room.currentDrawerIndex < 0) {
      // La partie commence par le dernier à avoir rejoint
      room.currentDrawerIndex = room.drawerOrder.length - 1;
    }
    const drawerId = room.drawerOrder[room.currentDrawerIndex];
    const drawer = room.players[drawerId];
    if (!drawer || !drawer.connected) {
      // Chercher prochain dessinateur connecté
      const nextIdx = room.drawerOrder.findIndex(id => room.players[id]?.connected);
      if (nextIdx === -1) return; // personne
      room.currentDrawerIndex = nextIdx;
    }
    const finalDrawerId = room.drawerOrder[room.currentDrawerIndex];
    Object.values(room.players).forEach(p => p.isDrawing = false);
    if (room.players[finalDrawerId]) room.players[finalDrawerId].isDrawing = true;
    const word = this.words[Math.floor(Math.random() * this.words.length)];
    const round = {
      word,
      revealed: word.replace(/./g, '_'),
      drawerId: finalDrawerId,
      startedAt: Date.now(),
      roundEndsAt: Date.now() + room.roundDuration * 1000,
      guessedPlayerIds: []
    };
    room.round = round;
    room.status = 'running';
    room.lastActivityAt = Date.now();
    this.lobby.upsertRoom(room);
    // Lancer timer
    this.startTimer(room.id);
    this.emitToRoom(room.id, 'round:started', {
      drawerId: round.drawerId,
      roundEndsAt: round.roundEndsAt,
      revealed: round.revealed,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds
    });
    this.emitToPlayer(round.drawerId, 'round:word', { word: round.word });
  }

  private startTimer(roomId: string) {
    this.clearTimer(roomId);
    const interval = setInterval(() => this.handleTimerTick(roomId), 1000);
    this.timers.set(roomId, interval);
  }

  private clearTimer(roomId: string) {
    const t = this.timers.get(roomId);
    if (t) clearInterval(t);
    this.timers.delete(roomId);
  }

  private handleTimerTick(roomId: string) {
    const room = this.lobby.getRoom(roomId);
    if (!room || !room.round) return;
    const remainingMs = room.round.roundEndsAt - Date.now();
    const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
    this.emitToRoom(room.id, 'timer:tick', { remaining });
    if (remaining <= 0) {
      this.endTurn(roomId, 'timeout');
    }
  }

  private endTurn(roomId: string, reason: string) {
    const room = this.lobby.getRoom(roomId);
    if (!room || !room.round) return;
    this.clearTimer(roomId);
    room.round.endReason = reason;
    const finishedRound = room.round;
    // Nettoyer état du dessinateur
    const drawer = room.players[finishedRound.drawerId];
    if (drawer) drawer.isDrawing = false;

    // Emit fin
    this.emitToRoom(room.id, 'round:ended', {
      word: finishedRound.word,
      drawerId: finishedRound.drawerId,
      guessedPlayerIds: finishedRound.guessedPlayerIds,
      reason,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      scores: Object.values(room.players)
    });

    // Avancer index en sautant les déconnectés
    if (room.drawerOrder && room.currentDrawerIndex != null) {
      const order = room.drawerOrder;
      let nextIndex = (room.currentDrawerIndex + 1) % order.length;
      let safety = 0;
      while (!room.players[order[nextIndex]]?.connected && safety < order.length) {
        nextIndex = (nextIndex + 1) % order.length;
        safety++;
      }
      const completedCycle = nextIndex === 0; // Retour au début => round complet
      room.currentDrawerIndex = nextIndex;
      if (completedCycle) {
        room.currentRound = (room.currentRound ?? 0) + 1;
        if (room.currentRound! > (room.totalRounds ?? 1)) {
          // Fin du jeu
            room.status = 'ended';
            room.round = undefined;
            this.lobby.upsertRoom(room);
            this.emitToRoom(room.id, 'game:ended', {
              totalRounds: room.totalRounds,
              scores: Object.values(room.players)
            });
            return;
        } else {
          this.emitToRoom(room.id, 'game:next-round', {
            currentRound: room.currentRound,
            totalRounds: room.totalRounds
          });
        }
      }
    }

    // Démarrer prochain tour si jeu pas terminé
    if (room.status !== 'ended') {
      room.round = undefined; // effacer ancien round
      this.lobby.upsertRoom(room);
      this.startTurn(room);
    }
  }

  private cancelCurrentTurn(room: RoomState, reason: string) {
    this.clearTimer(room.id);
    if (room.round) {
      room.round.endReason = reason;
      this.emitToRoom(room.id, 'round:cancelled', { reason });
    }
    room.round = undefined;
    room.status = 'lobby';
    this.lobby.upsertRoom(room);
  }

  startGame(roomId: string) {
    const room = this.lobby.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'lobby') {
      return room.round; // Déjà en cours
    }
    // Initialiser round global
    room.currentRound = 1;
    room.currentDrawerIndex = -1; // pour démarrer sur dernier joueur
    this.lobby.upsertRoom(room);
    this.startTurn(room);
    return room.round;
  }

  attachServer(server: Server) {
    if (!this.server) {
      this.server = server;
      this.logger.log('Server attached to GameService for event emission');
    }
  }

  private emitToRoom(roomId: string, event: string, payload: unknown) {
    if (this.server) {
      this.server.to(roomId).emit(event, payload);
    }
  }

  private emitToPlayer(playerId: string, event: string, payload: unknown) {
    if (this.server) {
      this.server.to(playerId).emit(event, payload);
    }
  }
}
