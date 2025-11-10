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
  const instance = getSocket();
  const currentToken = (instance.auth as { token?: string } | undefined)?.token;

  if (instance.connected) {
    if (currentToken === token) {
      return instance;
    }
    instance.disconnect();
  }

  instance.auth = { token };
  instance.connect();
  return instance;
}

export function disconnectSocket() {
  if (!socket) return;
  if (socket.connected) {
    socket.disconnect();
  }
}
