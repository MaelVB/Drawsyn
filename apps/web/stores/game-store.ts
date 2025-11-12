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
  totalRounds?: number;
  currentRound?: number;
  hostId?: string;
  connectedPlayers?: number;
  totalPlayers?: number;
  drawerOrder?: string[];
  round?: {
    drawerId: string;
    roundEndsAt: number;
    revealed: string;
    guessedPlayerIds?: string[];
  };
}


export interface RoundState {
  drawerId: string;
  roundEndsAt: number;
  revealed: string;
  guessedPlayerIds?: string[];
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
  updateRoundRemaining: (remaining: number) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  rooms: [],
  setRooms: (rooms) => set({ rooms }),
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setPlayerId: (playerId) => set({ playerId }),
  setRound: (round) => set({ round })
  ,
  updateRoundRemaining: (remaining) => set((state) => state.round ? ({ round: { ...state.round, roundEndsAt: Date.now() + remaining * 1000 } }) : {})
}));
