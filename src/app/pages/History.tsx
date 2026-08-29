import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, Database, Download, Eye, RefreshCw, X } from 'lucide-react';
import { useWellControl, type BackendLevel } from '../context/WellControlContext';
import { MonitoringWellTabs } from '../components/MonitoringWellTabs';
import { BACKEND_LEVEL_META, backendSignalLabel } from '../lib/backendDetection';
import { operatorEventPresentation } from '../lib/operatorEventPresentation';
import { LEVEL_VISUAL, safeLevel } from '../lib/levelVisual';
import { authenticatedFetch } from '../api/authToken';

type DbHistoryRecord = {
  id?: number;
  frame?: number;
  source_row_no?: number;
  timestamp?: string;
  sample_time?: string;
  inlet_smooth?: number;
  outlet_smooth?: number;
  pool_smooth?: number;
  cp?: number;
  spp?: number;
  standpipe_change_mpa?: number;
  spm?: number;
  gas?: number;
  bit_depth?: number;
  hook_load?: number;
  /** Legacy DB column only; must never feed current monitoring, algorithm, charts, or alerts. */
  legacyReturnResponsePct?: number;
  pool_delta_abs?: number;
  public_level?: BackendLevel;
  formal_eval_level?: BackendLevel;
  reason?: string;
  active_signals?: string;
  pump_state?: string;
  condition?: string;
  event_id?: string;
  highest_level?: BackendLevel;
  cycle_resolution?: string;
  reference_learning_action?: string;
  evidence_severity?: string;
  primary_hypothesis?: string;
  event_title?: string;
  physical_description?: string;
  primary_parameter?: string;
  abnormal_parameters?: string[];
  lifecycle_state?: string;
  data_quality?: string;
  missing_observations?: string[];
};

type HistoryPayload = {
  ok?: boolean;
  algorithmVersion?: string;
  configVersion?: string;
  sessionCode?: string;
  resultMode?: 'original' | 'replay' | string;
  processingStartTime?: string;
  warmupMinutes?: number;
  source?: string;
  frameCount?: number;
  processingNote?: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  startTime?: string;
  endTime?: string;
  records: DbHistoryRecord[];
  error?: string;
};

const PAGE_SIZE = 50;

/** L0-L4 keeps the canonical five-tier wording and colour everywhere. */
function levelBadgeText(level: number) {
  const safe = safeLevel(level);
  return `L${safe} ${BACKEND_LEVEL_META[safe].shortLabel}`;
}

function levelRowTone(level: number) {
  const safe = safeLevel(level);
  if (safe >= 4) return 'bg-red-50/60 dark:bg-red-950/20';
  if (safe >= 3) return 'bg-orange-50/60 dark:bg-orange-950/20';
  if (safe >= 2) return 'bg-amber-50/60 dark:bg-amber-950/20';
  return '';
}

