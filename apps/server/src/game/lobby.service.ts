import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { RoomState } from './types/game-state';

export interface CreateRoomOptions {
  name: string;
  maxPlayers: number;
  roundDuration: number;
}

@Injectable()
export class LobbyService {
  private readonly rooms = new Map<string, RoomState>();

  createRoom(options: CreateRoomOptions): RoomState {
    const id = randomUUID();
    const room: RoomState = {
      id,
      name: options.name,
      maxPlayers: options.maxPlayers,
      roundDuration: options.roundDuration,
      players: {},
      status: 'lobby',
      createdAt: Date.now()
    };

    this.rooms.set(id, room);

    return room;
  }

  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  upsertRoom(room: RoomState): void {
    this.rooms.set(room.id, room);
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }

  listRooms(): RoomState[] {
    return Array.from(this.rooms.values());
  }
}
