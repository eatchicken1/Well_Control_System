import { CircleDot, TimerReset } from 'lucide-react';
import type { CycleInfo, CycleState } from '../context/WellControlContext';

const STATES: Array<{ state: CycleState; label: string; short: string }> = [
  { state: 0, label: '井筒扰动观察', short: 'S0' },
  { state: 1, label: '钻进稳定', short: 'S1' },
  { state: 2, label: '循环稳定', short: 'S2' },
  { state: 3, label: '停泵监测', short: 'S3' },
  { state: 4, label: '开泵恢复', short: 'S4' },
  { state: 5, label: '实时监测', short: 'S5' },
];

function stateTone(isActive: boolean, isPast: boolean) {
  if (isActive) return 'border-cyan-300 bg-[#edfdfa] text-cyan-800 shadow-[0_0_0_3px_rgba(6,182,212,0.12)] dark:border-cyan-500/70 dark:bg-cyan-950/28 dark:text-cyan-100';
  if (isPast) return 'border-emerald-200 bg-[#f0fbf7] text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/18 dark:text-emerald-200';
  return 'border-slate-200 bg-[#f6fafc] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400';
}

function fmtSeconds(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function CycleStateMachine({ cycleInfo, compact = false }: { cycleInfo: CycleInfo; compact?: boolean }) {
  return (
    <section className="ops-panel cycle-machine-shell overflow-hidden p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="ops-eyebrow">实时工况状态</div>
          <h2 className="text-base text-slate-800 dark:text-slate-100">监测阶段 #{cycleInfo.cycleIndex}</h2>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/25 dark:text-cyan-100">
          <TimerReset className="h-3.5 w-3.5" />
          {cycleInfo.stateLabel} · {fmtSeconds(cycleInfo.elapsedInState)}
        </div>
      </div>

      <div className="cycle-rail-grid relative grid grid-cols-2 gap-2 md:grid-cols-6">
        <div className="cycle-fluid-thread hidden md:block" />
        {STATES.map((item) => {
          const active = item.state === cycleInfo.state;
          const past = item.state < cycleInfo.state;
          return (
            <div key={item.state} className={`relative rounded-md border px-2.5 py-2 ${stateTone(active, past)}`}>
              {active && <div className="cycle-active-wash" />}
              <div className="relative z-10 flex items-center gap-2">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] ${active ? 'bg-cyan-500 text-white' : past ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {item.short}
                </span>
                <span className="min-w-0 truncate text-xs">{item.label}</span>
              </div>
              {active && (
                <div className="relative z-10 mt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-cyan-900/10 dark:bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300" style={{ width: `${cycleInfo.progress}%` }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!compact && (
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-[#f6fafc] px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            <div className="ops-muted">当前状态说明</div>
            <div className="mt-1 text-slate-900 dark:text-slate-100">{cycleInfo.description}</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-[#f6fafc] px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            <div className="ops-muted">停泵 / 开泵锚点</div>
            <div className="mt-1 tabular-nums text-slate-900 dark:text-slate-100">{cycleInfo.tStopPump || '--:--:--'} / {cycleInfo.tStartPump || '--:--:--'}</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-[#f6fafc] px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            <div className="ops-muted">稳定恢复锚点</div>
            <div className="mt-1 flex items-center gap-1.5 tabular-nums text-slate-900 dark:text-slate-100">
              <CircleDot className="h-3.5 w-3.5 text-emerald-500" />
              {cycleInfo.tStable || '等待 State 5'}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
