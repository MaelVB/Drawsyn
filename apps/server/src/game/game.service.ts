import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { CreateRoomDto } from './dto/create-room.dto';
import { GuessDto } from './dto/guess.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { LobbyService } from './lobby.service';
import { PlayerState, RoomState } from './types/game-state';

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

  joinRoom(dto: JoinRoomDto): JoinRoomResult {
    const room = this.lobby.getRoom(dto.roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (Object.keys(room.players).length >= room.maxPlayers) {
      throw new Error('Room is full');
    }

    const player: PlayerState = {
      id: randomUUID(),
      name: dto.name,
      score: 0,
      isDrawing: false,
      connected: true
    };

    room.players[player.id] = player;
    this.lobby.upsertRoom(room);

    return { room, player };
  }

  leaveRoom(roomId: string, playerId: string): RoomState | undefined {
    const room = this.lobby.getRoom(roomId);
    if (!room) {
      return undefined;
    }

    delete room.players[playerId];

    if (Object.keys(room.players).length === 0) {
      this.lobby.deleteRoom(roomId);
      return undefined;
    }

    if (room.round?.drawerId === playerId) {
      this.logger.warn(`Drawer ${playerId} left room ${roomId}, ending round`);
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

  submitGuess(playerId: string, dto: GuessDto) {
    const room = this.lobby.getRoom(dto.roomId);
    if (!room || !room.round) {
      return { correct: false, room: undefined };
    }

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

    if (room.round) return room.round;

    const players = Object.values(room.players);
    if (players.length < 2) return undefined;

    const nextDrawer = this.pickDrawer(players, room.round?.drawerId);
    players.forEach((p) => (p.isDrawing = false));
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
    this.lobby.upsertRoom(room);
    return round;
  }

  private pickDrawer(players: PlayerState[], previousDrawerId?: string) {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    return (
      shuffled.find((player) => player.id !== previousDrawerId) ?? shuffled[0]
    );
  }
}
