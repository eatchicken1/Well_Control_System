import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, Clock3, Database, ListChecks, RefreshCw, ShieldCheck, X } from 'lucide-react';
import type { Alert, BackendLevel } from '../context/WellControlContext';
import { fetchEventExplanation } from '../api/eventExplanationApi';
import { fetchWarningEventDetail, type WarningEventReviewDetail } from '../api/warningsApi';
import { getEventExplanationCache, setEventExplanationCache } from '../lib/eventExplanationCache';
import { BACKEND_LEVEL_META } from '../lib/backendDetection';
import { operatorEventPresentation } from '../lib/operatorEventPresentation';
import type { EventExplanation, EventPhaseSegment, ParameterBehavior } from '../types/eventExplanation';

const PHASE_LABELS: Record<string, string> = {
  PreEventReference: '事件前参考',
  PreStopStableDrilling: '停泵前稳定钻进',
  PreStopStableCirculation: '停泵前稳定循环',
  PreStopDisturbedOperation: '停泵前扰动工况',
  PumpStoppingTransition: '停泵过渡',
  PostStopFlowCheck: '停泵后流动观察',
  ShutInObservation: '关井观察',
  RestartTransition: '开泵恢复过渡',
  PostRestartObservation: '开泵恢复观察',
  StableRecovery: '稳定恢复',
  UnknownOperation: '工况待确认',
};

const PUMP_LABELS: Record<string, string> = {
  Normal: '正常泵送',
  Stopping: '正在停泵',
  Stopped: '已停泵',
  CoolingOff: '已停泵',
  PostStopMonitoring: '已停泵',
  Restarting: '正在开泵',
};

const BEHAVIOR_LABELS: Record<string, string> = {
  Stable: '基本稳定',
  Elevated: '持续偏高',
  Reduced: '持续偏低',
  Rising: '呈上升趋势',
  Falling: '呈下降趋势',
  Adjusted: '存在调整',
  StepChange: '出现阶跃变化',
  Recovered: '按参考过程恢复',
  Missing: '数据缺失',
};

const RESOLUTION_LABELS: Record<string, string> = {
  active: '持续监测中',
  tracking: '持续跟踪中',
  confirmed: '风险已确认',
  recovering: '恢复观察中',
  resolved: '事件已解除',
  closed: '事件已结束',
  ended: '事件已结束',
  normal: '已恢复正常',
};

