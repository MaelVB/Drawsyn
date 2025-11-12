import { randomUUID } from 'crypto';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { RoomState } from './types/game-state';

export interface CreateRoomOptions {
  name: string;
  maxPlayers: number;
  roundDuration: number;
  totalRounds: number;
  hostId: string;
}

@Injectable()
export class LobbyService implements OnModuleInit {
  private readonly logger = new Logger(LobbyService.name);
  private readonly rooms = new Map<string, RoomState>();
  private readonly ROOM_CLEANUP_INTERVAL = 60 * 1000; // Vérifier toutes les minutes
  private readonly ROOM_INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  onModuleInit() {
    // Démarrer le nettoyage automatique des rooms inactives
    this.startRoomCleanup();
  }

  createRoom(options: CreateRoomOptions): RoomState {
    const id = randomUUID();
    const now = Date.now();
    const room: RoomState = {
      id,
      name: options.name,
      maxPlayers: options.maxPlayers,
      roundDuration: options.roundDuration,
      players: {},
      status: 'lobby',
      createdAt: now,
      lastActivityAt: now,
      totalRounds: options.totalRounds,
      currentRound: 0,
      drawerOrder: [],
      currentDrawerIndex: -1,
      hostId: options.hostId
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

  private startRoomCleanup() {
    setInterval(() => {
      const now = Date.now();
      const roomsToDelete: string[] = [];

      for (const [roomId, room] of this.rooms.entries()) {
        const connectedPlayers = Object.values(room.players).filter(p => p.connected);
        
        // Si aucun joueur connecté et inactif depuis 5 minutes
        if (connectedPlayers.length === 0 && now - room.lastActivityAt > this.ROOM_INACTIVITY_TIMEOUT) {
          roomsToDelete.push(roomId);
          this.logger.log(`Suppression de la room inactive: ${room.name} (${roomId})`);
        }
      }

      // Supprimer les rooms inactives
      roomsToDelete.forEach(roomId => this.rooms.delete(roomId));

      if (roomsToDelete.length > 0) {
        this.logger.log(`${roomsToDelete.length} room(s) supprimée(s) pour inactivité`);
      }
    }, this.ROOM_CLEANUP_INTERVAL);
  }
}
