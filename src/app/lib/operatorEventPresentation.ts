export interface OperatorEventPresentation {
  title: string;
  description: string;
  primaryParameter: string;
  abnormalParameters: string[];
  physicalFacts: string[];
}

const UNSPECIFIED_SENSOR_PARAMETER = '立压、出口流量或总池体积测量异常';

type ObjectLike = Record<string, unknown>;

const SIGNAL_LABELS: Array<[string, string]> = [
  ['PitIncreaseResidual', '总池体积持续增加'],
  ['PitDecreaseResidual', '总池体积持续减少'],
  ['OutletIncreaseResidual', '出口流量持续升高'],
  ['OutletDecreaseResidual', '出口流量持续降低'],
  ['PressureDropResidual', '立压低于同工况参考'],
  ['PressureRiseResidual', '立压高于同工况参考'],
  ['CasingPressureRiseResidual', '套压持续升高'],
  ['DensityDropResidual', '出口钻井液密度低于参考'],
  ['DensityRiseResidual', '出口钻井液密度高于参考'],
  ['GasDelayedRise', '全烃持续升高'],
  ['PumpConsistencyFailure', '停泵后出口流量仍未衰减'],
  ['MechanicalResponse', '扭矩或悬重异常变化'],
  ['SensorFault', UNSPECIFIED_SENSOR_PARAMETER],
  ['MechanicalTransientEvidence', '机械参数出现短时变化'],
  ['SurfaceOperationEvidence', '地面作业状态发生变化'],
  ['SensorFaultEvidence', UNSPECIFIED_SENSOR_PARAMETER],
  ['HydraulicContradiction', '参数变化需要现场复核'],
  ['standpipe_pressure', '立压出现异常变化'],
  ['pressure_drop', '立压低于同工况参考'],
  ['pressure_rise', '立压高于同工况参考'],
  ['spp_drop', '立压低于同工况参考'],
  ['spp', '立压出现异常变化'],
  ['casing_pressure', '套压出现异常变化'],
  ['casing_pressure_rise', '套压持续升高'],
  ['flow', '出口流量出现异常变化'],
  ['return_response', '出口流量出现异常变化'],
  ['flow_out', '出口流量出现异常变化'],
  ['outlet_flow', '出口流量出现异常变化'],
  ['inlet_flow', '入口流量出现异常变化'],
  ['pit_volume', '总池体积出现异常变化'],
  ['pit_gain', '总池体积持续增加'],
  ['pit', '总池体积出现异常变化'],
  ['pool_delta', '池体积增量出现异常'],
  ['pool_delta_abs', '池体积增量出现异常'],
  ['pool_window_increase', '总池体积窗口增量'],
  ['total_gas', '全烃持续升高'],
  ['gas', '全烃出现异常变化'],
  ['gas_support', '气测升高'],
  ['baseline_invalid', '当前工况参考暂不可用'],
  ['baseline_warmup', '当前工况参考仍在建立'],
  ['displacement_adjustment', '排量变化正在影响当前读数'],
  ['non_drilling_gate_closed', '当前非钻进工况，暂不作强结论'],
  ['outlet_degraded', '出口流量测量可信度不足'],
  ['post_stop_drilling_review', '停泵后需要复核钻进状态'],
  ['post_stop_pool_pressure_l2', '停泵后池量和压力同时异常'],
];

function object(value: unknown): ObjectLike | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectLike : null;
}

function read(source: ObjectLike | null | undefined, keys: string[]) {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

function level(value: unknown) {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 4 ? numeric : 0;
}

function labels(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : String(value || '').split(/[,、;；]/g);
  return values
    .map((item) => label(String(item || '').trim()))
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index);
}

