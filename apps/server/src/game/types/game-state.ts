export interface PlayerState {
  id: string;
  name: string;
  score: number;
  isDrawing: boolean;
  connected: boolean;
  // Ordre d'arrivée dans la room (sert à déterminer l'ordre des dessinateurs)
  joinOrder?: number;
}

export interface RoundState {
  word: string;
  revealed: string;
  roundEndsAt: number;
  drawerId: string;
  startedAt: number;
  // Joueurs (hors dessinateur) qui ont déjà trouvé
  guessedPlayerIds: string[];
  // Raison de fin possible: timeout | all-guessed | next-turn | game-ended | cancelled
  endReason?: string;
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
  lastActivityAt: number;
  // Configuration du nombre total de rounds (une "rotation" complète des joueurs = 1 round)
  totalRounds?: number;
  currentRound?: number; // démarre à 1
  drawerOrder?: string[]; // séquence déterministe des joueurs
  currentDrawerIndex?: number; // index actuel dans drawerOrder
}
