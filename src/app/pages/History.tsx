import { useState } from 'react';
import { ClipboardCheck, Database, Download, Filter, LineChart as LineChartIcon, Table2 } from 'lucide-react';
import { useWellControl } from '../context/WellControlContext';
import { OpsProcedureRail } from '../components/OpsProcedureRail';
import { VerticalCurveDeck } from '../components/VerticalCurveDeck';

type FilterStatus = 'all' | 'normal' | 'warning' | 'critical';

const STATUS_LABELS: Record<string, string> = { normal: '正常', warning: '预警', critical: '严重' };
const STATUS_BADGES: Record<string, string> = {
  normal: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
  critical: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200',
};

function SummaryCell({ label, value, unit, state }: { label: string; value: string; unit: string; state?: 'normal' | 'warning' | 'critical' }) {
  const tone = state === 'critical' ? 'text-red-600 dark:text-red-300' : state === 'warning' ? 'text-amber-600 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100';
  return (
    <div className="ops-panel-soft min-w-0 p-2.5">
      <div className="text-[11px] ops-muted">{label}</div>
      <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1">
        <span className={`text-xl tabular-nums ${tone}`}>{value}</span>
        <span className="text-[11px] ops-muted">{unit}</span>
      </div>
    </div>
  );
}

function RatioBar({ label, value, tone }: { label: string; value: number; tone: 'warning' | 'critical' }) {
  const width = `${Math.max(0, Math.min(100, value))}%`;
  const color = tone === 'critical' ? 'bg-red-500' : 'bg-amber-400';

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="ops-muted">{label}</span>
        <span className={tone === 'critical' ? 'text-red-600 dark:text-red-300' : 'text-amber-600 dark:text-amber-300'}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width }} />
      </div>
    </div>
  );
}