function phaseLabel(value: string) { return PHASE_LABELS[value] || '工况待确认'; }
function pumpLabel(value: string) { return PUMP_LABELS[value] || '泵状态待确认'; }
function behaviorLabel(value: string) { return BEHAVIOR_LABELS[value] || value || '变化待确认'; }
function resolutionLabel(value: string) { return RESOLUTION_LABELS[String(value || '').toLowerCase()] || '状态待确认'; }
function backendStateLabel(value: string) {
  const key = String(value || '').trim().toLowerCase();
  return ({ watch: '观察', open: '打开', active: '活动', hold: '保持', recovery: '恢复观察', recovering: '恢复观察', resolved: '已解除', closed: '已关闭', closedunresolved: '关闭但未解除', ended: '已结束' } as Record<string, string>)[key] || value || '状态更新';
}
function levelTone(level: number) {
  if (level >= 4) return 'border-red-300 dark:border-red-900/70';
  if (level >= 2) return 'border-amber-300 dark:border-amber-900/70';
  if (level === 1) return 'border-blue-300 dark:border-blue-900/70';
  return 'border-emerald-300 dark:border-emerald-900/70';
}
function numberText(value: number | null | undefined, unit = '') { return value == null || !Number.isFinite(value) ? '' : `${value.toFixed(2)}${unit ? ` ${unit}` : ''}`; }
function displayDateTime(value: string | null | undefined) {
  if (!value) return '';
  if (!value.includes('T')) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
}
function durationText(seconds: number | undefined) {
  const total = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(total / 60)}分${String(total % 60).padStart(2, '0')}秒`;
}
function eventIdFor(alert: Alert) { return String(alert.code || alert.backendEventId.split(':').slice(1, -1).join(':') || alert.backendEventId); }

function fallbackExplanation(alert: Alert): EventExplanation {
  const now = new Date().toISOString();
  const presentation = operatorEventPresentation({
    publicLevel: alert.backendLevel,
    eventTitle: alert.title,
    physicalDescription: alert.description,
    primaryParameter: alert.primaryParameter,
    activeSignals: alert.activeSignals,
  }, alert.backendLevel);
  const observed = presentation.abnormalParameters.length
    ? presentation.abnormalParameters.join('、')
    : '未提供具体异常信号';
  const summary = {
    currentConclusion: alert.description || `${observed}；后端事件详情暂未返回完整分析。`,
    currentPhaseSummary: `事件于${alert.date} ${alert.time}首次记录，当前泵状态：${pumpLabel(alert.pumpState)}。`,
    preStopSummary: null,
    pumpStopTransitionSummary: null,
    postStopSummary: null,
    shutInSummary: null,
    restartSummary: null,
    recoverySummary: null,
    supportingEvidence: presentation.abnormalParameters.map((parameter, index) => ({
      evidenceId: `alert-signal-${index}`,
      phaseId: 'alert-current',
      category: 'backend',
      fieldName: parameter,
      role: 'supporting',
      strength: 'observed',
      confidence: 1,
      observedFact: parameter,
      physicalMeaning: '来自后端事件投影的异常参数',
      supportsKick: true,
      supportsOperation: false,
      supportsSensorArtifact: false,
      limitation: '',
      startedAt: `${alert.date} ${alert.time}`,
      lastUpdatedAt: now,
    })),
    contradictingEvidence: [],
    alternativeExplanations: [],
    operatorChecks: ['核对异常信号对应的现场仪表与采集状态', '对照入口排量、出口流量和总池体积的同一时间点读数'],
    dataLimitations: ['后端分析明细尚未返回，当前只展示事件投影中的确定性字段'],
    changesSincePreviousRevision: [],
    currentPhase: 'UnknownOperation',
    resolutionState: alert.eventState || 'active',
    currentLevel: alert.backendLevel,
    highestLevel: alert.peakBackendLevel,
  };
  return {
    eventId: eventIdFor(alert), candidateId: 0, factRevision: 0, explanationRevision: 0,
    currentLevel: alert.backendLevel, highestLevel: alert.peakBackendLevel,
    eventStatus: alert.eventState || 'active', currentPhase: 'UnknownOperation',
    startedAt: `${alert.date} ${alert.time}`, updatedAt: now,
    deterministicSummary: summary, effectiveSummary: summary, explanationSource: 'deterministic',
    phases: [], parameterBehaviors: [], supportingEvidence: summary.supportingEvidence, contradictingEvidence: [],
    alternativeExplanations: summary.alternativeExplanations, operatorChecks: summary.operatorChecks,
    dataLimitations: summary.dataLimitations, changesSincePreviousRevision: [], materialFactHash: '',
    generatedAt: now, generatorVersion: 'deterministic-field-v1-fallback',
  };
}
function durationBetween(start: string | undefined, end: string | undefined) {
  if (!start || !end) return '';
  const left = Date.parse(start);
  const right = Date.parse(end);
  return Number.isFinite(left) && Number.isFinite(right) && right >= left
    ? durationText((right - left) / 1000)
    : '';
}

/**
 * The warning review endpoint is the authoritative persisted event projection.
 * Older deployments do not expose the optional explanation endpoint, so adapt
 * that response into the same drawer model instead of presenting a generic
 * "explanation failed" screen.
 */
function explanationFromWarningDetail(detail: WarningEventReviewDetail): EventExplanation {
  const event = detail.event;
  const frame = detail.latestFrame;
  const signals = Array.isArray(event.abnormalParameters) && event.abnormalParameters.length
    ? event.abnormalParameters
    : (event.activeSignals || []);
  const evidence = signals.map((signal, index) => ({
    evidenceId: `backend-signal-${index}`,
    phaseId: 'backend-latest',
    category: 'backend',
    fieldName: signal,
    role: 'supporting',
    strength: 'observed',
    confidence: 1,
    observedFact: signal,
    physicalMeaning: '后端事件投影记录的异常信号',
    supportsKick: true,
    supportsOperation: false,
    supportsSensorArtifact: false,
    limitation: '',
    startedAt: event.startTime,
    lastUpdatedAt: event.updatedAt || event.endTime || event.startTime,
  }));
  const latestText = frame
    ? `后端最新采样 ${displayDateTime(frame.sampleTime)}：入口流量 ${numberText(frame.inletFlow, 'm³/h')}，出口流量 ${numberText(frame.outletFlow, 'm³/h')}，总池体积 ${numberText(frame.pitVolume, 'm³')}，立压 ${numberText(frame.standpipePressure, 'MPa')}。`
    : '';
  const summary = {
    currentConclusion: event.physicalDescription || event.reason || '后端已记录该事件，当前以实时事件投影为准。',
    currentPhaseSummary: latestText || `后端记录 ${event.sampleCount} 个样本，事件状态为${event.status || '活动'}。`,
    preStopSummary: null,
    pumpStopTransitionSummary: null,
    postStopSummary: null,
    shutInSummary: null,
    restartSummary: null,
    recoverySummary: null,
    supportingEvidence: evidence,
    contradictingEvidence: [],
    alternativeExplanations: [],
    operatorChecks: event.needsManualReview ? ['核对异常信号对应的现场仪表与作业记录', '确认入口排量、出口流量和池体积变化是否一致'] : [],
    dataLimitations: [],
    changesSincePreviousRevision: detail.lifecycle.slice(-6).map((item) => `${displayDateTime(item.sampleTime)} · L${item.publicLevel} · ${backendStateLabel(item.eventState)}${item.reason ? ` · ${item.reason}` : ''}`),
    currentPhase: 'UnknownOperation',
    resolutionState: event.status || 'active',
    currentLevel: event.currentLevel,
    highestLevel: event.highestLevel,
  };
  return {
    eventId: event.eventId,
    candidateId: event.candidateId || 0,
    factRevision: 0,
    explanationRevision: 0,
    currentLevel: event.currentLevel,
    highestLevel: event.highestLevel,
    eventStatus: event.status || 'active',
    currentPhase: 'UnknownOperation',
    startedAt: event.startTime,
    updatedAt: event.updatedAt || event.endTime || event.startTime,
    deterministicSummary: summary,
    effectiveSummary: summary,
    explanationSource: 'backend-event-projection',
    phases: [],
    parameterBehaviors: [],
    supportingEvidence: evidence,
    contradictingEvidence: [],
    alternativeExplanations: summary.alternativeExplanations,
    operatorChecks: summary.operatorChecks,
    dataLimitations: summary.dataLimitations,
    changesSincePreviousRevision: [],
    materialFactHash: '',
    generatedAt: event.updatedAt || event.startTime,
    generatorVersion: 'backend-event-projection-v1',
    latestFrame: frame ? {
      sampleTime: frame.sampleTime,
      publicLevel: frame.publicLevel,
      formalEvalLevel: frame.formalEvalLevel,
      eventState: frame.eventState,
      inletFlow: frame.inletFlow,
      outletFlow: frame.outletFlow,
      pitVolume: frame.pitVolume,
      standpipePressure: frame.standpipePressure,
      casingPressure: frame.casingPressure,
      bitDepth: frame.bitDepth,
      wellDepth: frame.wellDepth,
    } : undefined,
    trend: detail.trend,
  };
}

function LocalTrendChart({ points, field, label, unit, color }: { points: NonNullable<EventExplanation['trend']>; field: 'inletFlow' | 'outletFlow' | 'pitVolume' | 'standpipePressure' | 'casingPressure'; label: string; unit: string; color: string }) {
  const values = points.map((point) => point[field]).filter((value): value is number => value != null && Number.isFinite(value));
  if (values.length < 2) return null;
  const min = Math.min(...values); const max = Math.max(...values); const range = max - min || Math.max(1, Math.abs(max) * 0.05);
  const coords = points.map((point, index) => { const value = point[field]; if (value == null || !Number.isFinite(value)) return null; const x = (index / Math.max(1, points.length - 1)) * 100; const y = 38 - ((value - min) / range) * 30; return `${x.toFixed(2)},${y.toFixed(2)}`; }).filter(Boolean).join(' ');
  return <div className="rounded-md border border-slate-100 bg-slate-50/70 p-2.5"><div className="flex items-center justify-between text-[11px]"><span className="font-medium text-slate-700">{label}</span><span className="font-mono text-slate-500">{values.at(-1)?.toFixed(2)} {unit}</span></div><svg className="mt-2 h-12 w-full" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={`${label}局部趋势`}><path d="M 0 38 H 100" stroke="#e2e8f0" strokeWidth=".6" fill="none" /><polyline points={coords} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg><div className="flex justify-between text-[10px] text-slate-400"><span>{displayDateTime(points[0]?.sampleTime)}</span><span>{displayDateTime(points.at(-1)?.sampleTime)}</span></div></div>;
}

function PhaseTimeline({ phase, active, onSelect }: { phase: EventPhaseSegment; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={`w-full rounded-lg border p-3 text-left transition ${active ? 'border-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/30' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-900 dark:text-slate-100">{phaseLabel(phase.phaseType)}</span>
        <span className="text-[11px] ops-muted">{durationText((new Date(phase.endedAt || phase.startedAt).getTime() - new Date(phase.startedAt).getTime()) / 1000)}</span>
      </div>
      <div className="mt-1 break-words text-xs ops-muted">{displayDateTime(phase.startedAt)} {phase.endedAt ? `至 ${displayDateTime(phase.endedAt)}` : '· 当前阶段'} · {pumpLabel(phase.pumpState)}</div>
      <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">{phase.startReason || '按当前事实绑定工况'}</div>
    </button>
  );
}

