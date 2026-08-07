import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { PreprocessingSnapshot } from '../lib/preprocessingContract';

const QUALITY_META: Record<string, { label: string; className: string }> = {
  Nominal: { label: '正常', className: 'text-slate-600 dark:text-slate-300' },
  Warming: { label: '积累中', className: 'text-slate-400 dark:text-slate-500' },
  InnovationCandidate: { label: '候选异常', className: 'text-amber-600 dark:text-amber-300' },
  IsolatedImpulseCandidate: { label: '孤立脉冲', className: 'text-amber-600 dark:text-amber-300' },
  PersistentShift: { label: '持续偏移', className: 'text-red-600 dark:text-red-300' },
};

const FLAG_LABELS: Record<string, string> = {
  InsufficientHistory: '历史不足',
  InnovationCandidate: '候选异常',
  IsolatedImpulseCandidate: '孤立脉冲',
  PersistentShift: '持续偏移',
  FlatlineCandidate: '疑似平坦',
  GapReset: '断点重置',
};

function formatSignalValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '--';
  const magnitude = Math.abs(value);
  const digits = magnitude >= 1000 ? 0 : magnitude >= 1 ? 2 : 4;
  return value.toFixed(digits);
}

function qualityMeta(quality: string) {
  return QUALITY_META[quality] || { label: quality || '--', className: 'text-slate-500' };
}

export function PreprocessingDiagnosticsPanel({ snapshot }: { snapshot: PreprocessingSnapshot | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!snapshot || snapshot.mode === 'Disabled') return null;

  const total = snapshot.signals.length;
  const suspect = snapshot.suspectChannels;
  const available = snapshot.availableChannels;

  return (
    <div className="ops-panel-soft overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="text-slate-600 dark:text-slate-300">
          数据质量：{suspect > 0 ? `正常 ${available - suspect}/${available} 可用，${suspect} 个候选异常` : `${available}/${total || available} 通道正常`}
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {expanded ? (
        <div className="max-h-64 overflow-auto border-t border-slate-200 dark:border-slate-700">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-2 py-1 text-left">通道</th>
                <th className="px-2 py-1 text-right">原始值</th>
                <th className="px-2 py-1 text-right">处理值</th>
                <th className="px-2 py-1 text-right">z</th>
                <th className="px-2 py-1 text-left">状态</th>
                <th className="px-2 py-1 text-left">标记</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.signals.map((signal) => {
                const quality = qualityMeta(signal.quality);
                return (
                  <tr key={signal.channel} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-1 text-slate-700 dark:text-slate-200">{signal.channel}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatSignalValue(signal.rawValue)} {signal.unit !== 'unknown' ? signal.unit : ''}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatSignalValue(signal.processedValue)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatSignalValue(signal.robustZ)}</td>
                    <td className={`px-2 py-1 ${quality.className}`}>{quality.label}</td>
                    <td className="px-2 py-1 text-slate-500 dark:text-slate-400">
                      {signal.flags.map((flag) => FLAG_LABELS[flag] || flag).join('、') || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
