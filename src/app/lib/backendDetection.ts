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
  PressureDropResidual: '立压下降',
  PressureRiseResidual: '立压抬升',
  OutletIncreaseResidual: '出口增量',
  OutletDecreaseResidual: '出口减量',
  PitIncreaseResidual: '池体积增量',
  PitDecreaseResidual: '池体积减量',
  DensityDropResidual: '密度下降',
  DensityRiseResidual: '密度抬升',
  GasDelayedRise: '气测延迟抬升',
  PumpConsistencyFailure: '停泵返出异常',
  CasingPressureRiseResidual: '套压抬升',
  MechanicalTransientEvidence: '机械瞬态证据',
  SurfaceOperationEvidence: '地面操作证据',
  SensorFaultEvidence: '传感器故障证据',
  HydraulicContradiction: '液力矛盾',
  // Current engine EvidenceFamily outputs
  Material: '物质平衡',
  Pressure: '压力证据',
  Fluid: '流体证据',
  Boundary: '边界证据',
  Operation: '工况证据',
  // Legacy snake_case keys that may appear in historical DB records
  return_response: '出口流量响应',
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
  return SIGNAL_LABELS[signal] || signal;
}

export function backendLevelState(level: BackendLevel): 'normal' | 'warning' | 'critical' {
  if (level >= 4) return 'critical';
  if (level >= 2) return 'warning';
  return 'normal';
}
