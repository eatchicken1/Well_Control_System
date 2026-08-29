import type { ElementType } from 'react';
import { AlertTriangle, CheckCircle2, Eye, ShieldAlert, Siren } from 'lucide-react';
import type { BackendLevel } from '../context/WellControlContext';

/**
 * Canonical L0-L4 visual language shared by every page. A given level must
 * always carry the same colour and icon: L0 emerald, L1 sky, L2 amber,
 * L3 orange, L4 red. Page-specific palettes are not allowed to remap these.
 */
export interface LevelVisual {
  /** Card tone: border + background classes. */
  tone: string;
  /** Solid chip: background + text classes. */
  badge: string;
  /** Status LED background class. */
  dot: string;
  /** Strong accent (left bar / progress) background class. */
  bar: string;
  /** Emphasis text color classes. */
  text: string;
  icon: ElementType;
}

export const LEVEL_VISUAL: Record<BackendLevel, LevelVisual> = {
  0: {
    tone: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-200',
    icon: CheckCircle2,
  },
  1: {
    tone: 'border-sky-200 bg-sky-50/70 dark:border-sky-900/60 dark:bg-sky-950/20',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-100',
    dot: 'bg-sky-500',
    bar: 'bg-sky-500',
    text: 'text-sky-700 dark:text-sky-200',
    icon: Eye,
  },
  2: {
    tone: 'border-amber-200 bg-amber-50/80 dark:border-amber-900/70 dark:bg-amber-950/20',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-200',
    icon: AlertTriangle,
  },
  3: {
    tone: 'border-orange-200 bg-orange-50/80 dark:border-orange-900/70 dark:bg-orange-950/20',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-100',
    dot: 'bg-orange-500',
    bar: 'bg-orange-500',
    text: 'text-orange-700 dark:text-orange-200',
    icon: Siren,
  },
  4: {
    tone: 'border-red-200 bg-red-50/80 dark:border-red-900/70 dark:bg-red-950/20',
    badge: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-100',
    dot: 'bg-red-500',
    bar: 'bg-red-600',
    text: 'text-red-700 dark:text-red-200',
    icon: ShieldAlert,
  },
};

export function safeLevel(value: unknown): BackendLevel {
  const level = Number(value);
  return Number.isFinite(level) && level >= 0 && level <= 4 ? level as BackendLevel : 0;
}

/**
 * The formal alarm list only shows L2+. L0/L1 records clamp to the L2 visual
 * only when callers explicitly request the formal-alarm floor.
 */
export function formalVisualLevel(value: unknown): 2 | 3 | 4 {
  const level = safeLevel(value);
  return level >= 4 ? 4 : level >= 3 ? 3 : 2;
}

export function levelBadgeClass(value: unknown) {
  return LEVEL_VISUAL[safeLevel(value)].badge;
}

export function levelDotClass(value: unknown) {
  return LEVEL_VISUAL[safeLevel(value)].dot;
}
