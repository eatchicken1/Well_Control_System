import { FormEvent, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Gauge, Info, KeyRound, RadioTower, RotateCcw, Save, Server, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { DEFAULT_REALTIME_ENDPOINT, DEFAULT_THRESHOLDS, useWellControl } from '../context/WellControlContext';
import { OpsProcedureRail } from '../components/OpsProcedureRail';
import { MonitoringWellTabs } from '../components/MonitoringWellTabs';
import { useAuth } from '../context/AuthContext';
import { fetchSystemSettings, OUTLET_SIGNAL_SEMANTIC_SETTING_KEY, outletSignalSemanticFromSettings, outletSignalSemanticSetting, saveOutletSignalSemantic, type OutletSignalSemantic, type SystemSetting } from '../api/systemSettingsApi';
import { getAlarmSoundPreference, previewAlarmSound, setAlarmSoundPreference } from '../lib/alarmNotification';

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
    <section className="ops-surface p-4">
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
    <div className="ops-inline-tile p-3">
      <div className="mb-2">
        <div className="text-sm text-slate-800 dark:text-slate-100">{label}</div>
        <div className="text-[11px] ops-muted">{description}</div>
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
  const { thresholds, updateThresholds, dataSourceState, realtimeEndpoint, updateRealtimeEndpoint } = useWellControl();
  const { changePassword } = useAuth();
  const [draft, setDraft] = useState({ ...thresholds });
  const [endpointDraft, setEndpointDraft] = useState(realtimeEndpoint);
  const [saved, setSaved] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordState, setPasswordState] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [serverSettings, setServerSettings] = useState<SystemSetting[]>([]);
  const [serverSettingsState, setServerSettingsState] = useState<'loading' | 'ready' | 'error'>('loading');
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
  const algorithmInvalid =
    draft.sppResidualWarning >= draft.sppResidualCritical
    || draft.rlsForgettingFactor <= 0
    || draft.rlsForgettingFactor >= 1
    || draft.cusumDecisionInterval <= 0
    || draft.madTolerance <= 0;
  const endpointInvalid = endpointDraft.trim().length === 0;
  const invalidReasons = [
    thresholdInvalid ? '参考线 1 必须低于参考线 2' : '',
    algorithmInvalid ? '曲线与基线参考参数超出有效范围' : '',
    endpointInvalid ? '实时数据接口不能为空' : '',
  ].filter(Boolean);
  const configInvalid = invalidReasons.length > 0;
  const configBannerId = 'settings-config-status';
  const endpointHelpId = 'settings-endpoint-help';

  useEffect(() => () => {
    mountedRef.current = false;
    if (savedResetTimeoutRef.current != null) window.clearTimeout(savedResetTimeoutRef.current);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchSystemSettings(controller.signal)
      .then((settings) => {
        if (controller.signal.aborted) return;
        setServerSettings(settings);
        const semantic = outletSignalSemanticFromSettings(settings);
        setOutletSemanticDraft(semantic);
        setOutletSemanticSaved(semantic);
        setServerSettingsState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setServerSettingsState('error');
      });
    return () => controller.abort();
  }, []);

  const handleSave = () => {
    if (configInvalid) return;
    updateThresholds(draft);
    updateRealtimeEndpoint(endpointDraft.trim());
    setSaved(true);
    if (savedResetTimeoutRef.current != null) window.clearTimeout(savedResetTimeoutRef.current);
    savedResetTimeoutRef.current = window.setTimeout(() => {
      if (mountedRef.current) setSaved(false);
      savedResetTimeoutRef.current = null;
    }, 3000);
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_THRESHOLDS });
    setEndpointDraft(DEFAULT_REALTIME_ENDPOINT);
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
      setServerSettings((previous) => {
        const next = previous.filter((item) => item.key !== OUTLET_SIGNAL_SEMANTIC_SETTING_KEY);
        return [...next, outletSignalSemanticSetting(outletSemanticDraft)];
      });
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

  const set = (key: keyof typeof draft) => (v: number) => setDraft((prev) => ({ ...prev, [key]: v }));
  const setPasswordField = (key: keyof typeof passwordDraft) => (value: string) => {
    setPasswordDraft((prev) => ({ ...prev, [key]: value }));
    if (passwordState.type === 'error') setPasswordState({ type: 'idle', message: '' });
  };
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
      label: '参数校验',
      value: configInvalid ? '存在无效参数' : '可保存',
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
      <MonitoringWellTabs />
      <div className="ops-page-header">
        <div className="ops-page-header-copy">
          <div className="ops-eyebrow">显示参考</div>
          <h1 className="ops-title">系统设置</h1>
          <p className="text-sm ops-muted">配置曲线参考线与基线显示参数；报警等级由实时检测接口返回</p>
        </div>
        <div className="ops-page-toolbar w-full sm:w-auto sm:flex-nowrap">
          <button type="button" onClick={handleReset} className="ops-button-secondary">
            <RotateCcw className="h-4 w-4" />
            恢复默认
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={configInvalid}
            className="ops-button-primary"
            aria-describedby={configBannerId}
            title={configInvalid ? invalidReasons.join('；') : '保存显示参数'}
          >
            <Save className="h-4 w-4" />
            保存设置
          </button>
        </div>
      </div>

      <ConfigRiskBanner id={configBannerId} invalid={configInvalid} invalidReasons={invalidReasons} changedCount={changedCount} saved={saved} />

      <div className="ops-status-line">
        <ConfigGuardrail
          label="配置校验"
          value={configInvalid ? invalidReasons[0] : '参数可保存'}
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

          <section className="ops-surface p-4">
            <h3 className="mb-3 flex items-center gap-2 text-base text-slate-800 dark:text-slate-100">
              <Info className="h-4 w-4 text-cyan-500" />
              事件系统解释
            </h3>
            <div className="grid gap-2 text-sm">
              <div className="ops-inline-tile flex items-center justify-between px-3 py-2"><span className="ops-muted">事件系统解释</span><span className="font-medium text-emerald-700 dark:text-emerald-300">已启用</span></div>
              <div className="ops-inline-tile flex items-center justify-between px-3 py-2"><span className="ops-muted">解释方式</span><span>系统规则</span></div>
              <div className="ops-inline-tile flex items-center justify-between px-3 py-2"><span className="ops-muted">大模型辅助解释</span><span className="ops-muted">暂未启用</span></div>
            </div>
            <p className="mt-2 text-[11px] leading-5 ops-muted">解释层只读投影检测事实，不改变报警等级、Candidate 状态、Evidence 或监测 Session。</p>
          </section>

          <ThresholdGroup title="总池体积曲线参考">
            <ThresholdInput label="参考线 1" value={draft.pitGainWarning} activeValue={thresholds.pitGainWarning} unit="m3" onChange={set('pitGainWarning')} min={0} max={10} step={0.1} description="仅用于曲线标尺，不参与报警判级" level="warning" />
            <ThresholdInput label="参考线 2" value={draft.pitGainCritical} activeValue={thresholds.pitGainCritical} unit="m3" onChange={set('pitGainCritical')} min={0} max={20} step={0.1} description="仅用于曲线标尺，不参与报警判级" level="critical" />
          </ThresholdGroup>

          <ThresholdGroup title="压力与钻井液曲线参考">
            <ThresholdInput label="套压参考线" value={draft.casingPressureWarning} activeValue={thresholds.casingPressureWarning} unit="MPa" onChange={set('casingPressureWarning')} min={0} max={10} step={0.1} description="仅用于曲线标尺" level="warning" />
            <ThresholdInput label="钻井液密度参考线" value={draft.mudWeightWarning} activeValue={thresholds.mudWeightWarning} unit="g/cm3" onChange={set('mudWeightWarning')} min={0.8} max={1.4} step={0.01} description="仅用于曲线标尺" level="warning" />
          </ThresholdGroup>

          <ThresholdGroup title="曲线与基线参考参数">
            <ThresholdInput label="立压变化量参考线 1" value={draft.sppResidualWarning} activeValue={thresholds.sppResidualWarning} unit="MPa" onChange={set('sppResidualWarning')} min={0.1} max={2} step={0.01} description="仅用于曲线显示" level="warning" />
            <ThresholdInput label="立压变化量参考线 2" value={draft.sppResidualCritical} activeValue={thresholds.sppResidualCritical} unit="MPa" onChange={set('sppResidualCritical')} min={0.2} max={3} step={0.01} description="仅用于曲线显示" level="critical" />
            <PlainConfigInput label="趋势参考线间隔" value={draft.cusumDecisionInterval} unit="score" onChange={set('cusumDecisionInterval')} min={2} max={9} step={0.1} description="曲线显示参数" />
            <PlainConfigInput label="RLS 遗忘因子" value={draft.rlsForgettingFactor} unit="lambda" onChange={set('rlsForgettingFactor')} min={0.9} max={0.999} step={0.001} description="稳定性显示参数" />
            <PlainConfigInput label="偏离容忍倍数" value={draft.madTolerance} unit="x" onChange={set('madTolerance')} min={1} max={6} step={0.1} description="曲线显示参数" />
            <PlainConfigInput label="全烃迟到窗口" value={draft.gasLagWindowMinutes} unit="min" onChange={set('gasLagWindowMinutes')} min={10} max={180} step={5} description="曲线显示参数" />
            <PlainConfigInput label="停泵出口流量衰减率" value={draft.stopFlowDecayThreshold} unit="%" onChange={set('stopFlowDecayThreshold')} min={40} max={98} step={1} description="停泵显示参数" />
            <PlainConfigInput label="基线样本目标" value={draft.coldStartCycleCount} unit="组" onChange={set('coldStartCycleCount')} min={5} max={40} step={1} description="样本量显示参数" />
            <PlainConfigInput label="协方差惩罚参考值" value={draft.covariancePenaltyThreshold} unit="rho" onChange={set('covariancePenaltyThreshold')} min={0.1} max={0.9} step={0.01} description="历史分析显示参数" />
          </ThresholdGroup>
        </div>

        <aside className="settings-side-stack h-fit xl:sticky xl:top-4">
          <section className="ops-surface settings-backend-card p-4">
            <div className="mb-3 flex items-start gap-2">
              <div className="settings-section-icon"><Server className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  后端运行配置
                  <span className={`settings-sync-badge ${serverSettingsState}`}>
                    <RadioTower className="h-3 w-3" />
                    {serverSettingsState === 'ready' ? '已同步' : serverSettingsState === 'loading' ? '读取中' : '读取失败'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] ops-muted">只读展示后端当前策略；不会覆盖检测算法或运行时状态。</p>
              </div>
            </div>
            {serverSettingsState === 'ready' && serverSettings.length > 0 ? (
              <div className="settings-backend-list">
                {serverSettings.slice(0, 8).map((item) => (
                  <div key={item.key} className="settings-backend-row">
                    <div className="min-w-0">
                      <span className="block truncate text-xs text-slate-700 dark:text-slate-200">{item.label}</span>
                      <span className="block truncate text-[10px] ops-muted">{item.key}</span>
                    </div>
                    <strong>{item.value || '--'}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="settings-backend-empty">
                {serverSettingsState === 'error' ? '暂时无法读取后端配置快照' : '正在读取后端配置快照'}
              </div>
            )}
          </section>
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
              ['趋势曲线参考', `${thresholds.cusumDecisionInterval} 分`],
              ['偏离曲线参考', `${thresholds.madTolerance}x`],
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
    </div>
  );
}
