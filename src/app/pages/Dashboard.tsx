import { useMemo, type ElementType } from 'react';
import { useNavigate } from 'react-router';
import {
  Activity,
  ArrowRight,
  Bell,
  CheckCircle,
  DatabaseZap,
  Gauge,
  RadioTower,
  ShieldAlert,
  Waves,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { WellSchematic } from '../components/WellSchematic';
import { useWellControl, type BackendLevel, type FlowDataPoint } from '../context/WellControlContext';
import { useChartTheme } from '../hooks/useChartTheme';
import { BACKEND_LEVEL_META, backendSignalLabel } from '../lib/backendDetection';

type MetricState = 'normal' | 'warning' | 'critical';

function metricStateClass(state: MetricState) {
  if (state === 'critical') return 'dashboard-metric-critical';
  if (state === 'warning') return 'dashboard-metric-warning';
  return 'dashboard-metric-normal';
}

function statusText(level: BackendLevel, shutInActive: boolean) {
  if (level >= 4 && shutInActive) return '关井处置进行中';
  return `L${level} ${BACKEND_LEVEL_META[level].label}`;
}

function signalMetricState(signal: string, level: BackendLevel, activeSignals: string[]): MetricState {
  if (!activeSignals.includes(signal) || level < 2) return 'normal';
  return level >= 4 ? 'critical' : 'warning';
}

function MetricPanel({
  label,
  value,
  unit,
  state,
  icon: Icon,
  sparkData,
  color,
  helper,
}: {
  label: string;
  value: string;
  unit: string;
  state: MetricState;
  icon: ElementType;
  sparkData: Array<{ time: string; value: number }>;
  color: string;
  helper: string;
}) {
  const sparkId = `spark-${label.length}-${label.charCodeAt(0)}`;

  return (
    <div className={`dashboard-metric-panel ${metricStateClass(state)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="dashboard-panel-label">{label}</div>
          <div className="mt-1 flex min-w-0 items-baseline gap-1">
            <span className="dashboard-metric-value">{value}</span>
            <span className="dashboard-metric-unit">{unit}</span>
          </div>
        </div>
        <Icon className="h-4 w-4 shrink-0 opacity-70" />
      </div>
      <div className="mt-2 h-10">
        {sparkData.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={sparkId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area dataKey="value" type="monotone" stroke={color} fill={`url(#${sparkId})`} strokeWidth={1.8} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="dashboard-spark-empty" />
        )}
      </div>
      <div className="dashboard-metric-helper">{helper}</div>
    </div>
  );
}

function BackendLevelRail({ detection }: { detection: ReturnType<typeof useWellControl>['backendDetection'] }) {
  return (
    <div className="dashboard-panel p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="ops-eyebrow">Backend decision</div>
          <h2 className="dashboard-section-title">后端实时判级</h2>
        </div>
        <span className={`dashboard-chip ${detection.publicLevel >= 4 ? 'dashboard-chip-danger' : detection.publicLevel >= 2 ? 'dashboard-chip-warn' : 'dashboard-chip-ok'}`}>
          L{detection.publicLevel} {BACKEND_LEVEL_META[detection.publicLevel].shortLabel}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {([0, 1, 2, 3, 4] as BackendLevel[]).map((level) => (
          <div key={level} className={`rounded-md border px-2 py-2 text-center ${level === detection.publicLevel ? level >= 4 ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200' : level >= 2 ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200' : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/25 dark:text-emerald-200' : 'border-slate-200 bg-slate-50 text-slate-400 opacity-60 dark:border-slate-800 dark:bg-slate-900'}`}>
            <div className="text-xs font-semibold">L{level}</div>
            <div className="mt-0.5 truncate text-[10px]">{BACKEND_LEVEL_META[level].shortLabel}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="text-slate-800 dark:text-slate-100">{detection.reason || BACKEND_LEVEL_META[detection.publicLevel].description}</div>
        <div className="mt-1 ops-muted">
          {detection.activeSignals.length > 0 ? detection.activeSignals.map(backendSignalLabel).join(' · ') : '当前无后端活动异常信号'}
        </div>
      </div>
    </div>
  );
}

function TrendPanel({ data, chartTheme }: {
  data: Array<FlowDataPoint & { returnResponse: number; pitGain: number; totalGas: number }>;
  chartTheme: ReturnType<typeof useChartTheme>;
}) {
  return (
    <div className="dashboard-panel dashboard-chart-panel p-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="ops-eyebrow">Streaming time-series</div>
          <h2 className="dashboard-section-title">实时证据趋势</h2>
        </div>
        <div className="dashboard-legend">
          <span><i style={{ background: '#ef4444' }} />出口流量响应</span>
          <span><i style={{ background: '#0891b2' }} />总池体积变化</span>
          <span><i style={{ background: '#16a34a' }} />全烃</span>
        </div>
      </div>
      {data.length >= 2 ? (
        <ResponsiveContainer width="100%" height={276}>
          <AreaChart data={data} margin={{ top: 10, right: 14, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="dashboardReturnFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="dashboardPitFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#0891b2" stopOpacity={0.24} />
                <stop offset="100%" stopColor="#0891b2" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: chartTheme.axis }} axisLine={{ stroke: chartTheme.axisLine }} tickLine={{ stroke: chartTheme.axisLine }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: chartTheme.axis }} axisLine={{ stroke: chartTheme.axisLine }} tickLine={{ stroke: chartTheme.axisLine }} width={44} />
            <Tooltip contentStyle={chartTheme.tooltipContent} labelStyle={chartTheme.tooltipLabel} itemStyle={chartTheme.tooltipItem} />
            <Area type="monotone" dataKey="returnResponse" name="出口流量响应" stroke="#ef4444" fill="url(#dashboardReturnFill)" strokeWidth={2.4} dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="pitGain" name="总池体积变化" stroke="#0891b2" fill="url(#dashboardPitFill)" strokeWidth={2.1} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="totalGas" name="全烃" stroke="#16a34a" strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="ops-empty-state min-h-[276px]">
          <div>
            <div className="text-sm text-slate-700 dark:text-slate-200">等待实时样本</div>
            <div className="mt-1 text-xs">采集到 2 个样本后显示动态趋势。</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const chartTheme = useChartTheme();
  const {
    currentData,
    alertStatus,
    alerts,
    flowHistory,
    pressureHistory,
    backendDetection,
    baselineInfo,
    wellInfo,
    shutInActive,
    shutInStartedAt,
    startShutInProcedure,
    dataSourceState,
    historyRecords,
  } = useWellControl();

  const returnResponse = currentData.returnResponse;
  const unacknowledged = alerts.filter((alert) => !alert.acknowledged);
  const criticalCount = unacknowledged.filter((alert) => alert.level === 'critical').length;
  const warningCount = unacknowledged.filter((alert) => alert.level === 'warning').length;
  const trendData = useMemo(
    () =>
      flowHistory.slice(-90).map((point) => ({
        ...point,
        returnResponse: point.returnResponse ?? currentData.returnResponse,
        pitGain: point.pitGain ?? currentData.pitGain,
        totalGas: point.totalGas ?? currentData.totalGas,
      })),
    [currentData.pitGain, currentData.totalGas, flowHistory],
  );
  const returnState = signalMetricState('return_response', backendDetection.publicLevel, backendDetection.activeSignals);
  const pitState = signalMetricState('pit_volume', backendDetection.publicLevel, backendDetection.activeSignals);
  const gasState = signalMetricState('total_gas', backendDetection.publicLevel, backendDetection.activeSignals);
  const sppResidual = currentData.spp - currentData.sppPredicted;
  const sppState = signalMetricState('standpipe_pressure', backendDetection.publicLevel, backendDetection.activeSignals);
  const returnSpark = flowHistory.slice(-28).map((point) => ({ time: point.time, value: point.returnResponse ?? currentData.returnResponse }));
  const pitGainSpark = flowHistory.slice(-28).map((point) => ({ time: point.time, value: point.pitGain ?? currentData.pitGain }));
  const sppResidualSpark = pressureHistory.slice(-28).map((point) => ({ time: point.time, value: (point.spp ?? point.drillPipePressure) - (point.sppPredicted ?? point.drillPipePressure) }));
  const gasSpark = flowHistory.slice(-28).map((point) => ({ time: point.time, value: point.totalGas ?? currentData.totalGas }));

  return (
    <div className="ops-page dashboard-shell space-y-3">
      <div className="dashboard-command">
        <div className="min-w-0">
          <div className="ops-eyebrow text-red-700 dark:text-red-300">Well control command board</div>
          <h1 className="ops-title">{wellInfo.wellName} · 实时井控总览</h1>
          <p className="mt-1 text-sm ops-muted">
            {wellInfo.wellId} · {wellInfo.block} · {wellInfo.crew}
          </p>
        </div>
        <div className="dashboard-command-actions">
          <div className={`dashboard-status-pill dashboard-status-${alertStatus}`}>
            <span className={`ops-led h-2.5 w-2.5 rounded-full ${alertStatus === 'critical' ? 'bg-red-500' : alertStatus === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} data-state={alertStatus} />
            {statusText(backendDetection.publicLevel, shutInActive)}
          </div>
          {alertStatus === 'critical' && !shutInActive && (
            <button onClick={startShutInProcedure} className="ops-button-danger">
              <ShieldAlert className="h-4 w-4" />
              启动关井程序
            </button>
          )}
          <button onClick={() => navigate('/monitoring')} className="ops-button-primary">
            进入实时监测
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="dashboard-kpi-strip">
        <MetricPanel label="出口流量响应" value={returnResponse.toFixed(1)} unit="%" icon={Activity} state={returnState} sparkData={returnSpark} color="#c2410c" helper={backendDetection.activeSignals.includes('return_response') ? '后端活动信号' : '实时遥测'} />
        <MetricPanel label="总池体积变化" value={currentData.pitGain.toFixed(2)} unit="m3" icon={Waves} state={pitState} sparkData={pitGainSpark} color="#0f766e" helper={backendDetection.activeSignals.includes('pit_volume') ? '后端活动信号' : '实时遥测'} />
        <MetricPanel label="立压残差" value={sppResidual.toFixed(2)} unit="MPa" icon={Gauge} state={sppState} sparkData={sppResidualSpark} color="#475569" helper={`实测 ${currentData.spp.toFixed(2)} / 模型 ${currentData.sppPredicted.toFixed(2)}`} />
        <MetricPanel label="全烃" value={currentData.totalGas.toFixed(2)} unit="%" icon={RadioTower} state={gasState} sparkData={gasSpark} color="#15803d" helper={backendDetection.activeSignals.includes('total_gas') ? '后端活动信号' : '实时遥测'} />
      </div>

      <div className="dashboard-grid">
        <div className="space-y-3">
          <TrendPanel data={trendData} chartTheme={chartTheme} />

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
            <BackendLevelRail detection={backendDetection} />
            <div className="dashboard-panel p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="ops-eyebrow">Baseline quality</div>
                  <h2 className="dashboard-section-title">基线与数据源</h2>
                </div>
                <DatabaseZap className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
              </div>
              <div className="dashboard-baseline-grid">
                <div><span>合格样本</span><strong>{baselineInfo.qualifiedCycles}</strong></div>
                <div><span>冻结样本</span><strong>{baselineInfo.frozenCycles}</strong></div>
                <div><span>覆盖率</span><strong>{baselineInfo.templateCoverage.toFixed(0)}%</strong></div>
                <div><span>质控</span><strong>{baselineInfo.qualityScore.toFixed(0)}%</strong></div>
              </div>
              <div className="mt-3 ops-inline-tile p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="ops-muted">实时接口</span>
                <span className={`dashboard-chip ${dataSourceState.status === 'connected' ? 'dashboard-chip-ok' : 'dashboard-chip-warn'}`}>
                    {dataSourceState.status === 'connected' ? '已连接' : dataSourceState.status}
                  </span>
                </div>
                <div className="mt-1 truncate font-mono text-[10px] ops-muted">{dataSourceState.endpoint || dataSourceState.message}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div>样本 <span className="tabular-nums text-slate-900 dark:text-slate-100">{dataSourceState.recordCount || flowHistory.length}</span></div>
                  <div>历史 <span className="tabular-nums text-slate-900 dark:text-slate-100">{historyRecords.length}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="h-[360px]">
            <WellSchematic
              flowIn={currentData.flowIn}
              flowOut={currentData.flowOut}
              casingPressure={currentData.casingPressure}
              drillPipePressure={currentData.drillPipePressure}
              pitGain={currentData.pitGain}
              returnResponse={currentData.returnResponse}
              backendLevel={backendDetection.publicLevel}
              activeSignals={backendDetection.activeSignals}
              compact
              surface="light"
              metrics={[
                { label: '出口流量响应', value: returnResponse.toFixed(1), unit: '%', state: returnState },
                { label: '总池体积变化', value: currentData.pitGain.toFixed(2), unit: 'm3', state: pitState },
                { label: '立压', value: currentData.spp.toFixed(2), unit: 'MPa', state: sppState },
                { label: '全烃', value: currentData.totalGas.toFixed(2), unit: '%', state: gasState },
                { label: '泵冲', value: currentData.spm.toFixed(0), unit: 'spm', state: 'normal' },
                { label: '钩载', value: currentData.hookLoad.toFixed(0), unit: 'kN', state: 'normal' },
              ]}
            />
          </div>

          <div className="dashboard-panel p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="ops-eyebrow">Alert queue</div>
                <h2 className="dashboard-section-title">报警队列</h2>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="dashboard-chip dashboard-chip-danger">红 {criticalCount}</span>
                <span className="dashboard-chip dashboard-chip-warn">待复核 {warningCount}</span>
              </div>
            </div>
            <div className="space-y-2">
              {alerts.slice(0, 5).length === 0 ? (
                <div className="ops-empty-state min-h-[126px]">
                  <div>
                    <CheckCircle className="mx-auto mb-2 h-5 w-5 text-emerald-500" />
                    <div className="text-sm text-slate-700 dark:text-slate-200">报警队列清空</div>
                  </div>
                </div>
              ) : (
                alerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className={`dashboard-alert-row dashboard-alert-${alert.level}`}>
                    <div className="flex min-w-0 items-center gap-2">
                    <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] dark:bg-white/10">L{alert.backendLevel}</span>
                      <span className="min-w-0 flex-1 truncate">{alert.message}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] opacity-65">
                      <span>{alert.date} {alert.time}</span>
                      <span>{alert.acknowledged ? '已确认' : '未确认'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => navigate('/alerts')} className="mt-3 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-[#f6fafc] dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900">
              查看报警管理
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
