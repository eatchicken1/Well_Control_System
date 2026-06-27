const ACCESS_TOKEN_KEY = 'wcs-access-token';
const REFRESH_TOKEN_KEY = 'wcs-refresh-token';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || '';
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || '';
}

export function setAuthTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function authHeaders(headers?: HeadersInit): HeadersInit {
  const token = getAccessToken();
  return {
    ...(headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function authenticatedFetch(url: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers: authHeaders(init?.headers),
  });
}

export function appendAccessToken(url: string) {
  const token = getAccessToken();
  if (!token) return url;
  const next = new URL(url, window.location.origin);
  next.searchParams.set('access_token', token);
  return next.toString();
}
