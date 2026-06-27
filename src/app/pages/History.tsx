import { useCallback, useEffect, useState } from 'react';
import { Database, Download, Eye, RefreshCw, X } from 'lucide-react';
import { useWellControl, type AlertStatus, type BackendLevel } from '../context/WellControlContext';
import { MonitoringWellTabs } from '../components/MonitoringWellTabs';
import { BACKEND_LEVEL_META, backendSignalLabel } from '../lib/backendDetection';
import { authenticatedFetch } from '../api/authToken';

type DbHistoryRecord = {
  id?: number;
  frame?: number;
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

function displayTime(value?: string) {
  if (!value) return '--';
  return value.replace('T', ' ');
}

function activeSignalList(value?: string) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

export default function History() {
  const {
    wellInfo,
    selectedStartTime,
    currentSampleTime,
    buildRealtimeApiUrl,
    monitoredWellIds,
    realtimeTabWellIds,
    selectedWellId,
    wells,
  } = useWellControl();
  const activeWellIds = [...new Set([
    ...monitoredWellIds,
    ...realtimeTabWellIds,
    ...(selectedWellId ? [selectedWellId] : []),
  ])];
  const activeWellLabel = wells.find((well) => well.wellId === selectedWellId)?.wellName || wells.find((well) => well.wellId === activeWellIds[0])?.wellName || wellInfo.wellName;
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<DbHistoryRecord | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState('');

  const loadPage = useCallback(async (nextPage = page) => {
    if (!wellInfo?.wellId) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(PAGE_SIZE),
      });
      if (selectedStartTime) params.set('startTime', selectedStartTime.replace('T', ' ') + (selectedStartTime.length === 16 ? ':00' : ''));
      const replayEndTime = currentSampleTime || (selectedStartTime ? selectedStartTime.replace('T', ' ') + (selectedStartTime.length === 16 ? ':00' : '') : '');
      if (replayEndTime) params.set('endTime', replayEndTime);
      const url = buildRealtimeApiUrl(`/wells/${encodeURIComponent(wellInfo.wellId)}/history?${params.toString()}`);
      const response = await authenticatedFetch(url, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
      setPayload(data);
      setPage(data.page || nextPage);
      setLastLoadedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [buildRealtimeApiUrl, currentSampleTime, page, selectedStartTime, wellInfo?.wellId]);

  useEffect(() => {
    setPage(1);
    loadPage(1);
  }, [wellInfo?.wellId, selectedStartTime, currentSampleTime]);

  useEffect(() => {
    const timer = window.setInterval(() => loadPage(1), 30_000);
    return () => window.clearInterval(timer);
  }, [loadPage]);

  const records = payload?.records || [];
  const highCount = records.filter((record) => finite(record.public_level) >= 4).length;
  const warnCount = records.filter((record) => finite(record.public_level) >= 2 && finite(record.public_level) < 4).length;
  const replayEndLabel = currentSampleTime || (selectedStartTime ? selectedStartTime.replace('T', ' ') : '--');

  const exportCSV = () => {
    const headers = ['时间', '出口流量响应(%)', '入口流量', '出口流量', '总池体积', '总池体积变化', '立压变化量', '套压', '全烃', '报警等级', '原因'];
    const rows = records.map((record) => [
      displayTime(record.timestamp || record.sample_time),
      finite(record.return_response_pct).toFixed(1),
      finite(record.inlet_smooth).toFixed(2),
      finite(record.outlet_smooth).toFixed(2),
      finite(record.pool_smooth).toFixed(2),
      finite(record.pool_delta_abs).toFixed(2),
      finite(record.standpipe_change_mpa).toFixed(2),
      finite(record.cp).toFixed(2),
      finite(record.gas).toFixed(2),
      `L${finite(record.public_level)}`,
      record.reason || '',
    ].join(','));
    const blob = new Blob(['\uFEFF' + [headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="ops-eyebrow">数据库复核</div>
          <h1 className="ops-title">数据库复核</h1>
          <p className="text-sm ops-muted">
            表格直接查询数据库，按当前回放时间向前复核，最新记录在第一页，每 30 秒自动刷新。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => loadPage(1)} className="ops-button-secondary" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button onClick={exportCSV} className="ops-button-primary" disabled={records.length === 0}>
            <Download className="h-4 w-4" />
            导出当前页
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="ops-panel-soft p-3">
          <div className="text-[11px] ops-muted">当前井组</div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{activeWellLabel} 等 {Math.max(1, activeWellIds.length)} 口</div>
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

      <div className="ops-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#f6fafc] px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 ops-muted">
            <Database className="h-4 w-4" />
            <span>第 {payload?.page ?? page} / {payload?.totalPages ?? 1} 页</span>
            <span>最新刷新 {lastLoadedAt || '--:--:--'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="ops-button-secondary px-2 py-1 text-xs" disabled={page <= 1 || loading} onClick={() => loadPage(page - 1)}>上一页</button>
            <button className="ops-button-secondary px-2 py-1 text-xs" disabled={page >= (payload?.totalPages ?? 1) || loading} onClick={() => loadPage(page + 1)}>下一页</button>
          </div>
        </div>
        {error ? (
          <div className="m-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-200">{error}</div>
        ) : (
          <div className="ops-scroll max-h-[calc(100vh-330px)] overflow-auto">
            <table className="ops-table">
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
                  const level = finite(record.public_level) as BackendLevel;
                  const status = levelStatus(level);
                  return (
                    <tr key={`${record.id || record.frame || index}-${record.timestamp}`} className={status === 'critical' ? 'bg-red-50/60 dark:bg-red-950/20' : status === 'warning' ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}>
                      <td className="whitespace-nowrap text-xs ops-muted">
                        {displayTime(record.timestamp || record.sample_time)}
                        <span className="ml-1 text-[10px] text-slate-400">#{record.source_row_no || record.id || record.frame || index}</span>
                      </td>
                      <td className="text-right tabular-nums">{finite(record.return_response_pct).toFixed(1)}%</td>
                      <td className="text-right tabular-nums text-emerald-600 dark:text-emerald-300">{finite(record.inlet_smooth).toFixed(2)}</td>
                      <td className="text-right tabular-nums text-blue-600 dark:text-blue-300">{finite(record.outlet_smooth).toFixed(2)}</td>
                      <td className="text-right tabular-nums">{finite(record.pool_smooth).toFixed(2)}</td>
                      <td className="text-right tabular-nums">{finite(record.pool_delta_abs).toFixed(2)}</td>
                      <td className="text-right tabular-nums">{finite(record.standpipe_change_mpa).toFixed(2)}</td>
                      <td className="text-right tabular-nums">{finite(record.gas).toFixed(2)}</td>
                      <td className="text-center"><span className={`rounded px-2 py-0.5 text-xs ${statusBadge(status)}`}>L{level} {STATUS_LABELS[status]}</span></td>
                      <td className="text-right">
                        <button onClick={() => setSelected(record)} className="ops-button-secondary px-2 py-1 text-xs">
                          <Eye className="h-3.5 w-3.5" />
                          查看
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {records.length === 0 && (
              <div className="ops-empty-state m-3 min-h-[160px]">
                <div>
                  <div className="text-sm text-slate-700 dark:text-slate-200">数据库当前没有可复核记录</div>
                  <div className="mt-1 text-xs">请确认已选择开始时间，并且数据库接口可访问。</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-xl rounded-md border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="ops-eyebrow">复核详情</div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">复核详情</h3>
              </div>
              <button className="ops-button-secondary px-2 py-1" onClick={() => setSelected(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="ops-inline-tile p-2"><span className="ops-muted">时间 </span>{displayTime(selected.timestamp || selected.sample_time)}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">报警等级 </span>L{finite(selected.public_level)} {BACKEND_LEVEL_META[finite(selected.public_level) as BackendLevel]?.label || ''}</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">入口流量 </span>{finite(selected.inlet_smooth).toFixed(2)} L/s</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">出口流量 </span>{finite(selected.outlet_smooth).toFixed(2)} L/s</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">总池体积变化 </span>{finite(selected.pool_delta_abs).toFixed(2)} m3</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">立压变化量 </span>{finite(selected.standpipe_change_mpa).toFixed(2)} MPa</div>
              <div className="ops-inline-tile p-2"><span className="ops-muted">全烃 </span>{finite(selected.gas).toFixed(2)}%</div>
            </div>
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="font-medium text-slate-900 dark:text-slate-100">判定原因</div>
              <div className="mt-1 ops-muted">{selected.reason || '当前记录未触发报警事件原因。'}</div>
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
