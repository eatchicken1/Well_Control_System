export const ALARM_SOUND_PREFERENCE_KEY = 'wcs-alarm-sound-enabled';

export interface AlarmCueSource {
  eventId: string;
  level: number;
  acknowledged: boolean;
}

export interface AlarmCue {
  eventId: string;
  level: 2 | 3 | 4;
  playSound: boolean;
}

/**
 * Compare only active, unacknowledged L2+ events.  This makes polling,
 * reconnecting and history hydration idempotent while retaining a cue for a
 * genuine event escalation.
 */
export function determineAlarmCue(
  events: AlarmCueSource[],
  previousLevels: ReadonlyMap<string, number>,
  initialized: boolean,
): { cue: AlarmCue | null; nextLevels: Map<string, number> } {
  // Retain observed IDs across a temporary empty list while a stream reconnects.
  // Clearing that history is what makes a recovered projection replay its sound.
  const nextLevels = new Map(previousLevels);
  const candidates: AlarmCue[] = [];

  for (const event of events) {
    const level = Math.max(0, Math.min(4, Math.trunc(event.level)));
    if (!event.eventId || event.acknowledged || level < 2) continue;
    nextLevels.set(event.eventId, level);
    const previousLevel = previousLevels.get(event.eventId);
    if (initialized && (previousLevel === undefined || level > previousLevel)) {
      candidates.push({ eventId: event.eventId, level: level as 2 | 3 | 4, playSound: level >= 3 });
    }
  }

  candidates.sort((a, b) => b.level - a.level || a.eventId.localeCompare(b.eventId));
  return { cue: candidates[0] || null, nextLevels };
}

export function getAlarmSoundPreference() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(ALARM_SOUND_PREFERENCE_KEY) === 'true';
}

export function setAlarmSoundPreference(enabled: boolean) {
  window.localStorage.setItem(ALARM_SOUND_PREFERENCE_KEY, String(enabled));
}

let alarmAudioContext: AudioContext | null = null;

async function getRunningAlarmAudioContext(): Promise<AudioContext> {
  const AudioContextConstructor = window.AudioContext
    || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error('当前浏览器不支持声音提醒。');
  if (!alarmAudioContext || alarmAudioContext.state === 'closed') alarmAudioContext = new AudioContextConstructor();
  if (alarmAudioContext.state === 'suspended') await alarmAudioContext.resume();
  if (alarmAudioContext.state !== 'running') throw new Error('浏览器阻止了自动播放，请点击“试听并启用”后重试。');
  return alarmAudioContext;
}

/**
 * Plays a short, non-repeating pattern.  L4 intentionally adds a third tone
 * so field operators can distinguish it from L3 without looking away.
 */
export async function playEscalationTone(level: 3 | 4): Promise<void> {
  const context = await getRunningAlarmAudioContext();
  const startAt = context.currentTime + 0.02;
  const frequencies = level >= 4 ? [740, 920, 1120] : [740, 920];
  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const offset = index * 0.18;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt + offset);
    gain.gain.setValueAtTime(0.0001, startAt + offset);
    gain.gain.exponentialRampToValueAtTime(0.07, startAt + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.13);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startAt + offset);
    oscillator.stop(startAt + offset + 0.14);
  });
  await new Promise<void>((resolve) => window.setTimeout(resolve, frequencies.length * 180 + 60));
}

/** Call from an explicit click to satisfy browser audio activation policies. */
export function previewAlarmSound() {
  return playEscalationTone(3);
}
