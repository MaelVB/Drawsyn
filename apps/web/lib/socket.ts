'use client';

import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER ?? 'http://localhost:3333/game';

let socket: Socket | undefined;

export function getSocket() {
  if (!socket) {
    console.log('[Socket] ⚠️ getSocket() appelé sans socket existant - création d\'un socket NON AUTHENTIFIÉ (pas recommandé)');
    console.trace('[Socket] Stack trace de getSocket()');
    socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });
  }
  return socket;
}

export function connectSocket(token: string) {
  console.log('[Socket] 🔐 Connexion avec token:', token.substring(0, 20) + '...');
  
  // IMPORTANT: Si un socket existe déjà, le détruire complètement
  // car on ne peut pas changer le token après le premier handshake
  if (socket) {
    console.log('[Socket] 🗑️ Destruction du socket existant');
    if (socket.connected) {
      socket.disconnect();
    }
    socket.removeAllListeners();
    // Force la fermeture complète de la connexion
    socket.close();
    socket = undefined;
  }
  
  // Créer un NOUVEAU socket avec le bon token
  console.log('[Socket] 🆕 Création d\'un nouveau socket avec le token');
  socket = io(SERVER_URL, {
    autoConnect: false,
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    auth: { token }  // ← Token défini DÈS la création
  });
  
  console.log('[Socket] ✏️ Socket créé avec auth:', socket.auth);
  
  // Ajouter des listeners de débogage AVANT la connexion
  socket.on('connect', () => {
    console.log('[Socket] ✅ CONNECTÉ avec succès! ID:', socket?.id);
    console.log('[Socket] Auth envoyé:', socket?.auth);
    console.log('[Socket] Timestamp:', new Date().toISOString());
  });
  
  socket.on('connect_error', (error: Error) => {
    console.error('[Socket] ❌ Erreur de connexion:', error.message);
  });
  
  // Connecter
  console.log('[Socket] 🚀 Lancement de la connexion... Timestamp:', new Date().toISOString());
  socket.connect();
  
  return socket;
}

export function disconnectSocket() {
  console.log('[Socket] Déconnexion');
  if (!socket) return;
  if (socket.connected) {
    socket.disconnect();
  }
}

export function resetSocket() {
  console.log('[Socket] Réinitialisation complète du socket');
  if (socket) {
    if (socket.connected) {
      socket.disconnect();
    }
    socket.removeAllListeners();
    socket = undefined;
  }
}

// S'assurer que le socket est fermé proprement avant le rechargement de la page
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    console.log('[Socket] beforeunload - fermeture du socket');
    if (socket) {
      // Désactiver la reconnexion automatique avant de fermer
      socket.io.opts.reconnection = false;
      if (socket.connected) {
        socket.disconnect();
      }
      socket.close();
    }
  });
}
