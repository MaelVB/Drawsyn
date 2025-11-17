'use client';

import { create } from 'zustand';

export interface PlayerState {
  id: string;
  name: string;
  score: number;
  isDrawing: boolean;
  connected: boolean;
  inventory?: PlayerItem[];
  teamId?: string;
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
  // Équipes (optionnel)
  teamCount?: number;
  teamSize?: number;
  // Items gratuits dans cette room
  itemsFree?: boolean;
  round?: {
    drawerId: string;
    roundEndsAt?: number;
    revealed: string;
    guessedPlayerIds?: string[];
  };
  drawings?: DrawingRecord[];
}


export interface RoundState {
  drawerId: string;
  roundEndsAt?: number;
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
  addItemToPlayer: (playerId: string, item: PlayerItem) => boolean;
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
  category: 'visual' | 'support' | 'block' | 'drawing';
  requiresTarget?: boolean;
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
  setPrimaryNotification: (notification) => set({ primaryNotification: notification ?? null }),
  addItemToPlayer: (playerId, item) => {
    let added = false;
    set((state) => {
      const room = state.currentRoom;
      if (!room) return {};
      const player = room.players[playerId];
      if (!player) return {};

      const inventory = player.inventory ?? [];
      const MAX_ITEMS = 7;
      if (inventory.length >= MAX_ITEMS) {
        // ne pas ajouter, montrer une notification
        added = false;
        return {
          primaryNotification: {
            id: 'inventory-full',
            message: `Vous ne pouvez pas avoir plus de ${MAX_ITEMS} items.`,
            variant: 'warning',
            durationMs: 3000,
            timestamp: Date.now()
          }
        };
      }

      const newInventory = [...inventory, item];
      const newPlayer: PlayerState = { ...player, inventory: newInventory };
      const newPlayers = { ...room.players, [playerId]: newPlayer };
      const newRoom: RoomState = { ...room, players: newPlayers };
      added = true;
      return { currentRoom: newRoom };
    });
    return added;
  }
}));
