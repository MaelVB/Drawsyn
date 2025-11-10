'use client';

import { create } from 'zustand';

import { connectSocket, disconnectSocket } from '@/lib/socket';

export interface AuthUser {
  id: string;
  username: string;
}

interface AuthPayload {
  token: string;
  user: AuthUser;
}

interface AuthStore {
  token?: string;
  user?: AuthUser;
  setAuth: (payload: AuthPayload) => void;
  clearAuth: () => void;
  hydrate: () => void;
  hydrated: boolean;
}

const TOKEN_KEY = 'drawsyn:token';
const USER_KEY = 'drawsyn:user';

export const useAuthStore = create<AuthStore>((set, get) => ({
  setAuth: (payload) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, payload.token);
      localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    }
    connectSocket(payload.token);
    set({ token: payload.token, user: payload.user, hydrated: true });
  },
  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    disconnectSocket();
    set({ token: undefined, user: undefined, hydrated: true });
  },
  hydrate: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    if (!token || !rawUser) {
      get().clearAuth();
      set({ hydrated: true });
      return;
    }

    try {
      const user = JSON.parse(rawUser) as AuthUser;
      connectSocket(token);
      set({ token, user, hydrated: true });
    } catch (error) {
      get().clearAuth();
    }
  },
  hydrated: false
}));
