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
  return authenticatedFetchWithRefresh(url, init);
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!getRefreshToken()) return false;
  if (!refreshInFlight) {
    refreshInFlight = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-wcs-csrf': '1' },
      body: JSON.stringify({ refreshToken: getRefreshToken() }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.accessToken || !data.refreshToken) return false;
        setAuthTokens(String(data.accessToken), String(data.refreshToken));
        return true;
      })
      .catch(() => false)
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

/** Reads the access token for every attempt. A 401 is retried exactly once after refresh. */
export async function authenticatedFetchWithRefresh(url: string, init?: RequestInit) {
  const request = () => fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers: authHeaders(init?.headers),
  });
  let response = await request();
  if (response.status !== 401) return response;
  if (!await refreshAccessToken()) return response;
  response = await request();
  return response;
}

export async function refreshAccessTokenForReconnect() {
  return refreshAccessToken();
}

export async function unauthenticatedFetch(url: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers: init?.headers,
  });
}

export function appendAccessToken(url: string) {
  const token = getAccessToken();
  if (!token) return url;
  const next = new URL(url, window.location.origin);
  next.searchParams.set('access_token', token);
  return next.toString();
}
