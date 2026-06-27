import { authHeaders, clearAuthTokens, getRefreshToken, setAuthTokens } from './authToken';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-wcs-csrf': '1',
      ...authHeaders(init?.headers),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data as T;
}

export async function login(username: string, password: string) {
  const data = await apiJson<{ ok: boolean; user: AuthUser; accessToken: string; refreshToken: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setAuthTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function fetchMe() {
  const data = await apiJson<{ ok: boolean; user: AuthUser }>('/api/auth/me');
  return data.user;
}

export async function logout() {
  await apiJson('/api/auth/logout', { method: 'POST', body: '{}' });
  clearAuthTokens();
}

export async function changePassword(oldPassword: string, newPassword: string, confirmPassword: string) {
  await apiJson('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
  });
}

export async function refreshToken() {
  const data = await apiJson<{ ok: boolean; user: AuthUser; accessToken: string; refreshToken: string }>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: getRefreshToken() }),
  });
  setAuthTokens(data.accessToken, data.refreshToken);
  return data.user;
}
