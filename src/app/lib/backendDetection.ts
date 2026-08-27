import type { BackendLevel } from '../context/WellControlContext';

export const BACKEND_LEVEL_META: Record<BackendLevel, {
  label: string;
  shortLabel: string;
  description: string;
  action: string;
}> = {
  0: { label: '正常监测', shortLabel: '正常', description: '未识别到异常证据', action: '保持监测' },
  1: { label: '异常观察', shortLabel: '观察', description: '单项轻微偏离', action: '保持跟踪' },
  2: { label: '溢流预警', shortLabel: '预警', description: '预警条件成立', action: '复核井况' },
  3: { label: '高度预警', shortLabel: '高预警', description: '多项或强异常条件成立', action: '准备处置' },
  4: { label: '溢流确认', shortLabel: '确认', description: '严重溢流风险确认', action: '立即处置' },
};

const SIGNAL_LABELS: Record<string, string> = {
  // Current engine EvidenceKind outputs (PascalCase from enum ToString)
  PressureDropResidual: '立压低于同工况参考',
  PressureRiseResidual: '立压高于同工况参考',
  OutletIncreaseResidual: '出口流量持续升高',
  OutletDecreaseResidual: '出口流量持续降低',
  PitIncreaseResidual: '总池体积持续增加',
  PitDecreaseResidual: '总池体积持续减少',
  DensityDropResidual: '出口钻井液密度低于参考',
  DensityRiseResidual: '出口钻井液密度高于参考',
  GasDelayedRise: '全烃持续升高',
  PumpConsistencyFailure: '停泵后出口流量仍未衰减',
  CasingPressureRiseResidual: '套压持续升高',
  MechanicalTransientEvidence: '机械参数出现短时变化',
  SurfaceOperationEvidence: '地面作业状态发生变化',
  SensorFaultEvidence: '立压、出口流量或总池体积测量异常',
  HydraulicContradiction: '参数变化需要现场复核',
  // Current engine EvidenceFamily outputs
  Material: '物质平衡',
  Pressure: '压力证据',
  Fluid: '流体证据',
  Boundary: '边界证据',
  Operation: '工况证据',
  // Legacy snake_case keys that may appear in historical DB records
  return_response: '出口流量出现异常变化',
  pit_volume: '总池体积',
  pit_gain: '池体积增量',
  pool_delta: '池体积增量',
  pool_delta_abs: '池体积绝对增量',
  pool_window_increase: '池体积窗口增量',
  standpipe_pressure: '立压变化量',
  spp: '立压',
  spp_drop: '立压下降',
  casing_pressure: '套压变化',
  total_gas: '全烃抬升',
  gas_support: '气测辅助证据',
  baseline_invalid: '基线无效',
  baseline_warmup: '基线预热',
  displacement_adjustment: '排量调整抑制',
  non_drilling_gate_closed: '非钻进工况门控',
  outlet_degraded: '出口流量降级',
  post_stop_drilling_review: '停泵后钻进复核',
  post_stop_pool_pressure_l2: '停泵池量压力 L2 证据',
};

export function backendSignalLabel(signal: string) {
  const value = String(signal || '').trim();
  if (!value) return '';
  if (/出口挡板开度|出口信号|出口流量信号/.test(value)) return '出口流量出现异常变化';
  const exact = SIGNAL_LABELS[value]
    || Object.entries(SIGNAL_LABELS).find(([key]) => key.toLowerCase() === value.toLowerCase())?.[1];
  if (exact) return exact;
  if (/PressureDropResidual|pressure[_-]?drop|spp[_-]?drop/i.test(value)) return '立压低于同工况参考';
  if (/PressureRiseResidual|pressure[_-]?rise/i.test(value)) return '立压高于同工况参考';
  if (/OutletIncreaseResidual|outlet|return|flow[_-]?out/i.test(value)) return '出口流量出现异常变化';
  if (/PitIncreaseResidual|pit|pool|volume/i.test(value)) return '总池体积出现异常变化';
  if (/GasDelayedRise|gas|烃/i.test(value)) return '全烃出现异常变化';
  if (/CasingPressureRiseResidual|casing|套压/i.test(value)) return '套压出现异常变化';
  if (/DensityDropResidual|density|密度/i.test(value)) return '出口钻井液密度出现异常变化';
  if (/Mechanical|扭矩|悬重/i.test(value)) return '扭矩或悬重出现异常变化';
  if (/Sensor|UnknownProxy|candidate|certificate|Evidence|residual|hydrauliccontradiction|^H_/i.test(value)) return '立压、出口流量或总池体积测量异常';
  return value;
}

export function backendLevelState(level: BackendLevel): 'normal' | 'warning' | 'critical' {
  if (level >= 4) return 'critical';
  if (level >= 2) return 'warning';
  return 'normal';
}
