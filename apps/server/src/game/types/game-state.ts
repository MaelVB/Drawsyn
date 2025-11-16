export interface PlayerState {
  id: string;
  name: string;
  score: number;
  isDrawing: boolean;
  connected: boolean;
  // Ordre d'arrivée dans la room (sert à déterminer l'ordre des dessinateurs)
  joinOrder?: number;
  // Inventaire du joueur (nouveau système d'items)
  inventory?: PlayerItem[];
  // Équipe du joueur (assignée au démarrage si le mode équipe est activé)
  teamId?: string;
}

export interface RoundState {
  word: string;
  revealed: string;
  roundEndsAt?: number;
  drawerId: string;
  startedAt: number;
  // Index séquentiel du tour (chaque dessin / passage d'un joueur) pour associer le dessin
  turnIndex: number;
  // Joueurs (hors dessinateur) qui ont déjà trouvé
  guessedPlayerIds: string[];
  // Raison de fin possible: timeout | all-guessed | next-turn | game-ended | cancelled
  endReason?: string;
  // Indices des lettres déjà révélées (pour le dévoilement progressif)
  revealedIndices?: number[];
  // Score total du round (100 × nombre de joueurs connectés)
  totalScore?: number;
}

export interface RoomState {
  id: string;
  name: string;
  maxPlayers: number;
  roundDuration: number;
  players: Record<string, PlayerState>;
  round?: RoundState;
  status: 'lobby' | 'choosing' | 'running' | 'ended';
  createdAt: number;
  lastActivityAt: number;
  // Compteur des tours (chaque fois qu'un dessinateur commence une manche)
  turnCounter?: number;
  // Configuration du nombre total de rounds (une "rotation" complète des joueurs = 1 round)
  totalRounds?: number;
  currentRound?: number; // démarre à 1
  drawerOrder?: string[]; // séquence déterministe des joueurs
  currentDrawerIndex?: number; // index actuel dans drawerOrder
  hostId?: string; // ID du joueur hôte (celui qui peut configurer et lancer la partie)
  // Visibilité de la salle (public par défaut). Si true, la salle n'apparaît pas dans la liste publique.
  isPrivate?: boolean;
  // ===================== Équipes =====================
  // Nombre d'équipes (2..6 typiquement). Si non défini, le mode équipe est désactivé
  teamCount?: number;
  // Taille maximale d'une équipe. Si non défini, répartition uniforme sans borne stricte
  teamSize?: number;
  // Optionnel: mapping des équipes vers leurs membres (dérivable via players[].teamId)
  // teams?: Record<string, string[]>;
  // Mots proposés au dessinateur lors de la phase de choix
  pendingWordChoices?: string[];
  // Instance pré-consommée de l'item Improvisation (pour saisie du mot)
  pendingImprovisationInstanceId?: string;
  // Round terminé en attente de soumission du dessin
  pendingDrawing?: {
    turnIndex: number;
    drawerId: string;
    word: string;
    endedAt: number;
  };
  // Historique des dessins soumis
  drawings?: DrawingRecord[];
}

// ===================== Items =====================
export type ItemId = 
  | 'party_time'
  | 'early_bird'
  | 'paralysis'
  | 'improvisation'
  | 'crt'
  | 'unsolicited_help'
  | 'noir_blanc'
  | 'blackout'
  | 'amnesia'
  | 'unforgiving'
  | 'roublard'
  | 'spy'
  | 'incognito'
  | 'ad_break'        // Page de pub
  | 'minigame'        // Mini-jeu
  | 'recent_memory'   // Mémoire récente
  | 'heal';           // Soin

export interface GameItemDef {
  id: ItemId;
  name: string;
  description: string;
  cost: number; // coût en score
}

export interface PlayerItem {
  instanceId: string; // identifiant unique d'instance
  itemId: ItemId;
  acquiredAt: number;
  consumed?: boolean;
}

// Représente un dessin sauvegardé à la fin d'un tour
export interface DrawingRecord {
  turnIndex: number;
  drawerId: string;
  word: string;
  imageData: string; // data URL base64 (ex: data:image/png;base64,...)
  savedAt: number;
  filePath?: string; // chemin relatif du fichier sauvegardé sur le disque
}