function channelLabel(value: string) {
  const text = value.toLowerCase();
  if (/inlet|qin|入口流量/.test(text)) return '入口流量异常变化';
  if (/standpipe|spp|立压|立管压力/.test(text)) return '立压异常变化';
  if (/casing|套压/.test(text)) return '套压异常变化';
  if (/pit|pool|tank|池体积|池量/.test(text)) return '总池体积异常变化';
  if (/outlet|flow_out|flow|返出|出口流量/.test(text)) return '出口流量异常变化';
  if (/density|mud_weight|密度/.test(text)) return '出口钻井液密度异常变化';
  if (/gas|c1|全烃|气测/.test(text)) return '全烃异常变化';
  if (/torque|扭矩/.test(text)) return '扭矩异常变化';
  if (/hook[_ ]?load|hookload|悬重/.test(text)) return '悬重异常变化';
  if (/pump|spm|泵冲/.test(text)) return '泵冲异常变化';
  return '';
}

function unavailableChannelLabels(source: ObjectLike | null, nested: ObjectLike | null): string[] {
  const quality = object(read(rootOrNested(source, nested), ['dataQuality', 'data_quality', 'coverage']));
  const channels = read(quality, ['missingChannels', 'missing_channels', 'staleChannels', 'stale_channels']);
  const values = Array.isArray(channels) ? channels : String(channels || '').split(/[,、;；]/g);
  return values
    .map((item) => channelLabel(String(item || '').trim()))
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index);
}

function rootOrNested(root: ObjectLike | null, nested: ObjectLike | null): ObjectLike | null {
  return object(read(root, ['dataQuality', 'data_quality'])) || nested;
}

function label(value: string) {
  if (!value) return '';
  if (/关键测量信号异常|监测参数偏离|待现场复核|^参数异常$|^异常$/i.test(value.trim())) return '';
  if (/出口挡板开度|出口信号|出口流量信号/.test(value)) return '出口流量出现异常变化';
  const physicalChannel = channelLabel(value);
  // Sensor-fault records may carry the physical channel in the same string.
  // Prefer it over the generic evidence-kind label whenever it is available.
  if (/sensorfault/i.test(value) && physicalChannel) return physicalChannel;
  const matched = SIGNAL_LABELS.find(([key]) => value.toLowerCase().includes(key.toLowerCase()));
  if (matched) return matched[1];
  if (physicalChannel) return physicalChannel;
  if (/unknownproxy|candidate|certificate|evidence|residual|hydrauliccontradiction/i.test(value)) return '';
  return value
    .replace(/返出响应/g, '出口流量响应')
    .replace(/返出/g, '出口流量')
    .replace(/出口挡板开度/g, '出口流量')
    .replace(/出口流量信号/g, '出口流量')
    .replace(/出口信号/g, '出口流量')
    .replace(/立管压力/g, '立压')
    .trim();
}

function isTechnical(value: string) {
  return /Residual|UnknownProxy|candidate|certificate|Evidence|Qin|Qout|SPP|_[a-z]/i.test(value);
}

function genericTitle(value: string) {
  const text = value.trim();
  return !text
    || /^L[0-4]\s*(异常|预警|告警|观察|确认)?$/i.test(text)
    || /^L[0-4]\s*[:：-]?\s*事件$/i.test(text)
    || /^L[0-4]\s*[:：-]?\s*(关键测量信号异常|监测参数偏离|参数异常|异常)$/i.test(text);
}

function safeDescription(value: unknown, parameters: string[]) {
  const text = String(value || '').trim();
  const normalizedText = text
    .replace(/返出响应/g, '出口流量响应')
    .replace(/返出/g, '出口流量')
    .replace(/出口挡板开度/g, '出口流量')
    .replace(/出口流量信号/g, '出口流量')
    .replace(/出口信号/g, '出口流量')
    .replace(/立管压力/g, '立压');
  if (normalizedText && !isTechnical(normalizedText) && !/关键测量信号异常|监测参数偏离|待现场复核/.test(normalizedText)) return normalizedText;
  const subject = parameters.join('、') || UNSPECIFIED_SENSOR_PARAMETER;
  return `发现${subject}。请查看当前测量值，并结合泵冲、作业状态和现场液位复核。`;
}

/**
 * Normalizes the public operator-event contract from realtime SSE frames,
 * review APIs, and compatible historical payloads. It deliberately never
 * shows detector enums as an event title or user-facing explanation.
 */
