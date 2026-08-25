import { useEffect, useRef, useState } from 'react';
import { BellRing, VolumeX } from 'lucide-react';
import type { Alert } from '../context/WellControlContext';
import { determineAlarmCue, getAlarmSoundPreference, playEscalationTone, type AlarmCue } from '../lib/alarmNotification';

function alertLevel(alert: Alert) {
  return Math.max(alert.currentBackendLevel ?? 0, alert.backendLevel ?? 0);
}

export function AlarmEffectController({ alerts }: { alerts: Alert[] }) {
  const levelsRef = useRef(new Map<string, number>());
  const initializedRef = useRef(false);
  const clearCueTimeoutRef = useRef<number | null>(null);
  const [cue, setCue] = useState<AlarmCue | null>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);

  useEffect(() => () => {
    if (clearCueTimeoutRef.current !== null) window.clearTimeout(clearCueTimeoutRef.current);
  }, []);

  useEffect(() => {
    const result = determineAlarmCue(
      alerts.map((alert) => ({ eventId: alert.backendEventId, level: alertLevel(alert), acknowledged: alert.acknowledged })),
      levelsRef.current,
      initializedRef.current,
    );
    if (!initializedRef.current && alerts.length === 0) return;
    levelsRef.current = result.nextLevels;
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    if (!result.cue) return;

    setCue(result.cue);
    if (clearCueTimeoutRef.current !== null) window.clearTimeout(clearCueTimeoutRef.current);
    clearCueTimeoutRef.current = window.setTimeout(() => {
      setCue(null);
      clearCueTimeoutRef.current = null;
    }, 4200);

    if (result.cue.playSound && getAlarmSoundPreference()) {
      void playEscalationTone(result.cue.level as 3 | 4).then(() => setSoundBlocked(false)).catch(() => setSoundBlocked(true));
    }
  }, [alerts]);

  if (!cue && !soundBlocked) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-3" aria-live="assertive" aria-atomic="true">
      {cue ? (
        <div className={`alarm-effect-beacon alarm-effect-l${cue.level} mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium shadow-xl`}>
          <BellRing className="h-4 w-4" aria-hidden="true" />
          新 L{cue.level} {cue.level >= 3 ? '高优先级' : '预警'}事件：已启动视觉提醒{cue.playSound ? '与声音提醒' : ''}
        </div>
      ) : null}
      {soundBlocked ? (
        <div className="alarm-effect-sound-blocked mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-xs shadow-lg">
          <VolumeX className="h-4 w-4" aria-hidden="true" />
          L3+ 声音提醒被浏览器阻止；请先在页面中操作一次，后续事件仍会显示声光提示。
        </div>
      ) : null}
    </div>
  );
}
