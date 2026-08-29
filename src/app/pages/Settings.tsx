import { FormEvent, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Gauge, Info, KeyRound, RotateCcw, Save, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { DEFAULT_REALTIME_ENDPOINT, DEFAULT_THRESHOLDS, MONITORING_WINDOW_OPTIONS, useWellControl, type MonitoringWindowMinutes, type ThresholdSettings } from '../context/WellControlContext';
import { MonitoringWellTabs } from '../components/MonitoringWellTabs';
import { useAuth } from '../context/AuthContext';
import { fetchSystemSettings, OUTLET_SIGNAL_SEMANTIC_SETTING_KEY, outletSignalSemanticFromSettings, outletSignalSemanticSetting, saveOutletSignalSemantic, type OutletSignalSemantic } from '../api/systemSettingsApi';
import { getAlarmSoundPreference, previewAlarmSound, setAlarmSoundPreference } from '../lib/alarmNotification';

type SettingsTab = 'global' | 'display';

const GLOBAL_TAB_ID = 'global';

/**
 * Shared numeric stepper for config values. Threshold-style inputs pass a
 * `level` to get the warning/critical tone and the effective-value chip.
 */
function ConfigNumberInput({
  label, value, activeValue, unit, onChange, min, max, step, description, level,
}: {
  label: string; value: number; activeValue?: number; unit: string; onChange: (v: number) => void;
  min: number; max: number; step: number; description: string; level?: 'warning' | 'critical';
}) {
  const tone = level === 'critical'
    ? 'border-red-200 bg-red-50 dark:border-red-900/70 dark:bg-red-950/20'
    : level === 'warning'
      ? 'border-amber-200 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/20'
      : '';
  const clampValue = (next: number) => Math.min(max, Math.max(min, next));
  const precision = step < 0.1 ? 2 : step < 1 ? 1 : 0;
  const [inputText, setInputText] = useState(String(value));
  const canDecrease = value > min;
  const canIncrease = value < max;
  const commitValue = (next: number) => {
    const clamped = Number(clampValue(next).toFixed(precision));
    onChange(clamped);
    setInputText(String(clamped));
  };
  const changeBy = (delta: number) => commitValue(value + delta);

  useEffect(() => {
    setInputText(String(value));
  }, [value]);

  return (
    <div className={`rounded-md border p-3 ${tone || 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm text-slate-800 dark:text-slate-100">{label}</div>
          <div className="text-[11px] ops-muted">{description}</div>
        </div>
        {level && (
          <span className={`rounded px-1.5 py-0.5 text-[11px] ${level === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'}`}>
            {level === 'critical' ? '严重' : '预警'}
          </span>
        )}
      </div>
      <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
        <div className="ops-control-input w-full sm:w-[156px] sm:max-w-full">
          <button
            type="button"
            onClick={() => changeBy(-step)}
            aria-label={`${label} 减少`}
            disabled={!canDecrease}
            title={canDecrease ? `${label} 减少` : `已到最小值 ${min}`}
          >
            -
          </button>
          <input
            type="number"
            aria-label={`${label} 数值`}
            value={inputText}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const nextText = e.target.value;
              setInputText(nextText);
              if (nextText.trim() === '' || nextText === '-' || nextText === '.' || nextText.endsWith('.')) return;
              const parsed = Number(nextText);
              if (Number.isFinite(parsed)) onChange(clampValue(parsed));
            }}
            onBlur={() => {
              if (inputText.trim() === '') {
                setInputText(String(value));
                return;
              }
              const parsed = Number(inputText);
              if (Number.isFinite(parsed)) {
                commitValue(parsed);
              } else {
                setInputText(String(value));
              }
            }}
          />
          <button
            type="button"
            onClick={() => changeBy(step)}
            aria-label={`${label} 增加`}
            disabled={!canIncrease}
            title={canIncrease ? `${label} 增加` : `已到最大值 ${max}`}
          >
            +
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm ops-muted">{unit}</span>
          {activeValue !== undefined && (
            <>
              <span className="ops-inline-tile px-1.5 py-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                草稿 {value}
              </span>
              {value !== activeValue && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 sm:ml-auto">
                  生效 {activeValue}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ThresholdGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ops-surface p-4">
      <h3 className="mb-3 flex items-center gap-2 text-base text-slate-800 dark:text-slate-100">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
    </section>
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
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const safeWarning = Number.isFinite(warning) ? warning : 0;
  const safeCritical = Number.isFinite(critical) ? critical : 0;
  const warnLeft = `${Math.max(0, Math.min(100, (safeWarning / safeMax) * 100))}%`;
  const criticalLeft = `${Math.max(0, Math.min(100, (safeCritical / safeMax) * 100))}%`;

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
          <span className="absolute left-1 top-0 whitespace-nowrap text-[10px] text-amber-600 dark:text-amber-300">W {safeWarning}</span>
        </div>
        <div className="absolute top-0 h-8 w-px bg-red-500" style={{ left: criticalLeft }}>
          <span className="absolute left-1 bottom-0 whitespace-nowrap text-[10px] text-red-600 dark:text-red-300">C {safeCritical}</span>
        </div>
      </div>
    </div>
  );
}

function ConfigRiskBanner({
  invalid,
  invalidReasons,
  changedCount,
  saved,
  id,
}: {
  invalid: boolean;
  invalidReasons: string[];
  changedCount: number;
  saved: boolean;
  id: string;
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
    ? `${invalidReasons[0] || '存在无效参数'}，保存动作已被锁定。`
    : saved
      ? '显示参数已同步到实时监测页曲线，报警等级不受显示参数影响。'
      : changedCount > 0
        ? `${changedCount} 项显示参数处于草稿状态。`
        : '当前草稿与生效显示参数一致。';

  return (
    <div
      id={id}
      className={`rounded-md border p-3 ${shell}`}
      role={invalid ? 'alert' : 'status'}
      aria-live={invalid ? 'assertive' : 'polite'}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="ops-inline-tile px-2 py-0.5 text-xs dark:bg-white/10">{label}</span>
        <span className="text-sm">{copy}</span>
      </div>
      {invalidReasons.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {invalidReasons.map((reason) => (
            <span key={reason} className="rounded bg-white/60 px-2 py-1 dark:bg-white/10">{reason}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Settings() {
  const { thresholds, updateThresholds, monitoringWindowMinutes, updateMonitoringWindowMinutes, dataSourceState, realtimeEndpoint, updateRealtimeEndpoint, wellInfo, selectedWellId, wells } = useWellControl();
  const { changePassword } = useAuth();
  const [tab, setTab] = useState<SettingsTab>('display');
  const [draft, setDraft] = useState<ThresholdSettings>({ ...thresholds });
  const [endpointDraft, setEndpointDraft] = useState(realtimeEndpoint);
  const [displaySaved, setDisplaySaved] = useState(false);
  const [endpointSaved, setEndpointSaved] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordState, setPasswordState] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [outletSemanticDraft, setOutletSemanticDraft] = useState<OutletSignalSemantic | null>(null);
  const [outletSemanticSaved, setOutletSemanticSaved] = useState<OutletSignalSemantic | null>(null);
  const [outletSemanticState, setOutletSemanticState] = useState<{ type: 'idle' | 'saving' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [alarmSoundEnabled, setAlarmSoundEnabled] = useState(getAlarmSoundPreference);
  const [alarmSoundState, setAlarmSoundState] = useState<{ type: 'idle' | 'testing' | 'error'; message: string }>({ type: 'idle', message: '' });
  const mountedRef = useRef(true);
  const savedResetTimeoutRef = useRef<number | null>(null);
  const passwordReady = passwordDraft.oldPassword.length > 0 && passwordDraft.newPassword.length >= 8 && passwordDraft.confirmPassword.length >= 8;
  const passwordMismatch = passwordDraft.confirmPassword.length > 0 && passwordDraft.newPassword !== passwordDraft.confirmPassword;
  const passwordSubmitDisabled = passwordSaving || !passwordReady || passwordMismatch;
  const thresholdInvalid = draft.pitGainWarning >= draft.pitGainCritical;
  const sppInvalid = draft.sppResidualWarning >= draft.sppResidualCritical;
  const endpointInvalid = endpointDraft.trim().length === 0;
  const invalidReasons = [
    thresholdInvalid ? '参考线 1 必须低于参考线 2' : '',
    sppInvalid ? '立压变化量参考线 1 必须低于参考线 2' : '',
  ].filter(Boolean);
  const configInvalid = invalidReasons.length > 0;
  const endpointChanged = endpointDraft.trim() !== realtimeEndpoint;
  const changedCount = (Object.keys(draft) as Array<keyof ThresholdSettings>).filter((key) => draft[key] !== thresholds[key]).length;
  const configBannerId = 'settings-config-status';
  const endpointHelpId = 'settings-endpoint-help';
  const currentWellLabel = wells.find((well) => well.wellId === selectedWellId)?.wellName || wellInfo.wellName || '当前井';

  useEffect(() => () => {
    mountedRef.current = false;
    if (savedResetTimeoutRef.current != null) window.clearTimeout(savedResetTimeoutRef.current);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchSystemSettings(controller.signal)
      .then((settings) => {
        if (controller.signal.aborted) return;
        const semantic = outletSignalSemanticFromSettings(settings);
        setOutletSemanticDraft(semantic);
        setOutletSemanticSaved(semantic);
      })
      .catch(() => {
        // The outlet semantic stays editable; saving will (re)create the key.
      });
    return () => controller.abort();
  }, []);

  const flashDisplaySaved = () => {
    setDisplaySaved(true);
    if (savedResetTimeoutRef.current != null) window.clearTimeout(savedResetTimeoutRef.current);
    savedResetTimeoutRef.current = window.setTimeout(() => {
      if (mountedRef.current) setDisplaySaved(false);
      savedResetTimeoutRef.current = null;
    }, 3000);
  };

  const handleSaveDisplay = () => {
    if (configInvalid) return;
    updateThresholds(draft);
    flashDisplaySaved();
  };

  const handleResetDisplay = () => {
    setDraft({ ...DEFAULT_THRESHOLDS });
  };

  const handleSaveEndpoint = () => {
    if (endpointInvalid) return;
    updateRealtimeEndpoint(endpointDraft.trim());
    setEndpointSaved(true);
    window.setTimeout(() => {
      if (mountedRef.current) setEndpointSaved(false);
    }, 3000);
  };

  const handleOutletSemanticSave = async () => {
    if (!outletSemanticDraft) {
      setOutletSemanticState({ type: 'error', message: '请先明确出口流量通道是实际流量还是代理测量。' });
      return;
    }
    setOutletSemanticState({ type: 'saving', message: '' });
    try {
      await saveOutletSignalSemantic(outletSemanticDraft);
      if (!mountedRef.current) return;
      setOutletSemanticSaved(outletSemanticDraft);
      setOutletSemanticState({ type: 'success', message: '出口通道定义已写入后端设置；实时帧会在服务端出口通道配置加载后反映该语义。' });
    } catch (error) {
      if (mountedRef.current) setOutletSemanticState({ type: 'error', message: error instanceof Error ? error.message : '出口通道定义保存失败。' });
    }
  };

  const toggleAlarmSound = () => {
    const next = !alarmSoundEnabled;
    setAlarmSoundEnabled(next);
    setAlarmSoundPreference(next);
  };

  const enableAndPreviewAlarmSound = async () => {
    setAlarmSoundState({ type: 'testing', message: '' });
    try {
      await previewAlarmSound();
      if (!mountedRef.current) return;
      setAlarmSoundEnabled(true);
      setAlarmSoundPreference(true);
      setAlarmSoundState({ type: 'idle', message: '试听成功；L3+ 新事件与升级事件会发出短促声光提示。' });
    } catch (error) {
      if (mountedRef.current) setAlarmSoundState({ type: 'error', message: error instanceof Error ? error.message : '声音试听失败。' });
    }
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordState({ type: 'idle', message: '' });
    if (!passwordDraft.oldPassword) {
      setPasswordState({ type: 'error', message: '请输入旧密码。' });
      return;
    }
    if (passwordDraft.newPassword.length < 8) {
      setPasswordState({ type: 'error', message: '新密码至少需要 8 位。' });
      return;
    }
    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setPasswordState({ type: 'error', message: '两次输入的新密码不一致。' });
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword(passwordDraft.oldPassword, passwordDraft.newPassword, passwordDraft.confirmPassword);
      if (!mountedRef.current) return;
      setPasswordDraft({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordState({ type: 'success', message: '密码已更新，下次登录请使用新密码。' });
    } catch (err) {
      if (mountedRef.current) setPasswordState({ type: 'error', message: err instanceof Error ? err.message : '密码修改失败。' });
    } finally {
      if (mountedRef.current) setPasswordSaving(false);
    }
  };

  const set = (key: keyof ThresholdSettings) => (v: number) => setDraft((prev) => ({ ...prev, [key]: v }));
  const setPasswordField = (key: keyof typeof passwordDraft) => (value: string) => {
    setPasswordDraft((prev) => ({ ...prev, [key]: value }));
    if (passwordState.type === 'error') setPasswordState({ type: 'idle', message: '' });
  };

  return (
    <div className="ops-page space-y-4">
      {/* Global settings live at the top level: one shared tab next to the well
          tabs, independent of which well is selected. */}
      <MonitoringWellTabs
        extraTabs={[{ id: GLOBAL_TAB_ID, label: '全局设置' }]}
        activeExtraTabId={tab === 'global' ? GLOBAL_TAB_ID : null}
        onExtraTabSelect={() => setTab('global')}
        onWellSelect={() => setTab('display')}
      />

      <div className="ops-page-header">
        <div className="ops-page-header-copy">
          <div className="ops-eyebrow">系统设置</div>
          <h1 className="ops-title">{tab === 'global' ? '全局设置' : `${currentWellLabel} · 监测显示设置`}</h1>
          <p className="text-sm ops-muted">
            {tab === 'global'
              ? '数据源、通道语义、声光提醒与账号安全，对所有井生效'
              : '当前井的曲线参考线与泳道窗口；报警判级始终由后端算法给出'}
          </p>
        </div>
      </div>

      {/* ------------------------- 全局设置 ------------------------- */}
      {tab === 'global' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <section className="ops-surface p-4">
              <h3 className="mb-3 flex items-center gap-2 text-base text-slate-800 dark:text-slate-100">
                <SlidersHorizontal className="h-4 w-4 text-cyan-500" />
                实时数据源
              </h3>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                  <label className="mb-1 block text-sm text-slate-700 dark:text-slate-200">实时数据接口</label>
                  <input
                    aria-label="实时数据接口"
                    aria-invalid={endpointInvalid}
                    aria-describedby={endpointHelpId}
                    value={endpointDraft}
                    onChange={(event) => setEndpointDraft(event.target.value)}
                    placeholder={DEFAULT_REALTIME_ENDPOINT}
                    className="ops-field w-full px-3 py-2 text-sm"
                  />
                  <div id={endpointHelpId} className={`mt-1 text-[11px] ${endpointInvalid ? 'text-red-600 dark:text-red-300' : 'ops-muted'}`}>
                    {endpointInvalid ? '实时数据接口不能为空。' : '默认读取本机接口；字段使用标准列。'}
                  </div>
                </div>
                <div className={`ops-break-text rounded-md border p-3 text-xs ${
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
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" className="ops-button-primary px-3 py-2 text-sm" disabled={endpointInvalid || !endpointChanged} onClick={handleSaveEndpoint}>
                  <Save className="h-4 w-4" />
                  {endpointChanged ? '保存数据源' : endpointSaved ? '已保存' : '与当前一致'}
                </button>
              </div>
            </section>

            <section className="ops-surface p-4" aria-labelledby="outlet-signal-setting-title">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id="outlet-signal-setting-title" className="flex items-center gap-2 text-base text-slate-800 dark:text-slate-100">
                    <Gauge className="h-4 w-4 text-cyan-500" />
                    出口通道定义
                  </h3>
                  <p className="mt-1 max-w-2xl text-[11px] leading-5 ops-muted">这是一项后端持久化的物理语义声明。真实出口流量允许使用入口/出口差值；代理测量仅用于出口流量趋势观察，系统不会把百分比当作流量参与物料平衡。实时判级仍以服务端随帧发布的通道配置为准。</p>
                </div>
                <span className={`rounded px-2 py-1 text-xs font-medium ${outletSemanticSaved ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100'}`}>
                  {outletSemanticSaved ? '后端已声明' : '待明确'}
                </span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={outletSemanticDraft === 'TrueVolumetricFlow'}
                  onClick={() => { setOutletSemanticDraft('TrueVolumetricFlow'); setOutletSemanticState({ type: 'idle', message: '' }); }}
                  className={`rounded-md border p-3 text-left transition-colors ${outletSemanticDraft === 'TrueVolumetricFlow' ? 'border-cyan-400 bg-cyan-50 ring-1 ring-cyan-300 dark:border-cyan-500 dark:bg-cyan-950/25 dark:ring-cyan-800' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600'}`}
                >
                  <div className="flex items-center justify-between gap-2"><strong className="text-sm text-slate-900 dark:text-slate-100">真实出口流量</strong><span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200">L/s / m³/s</span></div>
                  <div className="mt-2 text-xs leading-5 ops-muted">用于流量差、返出量与物料平衡证据。仅在传感器及换算版本已核验时选择。</div>
                </button>
                <button
                  type="button"
                  aria-pressed={outletSemanticDraft === 'ValveOpeningProxy'}
                  onClick={() => { setOutletSemanticDraft('ValveOpeningProxy'); setOutletSemanticState({ type: 'idle', message: '' }); }}
                  className={`rounded-md border p-3 text-left transition-colors ${outletSemanticDraft === 'ValveOpeningProxy' ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300 dark:border-amber-500 dark:bg-amber-950/25 dark:ring-amber-800' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600'}`}
                >
                  <div className="flex items-center justify-between gap-2"><strong className="text-sm text-slate-900 dark:text-slate-100">出口流量（代理测量）</strong><span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-500/15 dark:text-amber-100">%</span></div>
                  <div className="mt-2 text-xs leading-5 ops-muted">可监测出口流量的相对异常与趋势；禁止与入口排量相减，也不生成流量差类物料平衡结论。</div>
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" className="ops-button-primary px-3 py-2 text-sm" disabled={outletSemanticState.type === 'saving' || outletSemanticDraft === outletSemanticSaved} onClick={() => void handleOutletSemanticSave()}>
                  <Save className="h-4 w-4" />
                  {outletSemanticState.type === 'saving' ? '正在写入后端' : outletSemanticDraft === outletSemanticSaved ? '后端设置已一致' : '保存出口通道定义'}
                </button>
                {outletSemanticState.message ? <span role="status" className={`text-xs ${outletSemanticState.type === 'error' ? 'text-red-600 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{outletSemanticState.message}</span> : null}
              </div>
            </section>

            <section className="ops-surface p-4" aria-labelledby="alarm-effect-setting-title">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id="alarm-effect-setting-title" className="flex items-center gap-2 text-base text-slate-800 dark:text-slate-100">
                    <Volume2 className="h-4 w-4 text-orange-500" />
                    报警声光提醒
                  </h3>
                  <p className="mt-1 text-[11px] leading-5 ops-muted">L2 仅以有限光效提示；L3+ 在新事件或升级时追加一次短促声音。确认、刷新、重连与历史回放均不会重复鸣响；L4 使用可区分的三音模式。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {alarmSoundEnabled ? (
                    <button type="button" className="ops-button-secondary px-3 py-2 text-sm" aria-pressed={false} onClick={toggleAlarmSound}>
                      <VolumeX className="h-4 w-4" />L3+ 声音已开启 · 静音
                    </button>
                  ) : (
                    <button type="button" className="ops-button-primary px-3 py-2 text-sm" disabled={alarmSoundState.type === 'testing'} onClick={() => void enableAndPreviewAlarmSound()}>
                      <Volume2 className="h-4 w-4" />{alarmSoundState.type === 'testing' ? '正在试听…' : '试听并启用 L3+ 声音'}
                    </button>
                  )}
                </div>
              </div>
              {alarmSoundState.message ? <div role="status" className={`mt-2 text-xs ${alarmSoundState.type === 'error' ? 'text-red-600 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{alarmSoundState.message}</div> : null}
            </section>

            <section className="ops-surface p-4">
              <h3 className="mb-3 flex items-center gap-2 text-base text-slate-800 dark:text-slate-100">
                <KeyRound className="h-4 w-4 text-teal-500" />
                修改登录密码
              </h3>
              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                <div className="password-form-grid">
                  <label>
                    <span>旧密码</span>
                    <input
                      type="password"
                      aria-label="旧密码"
                      className="ops-field w-full px-3 py-2 text-sm"
                      value={passwordDraft.oldPassword}
                      autoComplete="current-password"
                      onChange={(event) => setPasswordField('oldPassword')(event.target.value)}
                      aria-describedby={passwordState.type !== 'idle' ? 'password-form-message' : undefined}
                      required
                    />
                  </label>
                  <label>
                    <span>新密码</span>
                    <input
                      type="password"
                      aria-label="新密码"
                      className="ops-field w-full px-3 py-2 text-sm"
                      value={passwordDraft.newPassword}
                      autoComplete="new-password"
                      minLength={8}
                      onChange={(event) => setPasswordField('newPassword')(event.target.value)}
                      aria-invalid={passwordDraft.newPassword.length > 0 && passwordDraft.newPassword.length < 8}
                      aria-describedby={passwordState.type !== 'idle' ? 'password-form-message' : undefined}
                      required
                    />
                  </label>
                  <label>
                    <span>确认新密码</span>
                    <input
                      type="password"
                      aria-label="确认新密码"
                      className="ops-field w-full px-3 py-2 text-sm"
                      value={passwordDraft.confirmPassword}
                      autoComplete="new-password"
                      minLength={8}
                      onChange={(event) => setPasswordField('confirmPassword')(event.target.value)}
                      aria-invalid={passwordMismatch}
                      aria-describedby={passwordState.type !== 'idle' || passwordMismatch ? 'password-form-message' : undefined}
                      required
                    />
                  </label>
                </div>
                <div className="text-[11px] ops-muted">新密码至少 8 位，且两次输入一致后才可提交。</div>
                {(passwordState.type !== 'idle' || passwordMismatch) && (
                  <div id="password-form-message" role="alert" className={`ops-break-text rounded-md border p-3 text-sm ${
                    passwordState.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-200'
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-200'
                  }`}>
                    {passwordMismatch ? '两次输入的新密码不一致。' : passwordState.message}
                  </div>
                )}
                <button className="ops-button-primary px-3 py-2" type="submit" disabled={passwordSubmitDisabled}>
                  <KeyRound className="h-4 w-4" />
                  {passwordSaving ? '正在修改' : '修改密码'}
                </button>
              </form>
            </section>
          </div>
        </div>
      )}

      {/* ------------------------- 监测显示（当前井） ------------------------- */}
      {tab === 'display' && (
        <div className="space-y-4">
          <ConfigRiskBanner id={configBannerId} invalid={configInvalid} invalidReasons={invalidReasons} changedCount={changedCount} saved={displaySaved} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <section className="ops-surface p-4" aria-labelledby="monitoring-window-setting-title">
                <h3 id="monitoring-window-setting-title" className="mb-2 flex items-center gap-2 text-base text-slate-800 dark:text-slate-100">
                  <SlidersHorizontal className="h-4 w-4 text-cyan-500" />泳道时间窗口
                </h3>
                <p className="mb-3 text-[11px] leading-5 ops-muted">限制实时监测泳道保留的最近数据范围，避免长期运行累积过多点位。仅影响显示缓存，不改变后端检测结果。</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {MONITORING_WINDOW_OPTIONS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      aria-pressed={monitoringWindowMinutes === minutes}
                      onClick={() => updateMonitoringWindowMinutes(minutes as MonitoringWindowMinutes)}
                      className={`rounded-md border px-3 py-2 text-sm transition-colors ${monitoringWindowMinutes === minutes ? 'border-cyan-400 bg-cyan-50 font-semibold text-cyan-800 ring-1 ring-cyan-300 dark:border-cyan-500 dark:bg-cyan-950/25 dark:text-cyan-100' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'}`}
                    >{minutes === 30 ? '半小时' : minutes === 60 ? '一小时' : '一个半小时'}</button>
                  ))}
                </div>
                <div className="mt-2 text-xs ops-muted">当前：最近 {monitoringWindowMinutes} 分钟</div>
              </section>

              <ThresholdGroup title="总池体积曲线参考">
                <ConfigNumberInput label="参考线 1" value={draft.pitGainWarning} activeValue={thresholds.pitGainWarning} unit="m3" onChange={set('pitGainWarning')} min={0} max={10} step={0.1} description="仅用于曲线标尺，不参与报警判级" level="warning" />
                <ConfigNumberInput label="参考线 2" value={draft.pitGainCritical} activeValue={thresholds.pitGainCritical} unit="m3" onChange={set('pitGainCritical')} min={0} max={20} step={0.1} description="仅用于曲线标尺，不参与报警判级" level="critical" />
              </ThresholdGroup>

              <ThresholdGroup title="压力与钻井液曲线参考">
                <ConfigNumberInput label="套压参考线" value={draft.casingPressureWarning} activeValue={thresholds.casingPressureWarning} unit="MPa" onChange={set('casingPressureWarning')} min={0} max={10} step={0.1} description="仅用于曲线标尺" level="warning" />
                <ConfigNumberInput label="钻井液密度参考线" value={draft.mudWeightWarning} activeValue={thresholds.mudWeightWarning} unit="g/cm3" onChange={set('mudWeightWarning')} min={0.8} max={1.4} step={0.01} description="仅用于曲线标尺" level="warning" />
                <ConfigNumberInput label="立压变化量参考线 1" value={draft.sppResidualWarning} activeValue={thresholds.sppResidualWarning} unit="MPa" onChange={set('sppResidualWarning')} min={0.1} max={2} step={0.01} description="仅用于曲线显示" level="warning" />
                <ConfigNumberInput label="立压变化量参考线 2" value={draft.sppResidualCritical} activeValue={thresholds.sppResidualCritical} unit="MPa" onChange={set('sppResidualCritical')} min={0.2} max={3} step={0.01} description="仅用于曲线显示" level="critical" />
              </ThresholdGroup>
            </div>

            <aside className="settings-side-stack h-fit xl:sticky xl:top-4">
              <section className="ops-surface p-4">
                <div className="mb-3 flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
                  <SlidersHorizontal className="h-4 w-4 text-cyan-500" />
                  阈值联锁面板
                  <span className={`ml-auto rounded px-2 py-0.5 text-[11px] ${changedCount > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'}`}>
                    {changedCount > 0 ? `${changedCount} 项待保存` : '无改动'}
                  </span>
                </div>
                <div className="mb-2 text-[11px] uppercase tracking-[0.16em] ops-muted">当前参数</div>
                <div className="space-y-2 text-sm">
                  {[
                    ['总池体积变化预警', `${thresholds.pitGainWarning} m3`],
                    ['总池体积变化严重', `${thresholds.pitGainCritical} m3`],
                    ['套压预警', `${thresholds.casingPressureWarning} MPa`],
                    ['密度下限', `${thresholds.mudWeightWarning} g/cm3`],
                    ['立压变化量', `${thresholds.sppResidualWarning}/${thresholds.sppResidualCritical} MPa`],
                  ].map(([label, value]) => (
                    <div key={label} className="ops-inline-tile flex items-center justify-between px-3 py-2">
                      <span className="ops-muted">{label}</span>
                      <span className="tabular-nums text-slate-900 dark:text-slate-100">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
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
              </section>
            </aside>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <button type="button" onClick={handleResetDisplay} className="ops-button-secondary">
              <RotateCcw className="h-4 w-4" />
              恢复默认
            </button>
            <button
              type="button"
              onClick={handleSaveDisplay}
              disabled={configInvalid}
              className="ops-button-primary"
              aria-describedby={configBannerId}
              title={configInvalid ? invalidReasons.join('；') : '保存显示参数'}
            >
              <Save className="h-4 w-4" />
              保存显示参数
            </button>
            <span className="text-xs ops-muted">保存后立即作用于监测页与历史页曲线。</span>
          </div>
        </div>
      )}
    </div>
  );
}
