export interface QueueAlertLike {
  wellId?: string;
  backendEventId: string;
  backendLevel: number;
  peakBackendLevel?: number;
}

export interface FrameQueueCandidate {
  eventId: string;
  candidateId?: number;
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
  const publicLevel = Math.max(0, Math.min(4, Math.round(Number(candidate.publicLevel) || 0)));
  if (!eventId || publicLevel < 2) return null;

  return {
    ...candidate,
    eventId,
    publicLevel,
    formalEvalLevel: Math.max(0, Math.min(4, Math.round(Number(candidate.formalEvalLevel) || publicLevel))),
    activeSignals: candidate.activeSignals.filter(Boolean),
  };
}
