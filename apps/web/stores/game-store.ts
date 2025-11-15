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
  drawings?: DrawingRecord[];
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
  primaryNotification?: PrimaryNotification | null;
  setRooms: (rooms: RoomState[]) => void;
  setCurrentRoom: (room?: RoomState | ((prev?: RoomState) => RoomState)) => void;
  setPlayerId: (playerId?: string) => void;
  setRound: (round?: RoundState) => void;
  updateRoundRemaining: (remaining: number) => void;
  updateRoundRevealed: (revealed: string) => void;
  setItemsCatalog: (items: GameItemDef[]) => void;
  setPrimaryNotification: (notification?: PrimaryNotification | null) => void;
}

export type ItemId =
  | 'party_time'
  | 'early_bird'
  | 'paralysis'
  | 'improvisation'
  | 'crt'
  | 'unsolicited_help'
  | 'noir_blanc'
  | 'ad_break'
  | 'blackout'
  | 'minigame'
  | 'amnesia'
  | 'recent_memory'
  | 'unforgiving'
  | 'roublard'
  | 'heal'
  | 'spy'
  | 'incognito';

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

export interface DrawingRecord {
  turnIndex: number;
  drawerId: string;
  word: string;
  imageData: string;
  savedAt: number;
}

export interface PrimaryNotification {
  id: string;
  message: string;
  variant?: 'info' | 'success' | 'warning' | 'danger';
  durationMs?: number;
  timestamp: number;
}

export const useGameStore = create<GameStore>((set) => ({
  rooms: [],
  itemsCatalog: [],
  primaryNotification: null,
  setRooms: (rooms) => set({ rooms }),
  setCurrentRoom: (room) =>
    set((state) => ({
      currentRoom:
        typeof room === 'function'
          ? (room as (prev?: RoomState) => RoomState)(state.currentRoom)
          : room
    })),
  setPlayerId: (playerId) => set({ playerId }),
  setRound: (round) => set({ round }),
  updateRoundRemaining: (remaining) =>
    set((state) =>
      state.round
        ? { round: { ...state.round, roundEndsAt: Date.now() + remaining * 1000 } }
        : {}
    ),
  updateRoundRevealed: (revealed) =>
    set((state) => (state.round ? { round: { ...state.round, revealed } } : {})),
  setItemsCatalog: (items) => set({ itemsCatalog: items }),
  setPrimaryNotification: (notification) => set({ primaryNotification: notification ?? null })
}));
