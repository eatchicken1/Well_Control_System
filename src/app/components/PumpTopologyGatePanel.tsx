import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { PumpGateDiagnosticsSnapshot } from '../lib/pumpGateContract';

function formatSpm(value: number | null) {
  return value === null || !Number.isFinite(value) ? '--' : value.toFixed(1);
}

function maskLabel(mask: number | null) {
  return mask === null ? '--' : `0b${mask.toString(2).padStart(3, '0')}`;
}

function statusClass(status: string) {
  switch (status) {
    case 'Stable': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200';
    case 'Boundary': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
    case 'PumpStopped': return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
    case 'Stabilizing': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200';
    default: return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200';
  }
}

/** Round 3 shadow diagnostic only; it never changes any alarm UI state. */
export function PumpTopologyGatePanel({ snapshot }: { snapshot: PumpGateDiagnosticsSnapshot | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!snapshot) return null;

  const { configuration, gate } = snapshot;
  const modeBadge = gate.mode === 'Shadow' ? 'SHADOW' : gate.mode.toUpperCase();
  const pumps = [
    ['Pump 1', configuration.spm1, configuration.pump1State],
    ['Pump 2', configuration.spm2, configuration.pump2State],
    ['Pump 3', configuration.spm3, configuration.pump3State],
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
          <span>泵况拓扑 / Stable Pump Gate</span>
          <span className="rounded bg-violet-100 px-1 py-0.5 font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">{modeBadge}</span>
          <span className={`rounded px-1 py-0.5 font-semibold ${statusClass(gate.status)}`}>{gate.status}</span>
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {expanded ? (
        <div className="space-y-2 border-t border-slate-200 px-3 py-2 text-[11px] dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400">
            仅使用 admitted SPM1/2/3 与实测 Qin 的科研诊断；不改变现有报警、证据、reference 或 legacy pump state。
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {pumps.map(([label, spm, state]) => (
              <div key={label} className="rounded border border-slate-200 px-2 py-1.5 dark:border-slate-700">
                <div className="text-slate-500 dark:text-slate-400">{label}</div>
                <div className="tabular-nums text-slate-800 dark:text-slate-100">{formatSpm(spm)} spm</div>
                <div className="font-medium text-slate-600 dark:text-slate-300">{state}</div>
              </div>
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600 dark:text-slate-300">
            <div><dt className="inline text-slate-500">Total SPM: </dt><dd className="inline tabular-nums">{formatSpm(configuration.totalSpm)}</dd></div>
            <div><dt className="inline text-slate-500">Complete: </dt><dd className="inline">{configuration.complete ? 'YES' : 'NO'}</dd></div>
            <div><dt className="inline text-slate-500">Active mask (P3P2P1): </dt><dd className="inline tabular-nums">{maskLabel(configuration.activeMask)}</dd></div>
            <div><dt className="inline text-slate-500">Topology stable: </dt><dd className="inline">{gate.configurationStable ? 'YES' : 'NO'}</dd></div>
            <div><dt className="inline text-slate-500">Qin stable: </dt><dd className="inline">{gate.qinStable ? 'YES' : 'NO'}</dd></div>
            <div><dt className="inline text-slate-500">Pump rates stable: </dt><dd className="inline">{gate.perPumpRatesStable ? 'YES' : 'NO'}</dd></div>
          </dl>
          <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-2 dark:border-slate-700">
            <span className="text-slate-500">Eligible for precursor:</span>
            <span className={`rounded px-1.5 py-0.5 font-semibold ${gate.eligibleForPrecursor ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
              {gate.eligibleForPrecursor ? 'YES' : 'NO'}
            </span>
            {gate.boundaryReasons.map((reason) => <span key={reason} className="rounded bg-amber-100 px-1 py-0.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">{reason}</span>)}
          </div>
          {!gate.eligibleForPrecursor && gate.reason ? <p className="text-amber-700 dark:text-amber-200">{gate.reason}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
