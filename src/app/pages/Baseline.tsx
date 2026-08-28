import { Activity, DatabaseZap, RotateCcw, ShieldCheck, Snowflake, Clock3, Layers3, LockKeyhole } from 'lucide-react';
import { useWellControl, type BaselineChannelSnapshot } from '../context/WellControlContext';
import { MonitoringWellTabs } from '../components/MonitoringWellTabs';
import { formatSourceDateTime } from '../lib/sourceTime';

const CHANNEL_ORDER = [
  'standpipe_pressure',
  'outlet_flow',
  'outlet_density',
  'total_pit_volume',
  'casing_pressure',
  'total_gas',
];

const STATE_META: Record<string, { label: string; className: string }> = {
  Active: { label: '有效', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' },
  Candidate: { label: '候选积累', className: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200' },
  Quarantine: { label: '异常隔离', className: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200' },
  LocalWindow: { label: '局部窗口', className: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200' },
  LocalAnchor: { label: '局部锚点', className: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200' },
  Unavailable: { label: '暂无参考', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200' },
};

const CHANNEL_META: Record<string, { label: string; unit: string; role: string; decimals: number }> = {
  standpipe_pressure: { label: '立压', unit: 'MPa', role: '核心压力参考', decimals: 3 },
  outlet_flow: { label: '出口流量', unit: 'L/s', role: '核心流量参考', decimals: 3 },
  outlet_density: { label: '出口密度', unit: 'g/cm³', role: '密度一致性参考', decimals: 3 },
  total_pit_volume: { label: '总池体积', unit: 'm³', role: '局部库存窗口', decimals: 2 },
  casing_pressure: { label: '套压', unit: 'MPa', role: '局部压力锚点', decimals: 3 },
  total_gas: { label: '全烃', unit: '原始单位', role: '描述性观测（不参与基线）', decimals: 2 },
};

function formatNumber(value: number | null | undefined, digits = 2) {
  return value === null || value === undefined || !Number.isFinite(value) ? '--' : value.toFixed(digits);
}

function formatReferenceValue(channel: BaselineChannelSnapshot, value: number | null) {
  if (value === null || !Number.isFinite(value)) return '--';
  switch (channel.channel) {
    case 'standpipe_pressure':
    case 'casing_pressure':
      return `${formatNumber(value / 1_000_000, 3)} MPa`;
    case 'outlet_flow':
      return `${formatNumber(value * 1_000, 3)} L/s`;
    case 'outlet_density':
      return `${formatNumber(value / 1_000, 3)} g/cm³`;
    default:
      return formatNumber(value);
  }
}

function channelMeta(channel: BaselineChannelSnapshot) {
  return CHANNEL_META[channel.channel] || { label: channel.label || channel.channel, unit: 'SI', role: '算法参考', decimals: 2 };
}

function formatExposure(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '未配置';
  if (seconds < 60) return `${Math.round(seconds)} 秒`;
  return `${(seconds / 60).toFixed(seconds >= 3600 ? 1 : 0)} 分钟`;
}

function formatSampleValue(value: number | null | undefined, unit: string, digits = 2) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '--'
    : `${value.toFixed(digits)} ${unit}`;
}

function formatPumpState(value: string) {
  const normalized = value.trim().toLowerCase();
  if (['running', 'stable', 'circulating'].includes(normalized)) return '运行中';
  if (['stopped', 'pumpstopped', '停泵'].includes(normalized)) return '停泵';
  if (['starting', 'stopping', 'transition', 'pumpstarting', 'pumpstopping'].includes(normalized)) return '过渡';
  return value || '未知';
}

function formatState(state: string) {
  return STATE_META[state] || { label: state || '未知', className: 'bg-slate-100 text-slate-600' };
}

function channelSampleCount(channel: BaselineChannelSnapshot) {
  return Math.max(channel.supportingSampleCount, channel.activeSampleCount, channel.candidateSampleCount);
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

function ChannelRow({ channel, minimum }: { channel: BaselineChannelSnapshot; minimum: number }) {
  const state = formatState(channel.state);
  const meta = channelMeta(channel);
  const count = channelSampleCount(channel);
  const progress = channel.state === 'LocalWindow' || channel.state === 'LocalAnchor'
    ? 100
    : Math.min(100, (count / Math.max(minimum, 1)) * 100);
  const expected = formatReferenceValue(channel, channel.expectedSiValue);
  const interval = channel.lowerBoundSiValue !== null && channel.upperBoundSiValue !== null
    ? `${formatReferenceValue(channel, channel.lowerBoundSiValue)} – ${formatReferenceValue(channel, channel.upperBoundSiValue)}`
    : '不提供长期预测';

  return (
    <tr>
      <td>
        <div className="font-medium text-slate-900 dark:text-slate-100">{meta.label}</div>
        <div className="mt-0.5 text-[11px] ops-muted">{channel.channel} · {meta.unit}</div>
      </td>
      <td>
        <span className={`rounded px-2 py-0.5 text-xs ${state.className}`}>{state.label}</span>
        {channel.frozen && <div className="mt-1 text-[11px] text-red-600 dark:text-red-300">异常证据期间停止更新</div>}
      </td>
      <td className="min-w-[180px]">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="tabular-nums">{channel.state === 'LocalWindow' || channel.state === 'LocalAnchor' ? '局部计算' : `${count} / ${minimum}`}</span>
          <span className="ops-muted">{channel.state === 'LocalWindow' || channel.state === 'LocalAnchor' ? '—' : `${Math.round(progress)}%`}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-cyan-500" style={{ width: `${progress}%` }} />
        </div>
      </td>
       <td>
         <div className="tabular-nums text-slate-900 dark:text-slate-100">实时 {formatReferenceValue(channel, channel.currentSiValue)}</div>
         <div className="mt-0.5 text-xs text-slate-700 dark:text-slate-200">中心 {expected}</div>
         <div className="mt-0.5 text-[11px] ops-muted">范围 {interval}</div>
      </td>
      <td>
        <div className="text-xs text-slate-700 dark:text-slate-200">{meta.role}</div>
        <div className="mt-0.5 max-w-[260px] text-[11px] ops-muted">{channel.applicability || channel.modelKind || '—'}</div>
      </td>
    </tr>
  );
}

export default function Baseline() {
  const { handleReset, selectedWellId, wells, wellInfo, selectedWellView } = useWellControl();
  const activeWell = wells.find((well) => well.wellId === selectedWellId) || wellInfo;
  const activeWellLabel = activeWell?.wellName || '未选择井';
  const activeWellMeta = activeWell ? `${activeWell.wellId} · ${activeWell.blockName || activeWell.block || '实时监测井'}` : '未选择井';
  const baseline = selectedWellView.backendDetection.baselineSnapshot;
  const channels = [...baseline.channels].sort((left, right) => CHANNEL_ORDER.indexOf(left.channel) - CHANNEL_ORDER.indexOf(right.channel));
  const latestSamples = selectedWellView.historyRecords.slice(-12).reverse();
  const latestRecord = latestSamples[0];
  const lastUpdated = baseline.lastUpdatedAt || selectedWellView.currentSampleTime || (latestRecord ? `${latestRecord.date} ${latestRecord.time}` : '');
  const statusLabel = baseline.status === 'Ready'
    ? '核心参考已就绪'
    : baseline.status === 'ReadyWithQuarantine'
      ? '核心参考已就绪，部分通道隔离'
      : '当前工况参考积累中';
  const primaryCounts = channels
    .filter((channel) => ['standpipe_pressure', 'outlet_flow'].includes(channel.channel))
    .map(channelSampleCount);
  const primarySampleCount = primaryCounts.length > 0 ? Math.min(...primaryCounts) : 0;
  const outletUnit = selectedWellView.currentData.outletUnit || '原始单位';
  const outletSemantic = selectedWellView.currentData.outletSemantic || '未声明';

  return (
    <div className="ops-page space-y-4">
      <MonitoringWellTabs />
      <div className="ops-page-header">
        <div className="ops-page-header-copy">
          <div className="ops-eyebrow">基线</div>
          <h1 className="ops-title">基线管理</h1>
          <p className="text-sm ops-muted">展示算法条件参考库的成熟度、通道状态和异常隔离情况</p>
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
        <span className="ml-auto text-xs ops-muted">最近源时间：{formatSourceDateTime(lastUpdated) || '等待算法帧'}</span>
      </div>

      <div className="ops-stat-grid">
        <BaselineMetric label="核心参考状态" value={baseline.ready ? '已就绪' : '积累中'} note={statusLabel} />
        <BaselineMetric label="有效参考通道" value={`${baseline.readyChannelCount}/${baseline.channelCount || 0}`} note="按信号通道独立判定" />
        <BaselineMetric label="核心参考样本" value={primarySampleCount.toString()} note={`压力/流量取较小值 · 门槛 ${baseline.minimumReferenceSamples}`} />
        <BaselineMetric label="异常隔离通道" value={baseline.frozenChannelCount.toString()} note="冻结期间不写入参考库" />
      </div>

      <section className="ops-surface p-4">
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
          <Activity className="h-4 w-4 text-cyan-600" />
          当前算法基线口径
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <div className="ops-inline-tile p-3">
            <div className="text-[11px] ops-muted">参考库</div>
            <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">条件参考库</div>
            <div className="mt-1 text-xs ops-muted">{baseline.selection}</div>
          </div>
          <div className="ops-inline-tile p-3">
            <div className="text-[11px] ops-muted">成熟条件</div>
            <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">样本 ≥ {baseline.minimumReferenceSamples} 个</div>
            <div className="mt-1 text-xs ops-muted">持续暴露 ≥ {formatExposure(baseline.minimumReferenceExposureSeconds)}；按工况分桶</div>
          </div>
          <div className="ops-inline-tile p-3">
            <div className="text-[11px] ops-muted">正常更新</div>
            <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">Active 参考 · α=0.02</div>
            <div className="mt-1 text-xs ops-muted">只吸收允许学习的正常观测</div>
          </div>
          <div className="ops-inline-tile p-3">
            <div className="text-[11px] ops-muted">异常处理</div>
            <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">证据通道冻结</div>
            <div className="mt-1 text-xs ops-muted">池体积为局部窗口，套压为局部锚点</div>
          </div>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <div className="ops-inline-tile flex items-start gap-2 p-3">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
            <div><div className="text-[11px] ops-muted">最小暴露时间</div><div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{formatExposure(baseline.minimumReferenceExposureSeconds)}</div></div>
          </div>
          <div className="ops-inline-tile flex items-start gap-2 p-3">
            <Layers3 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
            <div><div className="text-[11px] ops-muted">当前工况键</div><div className="mt-1 truncate text-sm text-slate-900 dark:text-slate-100" title={channels.find((item) => item.operationContextKey)?.operationContextKey}>{channels.find((item) => item.operationContextKey)?.operationContextKey || '等待后端返回'}</div></div>
          </div>
          <div className="ops-inline-tile flex items-start gap-2 p-3">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
            <div><div className="text-[11px] ops-muted">出口通道口径</div><div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{outletUnit} · {outletSemantic}</div></div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="ops-surface overflow-hidden">
          <div className="border-b border-slate-200 bg-[#f6fafc] px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
              <ShieldCheck className="h-4 w-4 text-cyan-500" />
              条件参考通道
            </div>
            <div className="mt-1 text-xs ops-muted">当前帧返回的 SI 参考值；现场单位仅在展示层换算。局部窗口/锚点不代表长期参考库已成熟。</div>
          </div>
          {channels.length === 0 ? (
            <div className="ops-empty-state m-3 min-h-[220px]">
              <div>
                <div className="ops-empty-icon"><Activity className="h-4 w-4" /></div>
                <div className="text-sm text-slate-700 dark:text-slate-200">等待后端参考库状态</div>
                <div className="mt-1 text-xs">开始监测并收到算法帧后，这里会显示每个信号通道的真实状态。</div>
              </div>
            </div>
          ) : (
            <div className="ops-scroll overflow-auto">
              <table className="ops-table min-w-[980px]" aria-label="条件参考通道">
                <thead>
                  <tr>
                    <th className="text-left">信号通道</th>
                    <th className="text-left">状态</th>
                    <th className="text-left">样本成熟度</th>
                    <th className="text-left">实时值 / 参考中心</th>
                    <th className="text-left">用途与口径</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((channel) => <ChannelRow key={channel.channel} channel={channel} minimum={baseline.minimumReferenceSamples} />)}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="ops-surface h-fit p-4">
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
            <Snowflake className="h-4 w-4 text-sky-500" />
            当前基线状态
          </div>
          <div className={`ops-break-text rounded-md border p-3 text-sm ${
            baseline.ready
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
              : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
          }`}>
            {statusLabel}
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="ops-inline-tile flex justify-between px-3 py-2">
              <span className="ops-muted">参考来源</span>
              <span className="max-w-[180px] truncate text-right">{baseline.source || '—'}</span>
            </div>
            <div className="ops-inline-tile flex justify-between px-3 py-2">
              <span className="ops-muted">候选规则</span>
              <span className="tabular-nums">{baseline.minimumReferenceSamples} 个样本</span>
            </div>
            <div className="ops-inline-tile flex justify-between px-3 py-2">
              <span className="ops-muted">隔离通道</span>
              <span className="tabular-nums">{baseline.frozenChannelCount}</span>
            </div>
            <div className="ops-inline-tile flex justify-between px-3 py-2">
              <span className="ops-muted">最后后端帧</span>
              <span className="max-w-[180px] truncate text-right">{formatSourceDateTime(baseline.lastUpdatedAt) || '—'}</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-3 text-xs leading-5 ops-muted dark:border-slate-800">
            “重置当前井基线”只清理当前井后端参考学习状态及前端快照；不会删除原始遥测，也不会改变告警事件历史。下一帧重新进入候选积累。
          </div>
        </aside>
      </div>

      <section className="ops-surface overflow-hidden">
        <div className="border-b border-slate-200 bg-[#f6fafc] px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
            <DatabaseZap className="h-4 w-4 text-cyan-500" />
            近期实时样本
          </div>
        </div>
        {latestSamples.length === 0 ? (
          <div className="p-4 text-sm ops-muted">等待实时样本写入。</div>
        ) : (
          <div className="ops-scroll overflow-auto">
            <table className="ops-table min-w-[760px]" aria-label="近期实时样本">
              <thead>
                <tr>
                  <th className="text-left">时间</th>
                  <th className="text-right">泵状态</th>
                    <th className="text-right">立压 (MPa)</th>
                    <th className="text-right">出口流量 ({outletUnit})</th>
                    <th className="text-right">全烃 (原始)</th>
                  <th className="text-center">参考状态</th>
                </tr>
              </thead>
              <tbody>
                {latestSamples.map((record) => (
                  <tr key={record.id}>
                    <td className="whitespace-nowrap text-xs ops-muted">{record.date} {record.time}</td>
                     <td className="text-right tabular-nums">{formatPumpState(record.pumpState)}</td>
                    <td className="text-right tabular-nums">{formatSampleValue(record.spp, 'MPa', 3)}</td>
                    <td className="text-right tabular-nums">{formatSampleValue(record.flowOut, outletUnit, 3)}</td>
                    <td className="text-right tabular-nums">{formatNumber(record.totalGas, 3)}</td>
                    <td className="text-center">
                      <span className={`rounded px-2 py-0.5 text-xs ${record.baselineValid ? 'bg-emerald-50 text-emerald-700' : record.baselineWarmup ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {record.baselineValid ? '核心参考有效' : record.baselineWarmup ? '积累中' : '不可用'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
