import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Database, Download, Eye, RefreshCw, X } from 'lucide-react';
import { useWellControl, type AlertStatus, type BackendLevel } from '../context/WellControlContext';
import { MonitoringWellTabs } from '../components/MonitoringWellTabs';
import { BACKEND_LEVEL_META, backendSignalLabel } from '../lib/backendDetection';
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
  return_response_pct?: number;
  pool_delta_abs?: number;
  public_level?: BackendLevel;
  formal_eval_level?: BackendLevel;
  reason?: string;
  active_signals?: string;
  pump_state?: string;
  condition?: string;
};

type HistoryPayload = {
  ok?: boolean;
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
const STATUS_LABELS: Record<AlertStatus, string> = { normal: '正常', warning: '预警', critical: '严重' };

function levelStatus(level: number): AlertStatus {
  if (level >= 4) return 'critical';
  if (level >= 2) return 'warning';
  return 'normal';
}

function statusBadge(status: AlertStatus) {
  if (status === 'critical') return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200';
  if (status === 'warning') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200';
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200';
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
  return value.replace('T', ' ');
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

export default function History() {
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
  const [payload, setPayload] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<DbHistoryRecord | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState('');
  const currentSampleTimeRef = useRef(currentSampleTime);
  const requestAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    currentSampleTimeRef.current = currentSampleTime;
  }, [currentSampleTime]);

  const loadPage = useCallback(async (nextPage = pageRef.current) => {
    if (!wellInfo?.wellId) return;
    pageRef.current = nextPage;
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(PAGE_SIZE),
      });
      const selectedStartQueryTime = toQueryDateTime(selectedStartTime);
      if (selectedStartQueryTime) params.set('startTime', selectedStartQueryTime);
      const replayEndTime = currentSampleTimeRef.current || wellInfo.endTime || timeBounds.lastTime || selectedStartQueryTime;
      if (replayEndTime) params.set('endTime', replayEndTime);
      const url = buildRealtimeApiUrl(`/wells/${encodeURIComponent(wellInfo.wellId)}/history?${params.toString()}`);
      const response = await authenticatedFetch(url, { cache: 'no-store', signal: controller.signal });
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
      if (controller.signal.aborted) return;
      setPayload(data);
      const resolvedPage = data.page || nextPage;
      pageRef.current = resolvedPage;
      setPage(resolvedPage);
      setLastLoadedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (requestAbortRef.current === controller) {
        requestAbortRef.current = null;
        setLoading(false);
      }
    }
  }, [buildRealtimeApiUrl, selectedStartTime, timeBounds.lastTime, wellInfo?.endTime, wellInfo?.wellId]);

  useEffect(() => () => requestAbortRef.current?.abort(), []);

  useEffect(() => {
    pageRef.current = 1;
    setPage(1);
    setSelected(null);
    setPayload(null);
    setError('');
    loadPage(1);
  }, [wellInfo?.wellId, selectedStartTime]);

  useEffect(() => {
    const timer = window.setInterval(() => loadPage(pageRef.current), 30_000);
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

  const records = payload?.records || [];
  const highCount = records.filter((record) => hasFiniteValue(record.public_level) && finite(record.public_level) >= 4).length;
  const warnCount = records.filter((record) => hasFiniteValue(record.public_level) && finite(record.public_level) >= 2 && finite(record.public_level) < 4).length;
  const replayEndLabel = displayTime(payload?.endTime || currentSampleTime || wellInfo.endTime || timeBounds.lastTime || toQueryDateTime(selectedStartTime));

  const exportCSV = () => {
    const headers = ['时间', '出口流量响应(%)', '入口流量', '出口流量', '总池体积', '总池体积变化', '立压变化量', '套压', '全烃', '报警等级', '原因'];
    const rows = records.map((record) => [
      displayTime(record.timestamp || record.sample_time),
      formatDbNumber(record.return_response_pct, 1, ''),
      formatDbNumber(record.inlet_smooth, 2, ''),
      formatDbNumber(record.outlet_smooth, 2, ''),
      formatDbNumber(record.pool_smooth, 2, ''),
      formatDbNumber(record.pool_delta_abs, 2, ''),
      formatDbNumber(record.standpipe_change_mpa, 2, ''),
      formatDbNumber(record.cp, 2, ''),
      formatDbNumber(record.gas, 2, ''),
      hasFiniteValue(record.public_level) ? `L${finite(record.public_level)}` : '',
      record.reason || '',
    ].map(csvCell).join(','));
    const blob = new Blob(['\uFEFF' + [headers.map(csvCell).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `well_db_review_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ops-page space-y-4">
      <MonitoringWellTabs />
      <div className="ops-page-header">
        <div className="ops-page-header-copy">
          <div className="ops-eyebrow">数据库复核</div>
          <h1 className="ops-title">数据库复核</h1>
          <p className="text-sm ops-muted">
            表格直接查询数据库，按当前回放时间向前复核，最新记录在第一页，每 30 秒自动刷新。
          </p>
        </div>
        <div className="ops-page-toolbar">
          <button type="button" onClick={() => loadPage(pageRef.current)} className="ops-button-secondary" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button type="button" onClick={exportCSV} className="ops-button-primary" disabled={records.length === 0}>
            <Download className="h-4 w-4" />
            导出当前页
          </button>
        </div>
      </div>

      <div className="ops-stat-grid">
        <div className="ops-panel-soft p-3">
          <div className="text-[11px] ops-muted">当前查询井</div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{reviewWellLabel}</div>
        </div>
        <div className="ops-panel-soft p-3">
          <div className="text-[11px] ops-muted">数据库记录</div>
          <div className="mt-1 text-sm tabular-nums text-slate-900 dark:text-slate-100">{payload?.total ?? 0} 条</div>
        </div>
        <div className="ops-panel-soft p-3">
          <div className="text-[11px] ops-muted">当前页预警</div>
          <div className="mt-1 text-sm tabular-nums text-amber-700 dark:text-amber-200">{warnCount} 条</div>
        </div>
        <div className="ops-panel-soft p-3">
          <div className="text-[11px] ops-muted">当前页确认</div>
          <div className="mt-1 text-sm tabular-nums text-red-700 dark:text-red-200">{highCount} 条</div>
        </div>
        <div className="ops-panel-soft p-3 lg:col-span-4">
          <div className="text-[11px] ops-muted">复核时间上界</div>
          <div className="mt-1 text-sm tabular-nums text-slate-900 dark:text-slate-100">{replayEndLabel}</div>
        </div>
      </div>

      <div className="ops-surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#f6fafc] px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 ops-muted">
            <Database className="h-4 w-4" />
            <span>第 {payload?.page ?? page} / {payload?.totalPages ?? 1} 页</span>
            <span>{loading ? '正在刷新...' : `最新刷新 ${lastLoadedAt || '--:--:--'}`}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="ops-button-secondary px-2 py-1 text-xs" disabled={page <= 1 || loading} onClick={() => loadPage(page - 1)}>上一页</button>
            <button type="button" className="ops-button-secondary px-2 py-1 text-xs" disabled={page >= (payload?.totalPages ?? 1) || loading} onClick={() => loadPage(page + 1)}>下一页</button>
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
                  数据库复核查询失败
                </div>
                <div className="ops-break-text mt-1 text-xs opacity-90">{error}</div>
                <div className="mt-2 text-xs opacity-80">请确认实时数据接口可访问、当前井已选择，并检查回放时间窗口。</div>
              </div>
              <button type="button" onClick={() => loadPage(pageRef.current)} className="ops-button-secondary shrink-0 px-2.5 py-1 text-xs" disabled={loading}>
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
                  <th className="text-right">出口流量响应</th>
                  <th className="text-right">入口流量</th>
                  <th className="text-right">出口流量</th>
                  <th className="text-right">总池体积</th>
                  <th className="text-right">总池体积变化</th>
                  <th className="text-right">立压变化量</th>
                  <th className="text-right">全烃</th>
                  <th className="text-center">报警等级</th>
                  <th className="text-right">详情</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, index) => {
                  const hasLevel = hasFiniteValue(record.public_level);
                  const level = finite(record.public_level) as BackendLevel;
                  const status = levelStatus(level);
                  return (
                    <tr key={`${record.id || record.frame || index}-${record.timestamp}`} className={status === 'critical' ? 'bg-red-50/60 dark:bg-red-950/20' : status === 'warning' ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}>
                      <td className="whitespace-nowrap text-xs ops-muted">
                        {displayTime(record.timestamp || record.sample_time)}
                        <span className="ml-1 text-[10px] text-slate-400">#{record.source_row_no || record.id || record.frame || index}</span>
                      </td>
                      <td className="text-right tabular-nums">{formatDbNumberWithUnit(record.return_response_pct, 1, '%')}</td>
                      <td className="text-right tabular-nums text-emerald-600 dark:text-emerald-300">{formatDbNumber(record.inlet_smooth, 2)}</td>
                      <td className="text-right tabular-nums text-blue-600 dark:text-blue-300">{formatDbNumber(record.outlet_smooth, 2)}</td>
                      <td className="text-right tabular-nums">{formatDbNumber(record.pool_smooth, 2)}</td>
                      <td className="text-right tabular-nums">{formatDbNumber(record.pool_delta_abs, 2)}</td>
                      <td className="text-right tabular-nums">{formatDbNumber(record.standpipe_change_mpa, 2)}</td>
                      <td className="text-right tabular-nums">{formatDbNumber(record.gas, 2)}</td>
                      <td className="text-center">
                        <span className={`rounded px-2 py-0.5 text-xs ${hasLevel ? statusBadge(status) : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}>
                          {hasLevel ? `L${level} ${STATUS_LABELS[status]}` : '-- 未知'}
                        </span>
                      </td>
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
                const level = finite(record.public_level) as BackendLevel;
                const status = levelStatus(level);
                return (
                  <article key={`mobile-${record.id || record.frame || index}-${record.timestamp}`} role="listitem" className={status === 'critical' ? 'bg-red-50/60 p-3 dark:bg-red-950/20' : status === 'warning' ? 'bg-amber-50/60 p-3 dark:bg-amber-950/20' : 'p-3'}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{displayTime(record.timestamp || record.sample_time)}</div>
                        <div className="mt-0.5 text-[11px] ops-muted">记录 #{record.source_row_no || record.id || record.frame || index}</div>
                      </div>
                      <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${hasLevel ? statusBadge(status) : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}>
                        {hasLevel ? `L${level} ${STATUS_LABELS[status]}` : '-- 未知'}
                      </span>
                    </div>
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
                        <div className="ops-muted">出口响应</div>
                        <div className="mt-1 tabular-nums">{formatDbNumberWithUnit(record.return_response_pct, 1, '%')}</div>
                      </div>
                      <div className="ops-inline-tile min-w-0 p-2">
                        <div className="ops-muted">池体积变化</div>
                        <div className="mt-1 tabular-nums">{formatDbNumber(record.pool_delta_abs, 2)}</div>
                      </div>
                      <div className="ops-inline-tile min-w-0 p-2">
                        <div className="ops-muted">立压变化量</div>
                        <div className="mt-1 tabular-nums">{formatDbNumber(record.standpipe_change_mpa, 2)}</div>
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
                  <div className="text-sm text-slate-700 dark:text-slate-200">{loading ? '正在加载复核记录' : '数据库当前没有可复核记录'}</div>
                  <div className="mt-1 text-xs">{loading ? '请稍候，正在查询当前时间窗口。' : '请确认已选择开始时间，并且数据库接口可访问。'}</div>
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
                <h3 id="history-detail-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">复核详情</h3>
              </div>
              <button type="button" className="ops-button-secondary px-2 py-1" onClick={() => setSelected(null)} title="关闭复核详情" aria-label="关闭复核详情" autoFocus><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="ops-inline-tile p-2"><span className="ops-muted">时间 </span>{displayTime(selected.timestamp || selected.sample_time)}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">报警等级 </span>{backendLevelText(selected.public_level)}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">入口流量 </span>{formatDbNumberWithSpacedUnit(selected.inlet_smooth, 2, 'L/s')}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">出口流量 </span>{formatDbNumberWithSpacedUnit(selected.outlet_smooth, 2, 'L/s')}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">总池体积变化 </span>{formatDbNumberWithSpacedUnit(selected.pool_delta_abs, 2, 'm3')}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">立压变化量 </span>{formatDbNumberWithSpacedUnit(selected.standpipe_change_mpa, 2, 'MPa')}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">全烃 </span>{formatDbNumberWithUnit(selected.gas, 2, '%')}</div>
            </div>
            <div id="history-detail-summary" className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="font-medium text-slate-900 dark:text-slate-100">判定原因</div>
              <div className="ops-break-text mt-1 ops-muted">{selected.reason || '当前记录未触发报警事件原因。'}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeSignalList(selected.active_signals).map((signal) => (
                  <span key={signal} className="ops-inline-tile px-2 py-1 text-xs">{backendSignalLabel(signal)}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
