'use client';

import { create } from 'zustand';

export interface PlayerState {
  id: string;
  name: string;
  score: number;
  isDrawing: boolean;
  connected: boolean;
  inventory?: PlayerItem[];
}

export interface RoomState {
  id: string;
  name: string;
  maxPlayers: number;
  roundDuration: number;
  players: Record<string, PlayerState>;
  status: 'lobby' | 'choosing' | 'running' | 'ended';
  createdAt: number;
  totalRounds?: number;
  currentRound?: number;
  hostId?: string;
  connectedPlayers?: number;
  totalPlayers?: number;
  drawerOrder?: string[];
  currentDrawerIndex?: number;
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
  itemsCatalog: GameItemDef[];
  setRooms: (rooms: RoomState[]) => void;
  setCurrentRoom: (room?: RoomState) => void;
  setPlayerId: (playerId?: string) => void;
  setRound: (round?: RoundState) => void;
  updateRoundRemaining: (remaining: number) => void;
  setItemsCatalog: (items: GameItemDef[]) => void;
}

export type ItemId = 'improvisation';

export interface GameItemDef {
  id: ItemId;
  name: string;
  description: string;
  cost: number;
}

export interface PlayerItem {
  instanceId: string;
  itemId: ItemId;
  acquiredAt: number;
  consumed?: boolean;
}

export const useGameStore = create<GameStore>((set) => ({
  rooms: [],
  itemsCatalog: [],
  setRooms: (rooms) => set({ rooms }),
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setPlayerId: (playerId) => set({ playerId }),
  setRound: (round) => set({ round })
  ,
  updateRoundRemaining: (remaining) => set((state) => state.round ? ({ round: { ...state.round, roundEndsAt: Date.now() + remaining * 1000 } }) : {}),
  setItemsCatalog: (items) => set({ itemsCatalog: items })
}));