function ParameterCard({ behavior }: { behavior: ParameterBehavior }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{behavior.fieldName}</div>
          <div className="mt-0.5 text-[11px] ops-muted">{behavior.category} · {behavior.semanticType || '语义待确认'}</div>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] dark:bg-slate-800">{behaviorLabel(behavior.behaviorType)}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div><span className="ops-muted">参考对象</span><div className="mt-0.5">{behavior.referenceType || '参考不可用'}</div></div>
        <div><span className="ops-muted">参考偏差</span><div className="mt-0.5">{numberText(behavior.residualFromReference, behavior.unit)}</div></div>
        <div><span className="ops-muted">阶段变化</span><div className="mt-0.5">{numberText(behavior.absoluteChange, behavior.unit)}</div></div>
        <div><span className="ops-muted">持续时间</span><div className="mt-0.5">{durationText(behavior.continuousDeviationSeconds)}</div></div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{behavior.interpretation || '本阶段暂无可用解释。'}</p>
      <details className="mt-2 text-xs ops-muted">
        <summary className="flex cursor-pointer items-center gap-1"><ChevronDown className="h-3 w-3" />展开原始统计（仅本工况段）</summary>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded bg-slate-50 p-2 dark:bg-slate-900">
          <span>开始 {numberText(behavior.startValue, behavior.unit)}</span><span>结束 {numberText(behavior.endValue, behavior.unit)}</span>
          <span>稳健中位数 {numberText(behavior.medianValue, behavior.unit)}</span><span>稳健范围 {numberText(behavior.robustMin, behavior.unit)}–{numberText(behavior.robustMax, behavior.unit)}</span>
        </div>
      </details>
    </div>
  );
}

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  if (!value || value === '不可用') return null;
  return <div className="min-w-0 bg-white px-3 py-3 dark:bg-slate-900"><div className="truncate text-[11px] text-slate-500 dark:text-slate-400">{label}</div><div className={`mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white ${mono ? 'font-mono text-xs' : ''}`}>{value}</div></div>;
}

