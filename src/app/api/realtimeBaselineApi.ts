import { authenticatedFetch } from './authToken';

export interface ResetRealtimeBaselineResponse {
  ok: boolean;
  wellId: string;
  reset: boolean;
  status: string;
  resetAt: string;
}

export async function resetRealtimeBaseline(endpoint: string, wellId: string) {
  const response = await authenticatedFetch(
    `${endpoint}/wells/${encodeURIComponent(wellId)}/baseline/reset`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wcs-csrf': '1',
      },
    },
  );
  const data = await response.json().catch(() => ({})) as Partial<ResetRealtimeBaselineResponse> & { error?: string };
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data as ResetRealtimeBaselineResponse;
}
