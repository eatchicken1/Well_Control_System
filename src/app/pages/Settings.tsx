import { useState } from 'react';
import { AlertTriangle, CheckCircle, Info, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import { DEFAULT_REALTIME_ENDPOINT, DEFAULT_THRESHOLDS, useWellControl } from '../context/WellControlContext';
import { OpsProcedureRail } from '../components/OpsProcedureRail';

function ThresholdInput({
  label, value, activeValue, unit, onChange, min, max, step, description, level,
}: {
  label: string; value: number; activeValue: number; unit: string; onChange: (v: number) => void;
  min: number; max: number; step: number; description: string; level: 'warning' | 'critical';
}) {
  const tone = level === 'critical'
    ? 'border-red-200 bg-red-50 dark:border-red-900/70 dark:bg-red-950/20'
    : 'border-amber-200 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/20';
  const clampValue = (next: number) => Math.min(max, Math.max(min, next));
  const precision = step < 0.1 ? 2 : step < 1 ? 1 : 0;
  const changeBy = (delta: number) => onChange(Number(clampValue(value + delta).toFixed(precision)));

  return (
    <div className={`rounded-md border p-3 ${tone}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm text-slate-800 dark:text-slate-100">{label}</div>
          <div className="text-[11px] ops-muted">{description}</div>
        </div>
        <span className={`rounded px-1.5 py-0.5 text-[11px] ${level === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'}`}>
          {level === 'critical' ? '严重' : '预警'}
        </span>
      </div>
      <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
        <div className="ops-control-input w-full sm:w-[156px] sm:max-w-full">
          <button type="button" onClick={() => changeBy(-step)} aria-label={`${label} 减少`}>
            -
          </button>
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(clampValue(parseFloat(e.target.value) || 0))}
          />
          <button type="button" onClick={() => changeBy(step)} aria-label={`${label} 增加`}>
            +
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm ops-muted">{unit}</span>
          <span className="ops-inline-tile px-1.5 py-0.5 text-[11px] text-slate-600 dark:text-slate-300">
            草稿 {value}
          </span>
          {value !== activeValue && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 sm:ml-auto">
              生效 {activeValue}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ThresholdGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ops-panel p-4">
      <h3 className="mb-3 flex items-center gap-2 text-base text-slate-800 dark:text-slate-100">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function PlainConfigInput({
  label,
  value,
  unit,
  onChange,
  min,
  max,
  step,
  description,
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  description: string;
}) {
  const clampValue = (next: number) => Math.min(max, Math.max(min, next));
  const precision = step < 0.1 ? 2 : step < 1 ? 1 : 0;
  const changeBy = (delta: number) => onChange(Number(clampValue(value + delta).toFixed(precision)));

  return (
    <div className="ops-inline-tile p-3">
      <div className="mb-2">
        <div className="text-sm text-slate-800 dark:text-slate-100">{label}</div>
        <div className="text-[11px] ops-muted">{description}</div>
      </div>
      <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
        <div className="ops-control-input w-full sm:w-[156px] sm:max-w-full">
          <button type="button" onClick={() => changeBy(-step)} aria-label={`${label} 减少`}>
            -
          </button>
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(clampValue(parseFloat(e.target.value) || 0))}
          />
          <button type="button" onClick={() => changeBy(step)} aria-label={`${label} 增加`}>
            +
          </button>
        </div>
        <span className="text-sm ops-muted">{unit}</span>
      </div>
    </div>
  );
}

function ThresholdScale({
  label,
  warning,
  critical,
  unit,
  max,
}: {
  label: string;
  warning: number;
  critical: number;
  unit: string;
  max: number;
}) {
  const warnLeft = `${Math.max(0, Math.min(100, (warning / max) * 100))}%`;
  const criticalLeft = `${Math.max(0, Math.min(100, (critical / max) * 100))}%`;

  return (
    <div className="ops-inline-tile p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-slate-700 dark:text-slate-200">{label}</span>
        <span className="ops-muted">0 - {max} {unit}</span>
      </div>
      <div className="relative h-8">
        <div className="absolute left-0 right-0 top-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full w-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500" />
        </div>
        <div className="absolute top-0 h-8 w-px bg-amber-500" style={{ left: warnLeft }}>
          <span className="absolute left-1 top-0 whitespace-nowrap text-[10px] text-amber-600 dark:text-amber-300">W {warning}</span>
        </div>
        <div className="absolute top-0 h-8 w-px bg-red-500" style={{ left: criticalLeft }}>
          <span className="absolute left-1 bottom-0 whitespace-nowrap text-[10px] text-red-600 dark:text-red-300">C {critical}</span>
        </div>
      </div>
    </div>
  );
}

function ConfigGuardrail({
  label,
  value,
  state,
}: {
  label: string;
  value: string;
  state: 'normal' | 'warning' | 'critical';
}) {
  const tone = state === 'critical'
    ? 'text-red-600 dark:text-red-300'
    : state === 'warning'
      ? 'text-amber-600 dark:text-amber-300'
      : 'text-emerald-600 dark:text-emerald-300';

  return (
    <div className="ops-status-cell">
      <div className="text-[11px] ops-muted">{label}</div>
      <div className={`mt-1 flex items-center gap-2 text-sm ${tone}`}>
        <span className={`ops-led h-2 w-2 rounded-full ${state === 'critical' ? 'bg-red-500' : state === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} data-state={state} />
        {value}
      </div>
    </div>
  );
}

function ConfigRiskBanner({
  invalid,
  changedCount,
  saved,
}: {
  invalid: boolean;
  changedCount: number;
  saved: boolean;
}) {
  const shell = invalid
    ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/25 dark:text-red-100'
    : saved
      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
      : changedCount > 0
        ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/25 dark:text-amber-100'
        : 'border-slate-200 bg-[#f6fafc] text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200';
  const label = invalid ? '配置锁定' : saved ? '同步完成' : changedCount > 0 ? '草稿待生效' : '配置一致';
  const copy = invalid
    ? '存在参考线顺序反转，保存动作已被锁定。'
    : saved
      ? '显示参数已同步到实时监测页曲线。后端判级未受影响。'
      : changedCount > 0
        ? `${changedCount} 项显示参数处于草稿状态。`
        : '当前草稿与生效显示参数一致。';

  return (
    <div className={`rounded-md border p-3 ${shell}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="ops-inline-tile px-2 py-0.5 text-xs dark:bg-white/10">{label}</span>
        <span className="text-sm">{copy}</span>
      </div>
    </div>
  );
}

export default function Settings() {
  const { thresholds, updateThresholds, dataSourceState, realtimeEndpoint, updateRealtimeEndpoint } = useWellControl();
  const [draft, setDraft] = useState({ ...thresholds });
  const [endpointDraft, setEndpointDraft] = useState(realtimeEndpoint);
  const [saved, setSaved] = useState(false);
  const thresholdInvalid = draft.returnResponseWarning >= draft.returnResponseCritical || draft.pitGainWarning >= draft.pitGainCritical;
  const algorithmInvalid =
    draft.sppResidualWarning >= draft.sppResidualCritical
    || draft.rlsForgettingFactor <= 0
    || draft.rlsForgettingFactor >= 1
    || draft.cusumDecisionInterval <= 0
    || draft.madTolerance <= 0;
  const configInvalid = thresholdInvalid || algorithmInvalid;

  const handleSave = () => {
    if (configInvalid) return;
    updateThresholds(draft);
    updateRealtimeEndpoint(endpointDraft);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_THRESHOLDS });
    setEndpointDraft(DEFAULT_REALTIME_ENDPOINT);
  };

  const set = (key: keyof typeof draft) => (v: number) => setDraft((prev) => ({ ...prev, [key]: v }));
  const changedCount = (Object.keys(draft) as Array<keyof typeof draft>).filter((key) => draft[key] !== thresholds[key]).length
    + (endpointDraft.trim() !== realtimeEndpoint ? 1 : 0);
  const configSteps = [
    {
      code: '01',
      label: '编辑草稿',
      value: changedCount > 0 ? `${changedCount} 项待保存` : '无改动',
      state: changedCount > 0 ? 'active' as const : 'done' as const,
      icon: SlidersHorizontal,
    },
    {
      code: '02',
      label: '等级校验',
      value: configInvalid ? '存在无效参数' : '顺序正确',
      state: configInvalid ? 'critical' as const : 'done' as const,
      icon: AlertTriangle,
    },
    {
      code: '03',
      label: '同步监测',
      value: saved ? '已同步' : changedCount > 0 ? '等待生效' : '阈值一致',
      state: saved ? 'done' as const : changedCount > 0 ? 'warning' as const : 'idle' as const,
      icon: Save,
    },
    {
      code: '04',
      label: '曲线阈值线',
      value: '监测页 / 历史页',
      state: configInvalid ? 'idle' as const : 'done' as const,
      icon: CheckCircle,
    },
  ];

  return (
    <div className="ops-page space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="ops-eyebrow">Display reference</div>
          <h1 className="ops-title">系统设置</h1>
          <p className="text-sm ops-muted">配置曲线参考线与基线显示参数；报警等级由后端独立返回</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
          <button onClick={handleReset} className="ops-button-secondary">
            <RotateCcw className="h-4 w-4" />
            恢复默认
          </button>
          <button onClick={handleSave} disabled={configInvalid} className="ops-button-primary">
            <Save className="h-4 w-4" />
            保存设置
          </button>
        </div>
      </div>

      <ConfigRiskBanner invalid={configInvalid} changedCount={changedCount} saved={saved} />

      <div className="ops-status-line">
        <ConfigGuardrail
          label="阈值顺序"
          value={configInvalid ? '存在无效参数' : '预警低于严重'}
          state={configInvalid ? 'critical' : 'normal'}
        />
        <ConfigGuardrail
          label="草稿状态"
          value={changedCount > 0 ? `${changedCount} 项未保存` : '与生效值一致'}
          state={changedCount > 0 ? 'warning' : 'normal'}
        />
        <ConfigGuardrail
          label="同步目标"
          value={dataSourceState.status === 'connected' ? '真实数据 / 曲线阈值线' : '真实接口 / 曲线阈值线'}
          state="normal"
        />
      </div>

      <OpsProcedureRail steps={configSteps} compact />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1.18fr)_360px]">
        <div className="space-y-4">
          <section className="ops-panel p-4">
            <h3 className="mb-3 flex items-center gap-2 text-base text-slate-800 dark:text-slate-100">
              <SlidersHorizontal className="h-4 w-4 text-cyan-500" />
              实时数据源
            </h3>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-200">实时数据接口</label>
                <input
                  value={endpointDraft}
                  onChange={(event) => setEndpointDraft(event.target.value)}
                  placeholder={DEFAULT_REALTIME_ENDPOINT}
                  className="ops-field w-full px-3 py-2 text-sm"
                />
                <div className="mt-1 text-[11px] ops-muted">
                  默认读取本机 MySQL 代理接口；实时记录字段使用 standpipe_pressure_mpa、pump_spm_total、total_gas_pct、hook_load_kn、total_pit_volume_m3 等标准列。
                </div>
              </div>
              <div className={`rounded-md border p-3 text-xs ${
                dataSourceState.status === 'connected'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
                  : dataSourceState.status === 'error' || dataSourceState.status === 'disconnected'
                    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-100'
                    : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
              }`}>
                <div className="font-medium">{dataSourceState.adapterName}</div>
                <div className="mt-1">{dataSourceState.message}</div>
                <div className="mt-2 tabular-nums opacity-75">样本 {dataSourceState.recordCount} · {dataSourceState.lastRecordAt || '--:--:--'}</div>
              </div>
            </div>
          </section>

          <ThresholdGroup title="出口流量响应曲线参考">
            <ThresholdInput label="参考线 1" value={draft.returnResponseWarning} activeValue={thresholds.returnResponseWarning} unit="%" onChange={set('returnResponseWarning')} min={0} max={60} step={0.1} description="仅用于曲线标尺，不参与后端判级" level="warning" />
            <ThresholdInput label="参考线 2" value={draft.returnResponseCritical} activeValue={thresholds.returnResponseCritical} unit="%" onChange={set('returnResponseCritical')} min={0} max={100} step={0.1} description="仅用于曲线标尺，不参与后端判级" level="critical" />
          </ThresholdGroup>

          <ThresholdGroup title="总池体积曲线参考">
            <ThresholdInput label="参考线 1" value={draft.pitGainWarning} activeValue={thresholds.pitGainWarning} unit="m3" onChange={set('pitGainWarning')} min={0} max={10} step={0.1} description="仅用于曲线标尺，不参与后端判级" level="warning" />
            <ThresholdInput label="参考线 2" value={draft.pitGainCritical} activeValue={thresholds.pitGainCritical} unit="m3" onChange={set('pitGainCritical')} min={0} max={20} step={0.1} description="仅用于曲线标尺，不参与后端判级" level="critical" />
          </ThresholdGroup>

          <ThresholdGroup title="压力与钻井液曲线参考">
            <ThresholdInput label="套压参考线" value={draft.casingPressureWarning} activeValue={thresholds.casingPressureWarning} unit="MPa" onChange={set('casingPressureWarning')} min={0} max={10} step={0.1} description="仅用于曲线标尺" level="warning" />
            <ThresholdInput label="钻井液密度参考线" value={draft.mudWeightWarning} activeValue={thresholds.mudWeightWarning} unit="g/cm3" onChange={set('mudWeightWarning')} min={0.8} max={1.4} step={0.01} description="仅用于曲线标尺" level="warning" />
          </ThresholdGroup>

          <ThresholdGroup title="曲线与基线参考参数">
            <ThresholdInput label="立压残差参考线 1" value={draft.sppResidualWarning} activeValue={thresholds.sppResidualWarning} unit="MPa" onChange={set('sppResidualWarning')} min={0.1} max={2} step={0.01} description="仅用于前端参考显示" level="warning" />
            <ThresholdInput label="立压残差参考线 2" value={draft.sppResidualCritical} activeValue={thresholds.sppResidualCritical} unit="MPa" onChange={set('sppResidualCritical')} min={0.2} max={3} step={0.01} description="仅用于前端参考显示" level="critical" />
            <PlainConfigInput label="CUSUM 参考区间" value={draft.cusumDecisionInterval} unit="score" onChange={set('cusumDecisionInterval')} min={2} max={9} step={0.1} description="历史曲线显示参数" />
            <PlainConfigInput label="RLS 遗忘因子" value={draft.rlsForgettingFactor} unit="lambda" onChange={set('rlsForgettingFactor')} min={0.9} max={0.999} step={0.001} description="基线质量显示参数" />
            <PlainConfigInput label="MAD 容忍倍数" value={draft.madTolerance} unit="x" onChange={set('madTolerance')} min={1} max={6} step={0.1} description="历史偏离显示参数" />
            <PlainConfigInput label="全烃迟到窗口" value={draft.gasLagWindowMinutes} unit="min" onChange={set('gasLagWindowMinutes')} min={10} max={180} step={5} description="气测窗口显示参数" />
            <PlainConfigInput label="停泵出口流量衰减率" value={draft.stopFlowDecayThreshold} unit="%" onChange={set('stopFlowDecayThreshold')} min={40} max={98} step={1} description="停泵分析参考参数" />
            <PlainConfigInput label="冷启动周期数" value={draft.coldStartCycleCount} unit="cycles" onChange={set('coldStartCycleCount')} min={5} max={40} step={1} description="基线进入正式评估前的周期要求" />
            <PlainConfigInput label="协方差惩罚参考值" value={draft.covariancePenaltyThreshold} unit="rho" onChange={set('covariancePenaltyThreshold')} min={0.1} max={0.9} step={0.01} description="历史多参数分析参考值" />
          </ThresholdGroup>
        </div>

        <aside className="ops-panel h-fit p-4 xl:sticky xl:top-4">
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
            <SlidersHorizontal className="h-4 w-4 text-cyan-500" />
            阈值联锁面板
            <span className={`ml-auto rounded px-2 py-0.5 text-[11px] ${changedCount > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'}`}>
              {changedCount > 0 ? `${changedCount} 项待保存` : '无改动'}
            </span>
          </div>
          <div className={`mb-3 rounded-md border p-3 text-xs ${
            configInvalid
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/25 dark:text-red-200'
              : changedCount > 0
                ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/25 dark:text-amber-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-200'
          }`}>
            {configInvalid ? '参考线校验失败：参考线 1 必须低于参考线 2。' : changedCount > 0 ? '存在未保存草稿，保存后仅同步到前端曲线显示。' : '所有显示参数与当前生效值一致。'}
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button onClick={handleReset} className="ops-button-secondary justify-center px-2">
              <RotateCcw className="h-4 w-4" />
              默认
            </button>
            <button onClick={handleSave} disabled={configInvalid} className="ops-button-primary justify-center px-2">
              <Save className="h-4 w-4" />
              生效
            </button>
          </div>
          <div className="mb-2 text-[11px] uppercase tracking-[0.16em] ops-muted">Active Values</div>
          <div className="space-y-2 text-sm">
            {[ 
              ['出口流量响应预警', `${thresholds.returnResponseWarning}%`],
              ['出口流量响应严重', `${thresholds.returnResponseCritical}%`],
              ['总池体积变化预警', `${thresholds.pitGainWarning} m3`],
              ['总池体积变化严重', `${thresholds.pitGainCritical} m3`],
              ['套压预警', `${thresholds.casingPressureWarning} MPa`],
              ['密度下限', `${thresholds.mudWeightWarning} g/cm3`],
              ['立压残差', `${thresholds.sppResidualWarning}/${thresholds.sppResidualCritical} MPa`],
              ['CUSUM曲线参考', `${thresholds.cusumDecisionInterval} 分`],
              ['MAD曲线参考', `${thresholds.madTolerance}x`],
            ].map(([label, value]) => (
              <div key={label} className="ops-inline-tile flex items-center justify-between px-3 py-2">
                <span className="ops-muted">{label}</span>
                <span className="tabular-nums text-slate-900 dark:text-slate-100">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <ThresholdScale
              label="出口流量响应阈值尺"
              warning={draft.returnResponseWarning}
              critical={draft.returnResponseCritical}
              unit="%"
              max={100}
            />
            <ThresholdScale
              label="总池体积变化阈值尺"
              warning={draft.pitGainWarning}
              critical={draft.pitGainCritical}
              unit="m3"
              max={20}
            />
          </div>
          <div className="mt-4 rounded-md border border-blue-200 bg-[#f4faff] p-3 text-xs text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/20 dark:text-blue-200">
            <div className="mb-1 flex items-center gap-1.5 font-medium">
              <Info className="h-3.5 w-3.5" />
              判级边界
            </div>
            此处参数仅控制曲线参考线和历史显示，不生成、升级或取消任何报警事件。
          </div>
        </aside>
      </div>
    </div>
  );
}
