export type WellboreState =
  | 'WAITING_DATA'
  | 'DRILLING_STABLE'
  | 'CIRCULATION_STABLE'
  | 'STOP_PUMP_MONITORING'
  | 'START_PUMP_RECOVERY'
  | 'TRIPPING_OBSERVATION'
  | 'KICK_WATCH'
  | 'KICK_WARNING'
  | 'KICK_SUSPECTED'
  | 'KICK_CONFIRMED'
  | 'MONITORING_STOPPED';

export interface WellboreStateInput {
  backendLevel: number;
  pumpState?: string;
  condition?: string;
  cycleState?: number;
  flowIn?: number;
  flowOut?: number;
  spm?: number;
  hasSamples?: boolean;
  isRecovering?: boolean;
  isStopped?: boolean;
}

const contains = (value: string | undefined, tokens: string[]) => {
  const normalized = value?.toLowerCase().trim() ?? '';
  return tokens.some((token) => normalized.includes(token));
};

export function formatWellboreConditionLabel(value?: string, fallback = '未识别') {
  const raw = value?.trim();
  if (!raw) return fallback;
  const normalized = raw.toLowerCase();
  const compact = normalized.replace(/[^a-z0-9一-龥]/g, '');
  if (['起下钻', 'tripping', 'trip', 'trippingout', 'trippingin'].some((token) => normalized.includes(token) || compact.includes(token))) return '起下钻';
  if (['钻进循环', 'drillingcirculating', 'drillingcirculation'].some((token) => normalized.includes(token) || compact.includes(token))) return '钻进循环';
  if (['钻进', '钻井', 'drilling'].some((token) => normalized.includes(token) || compact.includes(token))) return '钻进';
  if (['循环', 'circulating', 'circulation'].some((token) => normalized.includes(token) || compact.includes(token))) return '循环';
  if (['停泵', '关井', 'stopped', 'stop', 'stoppump', 'pumpoff', 'shutin'].some((token) => normalized.includes(token) || compact.includes(token))) return '停泵/关井';
  if (['开泵', '恢复', 'startpump', 'restart', 'recover', 'recovery'].some((token) => normalized.includes(token) || compact.includes(token))) return '开泵恢复';
  if (['等待', '待启动', '未接入', 'waiting', 'idle', 'pending'].some((token) => normalized.includes(token) || compact.includes(token))) return '等待接入';
  if (['实时检测', '实时监测', '检测', 'stable', 'normal'].some((token) => normalized.includes(token) || compact.includes(token))) return '稳定监测';
  return raw;
}

export function deriveWellboreState(input: WellboreStateInput): WellboreState {
  if (input.isStopped) return 'MONITORING_STOPPED';
  if (!input.hasSamples) return 'WAITING_DATA';
  if (input.backendLevel >= 4) return 'KICK_CONFIRMED';
  if (input.backendLevel === 3) return 'KICK_SUSPECTED';
  if (input.backendLevel === 2) return 'KICK_WARNING';
  if (input.backendLevel === 1) return 'KICK_WATCH';

  if (input.isRecovering || contains(input.pumpState, ['开泵', 'restart', 'recover', 'recovery']) || input.cycleState === 4) {
    return 'START_PUMP_RECOVERY';
  }
  if (contains(input.pumpState, ['停泵', '关井', 'stop', 'stopped', 'shut']) || contains(input.condition, ['停泵', '关井', 'stopped', 'shut']) || input.cycleState === 3) return 'STOP_PUMP_MONITORING';
  if (contains(input.condition, ['起下钻', 'tripping', 'trip', '扰动', '观察'])) return 'TRIPPING_OBSERVATION';
  if (contains(input.condition, ['循环', 'circulating', 'drillingcirculating']) || [2, 5].includes(input.cycleState ?? -1)) return 'CIRCULATION_STABLE';
  if (contains(input.condition, ['钻进', '钻井', 'drilling']) || input.cycleState === 1) return 'DRILLING_STABLE';
  if ((input.flowIn ?? 0) > 0.8 || (input.flowOut ?? 0) > 0.8 || (input.spm ?? 0) > 8) return 'CIRCULATION_STABLE';
  return 'DRILLING_STABLE';
}

export function getWellboreStateMeta(state: WellboreState) {
  const meta = {
    WAITING_DATA: { label: '等待数据', description: '尚未收到实时样本，等待检测流接入', tone: 'info' },
    DRILLING_STABLE: { label: '钻进稳定', description: '当前钻进工况稳定，持续监测井筒参数', tone: 'normal' },
    CIRCULATION_STABLE: { label: '循环稳定', description: '循环工况稳定，实时参数持续刷新', tone: 'normal' },
    STOP_PUMP_MONITORING: { label: '停泵监测', description: '停泵后持续复核返出与井筒液量', tone: 'warning' },
    START_PUMP_RECOVERY: { label: '开泵恢复', description: '开泵后正在恢复水力与循环参照', tone: 'info' },
    TRIPPING_OBSERVATION: { label: '起下钻观察', description: '当前处于起下钻或扰动观察阶段', tone: 'warning' },
    KICK_WATCH: { label: '异常观察', description: '出现低等级异常信号，持续跟踪', tone: 'info' },
    KICK_WARNING: { label: '溢流预警', description: '多参数证据达到预警等级', tone: 'warning' },
    KICK_SUSPECTED: { label: '疑似溢流', description: '多参数证据持续，需现场复核', tone: 'critical' },
    KICK_CONFIRMED: { label: '溢流确认', description: '证据达到确认等级，应按规程处置', tone: 'critical' },
    MONITORING_STOPPED: { label: '监测已停', description: '当前井已手动停止监测', tone: 'stopped' },
  } as const;
  return meta[state];
}
