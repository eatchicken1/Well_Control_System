export interface QueueAlertLike {
  wellId?: string;
  backendEventId: string;
  backendLevel: number;
  peakBackendLevel?: number;
}

export interface FrameQueueCandidate {
  eventId: string;
  candidateId?: number;
  advisoryLevel?: number;
  publicLevel: number;
  formalEvalLevel: number;
  reason: string;
  activeSignals: string[];
  eventState: string;
  pumpState: string;
  timestamp: string;
  startTime?: string;
  endTime?: string;
  sampleCount?: number;
}

function queueLevel(alert: QueueAlertLike) {
  return Math.max(Number(alert.backendLevel) || 0, Number(alert.peakBackendLevel ?? alert.backendLevel) || 0);
}

export function mergeQueueAlertSnapshot<T extends QueueAlertLike>(
  current: T[],
  refreshed: T[],
  wellId: string,
  limit = 120,
) {
  const refreshedIds = new Set(refreshed.map((alert) => alert.backendEventId));
  const localQueueAlerts = current.filter((alert) => {
    return alert.wellId === wellId
      && queueLevel(alert) >= 2
      && !refreshedIds.has(alert.backendEventId);
  });
  const alertsForOtherWells = current.filter((alert) => alert.wellId !== wellId);
  return [
    ...refreshed,
    ...localQueueAlerts,
    ...alertsForOtherWells,
  ].slice(0, limit);
}

export function fallbackQueueCandidateFromFrame(candidate: FrameQueueCandidate): FrameQueueCandidate | null {
  const eventId = String(candidate.eventId || '').trim();
  const advisoryLevel = Math.max(0, Math.min(4, Math.round(Number(candidate.advisoryLevel ?? candidate.publicLevel) || 0)));
  const normalizedState = String(candidate.eventState || '').trim().toLowerCase().replace(/[-\s]/g, '_');
  const terminal = normalizedState === 'resolved'
    || normalizedState === 'closedunresolved'
    || normalizedState === 'closed_unresolved';
  const lifecycleUpdate = ['watch', 'open', 'hold', 'recovery', 'recovering', 'resolved', 'closedunresolved', 'closed_unresolved'].includes(normalizedState);
  // Live SSE carries a raw frame rather than log_entries.  Keep any frame
  // with a canonical event id when it represents lifecycle state, including
  // L0 Recovery/Resolved updates; only ordinary L0 frames are ignored.
  if (!eventId || (advisoryLevel < 2 && !terminal && !lifecycleUpdate)) return null;

  return {
    ...candidate,
    eventId,
    advisoryLevel,
    publicLevel: Math.max(0, Math.min(4, Math.round(Number(candidate.publicLevel) || 0))),
    formalEvalLevel: Math.max(0, Math.min(4, Math.round(Number(candidate.formalEvalLevel) || advisoryLevel))),
    activeSignals: candidate.activeSignals.filter(Boolean),
  };
}
