import type { EventProjectionState, EventSpan, HypothesisCycleState, LifecycleNode } from '../context/WellControlContext';

const BOUNDARY_EVENTS = new Set(['ReferenceQuarantined', 'ReplayAsBenign', 'Reanchor', 'IntegralCutoff', 'PumpStop', 'PumpRestart', 'SurfaceOperation', 'DataGap', 'HardReset']);

function shortTime(value: string) {
  const match = value.match(/(\d{2}:\d{2})(?::\d{2})?/);
  return match?.[1] || '--:--';
}

function spanTone(level: number, status: string) {
  if (status.toLowerCase() === 'recovering') return 'is-recovering';
  if (level >= 4) return 'is-critical';
  if (level >= 2) return 'is-warning';
  return 'is-watch';
}

export function EventProjectionLanes({ eventSpans, lifecycleNodes, hypothesisState, projectionState }: {
  eventSpans: EventSpan[];
  lifecycleNodes: LifecycleNode[];
  hypothesisState: HypothesisCycleState;
  projectionState: EventProjectionState;
}) {
  const hypothesisNodes = lifecycleNodes.filter((node) => !BOUNDARY_EVENTS.has(node.eventName));
  const boundaryNodes = lifecycleNodes.filter((node) => BOUNDARY_EVENTS.has(node.eventName));
  return (
    <section className="event-projection-lanes" aria-label="服务端事件投影泳道">
      <div className="event-projection-head">
        <strong>事件投影</strong>
        <span data-status={projectionState.status}>{projectionState.message}</span>
      </div>
      <div className="event-projection-row">
        <b>公开报警</b>
        <div>
          {eventSpans.length > 0 ? eventSpans.slice(-6).map((span) => (
            <span key={span.eventId} className={spanTone(span.highestLevel, span.lifecycleStatus)} title={`${span.eventId} · ${span.resolution || span.lifecycleStatus}`}>
              L{span.highestLevel} {shortTime(span.startTime)}–{span.endTime ? shortTime(span.endTime) : '进行中'}
            </span>
          )) : <em>暂无服务端 EventSpan</em>}
        </div>
      </div>
      <div className="event-projection-row">
        <b>跨周期假设</b>
        <div>
          <span className="is-hypothesis">{hypothesisState === 'Unknown' ? '后端未提供' : hypothesisState}</span>
          {hypothesisNodes.slice(-4).map((node) => <span key={`${node.eventId}-${node.timestamp}-${node.eventName}`}>{node.eventName} · {shortTime(node.timestamp)}</span>)}
        </div>
      </div>
      <div className="event-projection-row">
        <b>参考 / 边界</b>
        <div>{boundaryNodes.length > 0 ? boundaryNodes.slice(-5).map((node) => <span key={`${node.eventId}-${node.timestamp}-${node.eventName}`}>{node.eventName} · {shortTime(node.timestamp)}</span>) : <em>暂无参考隔离或作业边界事件</em>}</div>
      </div>
    </section>
  );
}