export function EventExplanationDrawer({ alert, wellKey, endpoint, onClose }: { alert: Alert; wellKey: string; endpoint: string; onClose: () => void }) {
  const eventId = eventIdFor(alert);
  const [explanation, setExplanation] = useState<EventExplanation>(() => getEventExplanationCache(eventId)?.explanation || fallbackExplanation(alert));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPhaseId, setSelectedPhaseId] = useState('');

  const load = async (force = false) => {
    const cached = getEventExplanationCache(eventId);
    if (!force && cached?.explanation) { setExplanation(cached.explanation); return; }
    setLoading(true); setError('');
    setEventExplanationCache(eventId, { ...cached, explanationRevision: cached?.explanationRevision || 0, factRevision: cached?.factRevision || 0, loadedAt: cached?.loadedAt || '', status: 'loading' });
    try {
      let next: EventExplanation;
      try {
        next = await fetchEventExplanation(endpoint, wellKey, eventId);
      } catch {
        // The persisted warning projection exists on every backend version;
        // use it when the optional narrative service is unavailable.
        const detail = await fetchWarningEventDetail(eventId, undefined, endpoint);
        next = explanationFromWarningDetail(detail);
      }
      // Stored explanation revisions may retain a legacy frame event id.  The drawer is
      // opened with the canonical lifecycle event id, so keep that identity in the UI/cache.
      const canonical = { ...next, eventId };
      setExplanation(canonical);
      setEventExplanationCache(eventId, { explanation: canonical, explanationRevision: canonical.explanationRevision, factRevision: canonical.factRevision, loadedAt: new Date().toISOString(), status: canonical.generatorVersion.includes('fallback') ? 'fallback' : 'loaded' });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '后端事件详情暂不可用');
      setExplanation(fallbackExplanation(alert));
      setEventExplanationCache(eventId, { explanation: fallbackExplanation(alert), explanationRevision: 0, factRevision: 0, loadedAt: new Date().toISOString(), status: 'fallback' });
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [eventId, endpoint, wellKey]);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
      const incoming = String(detail.event_id || detail.eventId || '');
      if (incoming === eventId) void load(true);
    };
    window.addEventListener('wcs:event-explanation', handler);
    return () => window.removeEventListener('wcs:event-explanation', handler);
  }, [eventId, endpoint, wellKey]);

  const phases = explanation.phases || [];
  const selectedPhase = useMemo(() => phases.find((phase) => phase.phaseId === selectedPhaseId) || phases.find((phase) => phase.isActive) || phases.at(-1), [phases, selectedPhaseId]);
  const behaviors = selectedPhase?.parameterBehaviors?.length ? selectedPhase.parameterBehaviors : explanation.parameterBehaviors.filter((item) => item.phaseId === selectedPhase?.phaseId);
  const summary = explanation.effectiveSummary || explanation.deterministicSummary;
  const currentLevel = Math.max(0, Math.min(4, Number(explanation.currentLevel ?? alert.backendLevel)));
  const highestLevel = Math.max(currentLevel, Math.min(4, Number(explanation.highestLevel ?? alert.peakBackendLevel)));
  const levelMeta = BACKEND_LEVEL_META[currentLevel as BackendLevel];
  const resolution = resolutionLabel(summary.resolutionState || explanation.eventStatus);
  const supportingEvidence = explanation.supportingEvidence?.length ? explanation.supportingEvidence : summary.supportingEvidence || [];
  const contradictingEvidence = explanation.contradictingEvidence?.length ? explanation.contradictingEvidence : summary.contradictingEvidence || [];
  const operatorChecks = summary.operatorChecks?.filter((item) => item && !/待确认|不可用|继续按现场处置流程跟踪/.test(item)) || [];
  const reviewItems = [...(summary.alternativeExplanations || []), ...(summary.dataLimitations || [])]
    .filter((item) => item && !/待确认|不可用|暂未|继续按现场处置流程跟踪/.test(item));
  const presentation = operatorEventPresentation({
    publicLevel: currentLevel,
    eventTitle: alert.title,
    physicalDescription: alert.description,
    primaryParameter: alert.primaryParameter,
    activeSignals: alert.activeSignals,
  }, currentLevel);
  const operatorTitle = presentation.title;
  const physicalDescription = [presentation.description, summary.currentPhaseSummary, summary.currentConclusion]
    .map((value) => String(value || '').trim())
    .find((value) => value && !/待确认|不可用|暂未|请查看详情|继续等待连续观测/.test(value)) || '';
  const latestFrame = explanation.latestFrame;
  const trend = explanation.trend || [];

  // Render through a portal on document.body: this drawer is opened from
  // deeply nested side panels whose ancestors carry overflow/transform
  // rules. Without the portal, position:fixed collapses into that ancestor
  // and the briefing card gets squeezed into the corner instead of opening
  // as a full-screen sheet.
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45" onClick={onClose}>
      <aside className="h-full w-full max-w-[1120px] overflow-hidden bg-[#f7f8fa] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="event-explanation-title" onClick={(event) => event.stopPropagation()}>
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3 text-slate-900 sm:px-7">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="font-semibold text-slate-900">{alert.wellName || wellKey}</span><span>·</span><span>事件详情</span><span className={`rounded px-2 py-0.5 text-[11px] font-bold ${currentLevel >= 4 ? 'bg-red-100 text-red-700' : currentLevel >= 2 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>L{currentLevel}</span><span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">{resolution}</span></div>
              <h2 id="event-explanation-title" className="mt-1 break-words text-lg font-semibold text-slate-950 sm:text-xl">
                {operatorTitle.replace(/^L[0-4]：\s*/, '')}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                <span>事件编号 {eventId}</span><span>开始 {displayDateTime(explanation.startedAt || `${alert.date} ${alert.time}`)}</span>{explanation.updatedAt && <span>更新时间 {displayDateTime(explanation.updatedAt)}</span>}{alert.pumpState && alert.pumpState !== 'Unknown' && <span>工况 {pumpLabel(alert.pumpState)}</span>}
              </div>
            </div>
            <button type="button" className="ops-button-secondary shrink-0 px-2 py-1" onClick={onClose} title="关闭事件详情" aria-label="关闭事件详情"><X className="h-4 w-4" /></button>
          </header>
          <nav className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-5 py-2 text-xs dark:border-slate-800 dark:bg-slate-900 sm:px-7" aria-label="事件详情分区">
            <a className="rounded-md bg-cyan-50 px-3 py-1.5 font-semibold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300" href="#event-overview">事件概览</a>
            <a className="rounded-md px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" href="#event-evidence">证据链</a>
            <a className="rounded-md px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" href="#event-parameters">参数快照</a>
            <a className="rounded-md px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" href="#event-actions">处置建议</a>
          </nav>
          <div className="ops-scroll flex-1 space-y-4 overflow-y-auto bg-[#f5f7fa] p-4 sm:p-6">
            {loading && <div className="flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/20 dark:text-cyan-200"><RefreshCw className="h-3.5 w-3.5 animate-spin" />正在更新现场判断…</div>}

            <section id="event-overview" className={`grid items-stretch gap-4 ${operatorChecks.length ? 'lg:grid-cols-[minmax(0,1fr)_280px]' : ''}`}>
              <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Activity className="h-4 w-4 text-cyan-600" />事件概览</div>
                  <div className="flex items-center gap-2"><span className={`rounded-md px-2.5 py-1 text-xs font-bold ${currentLevel >= 4 ? 'bg-red-100 text-red-800' : currentLevel >= 2 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>L{currentLevel}</span>{highestLevel > currentLevel && <span className="text-xs ops-muted">峰值 L{highestLevel}</span>}</div>
                </div>
                <h3 className="mt-4 break-words text-[22px] font-semibold leading-tight tracking-tight text-slate-950 dark:text-white">{operatorTitle.replace(/^L[0-4]：\s*/, '')}</h3>
                <p className="mt-3 max-w-3xl break-words text-sm leading-6 text-slate-600 dark:text-slate-300">{physicalDescription}</p>
                {latestFrame && <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-700 sm:grid-cols-4">
                  <Metric label="最新样本" value={displayDateTime(latestFrame.sampleTime)} mono />
                  <Metric label="入口流量" value={numberText(latestFrame.inletFlow, 'm³/h')} />
                  <Metric label="出口流量" value={numberText(latestFrame.outletFlow, 'm³/h')} />
                  <Metric label="总池体积" value={numberText(latestFrame.pitVolume, 'm³')} />
                </div>}
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-700"><span className="text-slate-500">状态 <strong className="ml-1 text-slate-800 dark:text-slate-100">{resolution}</strong></span>{alert.pumpState && alert.pumpState !== 'Unknown' && <span className="text-slate-500">泵况 <strong className="ml-1 text-slate-800 dark:text-slate-100">{pumpLabel(alert.pumpState)}</strong></span>}<span className="text-slate-500">处置 <strong className="ml-1 text-slate-800 dark:text-slate-100">{levelMeta.action}</strong></span></div>
              </div>

              {operatorChecks.length > 0 && <div id="event-actions" className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-none">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ListChecks className="h-4 w-4 text-cyan-600" />处置建议</div>
                <ol className="mt-4 space-y-3">
                  {operatorChecks.slice(0, 4).map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-xs leading-5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-[10px] font-bold text-cyan-700">{index + 1}</span><span className="min-w-0 break-words text-slate-700">{item}</span></li>)}
                </ol>
              </div>}
            </section>

            {latestFrame && [latestFrame.inletFlow, latestFrame.outletFlow, latestFrame.pitVolume, latestFrame.standpipePressure, latestFrame.casingPressure, latestFrame.wellDepth].some((value) => value != null && Number.isFinite(value)) && <section id="event-parameters" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">实时数据</div><h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">关键参数快照</h3></div><span className="text-xs text-slate-500 dark:text-slate-400">采样 {displayDateTime(latestFrame.sampleTime)}</span></div>
              <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-700 sm:grid-cols-3 lg:grid-cols-6">
                {latestFrame.inletFlow != null && <Metric label="入口流量" value={numberText(latestFrame.inletFlow, 'm³/h')} />}
                {latestFrame.outletFlow != null && <Metric label="出口流量" value={numberText(latestFrame.outletFlow, 'm³/h')} />}
                {latestFrame.pitVolume != null && <Metric label="总池体积" value={numberText(latestFrame.pitVolume, 'm³')} />}
                {latestFrame.standpipePressure != null && <Metric label="立压" value={numberText(latestFrame.standpipePressure, 'MPa')} />}
                {latestFrame.casingPressure != null && <Metric label="套压" value={numberText(latestFrame.casingPressure, 'MPa')} />}
                {latestFrame.wellDepth != null && <Metric label="井深" value={numberText(latestFrame.wellDepth, 'm')} />}
              </div>
            </section>}

            {trend.length > 1 && <section className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">参数局部曲线</h3><span className="text-[11px] text-slate-500">事件时间窗 · {trend.length} 个样本</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3"><LocalTrendChart points={trend} field="inletFlow" label="入口流量" unit="m³/h" color="#0891b2" /><LocalTrendChart points={trend} field="outletFlow" label="出口流量" unit="m³/h" color="#2563eb" /><LocalTrendChart points={trend} field="pitVolume" label="总池体积" unit="m³" color="#d97706" /><LocalTrendChart points={trend} field="standpipePressure" label="立压" unit="MPa" color="#7c3aed" /><LocalTrendChart points={trend} field="casingPressure" label="套压" unit="MPa" color="#059669" /></div></section>}

            {(supportingEvidence.length > 0 || contradictingEvidence.length > 0 || reviewItems.length > 0) && <section id="event-evidence" className="grid items-start gap-3 lg:grid-cols-2">
              <EvidenceDigest items={supportingEvidence} />
              <ReviewDigest evidence={contradictingEvidence} items={reviewItems} />
            </section>}

            {phases.length > 0 && <details className="group rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                <span className="flex min-w-0 items-center gap-2"><Clock3 className="h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-300" />查看工况过程与参数</span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-normal ops-muted">共 {phases.length} 个阶段<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></span>
              </summary>
              <div className="space-y-4 border-t border-slate-200 p-4 dark:border-slate-800">
                <section>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-900 dark:text-slate-100">工况时间线</h3><span className="text-xs ops-muted">点击阶段查看对应参数</span></div>
                  <div className="grid gap-2 md:grid-cols-2">{phases.length ? phases.map((phase) => <PhaseTimeline key={phase.phaseId} phase={phase} active={selectedPhase?.phaseId === phase.phaseId} onSelect={() => setSelectedPhaseId(phase.phaseId)} />) : <div className="text-sm ops-muted">尚未形成可展示的阶段分段。</div>}</div>
                </section>
                {selectedPhase && <section><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-900 dark:text-slate-100">阶段参数 · {phaseLabel(selectedPhase.phaseType)}</h3><span className="text-xs ops-muted">{selectedPhase.dataQualityLevel || '数据质量待确认'}</span></div><div className="grid gap-3 md:grid-cols-2">{behaviors.length ? behaviors.map((behavior) => <ParameterCard key={`${behavior.phaseId}:${behavior.signalCode}`} behavior={behavior} />) : <div className="text-sm ops-muted">本阶段暂无有效参数行为。</div>}</div></section>}
                <section className="grid gap-3 lg:grid-cols-2">
                  <NarrativeBlock title="停泵前" text={summary.preStopSummary} />
                  <NarrativeBlock title="停泵过程" text={summary.pumpStopTransitionSummary} />
                  <NarrativeBlock title="停泵后" text={summary.postStopSummary} />
                  <NarrativeBlock title="关井与恢复" text={[summary.shutInSummary, summary.restartSummary, summary.recoverySummary].filter(Boolean).join(' ') || null} />
                </section>
              </div>
            </details>}

          </div>
          <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5 text-xs ops-muted sm:px-5 dark:border-slate-800 dark:bg-slate-900"><span className="min-w-0 break-words"><Clock3 className="mr-1 inline h-3.5 w-3.5" />更新于 {displayDateTime(getEventExplanationCache(eventId)?.loadedAt || explanation.updatedAt)}</span><button type="button" className="ops-button-secondary shrink-0 px-2.5 py-1.5" onClick={() => void load(true)} disabled={loading}><RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{loading ? '刷新中' : '刷新'}</button></footer>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function NarrativeBlock({ title, text }: { title: string; text?: string | null }) { return text ? <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"><h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3><p className="mt-2 break-words text-sm leading-6 text-slate-700 dark:text-slate-200">{text}</p></div> : null; }
function ListBlock({ title, items }: { title?: string; items: string[] }) { return <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">{title && <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>}<ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{items.length ? items.map((item, index) => <li key={`${item}-${index}`} className="flex min-w-0 gap-2"><span className="text-cyan-600">•</span><span className="min-w-0 break-words">{item}</span></li>) : <li className="ops-muted">暂无记录</li>}</ul></div>; }
function EvidenceDigest({ items }: { items: EventExplanation['supportingEvidence'] }) {
  if (!items.length) return null;
  return (
    <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />判定依据与变化过程</div>
      <div className="mt-3 space-y-2.5">
        {items.length ? items.slice(0, 3).map((item) => (
          <div key={item.evidenceId} className="min-w-0 rounded-lg bg-white/75 px-3 py-2.5 dark:bg-slate-900/60">
            <div className="break-words text-sm font-medium text-slate-900 dark:text-slate-100">{item.observedFact}</div>
            {item.physicalMeaning && <div className="mt-1 break-words text-xs leading-5 ops-muted">{item.physicalMeaning}</div>}
          </div>
        )) : <div className="text-sm ops-muted">当前尚未形成可展示的支持证据，系统继续等待连续观测并建议现场复核。</div>}
      </div>
      {items.length > 3 && <div className="mt-3 text-xs ops-muted">另有 {items.length - 3} 条证据，见“完整复核信息”。</div>}
    </div>
  );
}

function ReviewDigest({ evidence, items }: { evidence: EventExplanation['contradictingEvidence']; items: string[] }) {
  const visibleItems = [
    ...evidence.slice(0, 2).map((item) => item.observedFact || item.physicalMeaning),
    ...items,
  ].filter(Boolean).slice(0, 4);
  if (!visibleItems.length) return null;
  return (
    <div className="min-w-0 rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />复核提示</div>
      <ul className="mt-3 space-y-2.5 text-sm leading-6 text-slate-700 dark:text-slate-200">
        {visibleItems.length ? visibleItems.map((item, index) => <li key={`${item}-${index}`} className="flex min-w-0 gap-2"><span className="text-amber-600">•</span><span className="min-w-0 break-words">{item}</span></li>) : <li className="ops-muted">当前没有额外限制，继续按现场处置流程跟踪。</li>}
      </ul>
    </div>
  );
}

function EvidenceList({ title, items, tone }: { title: string; items: EventExplanation['supportingEvidence']; tone: 'support' | 'limit' }) { return <div className={`min-w-0 rounded-xl border p-4 ${tone === 'support' ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20' : 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20'}`}><h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3><div className="mt-2 space-y-3">{items.length ? items.map((item) => <div key={item.evidenceId} className="min-w-0 rounded-lg bg-white/70 p-3 text-sm dark:bg-slate-900/60"><div className="break-words font-medium">{item.observedFact}</div><div className="mt-1 break-words text-xs leading-5 ops-muted">现场意义：{item.physicalMeaning || '待结合工况确认'}</div><div className="mt-1 text-xs ops-muted">证据可靠度 {(item.confidence * 100).toFixed(0)}%</div></div>) : <div className="text-sm ops-muted">暂无成熟证据。</div>}</div></div>; }
