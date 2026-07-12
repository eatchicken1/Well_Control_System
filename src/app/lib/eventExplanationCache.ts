import type { EventExplanationCacheEntry } from '../types/eventExplanation';

const cache: Record<string, EventExplanationCacheEntry> = {};
const MAX_CACHE_ENTRIES = 128;

export function getEventExplanationCache(eventId: string) {
  return cache[eventId];
}

export function setEventExplanationCache(eventId: string, entry: EventExplanationCacheEntry) {
  cache[eventId] = entry;
  const keys = Object.keys(cache);
  if (keys.length > MAX_CACHE_ENTRIES) {
    const oldest = keys
      .filter((key) => key !== eventId)
      .sort((a, b) => (cache[a].loadedAt || '').localeCompare(cache[b].loadedAt || ''))[0];
    if (oldest) delete cache[oldest];
  }
  return entry;
}

export function markEventExplanationRevision(value: Record<string, unknown>) {
  const eventId = String(value.event_id || value.eventId || '').trim();
  if (!eventId) return;
  const nextRevision = Math.max(0, Number(value.explanation_revision ?? value.explanationRevision) || 0);
  const nextFactRevision = Math.max(0, Number(value.fact_revision ?? value.factRevision) || 0);
  const previous = cache[eventId];
  if (previous && previous.explanationRevision >= nextRevision && previous.factRevision >= nextFactRevision) return;
  setEventExplanationCache(eventId, {
    explanation: previous?.explanation,
    explanationRevision: nextRevision,
    factRevision: nextFactRevision,
    loadedAt: previous?.loadedAt || '',
    status: previous?.explanation ? 'loaded' : 'idle',
  });
}
