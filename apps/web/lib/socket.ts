'use client';

import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER ?? 'http://localhost:3333/game';

let socket: Socket | undefined;

export function getSocket() {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ['websocket']
    });
  }
  return socket;
}

export function connectSocket(token: string) {
  console.log('[Socket] Tentative de connexion avec token:', token.substring(0, 20) + '...');
  const instance = getSocket();
  
  // Déconnecter et nettoyer complètement
  if (instance.connected) {
    console.log('[Socket] Déconnexion de l\'instance actuelle');
    instance.disconnect();
  }
  
  // IMPORTANT: Supprimer TOUS les listeners pour éviter les messages résiduels
  console.log('[Socket] Suppression de tous les listeners');
  instance.removeAllListeners();
  
  // Définir le nouveau token
  instance.auth = { token };
  console.log('[Socket] Token défini, connexion...');
  
  instance.connect();
  console.log('[Socket] Connexion lancée');
  return instance;
}

export function disconnectSocket() {
  console.log('[Socket] Déconnexion');
  if (!socket) return;
  if (socket.connected) {
    socket.disconnect();
  }
}
