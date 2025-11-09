'use client';

import { create } from 'zustand';

export interface PlayerState {
  id: string;
  name: string;
  score: number;
  isDrawing: boolean;
  connected: boolean;
}

export interface RoomState {
  id: string;
  name: string;
  maxPlayers: number;
  roundDuration: number;
  players: Record<string, PlayerState>;
  status: 'lobby' | 'running' | 'ended';
  createdAt: number;
}

export interface RoundState {
  drawerId: string;
  roundEndsAt: number;
  revealed: string;
}

interface GameStore {
  rooms: RoomState[];
  currentRoom?: RoomState;
  playerId?: string;
  round?: RoundState;
  setRooms: (rooms: RoomState[]) => void;
  setCurrentRoom: (room?: RoomState) => void;
  setPlayerId: (playerId?: string) => void;
  setRound: (round?: RoundState) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  rooms: [],
  setRooms: (rooms) => set({ rooms }),
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setPlayerId: (playerId) => set({ playerId }),
  setRound: (round) => set({ round })
}));
