export interface ApiAuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

async function request<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? 'Une erreur est survenue');
  }

  return (await response.json()) as T;
}

export function register(username: string, password: string) {
  return request<ApiAuthResponse>('/auth/register', { username, password });
}

export function login(username: string, password: string) {
  return request<ApiAuthResponse>('/auth/login', { username, password });
}
