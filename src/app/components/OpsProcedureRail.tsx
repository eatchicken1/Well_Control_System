import type { CSSProperties, ElementType } from 'react';

export type OpsProcedureState = 'idle' | 'active' | 'done' | 'warning' | 'critical';

export interface OpsProcedureStep {
  code: string;
  label: string;
  value?: string;
  state: OpsProcedureState;
  icon?: ElementType;
}

export function OpsProcedureRail({
  steps,
  compact = false,
  micro = false,
}: {
  steps: OpsProcedureStep[];
  compact?: boolean;
  micro?: boolean;
}) {
  return (
    <div
      className={`ops-procedure-rail ${compact ? 'ops-procedure-rail-compact' : ''} ${micro ? 'ops-procedure-rail-micro' : ''}`}
      style={{ '--ops-step-count': steps.length } as CSSProperties}
    >
      {steps.map((step) => {
        const Icon = step.icon;
        return (
          <div key={`${step.code}-${step.label}`} className="ops-procedure-step" data-state={step.state}>
            <div className="flex min-w-0 items-center gap-2">
              <span className="ops-procedure-code">{step.code}</span>
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-75" />}
              <span className="truncate text-xs text-slate-800 dark:text-slate-100">{step.label}</span>
            </div>
            {step.value && <div className="ops-procedure-value">{step.value}</div>}
          </div>
        );
      })}
    </div>
  );
}
