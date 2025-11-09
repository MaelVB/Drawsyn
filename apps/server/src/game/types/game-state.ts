export interface PlayerState {
  id: string;
  name: string;
  score: number;
  isDrawing: boolean;
  connected: boolean;
}

export interface RoundState {
  word: string;
  revealed: string;
  roundEndsAt: number;
  drawerId: string;
  startedAt: number;
}

export interface RoomState {
  id: string;
  name: string;
  maxPlayers: number;
  roundDuration: number;
  players: Record<string, PlayerState>;
  round?: RoundState;
  status: 'lobby' | 'running' | 'ended';
  createdAt: number;
}
