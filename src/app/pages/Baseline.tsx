import { Activity, DatabaseZap, RotateCcw, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { useWellControl } from '../context/WellControlContext';
import { MonitoringWellTabs } from '../components/MonitoringWellTabs';

function sampleBadge(record: ReturnType<typeof useWellControl>['historyRecords'][number]) {
  if (record.backendLevel >= 4) return { label: '异常', className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200' };
  if (record.baselineWarmup) return { label: '预热', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200' };
  if (record.baselineValid) return { label: '有效', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' };
  return { label: '未就绪', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200' };
}

function BaselineMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="ops-panel-soft p-3">
      <div className="text-[11px] ops-muted">{label}</div>
      <div className="mt-1 text-2xl tabular-nums text-slate-900 dark:text-slate-100">{value}</div>
      <div className="mt-1 text-xs ops-muted">{note}</div>
    </div>
  );
}

function formatNumber(value: number, digits: number) {
  return Number.isFinite(value) ? value.toFixed(digits) : '--';
}

function formatNumberWithUnit(value: number, digits: number, unit: string) {
  const formatted = formatNumber(value, digits);
  return formatted === '--' ? formatted : `${formatted}${unit}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function Baseline() {
  const { baselineInfo, historyRecords, handleReset, thresholds, selectedWellId, wells, wellInfo, selectedWellView } = useWellControl();
  const activeWell = wells.find((well) => well.wellId === selectedWellId) || wellInfo;
  const activeWellLabel = activeWell?.wellName || '未选择井';
  const activeWellMeta = activeWell ? `${activeWell.wellId} · ${activeWell.blockName || activeWell.block || '实时监测井'}` : '未选择井';
  const viewHistoryRecords = selectedWellView.historyRecords.length > 0 ? selectedWellView.historyRecords : historyRecords;
  const viewBaselineInfo = useMemo(() => {
    const detection = selectedWellView.backendDetection;
    const totalCycles = Math.max(viewHistoryRecords.length, detection.baselineCount);
    const acceptedCycleCount = detection.baselineCount;
    const frozenCycles = Math.max(0, viewHistoryRecords.filter((record) => record.backendLevel >= 4).length);
    const coverageBase = detection.baselineValid
      ? 100
      : (acceptedCycleCount / Math.max(thresholds.coldStartCycleCount, 1)) * 100;
    const qualityPenalty = totalCycles > 0 ? (frozenCycles / Math.max(totalCycles, 1)) * 100 : 0;
    const isColdStart = detection.baselineWarmup || !detection.baselineValid;
    return {
      ...baselineInfo,
      totalCycles,
      qualifiedCycles: acceptedCycleCount,
      frozenCycles,
      acceptedCycleCount,
      isColdStart,
      coldStartRemaining: Math.max(0, thresholds.coldStartCycleCount - acceptedCycleCount),
      qualityScore: clamp(coverageBase - qualityPenalty * 0.6, 0, 100),
      templateCoverage: clamp(coverageBase, 0, 100),
      lastResetReason: detection.baselineInvalidReason || (isColdStart ? '等待后端基线状态稳定' : null),
      lastResetTime: detection.baselineEndTime || null,
    };
  }, [baselineInfo, selectedWellView.backendDetection, thresholds.coldStartCycleCount, viewHistoryRecords]);
  const latestSamples = viewHistoryRecords.slice(-12).reverse();

  return (
    <div className="ops-page space-y-4">
      <MonitoringWellTabs />
      <div className="ops-page-header">
        <div className="ops-page-header-copy">
          <div className="ops-eyebrow">基线</div>
          <h1 className="ops-title">基线管理</h1>
          <p className="text-sm ops-muted">展示后端算法返回的有效样本、基线质量和异常样本处理情况</p>
        </div>
        <button type="button" onClick={handleReset} className="ops-button-secondary" aria-label={`重置 ${activeWellLabel} 基线`}>
          <RotateCcw className="h-4 w-4" />
          重置当前井基线
        </button>
      </div>
      <div className="ops-inline-tile flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
        <span className="ops-muted">当前基线井</span>
        <span className="font-medium text-slate-900 dark:text-slate-100">{activeWellLabel}</span>
        <span className="text-xs ops-muted">{activeWellMeta}</span>
      </div>

      <div className="ops-stat-grid">
        <BaselineMetric label="有效样本" value={viewBaselineInfo.qualifiedCycles.toString()} note={`目标 ${thresholds.coldStartCycleCount} 组`} />
        <BaselineMetric label="异常样本" value={viewBaselineInfo.frozenCycles.toString()} note="已识别异常不纳入基线统计" />
        <BaselineMetric label="覆盖率" value={formatNumberWithUnit(viewBaselineInfo.templateCoverage, 0, '%')} note="后端基线样本覆盖" />
        <BaselineMetric label="稳定度" value={formatNumberWithUnit(viewBaselineInfo.qualityScore, 0, '%')} note={viewBaselineInfo.isColdStart ? `仍需 ${viewBaselineInfo.coldStartRemaining} 组样本` : '背景状态稳定'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="ops-surface p-4 xl:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
            <Activity className="h-4 w-4 text-cyan-600" />
            当前算法基线口径
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="ops-inline-tile p-3">
              <div className="text-[11px] ops-muted">出口流量背景</div>
              <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">滑动窗口 + EWMA</div>
            </div>
            <div className="ops-inline-tile p-3">
              <div className="text-[11px] ops-muted">总池体积背景</div>
              <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">长程背景 + 异常剔除</div>
            </div>
            <div className="ops-inline-tile p-3">
              <div className="text-[11px] ops-muted">等级来源</div>
              <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">实时检测结果</div>
            </div>
          </div>
        </section>

        <section className="ops-surface overflow-hidden">
          <div className="border-b border-slate-200 bg-[#f6fafc] px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
              <DatabaseZap className="h-4 w-4 text-cyan-500" />
              近期实时样本
            </div>
          </div>
          <div className="ops-scroll max-h-[calc(100vh-330px)] overflow-auto">
            {latestSamples.length === 0 ? (
              <div className="ops-empty-state m-3 min-h-[180px]">
                <div>
                  <div className="ops-empty-icon">
                    <DatabaseZap className="h-4 w-4" />
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-200">等待实时样本写入</div>
                  <div className="mt-1 text-xs">采集开始后，最新样本会在这里形成复核列表。</div>
                </div>
              </div>
            ) : (
              <>
              <table className="ops-table hidden md:table" aria-label="近期实时样本">
                <thead>
                  <tr>
                    <th className="text-left">时间</th>
                    <th className="text-right">泵状态</th>
                    <th className="text-right">立压</th>
                    <th className="text-right">出口流量响应</th>
                    <th className="text-right">全烃</th>
                    <th className="text-center">样本标记</th>
                  </tr>
                </thead>
                <tbody>
                  {latestSamples.map((record) => {
                    const badge = sampleBadge(record);
                    return (
                      <tr key={record.id}>
                        <td className="whitespace-nowrap text-xs ops-muted">{record.date} {record.time}</td>
                        <td className="text-right tabular-nums">{record.pumpState}</td>
                        <td className="text-right tabular-nums">{formatNumber(record.spp, 2)}</td>
                        <td className="text-right tabular-nums">{formatNumberWithUnit(record.returnResponse, 1, '%')}</td>
                        <td className="text-right tabular-nums">{formatNumber(record.totalGas, 2)}</td>
                        <td className="text-center">
                          <span className={`rounded px-2 py-0.5 text-xs ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="divide-y divide-slate-200 md:hidden dark:divide-slate-800" role="list" aria-label="近期实时样本">
                {latestSamples.map((record) => {
                  const badge = sampleBadge(record);
                  return (
                    <article key={`mobile-${record.id}`} role="listitem" className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{record.date} {record.time}</div>
                          <div className="mt-0.5 text-[11px] ops-muted">{record.pumpState}</div>
                        </div>
                        <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="ops-inline-tile min-w-0 p-2">
                          <div className="ops-muted">立压</div>
                          <div className="mt-1 tabular-nums">{formatNumber(record.spp, 2)}</div>
                        </div>
                        <div className="ops-inline-tile min-w-0 p-2">
                          <div className="ops-muted">出口响应</div>
                          <div className="mt-1 tabular-nums">{formatNumberWithUnit(record.returnResponse, 1, '%')}</div>
                        </div>
                        <div className="ops-inline-tile min-w-0 p-2">
                          <div className="ops-muted">全烃</div>
                          <div className="mt-1 tabular-nums">{formatNumber(record.totalGas, 2)}</div>
                        </div>
                        <div className="ops-inline-tile min-w-0 p-2">
                          <div className="ops-muted">基线</div>
                          <div className="mt-1 tabular-nums">{record.baselineValid ? '有效' : record.baselineWarmup ? '预热' : '未就绪'}</div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              </>
            )}
          </div>
        </section>

        <aside className="ops-surface h-fit p-4">
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            当前基线状态
          </div>
          <div className={`ops-break-text rounded-md border p-3 text-sm ${
            viewBaselineInfo.isColdStart
              ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
          }`}>
            {viewBaselineInfo.lastResetReason || (viewBaselineInfo.isColdStart ? '样本积累中：持续评估样本质量。' : '基线状态稳定，可用于实时监测展示。')}
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="ops-inline-tile flex justify-between px-3 py-2">
              <span className="ops-muted">样本状态</span>
              <span className="tabular-nums">{viewBaselineInfo.isColdStart ? '积累中' : '稳定'}</span>
            </div>
            <div className="ops-inline-tile flex justify-between px-3 py-2">
              <span className="ops-muted">待补样本</span>
              <span className="tabular-nums">{viewBaselineInfo.coldStartRemaining}</span>
            </div>
            <div className="ops-inline-tile flex justify-between px-3 py-2">
              <span className="ops-muted">基线截止</span>
              <span className="min-w-0 truncate text-right">{viewBaselineInfo.lastResetTime || '无'}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
