import { authHeaders } from './authToken';

export interface WarningEventReviewItem {
  warningId: number;
  warningCode: string;
  sessionId: number;
  wellId: number;
  wellKey: string;
  wellName: string;
  sessionCode: string;
  startTime: string;
  endTime: string;
  highestLevel: number;
  currentLevel: number;
  status: string;
  primarySignal: string;
  activeSignals: string[];
  reason: string;
  sampleCount: number;
  isAcknowledged: boolean;
  acknowledgedBy: string;
  acknowledgedAt: string;
  acknowledgementCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WarningEventReviewSummary {
  ok: boolean;
  total: number;
  active: number;
  ended: number;
  acknowledged: number;
  unacknowledged: number;
  l2: number;
  l3: number;
  l4: number;
}

export interface WarningEventReviewPage {
  ok: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  events: WarningEventReviewItem[];
  summary: WarningEventReviewSummary;
}

export interface WarningEventQuery {
  wellId?: string;
  status?: 'active' | 'ended' | 'acknowledged' | 'unacknowledged';
  level?: number;
  includeAcknowledged?: boolean;
  page?: number;
  pageSize?: number;
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init?.method && init.method !== 'GET' ? { 'content-type': 'application/json', 'x-wcs-csrf': '1' } : {}),
      ...authHeaders(init?.headers),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || data.message || `HTTP ${response.status}`);
  }
  return data as T;
}

export function buildWarningEventsUrl(query: WarningEventQuery = {}) {
  const params = new URLSearchParams();
  if (query.wellId) params.set('wellId', query.wellId);
  if (query.status) params.set('status', query.status);
  if (query.level !== undefined) params.set('level', String(query.level));
  if (query.includeAcknowledged !== undefined) params.set('includeAcknowledged', String(query.includeAcknowledged));
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  const suffix = params.toString();
  return `/api/warnings/events${suffix ? `?${suffix}` : ''}`;
}

export async function fetchWarningEvents(query: WarningEventQuery = {}, signal?: AbortSignal) {
  return apiJson<WarningEventReviewPage>(buildWarningEventsUrl(query), { cache: 'no-store', signal });
}

export async function acknowledgeWarningEvent(warningId: number, comment?: string) {
  return apiJson<{ ok: boolean; warningId: number; acknowledged: boolean; message: string }>(
    `/api/warnings/events/${encodeURIComponent(String(warningId))}/acknowledge`,
    {
      method: 'POST',
      body: JSON.stringify({ action: 'acknowledge', comment: comment || '' }),
    },
  );
}

export async function acknowledgeWarningEvents(query: WarningEventQuery = {}, comment?: string) {
  return apiJson<{ ok: boolean; requested: number; acknowledged: number; message: string }>(
    '/api/warnings/events/acknowledge-all',
    {
      method: 'POST',
      body: JSON.stringify({
        wellId: query.wellId,
        level: query.level,
        status: query.status,
        comment: comment || '',
      }),
    },
  );
}
