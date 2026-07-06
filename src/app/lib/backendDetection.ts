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
  stage1_geo_rop: '钻速地质观察',
  stage2_armed: '二阶段预警已布防',
  stage2_armed_active: '二阶段布防中',
  stage2_triggered_now: '二阶段当前触发',
  stage2_outlet_soft: '出口流量软异常',
  stage2_pool_soft: '池体积软异常',
  stage2_spp_drop: '立压下降辅助',
  stage2_geo_rop: '钻速地质辅助',
  stage2_gas_support: '气测辅助',
  stage2_macro_pool: '池体积宏观抬升',
  stage2_pressure_gas_bypass: '压力气测旁路确认',
  stage2_weak_pool_gas_formal: '弱池增量加气测确认',
  stage2_slow_pool_formal: '缓慢池增量确认',
  stage2_weak_outlet_slow_pool_formal: '弱出口加慢池确认',
  stage2_step_bypass_outlet_formal: '阶跃旁路出口确认',
  stage2_pool_dominant_formal: '池体积主导确认',
  stage2_outlet_companion_formal: '出口伴随确认',
  stage2_strong_burst: '二阶段强突增',
  stage2_strong_burst_hold: '二阶段强突增保持',
  stage2_accelerated_stage3: '二阶段加速进入三阶段',
  short_long_flow_bottom_line: '短长窗流量底线',
  short_long_flow_bottom_line_strong: '强短长窗流量底线',
  post_stop_drilling_review: '停泵后钻进复核',
  stage3_post_stop_review: '三阶段停泵复核',
  post_stop_pool_pressure_l2: '停泵池量压力 L2 证据',
  stage3_surface_fallback: '三阶段地面信号兜底',
  unified_candidate: '统一候选事件',
  unified_stage2_track: '统一二阶段跟踪',
  unified_stage3_track: '统一三阶段跟踪',
  pool_solo_formal: '池体积单参正式确认',
  pool_solo_strong_formal: '池体积强单参确认',
  outlet_degraded: '出口流量降级',
  drilling_post_stop_review: '钻进停泵后复核',
};

export function backendSignalLabel(signal: string) {
  return SIGNAL_LABELS[signal] || signal;
}

export function backendLevelState(level: BackendLevel): 'normal' | 'warning' | 'critical' {
  if (level >= 4) return 'critical';
  if (level >= 2) return 'warning';
  return 'normal';
}
