import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, Database, RefreshCw, X } from 'lucide-react';
import type { Alert } from '../context/WellControlContext';
import { fetchEventExplanation } from '../api/eventExplanationApi';
import { getEventExplanationCache, setEventExplanationCache } from '../lib/eventExplanationCache';
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

function phaseLabel(value: string) { return PHASE_LABELS[value] || '工况待确认'; }
function pumpLabel(value: string) { return PUMP_LABELS[value] || '泵状态待确认'; }
function behaviorLabel(value: string) { return BEHAVIOR_LABELS[value] || value || '变化待确认'; }
function numberText(value: number | null | undefined, unit = '') { return value == null || !Number.isFinite(value) ? '不可用' : `${value.toFixed(2)}${unit ? ` ${unit}` : ''}`; }
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
      <div className="mt-1 text-xs ops-muted">{phase.startedAt} {phase.endedAt ? `至 ${phase.endedAt}` : '· 当前阶段'} · {pumpLabel(phase.pumpState)}</div>
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45" onClick={onClose}>
      <aside className="h-full w-full max-w-[1180px] overflow-hidden bg-slate-50 shadow-2xl dark:bg-slate-950" role="dialog" aria-modal="true" aria-labelledby="event-explanation-title" onClick={(event) => event.stopPropagation()}>
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">现场事件简报</div>
              <h2 id="event-explanation-title" className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{alert.wellName || wellKey} · 事件解释</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="ops-inline-tile px-2 py-1">当前 L{currentLevel}</span><span className="ops-inline-tile px-2 py-1">最高 L{highestLevel}</span>
                <span className="ops-inline-tile px-2 py-1">{summary.resolutionState || explanation.eventStatus}</span><span className="ops-inline-tile px-2 py-1">{phaseLabel(explanation.currentPhase)}</span>
                <span className="ops-inline-tile px-2 py-1">解释来源：系统解释</span><span className="ops-inline-tile px-2 py-1">版本 {explanation.explanationRevision}</span>
              </div>
              <div className="mt-2 text-xs ops-muted">开始 {explanation.startedAt || `${alert.date} ${alert.time}`} · 最近更新 {explanation.updatedAt || `${alert.lastDate || alert.date} ${alert.lastTime || alert.time}`}</div>
            </div>
            <button type="button" className="ops-button-secondary px-2 py-1" onClick={onClose} title="关闭事件解释" aria-label="关闭事件解释"><X className="h-4 w-4" /></button>
          </header>
          <div className="ops-scroll flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
            {error && <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle className="h-4 w-4 shrink-0" />解释加载失败，已返回基础确定性兜底；实时报警等级不受影响。</div>}
            <section className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-900/60 dark:bg-cyan-950/25">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-800 dark:text-cyan-200"><CheckCircle2 className="h-4 w-4" />当前现场判断</div>
              <div className="mt-2 text-lg font-semibold leading-8 text-slate-900 dark:text-slate-100">{summary.currentConclusion}</div>
              <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{summary.currentPhaseSummary}</p>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-slate-900 dark:text-slate-100">工况时间线</h3><span className="text-xs ops-muted">点击阶段查看阶段参数</span></div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{phases.length ? phases.map((phase) => <PhaseTimeline key={phase.phaseId} phase={phase} active={selectedPhase?.phaseId === phase.phaseId} onSelect={() => setSelectedPhaseId(phase.phaseId)} />) : <div className="text-sm ops-muted">尚未形成可展示的阶段分段。</div>}</div>
            </section>

            {selectedPhase && <section><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold text-slate-900 dark:text-slate-100">关键参数行为 · {phaseLabel(selectedPhase.phaseType)}</h3><span className="text-xs ops-muted">{selectedPhase.dataQualityLevel || '数据质量待确认'}</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{behaviors.length ? behaviors.map((behavior) => <ParameterCard key={`${behavior.phaseId}:${behavior.signalCode}`} behavior={behavior} />) : <div className="text-sm ops-muted">本阶段暂无有效参数行为。</div>}</div></section>}

            <section className="grid gap-3 lg:grid-cols-2">
              <NarrativeBlock title="停泵前发生了什么" text={summary.preStopSummary} />
              <NarrativeBlock title="停泵过渡发生了什么" text={summary.pumpStopTransitionSummary} />
              <NarrativeBlock title="停泵后发生了什么" text={summary.postStopSummary} />
              <NarrativeBlock title="关井与开泵恢复" text={[summary.shutInSummary, summary.restartSummary, summary.recoverySummary].filter(Boolean).join(' ') || null} />
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              <EvidenceList title="支持当前风险判断" items={explanation.supportingEvidence} tone="support" />
              <EvidenceList title="可能的替代解释或限制" items={explanation.contradictingEvidence} tone="limit" />
            </section>

            <section className="grid gap-3 lg:grid-cols-2"><ListBlock title="替代解释" items={summary.alternativeExplanations} /><ListBlock title="现场复核" items={summary.operatorChecks} /></section>
            <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-2 font-semibold"><Database className="h-4 w-4" />数据限制</div><ListBlock items={summary.dataLimitations} /></section>
            <details className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><summary className="flex cursor-pointer items-center gap-2 font-semibold"><ChevronDown className="h-4 w-4" />算法诊断（研发与专家复核）</summary><div className="mt-3 grid gap-2 text-xs ops-muted md:grid-cols-2"><div>事件标识：{eventId}</div><div>候选标识：{explanation.candidateId || '不可用'}</div><div>事实版本：{explanation.factRevision}</div><div>规则版本：{explanation.generatorVersion}</div><div>活动信号：{alert.activeSignals.join('、') || '无'}</div><div>原始状态：{alert.eventState || '不可用'}</div></div></details>
          </div>
          <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3 text-xs ops-muted dark:border-slate-800 dark:bg-slate-900"><span><Clock3 className="mr-1 inline h-3.5 w-3.5" />缓存更新时间 {getEventExplanationCache(eventId)?.loadedAt || '待加载'}</span><button type="button" className="ops-button-secondary px-2.5 py-1.5" onClick={() => void load(true)} disabled={loading}><RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{loading ? '刷新中' : '刷新解释'}</button></footer>
        </div>
      </aside>
    </div>
  );
}

function NarrativeBlock({ title, text }: { title: string; text?: string | null }) { return text ? <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{text}</p></div> : null; }
function ListBlock({ title, items }: { title?: string; items: string[] }) { return <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">{title && <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>}<ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{items.length ? items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><span className="text-cyan-600">•</span><span>{item}</span></li>) : <li className="ops-muted">暂无记录</li>}</ul></div>; }
function EvidenceList({ title, items, tone }: { title: string; items: EventExplanation['supportingEvidence']; tone: 'support' | 'limit' }) { return <div className={`rounded-xl border p-4 ${tone === 'support' ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20' : 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20'}`}><h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3><div className="mt-2 space-y-3">{items.length ? items.map((item) => <div key={item.evidenceId} className="rounded-lg bg-white/70 p-3 text-sm dark:bg-slate-900/60"><div className="font-medium">{item.observedFact}</div><div className="mt-1 text-xs leading-5 ops-muted">物理意义：{item.physicalMeaning}</div><div className="mt-1 text-xs ops-muted">置信度 {(item.confidence * 100).toFixed(0)}% · 阶段 {phaseLabel(item.phaseId.split('-phase-')[1] ? '' : item.phaseId)}</div></div>) : <div className="text-sm ops-muted">暂无成熟证据。</div>}</div></div>; }
