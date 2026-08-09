import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { PrecursorEligibilitySnapshot } from '../lib/precursorEligibilityContract';

function statusClass(status: string) {
  switch (status) {
    case 'Eligible': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200';
    case 'NotApplicable': return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
    case 'Blocked': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
    default: return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200';
  }
}

function roleLabel(role: string) {
  switch (role) {
    case 'ControlInput': return 'Control input';
    case 'FormationResponse': return 'Formation response';
    case 'MotionContext': return 'Motion context';
    default: return role;
  }
}

/** Round 3.1 diagnostics only; this component never infers status from raw telemetry. */
export function PrecursorEligibilityPanel({ snapshot }: { snapshot: PrecursorEligibilitySnapshot | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!snapshot) return null;

  const badges = [
    ['Hydraulic/Pump', snapshot.hydraulic.status, snapshot.hydraulic.eligible],
    ['Pressure', snapshot.pressure.status, snapshot.pressure.status === 'Eligible'],
    ['Mechanical formation', snapshot.mechanical.status, snapshot.mechanical.status === 'Eligible'],
  ] as const;

  return (
    <div className="ops-panel-soft overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span>前兆分析资格 / Precursor Eligibility</span>
          <span className="rounded bg-violet-100 px-1 py-0.5 font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">SHADOW</span>
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {expanded ? (
        <div className="space-y-2 border-t border-slate-200 px-3 py-2 text-[11px] dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400">
            仅表示该参数当前是否具备物理解释条件；不表示已经发生异常或溢流，也不会改变报警、证据、reference 或 candidate。
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {badges.map(([label, status, yes]) => (
              <div key={label} className="rounded border border-slate-200 px-2 py-1.5 dark:border-slate-700">
                <div className="text-slate-500 dark:text-slate-400">{label}</div>
                <div className={`mt-1 inline-block rounded px-1 py-0.5 font-semibold ${statusClass(status)}`}>{status}</div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">{yes ? 'YES' : 'NO'}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1 text-slate-600 dark:text-slate-300">
            {snapshot.hydraulic.reasons.length > 0 ? <ReasonLine label="Hydraulic" reasons={snapshot.hydraulic.reasons} /> : null}
            {snapshot.pressure.reasons.length > 0 ? <ReasonLine label="Pressure" reasons={snapshot.pressure.reasons} /> : null}
            {snapshot.mechanical.reasons.length > 0 ? <ReasonLine label="Mechanical" reasons={snapshot.mechanical.reasons} /> : null}
          </div>
          <div className="overflow-x-auto border-t border-slate-200 pt-2 dark:border-slate-700">
            <table className="w-full border-collapse text-left">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr><th className="pb-1 pr-2 font-medium">Channel</th><th className="pb-1 pr-2 font-medium">Role</th><th className="pb-1 pr-2 font-medium">Status</th><th className="pb-1 font-medium">Reason</th></tr>
              </thead>
              <tbody>
                {snapshot.mechanical.channels.map((channel) => (
                  <tr key={channel.channel} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1 pr-2 font-medium text-slate-700 dark:text-slate-200">{channel.channel}</td>
                    <td className="py-1 pr-2 text-slate-500 dark:text-slate-400">{roleLabel(channel.role)}</td>
                    <td className="py-1 pr-2"><span className={`rounded px-1 py-0.5 font-semibold ${statusClass(channel.status)}`}>{channel.status}</span></td>
                    <td className="py-1 text-slate-500 dark:text-slate-400">{channel.reasons.join(', ') || channel.reason || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReasonLine({ label, reasons }: { label: string; reasons: string[] }) {
  return <p><span className="text-slate-500">{label}: </span>{reasons.join(', ')}</p>;
}