function finite(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function hasFiniteValue(value: unknown) {
  if (value === undefined || value === null || value === '') return false;
  return Number.isFinite(Number(value));
}

function formatDbNumber(value: unknown, digits: number, fallback = '--') {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : fallback;
}

function formatDbNumberWithUnit(value: unknown, digits: number, unit: string) {
  const formatted = formatDbNumber(value, digits);
  return formatted === '--' ? formatted : `${formatted}${unit}`;
}

function formatDbNumberWithSpacedUnit(value: unknown, digits: number, unit: string) {
  const formatted = formatDbNumber(value, digits);
  return formatted === '--' ? formatted : `${formatted} ${unit}`;
}

function displayTime(value?: string) {
  if (!value) return '--';
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : value.replace('T', ' ').slice(0, 19);
}

function toQueryDateTime(value?: string) {
  if (!value) return '';
  const normalized = value.replace('T', ' ');
  return normalized.length === 16 ? `${normalized}:00` : normalized;
}

function activeSignalList(value?: string) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function backendLevelText(value: unknown) {
  if (!hasFiniteValue(value)) return '-- 未知';
  const level = finite(value) as BackendLevel;
  return `L${level} ${BACKEND_LEVEL_META[level]?.label || ''}`.trim();
}

function resultModeText(value?: string) {
  if (value === 'replay') return '独立算法回放';
  if (value === 'algorithm_replay') return '窗口算法复演';
  if (value === 'persisted_fact') return '持久化事实';
  return '算法输出';
}

function normalizeHistoryRecord(value: unknown): DbHistoryRecord {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const read = (...keys: string[]) => keys.map((key) => row[key]).find((item) => item !== undefined && item !== null);
  const alert = row.alert && typeof row.alert === 'object' ? row.alert as Record<string, unknown> : {};
  const candidate = row.candidate && typeof row.candidate === 'object' ? row.candidate as Record<string, unknown> : {};
  const evidence = row.evidence && typeof row.evidence === 'object' ? row.evidence as Record<string, unknown> : {};
  const operation = row.operation && typeof row.operation === 'object' ? row.operation as Record<string, unknown> : {};
  const quality = row.dataQuality && typeof row.dataQuality === 'object' ? row.dataQuality as Record<string, unknown> : {};
  const readNested = (source: Record<string, unknown>, ...keys: string[]) => keys.map((key) => source[key]).find((item) => item !== undefined && item !== null);
  const qualityValue = read('data_quality', 'dataQuality');
  const alertLevel = read('public_level', 'publicLevel') ?? readNested(alert, 'level', 'publicLevel');
  const highestLevel = read('highest_level', 'highestLevel') ?? readNested(candidate, 'highestLevel', 'highest_level');
  const nestedFamilies = readNested(evidence, 'families');
  const activeSignals = read('active_signals', 'activeSignals')
    ?? (Array.isArray(nestedFamilies)
      ? nestedFamilies
        .filter((item) => item && typeof item === 'object' && Boolean((item as Record<string, unknown>).available))
        .map((item) => String((item as Record<string, unknown>).family || ''))
        .filter(Boolean)
        .join(',')
      : readNested(evidence, 'supportingSignals'));
  const presentation = operatorEventPresentation(row, alertLevel);
  const normalizedSignals = presentation.abnormalParameters.length > 0
    ? presentation.abnormalParameters
    : (Array.isArray(activeSignals) ? activeSignals.map(String) : String(activeSignals || '').split(/[,、;；]/g).map((item) => item.trim()).filter(Boolean));
  return {
    ...row,
    id: Number(read('id')) || undefined,
    frame: Number(read('frame')) || undefined,
    source_row_no: Number(read('source_row_no', 'sourceRowNo')) || undefined,
    timestamp: String(read('timestamp', 'sample_time', 'sampleTime') ?? row.sampleTime ?? ''),
    sample_time: String(read('sample_time', 'sampleTime', 'timestamp') ?? row.sampleTime ?? ''),
    public_level: hasFiniteValue(alertLevel) ? finite(alertLevel) as BackendLevel : undefined,
    formal_eval_level: hasFiniteValue(read('formal_eval_level', 'formalEvalLevel')) ? finite(read('formal_eval_level', 'formalEvalLevel')) as BackendLevel : undefined,
    highest_level: hasFiniteValue(highestLevel) ? finite(highestLevel) as BackendLevel : undefined,
    event_id: String(read('event_id', 'eventId') ?? readNested(candidate, 'candidateId', 'candidate_id') ?? ''),
    reason: presentation.description,
    active_signals: normalizedSignals.join(','),
    event_title: presentation.title,
    physical_description: presentation.description,
    primary_parameter: presentation.primaryParameter,
    abnormal_parameters: normalizedSignals,
    cycle_resolution: String(read('cycle_resolution', 'cycleResolution') || ''),
    reference_learning_action: String(read('reference_learning_action', 'referenceLearningAction') || ''),
    evidence_severity: String(read('evidence_severity', 'evidenceSeverity') ?? readNested(evidence, 'severity') ?? ''),
    primary_hypothesis: String(read('primary_hypothesis', 'primaryHypothesis') ?? readNested(evidence, 'primaryHypothesis') ?? ''),
    lifecycle_state: String(read('lifecycle_state', 'lifecycleState', 'event_state', 'eventState') ?? row.lifecycleState ?? ''),
    data_quality: typeof qualityValue === 'string' || typeof qualityValue === 'number'
      ? String(qualityValue)
      : String(readNested(quality, 'level') ?? ''),
    missing_observations: Array.isArray(readNested(quality, 'missingChannels'))
      ? (readNested(quality, 'missingChannels') as unknown[]).map(String)
      : Array.isArray(read('missing_observations', 'missingObservations'))
        ? (read('missing_observations', 'missingObservations') as unknown[]).map(String)
        : [],
    inlet_smooth: Number(read('inlet_smooth', 'inletSmooth') ?? row.inletRaw) || undefined,
    outlet_smooth: Number(read('outlet_smooth', 'outletSmooth') ?? row.outletRaw) || undefined,
    pool_smooth: Number(read('pool_smooth', 'poolSmooth') ?? row.poolRaw) || undefined,
    pool_delta_abs: Number(read('pool_delta_abs', 'poolDeltaAbs')) || undefined,
    standpipe_change_mpa: Number(read('standpipe_change_mpa', 'standpipeChangeMpa')) || undefined,
    legacyReturnResponsePct: Number(read('return_response_pct', 'returnResponsePct')) || undefined,
    cp: Number(read('cp', 'casingPressure') ?? row.cp) || undefined,
    spp: Number(read('spp', 'standpipePressure') ?? row.spp) || undefined,
    spm: Number(read('spm', 'pumpStrokeRate') ?? row.spm) || undefined,
    gas: Number(read('gas', 'totalGas') ?? row.gas) || undefined,
    pump_state: String(read('pump_state', 'pumpState') ?? readNested(operation, 'pumpState') ?? ''),
    condition: String(read('condition') ?? readNested(operation, 'context') ?? ''),
  };
}

export default function History() {
  const navigate = useNavigate();
  const {
    wellInfo,
    selectedStartTime,
    currentSampleTime,
    timeBounds,
    buildRealtimeApiUrl,
    selectedWellId,
    wells,
  } = useWellControl();
  const reviewWellLabel = wellInfo.wellName || wells.find((well) => well.wellId === selectedWellId)?.wellName || '当前井';
  const [page, setPage] = useState(1);
  const pageRef = useRef(1);
  const [replayPage, setReplayPage] = useState(1);
  const [payload, setPayload] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<DbHistoryRecord | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState('');
  const [reviewMode, setReviewMode] = useState<'facts' | 'replay'>('facts');
  const reviewModeRef = useRef(reviewMode);
  reviewModeRef.current = reviewMode;
  const [replayMessage, setReplayMessage] = useState('');
  const [replayRequesting, setReplayRequesting] = useState(false);
  const [replayResult, setReplayResult] = useState<HistoryPayload | null>(null);
  const currentSampleTimeRef = useRef(currentSampleTime);
  const selectedStartTimeRef = useRef(selectedStartTime);
  const timeBoundsRef = useRef(timeBounds);
  const wellEndTimeRef = useRef(wellInfo?.endTime || '');
  const historyStartTimeRef = useRef('');
  const historyWellRef = useRef('');
  const requestAbortRef = useRef<AbortController | null>(null);

  currentSampleTimeRef.current = currentSampleTime;
  selectedStartTimeRef.current = selectedStartTime;
  timeBoundsRef.current = timeBounds;
  wellEndTimeRef.current = wellInfo?.endTime || '';

  const loadPage = useCallback(async (nextPage = pageRef.current) => {
    if (!wellInfo?.wellId) return;
    pageRef.current = nextPage;
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 45_000);
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(PAGE_SIZE),
      });
      const selectedStartQueryTime = toQueryDateTime(historyStartTimeRef.current || selectedStartTimeRef.current);
      if (selectedStartQueryTime) params.set('startTime', selectedStartQueryTime);
      const replayEndTime = wellEndTimeRef.current || timeBoundsRef.current.lastTime || currentSampleTimeRef.current || selectedStartQueryTime;
      if (replayEndTime) params.set('endTime', replayEndTime);
      params.set('warmupMinutes', '60');
      const url = buildRealtimeApiUrl(`/wells/${encodeURIComponent(wellInfo.wellId)}/history?${params.toString()}`);
      const response = await authenticatedFetch(url, { cache: 'no-store', signal: controller.signal });
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
      if (controller.signal.aborted) return;
      setPayload({ ...data, records: Array.isArray(data.records) ? data.records.map(normalizeHistoryRecord) : [] });
      const resolvedPage = data.page || nextPage;
      pageRef.current = resolvedPage;
      setPage(resolvedPage);
      setLastLoadedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    } catch (err) {
      if ((err instanceof DOMException && err.name === 'AbortError') || (err instanceof Error && err.name === 'AbortError')) {
        if (!timedOut) return;
        setError('历史算法查询超过 45 秒，后端可能仍在复演当前窗口。请缩小时间窗口后重试。');
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (requestAbortRef.current === controller) {
        requestAbortRef.current = null;
        setLoading(false);
      }
    }
  }, [buildRealtimeApiUrl, wellInfo?.wellId]);

  useEffect(() => () => requestAbortRef.current?.abort(), []);

  useEffect(() => {
    if (!wellInfo?.wellId || historyWellRef.current === wellInfo.wellId) return;
    const initialStartTime = selectedStartTimeRef.current || timeBoundsRef.current.firstTime;
    if (!initialStartTime) return;
    historyWellRef.current = wellInfo.wellId;
    historyStartTimeRef.current = initialStartTime;
    pageRef.current = 1;
    setPage(1);
    setSelected(null);
    setPayload(null);
    setReplayResult(null);
    setReplayPage(1);
    setReplayMessage('');
    setReviewMode('facts');
    setError('');
    loadPage(1);
  }, [loadPage, selectedStartTime, timeBounds.firstTime, wellInfo?.wellId]);

  // Replay results are a frozen snapshot: polling the facts endpoint during
  // replay mode would burn requests the UI never shows.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (reviewModeRef.current !== 'replay') loadPage(pageRef.current);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadPage]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    if (!selected) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  const visiblePayload = reviewMode === 'replay' && replayResult ? replayResult : payload;
  const allReplayRecords = replayResult?.records || [];
  const replayTotal = allReplayRecords.length;
  const replayTotalPages = Math.max(1, Math.ceil(replayTotal / PAGE_SIZE));
  const records = reviewMode === 'replay' && replayResult
    ? allReplayRecords.slice((replayPage - 1) * PAGE_SIZE, replayPage * PAGE_SIZE)
    : (visiblePayload?.records || []);
  const visiblePage = reviewMode === 'replay' && replayResult ? replayPage : (visiblePayload?.page || 1);
  const visibleTotalPages = reviewMode === 'replay' && replayResult ? replayTotalPages : (visiblePayload?.totalPages || 1);
  const visibleTotal = reviewMode === 'replay' && replayResult ? replayTotal : (visiblePayload?.total ?? 0);
  const refreshHistory = () => {
    historyStartTimeRef.current = selectedStartTimeRef.current;
    loadPage(pageRef.current);
  };
  const requestReplay = async () => {
    if (!wellInfo?.wellId || replayRequesting) return;
    setReplayRequesting(true);
    setReplayMessage('正在创建独立算法回放 Session…');
    try {
      const response = await authenticatedFetch(buildRealtimeApiUrl(`/wells/${encodeURIComponent(wellInfo.wellId)}/replay`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: toQueryDateTime(selectedStartTime), endTime: wellInfo.endTime || timeBounds.lastTime || currentSampleTime || null, warmupMinutes: 60 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      const replayPayload: HistoryPayload = {
        ...data,
        algorithmVersion: data.algorithmVersion || data.algorithm_version,
        configVersion: data.configVersion || data.config_version,
        sessionCode: data.sessionCode || data.session_code,
        processingStartTime: data.processingStartTime || data.processing_start_time,
        warmupMinutes: Number(data.warmupMinutes ?? data.warmup_minutes ?? 60),
        startTime: data.startTime || data.start_time || toQueryDateTime(selectedStartTime),
        endTime: data.endTime || data.end_time || wellInfo.endTime || timeBounds.lastTime || currentSampleTime,
        resultMode: 'replay',
        records: (Array.isArray(data.records) ? data.records : (Array.isArray(data.outcomes) ? data.outcomes : [])).map(normalizeHistoryRecord),
      };
      setReplayResult(replayPayload);
      setReplayPage(1);
      setReplayMessage(`回放 Session ${replayPayload.sessionCode || '已创建'} · 算法 ${replayPayload.algorithmVersion || '--'} · 已预热 ${replayPayload.warmupMinutes || 0} 分钟`);
    } catch (error) {
      setReplayMessage(`回放创建失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setReplayRequesting(false);
    }
  };
  const highCount = records.filter((record) => hasFiniteValue(record.public_level) && finite(record.public_level) >= 4).length;
  const warnCount = records.filter((record) => hasFiniteValue(record.public_level) && finite(record.public_level) >= 2 && finite(record.public_level) < 4).length;
  const replayEndLabel = displayTime(visiblePayload?.endTime || currentSampleTime || wellInfo.endTime || timeBounds.lastTime || toQueryDateTime(selectedStartTime));

  const exportCSV = () => {
    const headers = ['时间', '工况', '入口流量(L/s)', '出口流量(L/s)', '总池体积(m3)', 'SPM', '立管压力(MPa)', '套管压力(MPa)', '全烃(%)', '报警等级', '事件', '异常参数', '现场变化'];
    const rows = records.map((record) => [
      displayTime(record.timestamp || record.sample_time),
      record.condition || record.pump_state || '',
      formatDbNumber(record.inlet_smooth, 2, ''),
      formatDbNumber(record.outlet_smooth, 2, ''),
      formatDbNumber(record.pool_smooth, 2, ''),
      formatDbNumber(record.spm, 1, ''),
      formatDbNumber(record.spp, 3, ''),
      formatDbNumber(record.cp, 2, ''),
      formatDbNumber(record.gas, 2, ''),
      hasFiniteValue(record.public_level) ? `L${finite(record.public_level)}` : '',
      record.event_title || '',
      record.abnormal_parameters?.join('、') || record.active_signals || '',
      record.physical_description || record.reason || '',
    ].map(csvCell).join(','));
    const blob = new Blob(['\uFEFF' + [headers.map(csvCell).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `history_${reviewMode === 'replay' ? 'algorithm_replay' : 'window_facts'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ops-page space-y-4">
      <MonitoringWellTabs />
      <div className="ops-page-header">
        <div className="ops-page-header-copy">
          <div className="ops-eyebrow">历史与回放</div>
          <h1 className="ops-title">历史算法复盘</h1>
          <p className="text-sm ops-muted">
            复盘结果由后端统一检测引擎生成；请求窗口前自动预热，报警等级、候选状态和证据链均以算法输出为准。
          </p>
        </div>
        <div className="ops-page-toolbar">
          <div className="ops-segment" aria-label="历史查询模式">
            <button type="button" className={reviewMode === 'facts' ? 'is-active' : ''} onClick={() => setReviewMode('facts')}>窗口算法复演</button>
            <button type="button" className={reviewMode === 'replay' ? 'is-active' : ''} onClick={() => setReviewMode('replay')}>算法重新回放</button>
          </div>
          <button type="button" onClick={refreshHistory} className="ops-button-secondary" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button type="button" onClick={exportCSV} className="ops-button-primary" disabled={records.length === 0}>
            <Download className="h-4 w-4" />
            导出当前页
          </button>
        </div>
      </div>

      {reviewMode === 'replay' && (
        <div className="ops-panel flex flex-wrap items-center justify-between gap-3 p-3">
          <div>
            <div className="ops-eyebrow">独立回放 Runtime</div>
            <div className="mt-1 text-sm text-slate-800 dark:text-slate-100">{replayMessage || '使用当前井和时间窗口创建独立回放 Session，不覆盖实时监测状态。'}</div>
          </div>
          <button type="button" className="ops-button-primary" onClick={requestReplay} disabled={replayRequesting}>
            {replayRequesting ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
            {replayRequesting ? '正在创建回放…' : '创建后端回放'}
          </button>
        </div>
      )}

      <div className="ops-stat-grid">
        <div className="ops-panel-soft p-3">
          <div className="text-[11px] ops-muted">当前查询井</div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{reviewWellLabel}</div>
        </div>
        <div className="ops-panel-soft p-3">
          <div className="text-[11px] ops-muted">算法输出记录</div>
          <div className="mt-1 text-sm tabular-nums text-slate-900 dark:text-slate-100">{visibleTotal} 条</div>
        </div>
        <div className="ops-panel-soft p-3">
          <div className="text-[11px] ops-muted">当前页预警</div>
          <div className="mt-1 text-sm tabular-nums text-amber-700 dark:text-amber-200">{warnCount} 条</div>
        </div>
        <div className="ops-panel-soft p-3">
          <div className="text-[11px] ops-muted">当前页 L4 确认</div>
          <div className="mt-1 text-sm tabular-nums text-red-700 dark:text-red-200">{highCount} 条</div>
        </div>
        <div className="ops-panel-soft p-3">
          <div className="text-[11px] ops-muted">算法 / 配置版本</div>
          <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{visiblePayload?.algorithmVersion || '--'} / {visiblePayload?.configVersion || '--'}</div>
        </div>
        <div className="ops-panel-soft p-3">
          <div className="text-[11px] ops-muted">Session / 结果来源</div>
          <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{visiblePayload?.sessionCode || '--'} / {resultModeText(visiblePayload?.resultMode)}</div>
        </div>
        <div className="ops-panel-soft p-3 lg:col-span-2">
          <div className="text-[11px] ops-muted">数据时间范围</div>
          <div className="mt-1 text-sm tabular-nums text-slate-900 dark:text-slate-100">{displayTime(visiblePayload?.startTime)} → {replayEndLabel}</div>
          {visiblePayload?.processingStartTime && (
            <div className="mt-1 text-[11px] ops-muted">算法预热起点 {displayTime(visiblePayload.processingStartTime)} · {visiblePayload.warmupMinutes ?? 0} 分钟</div>
          )}
        </div>
      </div>

      <div className="ops-surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#f6fafc] px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 ops-muted">
            <Database className="h-4 w-4" />
            <span>第 {visiblePage} / {visibleTotalPages} 页</span>
            <span>{loading ? '正在刷新...' : `最新刷新 ${lastLoadedAt || '--:--:--'}`}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="ops-button-secondary px-2 py-1 text-xs" disabled={visiblePage <= 1 || loading} onClick={() => { if (reviewMode === 'replay') setReplayPage((p) => Math.max(1, p - 1)); else loadPage(visiblePage - 1); }}>上一页</button>
            <button type="button" className="ops-button-secondary px-2 py-1 text-xs" disabled={visiblePage >= visibleTotalPages || loading} onClick={() => { if (reviewMode === 'replay') setReplayPage((p) => Math.min(replayTotalPages, p + 1)); else loadPage(visiblePage + 1); }}>下一页</button>
          </div>
        </div>
        {error ? (
          <div
            className="m-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-200"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  历史算法查询失败
                </div>
                <div className="ops-break-text mt-1 text-xs opacity-90">{error}</div>
                <div className="mt-2 text-xs opacity-80">请确认实时数据接口可访问、当前井已选择，并检查时间窗口或缩小复盘范围。</div>
              </div>
              <button type="button" onClick={refreshHistory} className="ops-button-secondary shrink-0 px-2.5 py-1 text-xs" disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                重试查询
              </button>
            </div>
          </div>
        ) : (
          <div className="ops-surface-body ops-scroll max-h-[calc(100vh-330px)] overflow-auto">
            <table className="ops-table hidden md:table" aria-label="数据库复核记录">
              <thead>
                <tr>
                  <th className="text-left">时间</th>
              <th className="text-left">工况</th>
              <th className="text-right">入口流量</th>
              <th className="text-right">出口流量</th>
              <th className="text-right">总池体积</th>
              <th className="text-right">SPM</th>
              <th className="text-right">立管压力</th>
              <th className="text-right">全烃</th>
              <th className="text-center">报警等级</th>
              <th className="text-left">事件</th>
              <th className="text-left">异常参数</th>
              <th className="text-right">详情</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, index) => {
                  const hasLevel = hasFiniteValue(record.public_level);
                  const level = safeLevel(record.public_level);
                  return (
                    <tr key={`${record.id || record.frame || index}-${record.timestamp}`} className={levelRowTone(level)}>
                      <td className="whitespace-nowrap text-xs ops-muted">
                        {displayTime(record.timestamp || record.sample_time)}
                        <span className="ml-1 text-[10px] text-slate-400">#{record.source_row_no || record.id || record.frame || index}</span>
                      </td>
                      <td className="max-w-[150px] truncate text-xs ops-muted" title={record.condition || record.pump_state || undefined}>{record.condition || record.pump_state || '--'}</td>
                      <td className="text-right tabular-nums text-emerald-600 dark:text-emerald-300">{formatDbNumber(record.inlet_smooth, 2)}</td>
                      <td className="text-right tabular-nums text-blue-600 dark:text-blue-300">{formatDbNumber(record.outlet_smooth, 2)}</td>
                      <td className="text-right tabular-nums">{formatDbNumber(record.pool_smooth, 2)}</td>
                      <td className="text-right tabular-nums">{formatDbNumber(record.spm, 1)}</td>
                      <td className="text-right tabular-nums">{formatDbNumber(record.spp, 3)}</td>
                      <td className="text-right tabular-nums">{formatDbNumber(record.gas, 2)}</td>
                      <td className="text-center">
                        <span className={`rounded px-2 py-0.5 text-xs ${hasLevel ? LEVEL_VISUAL[level].badge : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}>
                          {hasLevel ? levelBadgeText(level) : '-- 未知'}
                        </span>
                      </td>
                      <td className="max-w-[240px] truncate text-xs font-medium text-slate-800 dark:text-slate-100" title={record.physical_description || undefined}>
                        {record.event_title || (hasLevel ? operatorEventPresentation(record, level).title : '当前未发现需提示的参数异常')}
                      </td>
                      <td className="max-w-[180px] truncate text-xs ops-muted" title={record.physical_description || undefined}>{record.abnormal_parameters?.join('、') || activeSignalList(record.active_signals).join('、') || '--'}</td>
                      <td className="text-right">
                        <button type="button" onClick={() => setSelected(record)} className="ops-button-secondary px-2 py-1 text-xs" aria-label={`查看 ${displayTime(record.timestamp || record.sample_time)} 复核详情`}>
                          <Eye className="h-3.5 w-3.5" />
                          查看
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="divide-y divide-slate-200 md:hidden dark:divide-slate-800" role="list" aria-label="数据库复核记录">
              {records.map((record, index) => {
                const hasLevel = hasFiniteValue(record.public_level);
                const level = safeLevel(record.public_level);
                return (
                  <article key={`mobile-${record.id || record.frame || index}-${record.timestamp}`} role="listitem" className={`${levelRowTone(level)} p-3`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{displayTime(record.timestamp || record.sample_time)}</div>
                        <div className="mt-0.5 text-[11px] ops-muted">记录 #{record.source_row_no || record.id || record.frame || index}</div>
                      </div>
                      <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${hasLevel ? LEVEL_VISUAL[level].badge : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}>
                        {hasLevel ? levelBadgeText(level) : '-- 未知'}
                      </span>
                    </div>
                    <div className="mt-2 text-sm font-semibold leading-5 text-slate-900 dark:text-slate-100">{record.event_title || (hasLevel ? operatorEventPresentation(record, level).title : '当前未发现需提示的参数异常')}</div>
                    <div className="mt-1 text-xs leading-5 ops-muted">{record.physical_description || '当前记录未保存可读的现场变化描述。'}</div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="ops-inline-tile min-w-0 p-2">
                        <div className="ops-muted">入口流量</div>
                        <div className="mt-1 tabular-nums text-emerald-700 dark:text-emerald-300">{formatDbNumber(record.inlet_smooth, 2)}</div>
                      </div>
                      <div className="ops-inline-tile min-w-0 p-2">
                        <div className="ops-muted">出口流量</div>
                        <div className="mt-1 tabular-nums text-blue-700 dark:text-blue-300">{formatDbNumber(record.outlet_smooth, 2)}</div>
                      </div>
                      <div className="ops-inline-tile min-w-0 p-2">
                        <div className="ops-muted">SPM</div>
                        <div className="mt-1 tabular-nums">{formatDbNumber(record.spm, 1)}</div>
                      </div>
                      <div className="ops-inline-tile min-w-0 p-2">
                        <div className="ops-muted">总池体积</div>
                        <div className="mt-1 tabular-nums">{formatDbNumber(record.pool_smooth, 2)}</div>
                      </div>
                      <div className="ops-inline-tile min-w-0 p-2">
                        <div className="ops-muted">立管压力</div>
                        <div className="mt-1 tabular-nums">{formatDbNumber(record.spp, 3)} MPa</div>
                      </div>
                      <div className="ops-inline-tile min-w-0 p-2">
                        <div className="ops-muted">全烃</div>
                        <div className="mt-1 tabular-nums">{formatDbNumber(record.gas, 2)}</div>
                      </div>
                    </div>
                    <button type="button" onClick={() => setSelected(record)} className="ops-button-secondary mt-3 w-full justify-center px-2 py-1.5 text-xs" aria-label={`查看 ${displayTime(record.timestamp || record.sample_time)} 复核详情`}>
                      <Eye className="h-3.5 w-3.5" />
                      查看详情
                    </button>
                  </article>
                );
              })}
            </div>
            {records.length === 0 && (
              <div className="ops-empty-state m-3 min-h-[160px]">
                <div>
                  <div className="text-sm text-slate-700 dark:text-slate-200">{loading ? '正在加载算法输出' : '当前时间窗口没有算法输出'}</div>
                  <div className="mt-1 text-xs">{loading ? '请稍候，后端正在预热并复演当前窗口。' : '查询窗口起点继承自监测页的数据窗口。可回到监测页调整窗口，或直接点击「刷新」重试。'}</div>
                  {!loading && (
                    <button type="button" className="ops-button-secondary mt-3 px-3 py-1.5 text-xs" onClick={() => navigate('/monitoring')}>
                      回到监测页调整窗口
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div
            className="ops-scroll max-h-[calc(100vh-32px)] w-full max-w-xl overflow-auto rounded-md border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-detail-title"
            aria-describedby="history-detail-summary"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="ops-eyebrow">复核详情</div>
                <h3 id="history-detail-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">{selected.event_title || '复核详情'}</h3>
              </div>
              <button type="button" className="ops-button-secondary px-2 py-1" onClick={() => setSelected(null)} title="关闭复核详情" aria-label="关闭复核详情" autoFocus><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="ops-inline-tile p-2"><span className="ops-muted">时间 </span>{displayTime(selected.timestamp || selected.sample_time)}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">报警等级 </span>{backendLevelText(selected.public_level)}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">事件 ID </span>{selected.event_id || '--'}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">事件最高等级 </span>{backendLevelText(selected.highest_level)}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">内部正式评估 </span>{backendLevelText(selected.formal_eval_level)}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">工况 </span>{selected.condition || selected.pump_state || '--'}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">生命周期 </span>{selected.lifecycle_state || '--'}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">入口流量 </span>{formatDbNumberWithSpacedUnit(selected.inlet_smooth, 2, 'L/s')}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">出口流量 </span>{formatDbNumberWithSpacedUnit(selected.outlet_smooth, 2, 'L/s')}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">总池体积 </span>{formatDbNumberWithSpacedUnit(selected.pool_smooth, 2, 'm3')}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">SPM </span>{formatDbNumberWithSpacedUnit(selected.spm, 1, 'spm')}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">立管压力 </span>{formatDbNumberWithSpacedUnit(selected.spp, 3, 'MPa')}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">套管压力 </span>{formatDbNumberWithSpacedUnit(selected.cp, 3, 'MPa')}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">全烃 </span>{formatDbNumberWithUnit(selected.gas, 2, '%')}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">数据质量 </span>{selected.data_quality || '--'}</div>
            </div>
            <div id="history-detail-summary" className="mt-3 rounded-md border border-cyan-200 bg-cyan-50/70 p-3 text-sm dark:border-cyan-900/60 dark:bg-cyan-950/20">
              <div className="font-medium text-slate-900 dark:text-slate-100">现场变化</div>
              <div className="mt-1 text-base font-semibold leading-6 text-slate-900 dark:text-slate-100">{selected.event_title || '当前记录未发现需提示的参数异常'}</div>
              <div className="ops-break-text mt-1 leading-6 text-slate-700 dark:text-slate-200">{selected.physical_description || selected.reason || '当前记录未保存可读的现场变化描述。'}</div>
              {selected.primary_parameter && <div className="mt-2 text-xs text-cyan-900 dark:text-cyan-100">主要异常参数：{selected.primary_parameter}</div>}
              {selected.missing_observations && selected.missing_observations.length > 0 && (
                <div className="mt-2 text-xs text-amber-700 dark:text-amber-200">缺失观测：{selected.missing_observations.join('、')}</div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeSignalList(selected.active_signals).map((signal) => (
                  <span key={signal} className="ops-inline-tile px-2 py-1 text-xs">{backendSignalLabel(signal)}</span>
                ))}
              </div>
            </div>
            <details className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
              <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">算法追溯（专家复核）</summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="ops-inline-tile p-2"><span className="ops-muted">证据强度 </span>{selected.evidence_severity || '--'}</div>
                <div className="ops-inline-tile p-2"><span className="ops-muted">主导假设 </span>{selected.primary_hypothesis || '--'}</div>
                <div className="ops-inline-tile p-2"><span className="ops-muted">跨周期解析 </span>{selected.cycle_resolution || '--'}</div>
                <div className="ops-inline-tile p-2"><span className="ops-muted">参考学习动作 </span>{selected.reference_learning_action || '--'}</div>
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