export function operatorEventPresentation(source: unknown, suppliedLevel?: unknown): OperatorEventPresentation {
  const root = object(source);
  const warning = object(read(root, ['warning', 'Warning']));
  const nested = object(read(root, ['eventPresentation', 'event_presentation', 'presentation']))
    || object(read(warning, ['presentation', 'eventPresentation', 'event_presentation']));
  const evidence = object(read(root, ['evidence', 'hardEvidence', 'hard_evidence']))
    || object(read(nested, ['evidence', 'hardEvidence', 'hard_evidence']));
  const evidenceAtoms = read(evidence, ['atoms']) ?? read(root, ['evidenceAtoms', 'evidence_atoms']);
  const evidenceParameters = Array.isArray(evidenceAtoms)
    ? evidenceAtoms
      .map((item) => object(item))
      .map((item) => channelLabel(String(read(item, ['channel', 'Channel', 'reason', 'Reason']) || '')))
      .filter(Boolean)
    : [];
  const qualityParameters = unavailableChannelLabels(root, nested);
  const eventLevel = level(suppliedLevel ?? read(root, ['publicLevel', 'public_level', 'currentLevel', 'current_level']) ?? read(warning, ['level']));
  const rawParameters = labels(
    read(nested, ['abnormalParameters', 'abnormal_parameters'])
      ?? read(root, ['abnormalParameters', 'abnormal_parameters', 'activeSignals', 'active_signals'])
      ?? read(warning, ['activeSignals', 'active_signals']),
  ).concat(evidenceParameters, qualityParameters).filter((item, index, all) => all.indexOf(item) === index);
  const parameters = rawParameters.includes(UNSPECIFIED_SENSOR_PARAMETER) && rawParameters.some((item) => item !== UNSPECIFIED_SENSOR_PARAMETER)
    ? rawParameters.filter((item) => item !== UNSPECIFIED_SENSOR_PARAMETER)
    : rawParameters;
  const suppliedPrimary = label(String(
    read(nested, ['primaryParameter', 'primary_parameter'])
      ?? read(root, ['primaryParameter', 'primary_parameter', 'primarySignal', 'primary_signal'])
      ?? parameters[0]
      ?? UNSPECIFIED_SENSOR_PARAMETER,
  ));
  const primary = suppliedPrimary === UNSPECIFIED_SENSOR_PARAMETER && parameters.some((item) => item !== UNSPECIFIED_SENSOR_PARAMETER)
    ? parameters.find((item) => item !== UNSPECIFIED_SENSOR_PARAMETER)!
    : suppliedPrimary || parameters[0] || UNSPECIFIED_SENSOR_PARAMETER;
  const normalizedParameters = [primary, ...parameters].filter(Boolean).filter((item, index, all) => all.indexOf(item) === index);
  const suppliedTitle = safeDescription(read(nested, ['title']) ?? read(root, ['eventTitle', 'event_title', 'title']), []).trim();
  const title = !genericTitle(suppliedTitle) && !isTechnical(suppliedTitle)
    ? suppliedTitle
    : `L${eventLevel}：${normalizedParameters.slice(0, 3).join('、') || UNSPECIFIED_SENSOR_PARAMETER}`;
  const facts = labels(read(nested, ['physicalFacts', 'physical_facts']) ?? read(root, ['physicalFacts', 'physical_facts']));
  const rawDescription = read(nested, ['description', 'physicalDescription', 'physical_description'])
    ?? read(root, ['physicalDescription', 'physical_description', 'description', 'reason', 'message'])
    ?? read(warning, ['reason']);

  const description = safeDescription(rawDescription, normalizedParameters);
  return {
    title,
    description: description === `发现${UNSPECIFIED_SENSOR_PARAMETER}。请查看当前测量值，并结合泵冲、作业状态和现场液位复核。`
      && qualityParameters.length > 0
      ? `当前${qualityParameters.join('、')}数据缺失、断线或不稳定，无法据此判断井下变化；请先核对对应传感器和采集链路。`
      : description,
    primaryParameter: primary,
    abnormalParameters: normalizedParameters,
    physicalFacts: facts,
  };
}
