import { authenticatedFetch } from './authToken';
import type { EventExplanation, EventPhaseSegment } from '../types/eventExplanation';

function apiUrl(endpoint: string, path: string) {
  const base = endpoint.replace(/\/+$/, '');
  return new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`, window.location.origin).toString();
}

async function getJson<T>(endpoint: string, path: string, signal?: AbortSignal) {
  const response = await authenticatedFetch(apiUrl(endpoint, path), { cache: 'no-store', signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error || payload?.message || `HTTP ${response.status}`));
  return payload as T;
}

export function eventExplanationId(eventId: string) {
  return eventId.trim();
}

export async function fetchEventExplanation(endpoint: string, wellKey: string, eventId: string, signal?: AbortSignal) {
  return getJson<EventExplanation>(
    endpoint,
    `/wells/${encodeURIComponent(wellKey)}/events/${encodeURIComponent(eventExplanationId(eventId))}/explanation`,
    signal,
  );
}

export async function fetchEventExplanationRevisions(endpoint: string, wellKey: string, eventId: string, signal?: AbortSignal) {
  const payload = await getJson<{ revisions?: EventExplanation[] }>(
    endpoint,
    `/wells/${encodeURIComponent(wellKey)}/events/${encodeURIComponent(eventExplanationId(eventId))}/explanation/revisions`,
    signal,
  );
  return Array.isArray(payload.revisions) ? payload.revisions : [];
}

export async function fetchEventPhases(endpoint: string, wellKey: string, eventId: string, signal?: AbortSignal) {
  const payload = await getJson<{ phases?: EventPhaseSegment[] }>(
    endpoint,
    `/wells/${encodeURIComponent(wellKey)}/events/${encodeURIComponent(eventExplanationId(eventId))}/phases`,
    signal,
  );
  return Array.isArray(payload.phases) ? payload.phases : [];
}
