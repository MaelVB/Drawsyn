'use client';

import { create } from 'zustand';

interface EffectsState {
  // True when we should show the urgent timer flash effect
  hurryActive: boolean;
  partyActive: boolean;
  partySeed: number;
  partyExpiresAt?: number;
  startHurry: () => void;
  stopHurry: () => void;
  startPartyEffect: (durationMs?: number) => void;
  stopPartyEffect: () => void;
}

export const useEffectsStore = create<EffectsState>((set) => ({
  hurryActive: false,
  partyActive: false,
  partySeed: 0,
  partyExpiresAt: undefined,
  startHurry: () => set({ hurryActive: true }),
  stopHurry: () => set({ hurryActive: false }),
  startPartyEffect: (durationMs = 10000) =>
    set({
      partyActive: true,
      partySeed: Math.max(Number.MIN_VALUE, Math.random()),
      partyExpiresAt: Date.now() + durationMs
    }),
  stopPartyEffect: () => set({ partyActive: false, partyExpiresAt: undefined })
}));
