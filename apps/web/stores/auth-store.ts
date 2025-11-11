'use client';

import { create } from 'zustand';

import { connectSocket, disconnectSocket } from '@/lib/socket';

export interface AuthUser {
  id: string;
  pseudo: string;
  email: string;
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
    console.log('[AuthStore] setAuth appelé pour:', payload.user.pseudo);
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, payload.token);
      localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
      console.log('[AuthStore] Token et user sauvegardés dans localStorage');
    }
    connectSocket(payload.token);
    set({ token: payload.token, user: payload.user, hydrated: true });
  },
  clearAuth: () => {
    console.log('[AuthStore] clearAuth appelé');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      console.log('[AuthStore] localStorage vidé');
    }
    disconnectSocket();
    set({ token: undefined, user: undefined, hydrated: true });
  },
  hydrate: async () => {
    if (typeof window === 'undefined') {
      console.log('[AuthStore] Hydratation ignorée (côté serveur)');
      return;
    }
    
    // Éviter l'hydratation multiple
    if (get().hydrated) {
      console.log('[AuthStore] Déjà hydraté, ignoré');
      return;
    }
    
    console.log('[AuthStore] Début de l\'hydratation...');
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    
    if (!token || !rawUser) {
      console.log('[AuthStore] Aucune session trouvée dans localStorage');
      set({ hydrated: true });
      return;
    }

    try {
      const user = JSON.parse(rawUser) as AuthUser;
      console.log('[AuthStore] Session trouvée dans localStorage:', { pseudo: user.pseudo, email: user.email });
      
      // Vérifier que l'utilisateur a les nouveaux champs requis
      if (!user.pseudo || !user.email) {
        console.warn('[AuthStore] Ancien format de compte détecté, nettoyage...');
        get().clearAuth();
        return;
      }

      // Charger depuis le localStorage sans vérifier auprès du serveur
      // La vérification se fera lors de la première requête authentifiée
      console.log('[AuthStore] Restauration de la session pour:', user.pseudo);
      connectSocket(token);
      set({ token, user, hydrated: true });
      console.log('[AuthStore] Hydratation terminée avec succès');
    } catch (error) {
      console.error('[AuthStore] Erreur lors de l\'hydratation:', error);
      get().clearAuth();
    }
  },
  hydrated: false
}));
