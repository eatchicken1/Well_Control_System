import type { BackendLevel } from '../context/WellControlContext';

export const BACKEND_LEVEL_META: Record<BackendLevel, {
  label: string;
  shortLabel: string;
  description: string;
  action: string;
}> = {
  0: { label: '正常监测', shortLabel: '正常', description: '后端未识别到异常证据', action: '持续监测' },
  1: { label: '异常观察', shortLabel: '观察', description: '后端识别到单项轻微偏离', action: '保持跟踪' },
  2: { label: '溢流预警', shortLabel: '预警', description: '后端预警条件成立', action: '复核井况' },
  3: { label: '高度预警', shortLabel: '高预警', description: '后端多项或强异常条件成立', action: '准备处置' },
  4: { label: '溢流确认', shortLabel: '确认', description: '后端确认严重溢流风险', action: '立即处置' },
};

const SIGNAL_LABELS: Record<string, string> = {
  return_response: '出口流量响应',
  pit_volume: '总池体积',
  standpipe_pressure: '立压残差',
  total_gas: '全烃抬升',
};

export function backendSignalLabel(signal: string) {
  return SIGNAL_LABELS[signal] || signal;
}

export function backendLevelState(level: BackendLevel): 'normal' | 'warning' | 'critical' {
  if (level >= 4) return 'critical';
  if (level >= 2) return 'warning';
  return 'normal';
}
