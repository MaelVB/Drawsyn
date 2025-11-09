'use client';

import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER ?? 'http://localhost:3333/game';

let socket: Socket | undefined;

export function getSocket() {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: true,
      transports: ['websocket']
    });
  }
  return socket;
}
