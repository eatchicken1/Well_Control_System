import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { OperationContextV2Snapshot } from '../lib/operationContextV2Contract';

function statusClass(status: string) {
  if (status === 'Confirmed') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (status === 'CandidatePending') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
  return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
}

/** V1/V2 comparison only. This panel must never portray V2 as an alarm input. */
export function OperationContextV2Panel({ snapshot, v1FineLabel }: { snapshot: OperationContextV2Snapshot | null; v1FineLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!snapshot) return null;
  return (
    <div className="ops-panel-soft overflow-hidden">
      <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span>工况 V1 / V2 审计</span>
          <span className="rounded bg-violet-100 px-1 py-0.5 font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">SHADOW</span>
          <span className={`rounded px-1 py-0.5 font-semibold ${statusClass(snapshot.status)}`}>{snapshot.status}</span>
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {expanded ? <div className="space-y-2 border-t border-slate-200 px-3 py-2 text-[11px] dark:border-slate-700">
        <p className="font-medium text-violet-700 dark:text-violet-200">SHADOW · NOT ALARM INPUT。V2 不参与报警、证据、reference、candidate 或 precursor eligibility。</p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600 dark:text-slate-300">
          <div><dt className="inline text-slate-500">V1 FineLabel: </dt><dd className="inline">{v1FineLabel || '--'}</dd></div>
          <div><dt className="inline text-slate-500">V2 candidate: </dt><dd className="inline">{snapshot.candidate.fineLabel}</dd></div>
          <div><dt className="inline text-slate-500">V2 confirmed: </dt><dd className="inline">{snapshot.confirmedFineLabel || '--'}</dd></div>
          <div><dt className="inline text-slate-500">Hydraulic: </dt><dd className="inline">{snapshot.hydraulicStatus || '--'}{snapshot.hydraulicBoundary ? ' / Boundary' : ''}</dd></div>
          <div><dt className="inline text-slate-500">String motion: </dt><dd className="inline">{snapshot.stringMotion.state}</dd></div>
          <div><dt className="inline text-slate-500">Trusted depth: </dt><dd className="inline">{snapshot.trustedDepth.status}</dd></div>
        </dl>
        {snapshot.pendingTransition ? <p className="text-amber-700 dark:text-amber-200">Pending: {snapshot.pendingTransition.fromFineLabel} → {snapshot.pendingTransition.toFineLabel}; {snapshot.pendingTransition.supportingFacts.join(', ') || 'awaiting support'}</p> : null}
        {snapshot.hydraulicBoundaryReasons.length > 0 ? <p className="text-slate-500 dark:text-slate-400">PumpGate reasons: {snapshot.hydraulicBoundaryReasons.join(', ')}</p> : null}
        {snapshot.validationFlags.length > 0 ? <p className="text-slate-500 dark:text-slate-400">Validation: {snapshot.validationFlags.join(', ')}</p> : null}
        <p className="text-slate-500 dark:text-slate-400">{snapshot.reason || snapshot.candidate.reason}</p>
      </div> : null}
    </div>
  );
}
