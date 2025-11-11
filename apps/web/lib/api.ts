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
