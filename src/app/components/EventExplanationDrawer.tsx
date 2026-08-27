import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, Clock3, Database, ListChecks, RefreshCw, ShieldCheck, X } from 'lucide-react';
import type { Alert, BackendLevel } from '../context/WellControlContext';
import { fetchEventExplanation } from '../api/eventExplanationApi';
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
function levelTone(level: number) {
  if (level >= 4) return 'border-red-300 bg-red-50 text-red-900 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100';
  if (level >= 2) return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100';
  if (level === 1) return 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-100';
  return 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/25 dark:text-emerald-100';
}
function numberText(value: number | null | undefined, unit = '') { return value == null || !Number.isFinite(value) ? '不可用' : `${value.toFixed(2)}${unit ? ` ${unit}` : ''}`; }
function displayDateTime(value: string | null | undefined) {
  if (!value) return '待加载';
  if (!value.includes('T')) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('zh-CN', { hour12: false });
}
function durationText(seconds: number | undefined) {
  const total = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(total / 60)}分${String(total % 60).padStart(2, '0')}秒`;
}
function eventIdFor(alert: Alert) { return String(alert.code || alert.backendEventId.split(':').slice(1, -1).join(':') || alert.backendEventId); }

function fallbackExplanation(alert: Alert): EventExplanation {
  const now = new Date().toISOString();
  const summary = {
    currentConclusion: '解释生成暂不可用，实时报警等级不受影响。',
    currentPhaseSummary: `当前泵状态为${pumpLabel(alert.pumpState)}，工况阶段待确认。`,
    preStopSummary: null,
    pumpStopTransitionSummary: null,
    postStopSummary: null,
    shutInSummary: null,
    restartSummary: null,
    recoverySummary: null,
    supportingEvidence: [],
    contradictingEvidence: [],
    alternativeExplanations: ['需要结合现场记录继续复核'],
    operatorChecks: ['复核泵冲、入口排量、返出流量和总池体积'],
    dataLimitations: ['完整解释暂不可用，当前仅展示可确认的实时事实'],
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
    phases: [], parameterBehaviors: [], supportingEvidence: [], contradictingEvidence: [],
    alternativeExplanations: summary.alternativeExplanations, operatorChecks: summary.operatorChecks,
    dataLimitations: summary.dataLimitations, changesSincePreviousRevision: [], materialFactHash: '',
    generatedAt: now, generatorVersion: 'deterministic-field-v1-fallback',
  };
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
      const next = await fetchEventExplanation(endpoint, wellKey, eventId);
      // Stored explanation revisions may retain a legacy frame event id.  The drawer is
      // opened with the canonical lifecycle event id, so keep that identity in the UI/cache.
      const canonical = { ...next, eventId };
      setExplanation(canonical);
      setEventExplanationCache(eventId, { explanation: canonical, explanationRevision: canonical.explanationRevision, factRevision: canonical.factRevision, loadedAt: new Date().toISOString(), status: canonical.generatorVersion.includes('fallback') ? 'fallback' : 'loaded' });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '解释加载失败');
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
  const operatorChecks = summary.operatorChecks?.length ? summary.operatorChecks : ['复核泵冲、入口排量、返出流量和总池体积'];
  const reviewItems = [...(summary.alternativeExplanations || []), ...(summary.dataLimitations || [])];
  const presentation = operatorEventPresentation({
    publicLevel: currentLevel,
    eventTitle: alert.title,
    physicalDescription: alert.description,
    primaryParameter: alert.primaryParameter,
    activeSignals: alert.activeSignals,
  }, currentLevel);
  const operatorTitle = presentation.title;
  const physicalDescription = presentation.description || summary.currentPhaseSummary || summary.currentConclusion;

  // Render through a portal on document.body: this drawer is opened from
  // deeply nested side panels whose ancestors carry overflow/transform
  // rules. Without the portal, position:fixed collapses into that ancestor
  // and the briefing card gets squeezed into the corner instead of opening
  // as a full-screen sheet.
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45" onClick={onClose}>
      <aside className="h-full w-full max-w-[1080px] overflow-hidden bg-slate-50 shadow-2xl dark:bg-slate-950" role="dialog" aria-modal="true" aria-labelledby="event-explanation-title" onClick={(event) => event.stopPropagation()}>
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-[0.16em] text-cyan-700 dark:text-cyan-300">事件现场简报</div>
              <h2 id="event-explanation-title" className="mt-1 break-words text-lg font-semibold text-slate-900 dark:text-slate-100">
                {alert.wellName || wellKey} · {operatorTitle}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ops-muted">
                <span>{resolution}</span>
                <span>{phaseLabel(summary.currentPhase || explanation.currentPhase)}</span>
                <span>{pumpLabel(alert.pumpState)}</span>
                <span>开始 {explanation.startedAt || `${alert.date} ${alert.time}`}</span>
              </div>
            </div>
            <button type="button" className="ops-button-secondary shrink-0 px-2 py-1" onClick={onClose} title="关闭事件详情" aria-label="关闭事件详情"><X className="h-4 w-4" /></button>
          </header>
          <div className="ops-scroll flex-1 space-y-3 overflow-y-auto p-3.5 sm:p-5">
            {error && <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle className="h-4 w-4 shrink-0" />解释加载失败，已返回基础确定性兜底；实时报警等级不受影响。</div>}
            {loading && <div className="flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/20 dark:text-cyan-200"><RefreshCw className="h-3.5 w-3.5 animate-spin" />正在更新现场判断…</div>}

            <section className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
              <div className={`min-w-0 rounded-xl border p-4 sm:p-5 ${levelTone(currentLevel)}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4 shrink-0" />现在是什么情况</div>
                  <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
                    <span className="rounded-full bg-white/70 px-2.5 py-1 dark:bg-slate-950/30">当前 L{currentLevel}</span>
                    {highestLevel > currentLevel && <span className="rounded-full bg-white/70 px-2.5 py-1 dark:bg-slate-950/30">最高到 L{highestLevel}</span>}
                  </div>
                </div>
                <div className="mt-3 break-words text-xl font-semibold leading-8 text-slate-950 dark:text-white">{operatorTitle}</div>
                <p className="mt-2 break-words text-sm leading-6 text-slate-700 dark:text-slate-200">{physicalDescription}</p>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-current/15 pt-3 text-xs">
                  <span><strong>系统建议：</strong>{levelMeta.action}</span>
                  <span><strong>事件状态：</strong>{resolution}</span>
                </div>
              </div>

              <div className="min-w-0 rounded-xl border border-cyan-200 bg-white p-4 dark:border-cyan-900/60 dark:bg-slate-900">
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"><ListChecks className="h-4 w-4 text-cyan-700 dark:text-cyan-300" />现场立即复核</div>
                <ol className="mt-3 space-y-2.5">
                  {operatorChecks.slice(0, 4).map((item, index) => (
                    <li key={`${item}-${index}`} className="flex min-w-0 gap-2.5 text-sm leading-6 text-slate-700 dark:text-slate-200">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[11px] font-bold text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-100">{index + 1}</span>
                      <span className="min-w-0 break-words">{item}</span>
                    </li>
                  ))}
                </ol>
                {operatorChecks.length > 4 && <div className="mt-3 text-xs ops-muted">另有 {operatorChecks.length - 4} 项，见下方“完整复核信息”。</div>}
              </div>
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              <EvidenceDigest items={supportingEvidence} />
              <ReviewDigest evidence={contradictingEvidence} items={reviewItems} />
            </section>

            <details className="group rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
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
            </details>

            <details className="group rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                <span className="flex min-w-0 items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-300" />完整复核信息</span>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid gap-3 border-t border-slate-200 p-4 lg:grid-cols-2 dark:border-slate-800">
                <EvidenceList title="全部支持证据" items={supportingEvidence} tone="support" />
                <EvidenceList title="反向证据与限制" items={contradictingEvidence} tone="limit" />
                <ListBlock title="其他可能原因" items={summary.alternativeExplanations} />
                <ListBlock title="全部现场复核项" items={operatorChecks} />
                <div className="lg:col-span-2"><ListBlock title="数据限制" items={summary.dataLimitations} /></div>
              </div>
            </details>

            <details className="group rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-100"><span className="flex min-w-0 items-center gap-2"><Database className="h-4 w-4 shrink-0" />算法信息（专家复核）</span><ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" /></summary><div className="grid gap-2 border-t border-slate-200 p-4 text-xs ops-muted md:grid-cols-2 dark:border-slate-800"><div className="break-words">事件标识：{eventId}</div><div>候选标识：{explanation.candidateId || '不可用'}</div><div>事实版本：{explanation.factRevision}</div><div className="break-words">规则版本：{explanation.generatorVersion}</div><div className="break-words">活动信号：{alert.activeSignals.join('、') || '无'}</div><div>原始状态：{alert.eventState || '不可用'}</div></div></details>
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
  return (
    <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />为什么这样判断</div>
      <div className="mt-3 space-y-2.5">
        {items.length ? items.slice(0, 3).map((item) => (
          <div key={item.evidenceId} className="min-w-0 rounded-lg bg-white/75 px-3 py-2.5 dark:bg-slate-900/60">
            <div className="break-words text-sm font-medium text-slate-900 dark:text-slate-100">{item.observedFact}</div>
            {item.physicalMeaning && <div className="mt-1 break-words text-xs leading-5 ops-muted">{item.physicalMeaning}</div>}
          </div>
        )) : <div className="text-sm ops-muted">当前没有足够的成熟证据，请以现场复核为准。</div>}
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
  return (
    <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />还需要确认什么</div>
      <ul className="mt-3 space-y-2.5 text-sm leading-6 text-slate-700 dark:text-slate-200">
        {visibleItems.length ? visibleItems.map((item, index) => <li key={`${item}-${index}`} className="flex min-w-0 gap-2"><span className="text-amber-600">•</span><span className="min-w-0 break-words">{item}</span></li>) : <li className="ops-muted">当前没有额外限制，继续按现场处置流程跟踪。</li>}
      </ul>
    </div>
  );
}

function EvidenceList({ title, items, tone }: { title: string; items: EventExplanation['supportingEvidence']; tone: 'support' | 'limit' }) { return <div className={`min-w-0 rounded-xl border p-4 ${tone === 'support' ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20' : 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20'}`}><h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3><div className="mt-2 space-y-3">{items.length ? items.map((item) => <div key={item.evidenceId} className="min-w-0 rounded-lg bg-white/70 p-3 text-sm dark:bg-slate-900/60"><div className="break-words font-medium">{item.observedFact}</div><div className="mt-1 break-words text-xs leading-5 ops-muted">现场意义：{item.physicalMeaning || '待结合工况确认'}</div><div className="mt-1 text-xs ops-muted">证据可靠度 {(item.confidence * 100).toFixed(0)}%</div></div>) : <div className="text-sm ops-muted">暂无成熟证据。</div>}</div></div>; }
