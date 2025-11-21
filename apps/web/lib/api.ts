export interface ApiAuthResponse {
  token: string;
  user: {
    id: string;
    pseudo: string;
    email: string;
  };
}

export interface ApiUser {
  id: string;
  pseudo: string;
  email: string;
  twitchUrl?: string | null;
  allowPublicFriendRequests?: boolean;
}

export interface ApiFriendRelation {
  userId: string;
  pseudo: string;
  email: string;
  status: 'pending' | 'accepted';
  type: 'private-email' | 'public';
  direction?: 'incoming' | 'outgoing';
  presence?: {
    status: 'disconnected' | 'lobby' | 'running';
    roomId?: string;
    roomName?: string;
  } | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
  } = {}
): Promise<T> {
  const { method = 'POST', body, token } = options;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? 'Une erreur est survenue');
  }

  return (await response.json()) as T;
}

export function register(pseudo: string, email: string, password: string) {
  return request<ApiAuthResponse>('/auth/register', { body: { pseudo, email, password } });
}

export function login(identifier: string, password: string) {
  return request<ApiAuthResponse>('/auth/login', { body: { identifier, password } });
}

export function verifyToken(token: string) {
  return request<ApiUser>('/auth/me', { method: 'GET', token });
}

export function getCurrentUser(token: string) {
  return request<ApiUser>('/users/me', { method: 'GET', token });
}

export function updateCurrentUser(
  token: string,
  payload: { pseudo?: string; twitchUrl?: string | null; allowPublicFriendRequests?: boolean }
) {
  // If twitchUrl is empty string, send null to clear
  const body: Record<string, unknown> = {};
  if (typeof payload.pseudo === 'string') body.pseudo = payload.pseudo;
  if (payload.twitchUrl === null) body.twitchUrl = null;
  else if (typeof payload.twitchUrl === 'string') body.twitchUrl = payload.twitchUrl;
  if (typeof payload.allowPublicFriendRequests === 'boolean') {
    body.allowPublicFriendRequests = payload.allowPublicFriendRequests;
  }
  return request<ApiUser>('/users/me', { method: 'PUT', body, token });
}

export function getFriends(token: string) {
  return request<ApiFriendRelation[]>('/friends', { method: 'GET', token });
}

export function connectFriendByEmail(token: string, email: string) {
  return request<{ status: 'pending' | 'accepted'; already: boolean }>(
    '/friends/connect-by-email',
    { method: 'POST', token, body: { email } }
  );
}

export function sendPublicFriendRequest(token: string, targetUserId: string) {
  return request<{ status: 'pending' | 'accepted'; already: boolean }>(
    '/friends/send-public',
    { method: 'POST', token, body: { targetUserId } }
  );
}

export function confirmPublicFriendRequest(token: string, requesterUserId: string) {
  return request<{ status: 'accepted' }>(
    '/friends/confirm-public',
    { method: 'POST', token, body: { requesterUserId } }
  );
}

export function removeFriend(token: string, otherUserId: string) {
  return request<{ removed: boolean }>(`/friends/${otherUserId}`, { method: 'DELETE', token });
}

// ================= Games =================
export interface ApiArchivedGameDrawing {
  turnIndex: number;
  drawerId: string;
  word: string;
  filePath: string;
  imageData?: string;
}

export interface ApiArchivedGame {
  gameId: string;
  roomId: string;
  status: 'running' | 'ended';
  totalRounds: number;
  currentRound: number;
  players: { playerId: string; pseudo: string; score: number }[];
  drawings: ApiArchivedGameDrawing[];
  messages: { at: number; type: 'guess' | 'correct' | 'system'; playerId?: string; text: string }[];
  endedAt: string | null;
  expiresAt: string | null;
}

export function getGame(gameId: string, token: string) {
  return request<ApiArchivedGame>(`/games/${gameId}`, { method: 'GET', token });
}