function ReplayStatusCell({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warning' | 'critical' }) {
  const color = tone === 'critical'
    ? 'text-red-600 dark:text-red-300'
    : tone === 'warning'
      ? 'text-amber-600 dark:text-amber-300'
      : 'text-slate-900 dark:text-slate-100';

  return (
    <div className="ops-status-cell">
      <div className="text-[11px] ops-muted">{label}</div>
      <div className={`mt-1 truncate text-sm tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function ReplayModeStrip({
  activeTab,
  setActiveTab,
  displayedCount,
  totalCount,
  chartCount,
}: {
  activeTab: 'table' | 'chart';
  setActiveTab: (tab: 'table' | 'chart') => void;
  displayedCount: number;
  totalCount: number;
  chartCount: number;
}) {
  return (
    <div className="grid gap-2 border-b border-slate-200 bg-[#f6fafc] px-3 py-2 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[auto_minmax(0,1fr)]">
      <div className="ops-segment w-max">
        <button data-active={activeTab === 'table'} onClick={() => setActiveTab('table')}>
          <Table2 className="mr-1 inline h-3.5 w-3.5" />
          表格复核
        </button>
        <button data-active={activeTab === 'chart'} onClick={() => setActiveTab('chart')}>
          <LineChartIcon className="mr-1 inline h-3.5 w-3.5" />
          竖曲线回放
        </button>
      </div>
      <div className="grid gap-1.5 text-xs sm:grid-cols-3">
        <div className="ops-inline-tile px-2 py-1.5">
          <span className="ops-muted">显示 </span>
          <span className="tabular-nums text-slate-900 dark:text-slate-100">{displayedCount}/{totalCount}</span>
        </div>
        <div className="ops-inline-tile px-2 py-1.5">
          <span className="ops-muted">趋势窗口 </span>
          <span className="tabular-nums text-slate-900 dark:text-slate-100">{chartCount} 点</span>
        </div>
        <div className="ops-inline-tile px-2 py-1.5">
          <span className="ops-muted">模式 </span>
          <span className="text-slate-900 dark:text-slate-100">{activeTab === 'table' ? '事件逐条复核' : 'V7 竖曲线阈值回放'}</span>
        </div>
      </div>
    </div>
  );
}

export default function History() {
  const { historyRecords, thresholds, currentData } = useWellControl();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [activeTab, setActiveTab] = useState<'table' | 'chart'>(() => {
    if (typeof window === 'undefined') return 'table';
    return new URLSearchParams(window.location.search).get('view') === 'chart' ? 'chart' : 'table';
  });

  const filtered = filterStatus === 'all' ? historyRecords : historyRecords.filter((r) => r.status === filterStatus);
  const displayed = [...filtered].reverse();
  const chartRows = historyRecords.slice(-80);
  const replayReady = chartRows.length >= 2;
  const replayFlowData = replayReady
    ? chartRows.map((row) => ({
      time: row.time,
      flowIn: row.flowIn,
      flowOut: row.flowOut,
      returnResponse: row.returnResponse,
      pitGain: row.pitGain,
      pitVolume: row.pitVolume,
      spm: row.spm,
      totalGas: row.totalGas,
      hookLoad: row.hookLoad,
    }))
    : [];
  const replayPressureData = replayReady
    ? chartRows.map((row) => ({
      time: row.time,
      casingPressure: row.casingPressure,
      drillPipePressure: row.drillPipePressure,
      spp: row.spp,
      sppPredicted: currentData.sppPredicted,
    }))
    : [];

  const exportCSV = () => {
    const headers = ['时间', '日期', '总池体积(m3)', '总池体积变化(m3)', '出口流量响应(%)', '入口流量', '出口流量', '套压(MPa)', '立压(MPa)', '泵冲(spm)', '全烃(%)', '钩载(kN)', '钻井液密度(g/cm3)', '机械钻速(m/h)', '钻头深度(m)', '周期状态', '后端判级', '状态'];
    const rows = historyRecords.map((r) =>
      [r.time, r.date, r.pitVolume.toFixed(2), r.pitGain.toFixed(2), r.returnResponse.toFixed(1), r.flowIn.toFixed(2), r.flowOut.toFixed(2),
       r.casingPressure.toFixed(2), r.spp.toFixed(2), r.spm.toFixed(0), r.totalGas.toFixed(2), r.hookLoad.toFixed(1),
       r.mudWeight.toFixed(2), r.rop.toFixed(1), r.bitDepth.toFixed(1), `S${r.cycleState}`, `L${r.backendLevel}`, STATUS_LABELS[r.status]].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `well_history_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const avgReturnResponse = historyRecords.length > 0 ? historyRecords.reduce((s, r) => s + r.returnResponse, 0) / historyRecords.length : 0;
  const maxPitGain = historyRecords.length > 0 ? Math.max(...historyRecords.map((r) => r.pitGain)) : 0;
  const anomalyCount = historyRecords.filter((r) => r.status !== 'normal').length;
  const criticalRecords = historyRecords.filter((r) => r.status === 'critical').length;
  const anomalyRatio = historyRecords.length > 0 ? (anomalyCount / historyRecords.length) * 100 : 0;
  const criticalRatio = historyRecords.length > 0 ? (criticalRecords / historyRecords.length) * 100 : 0;
  const latestRecord = historyRecords.at(-1);
  const highestBackendLevel = historyRecords.reduce((highest, record) => Math.max(highest, record.backendLevel), 0);
  const backendSummaryState = highestBackendLevel >= 4 ? 'critical' as const : highestBackendLevel >= 2 ? 'warning' as const : 'normal' as const;
  const firstRecord = historyRecords[0];
  const replayWindow = firstRecord && latestRecord ? `${firstRecord.time} - ${latestRecord.time}` : '等待采集';
  const latestTone = latestRecord?.status === 'critical' ? 'critical' : latestRecord?.status === 'warning' ? 'warning' : 'normal';
  const replaySteps = [
    {
      code: '01',
      label: '采样归档',
      value: historyRecords.length > 0 ? `${historyRecords.length} 条记录` : '等待采集',
      state: historyRecords.length > 0 ? 'done' as const : 'idle' as const,
      icon: Database,
    },
    {
      code: '02',
      label: '状态筛选',
      value: filterStatus === 'all' ? '全部状态' : STATUS_LABELS[filterStatus],
      state: filterStatus === 'all' ? 'idle' as const : 'active' as const,
      icon: Filter,
    },
    {
      code: '03',
      label: '复核模式',
      value: activeTab === 'table' ? '事件逐条复核' : '曲线阈值回放',
      state: 'active' as const,
      icon: activeTab === 'table' ? Table2 : LineChartIcon,
    },
    {
      code: '04',
      label: '异常结论',
      value: criticalRecords > 0 ? `${criticalRecords} 条严重` : anomalyCount > 0 ? `${anomalyCount} 条异常` : '未发现异常',
      state: criticalRecords > 0 ? 'critical' as const : anomalyCount > 0 ? 'warning' as const : 'done' as const,
      icon: ClipboardCheck,
    },
  ];
  const setReplayTab = (tab: 'table' | 'chart') => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === 'chart') url.searchParams.set('view', 'chart');
    else url.searchParams.delete('view');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  return (
    <div className="ops-page space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="ops-eyebrow">历史复盘</div>
          <h1 className="ops-title">历史数据复核</h1>
          <p className="text-sm ops-muted">保留最近 {historyRecords.length} 条采集记录，用于班后复盘与异常追溯</p>
        </div>
        <button onClick={exportCSV} className="ops-button-primary">
          <Download className="h-4 w-4" />
          导出 CSV
        </button>
      </div>

      {activeTab === 'table' ? (
        <>
          <div className="grid grid-cols-3 gap-1.5 md:gap-2">
            <SummaryCell label="平均出口流量响应" value={avgReturnResponse.toFixed(1)} unit="%" state={backendSummaryState} />
            <SummaryCell label="最大总池体积变化" value={maxPitGain.toFixed(2)} unit="m3" state={backendSummaryState} />
            <SummaryCell label="异常记录数" value={anomalyCount.toString()} unit="条" state={anomalyCount > 0 ? 'warning' : 'normal'} />
          </div>

          <div className="ops-panel-soft grid gap-3 p-2.5 md:grid-cols-2">
            <RatioBar label="异常记录占比" value={anomalyRatio} tone="warning" />
            <RatioBar label="严重记录占比" value={criticalRatio} tone="critical" />
          </div>

          <div className="ops-status-line">
            <ReplayStatusCell
              label="复盘时间窗"
              value={replayWindow}
              tone={latestTone}
            />
            <ReplayStatusCell
              label="样本容量"
              value={historyRecords.length > 0 ? `${chartRows.length} 点趋势 / ${historyRecords.length} 条记录` : '暂无数据'}
            />
            <ReplayStatusCell
              label="风险摘要"
              value={criticalRecords > 0 ? `${criticalRecords} 条严重记录` : anomalyCount > 0 ? `${anomalyCount} 条异常记录` : '未发现异常'}
              tone={criticalRecords > 0 ? 'critical' : anomalyCount > 0 ? 'warning' : 'normal'}
            />
          </div>

          <OpsProcedureRail steps={replaySteps} compact />
        </>
      ) : (
        <div className="ops-panel-soft grid grid-cols-2 gap-2 p-2.5 text-xs md:grid-cols-4">
          <div>
            <div className="ops-muted">回放模式</div>
            <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">V7 竖曲线优先</div>
          </div>
          <div>
            <div className="ops-muted">样本状态</div>
            <div className="mt-1 text-sm tabular-nums text-slate-900 dark:text-slate-100">{replayReady ? `${chartRows.length} 点` : `${chartRows.length}/2 预热`}</div>
          </div>
          <div>
            <div className="ops-muted">回放窗口</div>
            <div className="mt-1 truncate text-sm tabular-nums text-slate-900 dark:text-slate-100">{replayReady ? replayWindow : '等待历史样本写入'}</div>
          </div>
          <div>
            <div className="ops-muted">风险摘要</div>
            <div className={`mt-1 text-sm ${criticalRecords > 0 ? 'text-red-600 dark:text-red-300' : anomalyCount > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
              {criticalRecords > 0 ? `${criticalRecords} 条严重` : anomalyCount > 0 ? `${anomalyCount} 条异常` : '未发现异常'}
            </div>
          </div>
        </div>
      )}

      <div className="ops-panel overflow-hidden">
        <ReplayModeStrip
          activeTab={activeTab}
          setActiveTab={setReplayTab}
          displayedCount={displayed.length}
          totalCount={historyRecords.length}
          chartCount={chartRows.length}
        />
        {activeTab === 'table' && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-b border-slate-200 bg-[#f6fafc] px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 ops-muted" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="ops-field px-2 py-1.5"
              >
                <option value="all">全部状态</option>
                <option value="normal">正常</option>
                <option value="warning">预警</option>
                <option value="critical">严重</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'table' ? (
          <div className="ops-scroll max-h-[calc(100vh-330px)] overflow-auto">
            {displayed.length === 0 ? (
              <div className="ops-empty-state m-3 min-h-[150px]">
                <div>
                  <div className="ops-empty-icon">
                    <Database className="h-4 w-4" />
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-200">暂无可复核记录</div>
                  <div className="mt-1 text-xs">保持实时采集开启后，系统会每 2 秒写入一条历史样本</div>
                </div>
              </div>
            ) : (
              <table className="ops-table">
                <thead>
                  <tr>
                    <th className="text-left">时间</th>
                    <th className="text-right">总池体积</th>
                    <th className="text-right">总池体积变化</th>
                    <th className="text-right">出口流量响应</th>
                    <th className="text-right">入口流量</th>
                    <th className="text-right">出口流量</th>
                    <th className="text-right">套压</th>
                    <th className="text-right">立压</th>
                    <th className="text-right">泵冲</th>
                    <th className="text-right">全烃</th>
                    <th className="text-right">密度</th>
                    <th className="text-right">周期/后端判级</th>
                    <th className="text-center">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((r) => (
                    <tr key={r.id} className={r.status === 'critical' ? 'bg-red-50/60 dark:bg-red-950/20' : r.status === 'warning' ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}>
                      <td className="whitespace-nowrap text-xs ops-muted">{r.date} {r.time}</td>
                      <td className="text-right tabular-nums">{r.pitVolume.toFixed(2)}</td>
                      <td className="text-right tabular-nums">{r.pitGain.toFixed(2)}</td>
                      <td className="text-right tabular-nums">
                        <span className="inline-flex items-center justify-end gap-1">
                          {r.returnResponse.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-right tabular-nums text-emerald-600 dark:text-emerald-300">{r.flowIn.toFixed(2)}</td>
                      <td className="text-right tabular-nums text-blue-600 dark:text-blue-300">{r.flowOut.toFixed(2)}</td>
                      <td className="text-right tabular-nums">{r.casingPressure.toFixed(2)}</td>
                      <td className="text-right tabular-nums">{r.spp.toFixed(2)}</td>
                      <td className="text-right tabular-nums">{r.spm.toFixed(0)}</td>
                      <td className="text-right tabular-nums">{r.totalGas.toFixed(2)}</td>
                      <td className="text-right tabular-nums">{r.mudWeight.toFixed(2)}</td>
                      <td className="text-right tabular-nums">S{r.cycleState} / L{r.backendLevel}</td>
                      <td className="text-center">
                        <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGES[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="p-3">
            <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2 text-xs xl:grid-cols-4">
                  <div className="ops-inline-tile px-3 py-2">
                    <div className="ops-muted">回放样本</div>
                    <div className="mt-1 text-sm tabular-nums text-slate-900 dark:text-slate-100">
                      {replayReady ? `${chartRows.length} 点` : `${chartRows.length}/2 预热`}
                    </div>
                  </div>
                  <div className="ops-inline-tile px-3 py-2">
                    <div className="ops-muted">回放窗口</div>
                    <div className="mt-1 truncate text-sm tabular-nums text-slate-900 dark:text-slate-100">
                      {replayReady ? replayWindow : '等待历史样本写入'}
                    </div>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-[#fff9ee] px-3 py-2 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100">
                    <div>出口流量响应预警</div>
                    <div className="mt-1 text-sm tabular-nums">{thresholds.returnResponseWarning}%</div>
                  </div>
                  <div className="rounded-md border border-red-200 bg-[#fff5f5] px-3 py-2 text-red-800 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-100">
                    <div>出口流量响应严重</div>
                    <div className="mt-1 text-sm tabular-nums">{thresholds.returnResponseCritical}%</div>
                  </div>
                </div>

                <div className="relative h-[min(520px,calc(100vh-318px))] min-h-[360px]">
                  <VerticalCurveDeck
                    flowData={replayFlowData}
                    pressureData={replayPressureData}
                    thresholds={thresholds}
                    currentDepth={3200 + chartRows.length * 0.6}
                  />
                  {!replayReady && (
                    <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-md border border-cyan-200 bg-[#f6fafc]/94 p-3 text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-cyan-900/70 dark:bg-slate-950/92 dark:text-slate-200">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-cyan-600">
                          <LineChartIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm">竖曲线回放预热中</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            当前显示当前井况参考轨，采集到 2 条历史样本后自动切换为真实回放曲线
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                          <div className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">
                            <div className="ops-muted">样本</div>
                            <div className="tabular-nums">{chartRows.length}/2</div>
                          </div>
                          <div className="rounded bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                            <div>预警</div>
                            <div className="tabular-nums">{thresholds.returnResponseWarning}%</div>
                          </div>
                          <div className="rounded bg-red-50 px-2 py-1 text-red-700 dark:bg-red-950/30 dark:text-red-200">
                            <div>严重</div>
                            <div className="tabular-nums">{thresholds.returnResponseCritical}%</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          </div>
        )}
      </div>
    </div>
  );
}
