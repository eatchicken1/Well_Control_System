/**
 * The stream endpoint has two distinct contracts. Keep the wire value in one
 * place so a realtime attachment never relies on the server's default mode.
 */
export type RealtimeStreamMode = 'realtime' | 'historyReplay';

export function withMonitoringModeQuery(url: URL, mode: RealtimeStreamMode): URL {
  const next = new URL(url.toString());
  next.searchParams.set('monitoringMode', mode === 'historyReplay' ? 'history_replay' : 'realtime');
  return next;
}
