import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ReferenceExperimentSnapshot } from '../lib/referenceExperimentContract';

const METHOD_LABELS: Record<string, string> = {
  'causal-robust-v1': 'CausalRobust',
};

function methodLabel(version: string) {
  return METHOD_LABELS[version] || version || '--';
}

function formatValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '--';
  const magnitude = Math.abs(value);
  const digits = magnitude >= 1000 ? 0 : magnitude >= 1 ? 2 : 4;
  return value.toFixed(digits);
}

const LEARNING_META: Record<string, { label: string; className: string }> = {
  Learned: { label: '已学习', className: 'text-slate-600 dark:text-slate-300' },
  Blocked: { label: '已阻止', className: 'text-amber-600 dark:text-amber-300' },
};

function learningMeta(decision: string) {
  return LEARNING_META[decision] || { label: decision || '--', className: 'text-slate-500' };
}

/**
 * Round 2.2 research-only A/B view: for each shadow-eligible channel, shows
 * the EXISTING authoritative reference bank's diagnostics side by side with
 * the experimental Shadow (causal-robust-v1 processed) reference bank's
 * diagnostics. Both are queried against the SAME raw measurement each frame
 * - see ReferenceChannelComparison.rawQueryValue - so the two z columns are
 * directly comparable.
 *
 * This panel NEVER drives any alarm. Current PublicLevel/FormalEvalLevel and
 * every other alarm/evidence path in this app is derived solely from the
 * authoritative raw reference bank - the Shadow column below is diagnostics
 * only, clearly labeled "实验 / Shadow", and only ever shown for ONE method
 * at a time (never a multi-curve overlay).
 */
export function ReferenceExperimentPanel({ snapshot }: { snapshot: ReferenceExperimentSnapshot | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!snapshot || snapshot.mode === 'Disabled' || snapshot.channels.length === 0) return null;

  const learnedCount = snapshot.channels.filter((channel) => channel.learningDecision === 'Learned').length;

  return (
    <div className="ops-panel-soft overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span>参考基线 A/B：{learnedCount}/{snapshot.channels.length} 通道已学习处理参考</span>
          <span className="rounded bg-violet-100 px-1 py-0.5 font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">SHADOW</span>
          <span className="rounded bg-amber-100 px-1 py-0.5 font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">EXPERIMENT</span>
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {expanded ? (
        <div className="border-t border-slate-200 dark:border-slate-700">
          <div className="px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            方法：{methodLabel(snapshot.methodVersion)}。实测参考学习来源：{snapshot.channels[0]?.authoritativeLearningOrigin || 'RawMeasurement'}；处理参考学习来源：{snapshot.channels[0]?.shadowLearningOrigin || 'DerivedEstimate'}。两列都以当前原始测量值查询；处理参考仅供实验诊断，不参与当前告警。
          </div>
          <div className="max-h-64 overflow-auto border-t border-slate-200 dark:border-slate-700">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-2 py-1 text-left" rowSpan={2}>通道</th>
                  <th className="px-2 py-1 text-right" rowSpan={2}>原始值</th>
                  <th className="px-2 py-1 text-center" colSpan={4}>实测参考（告警依据）</th>
                  <th className="px-2 py-1 text-center" colSpan={4}>处理参考（SHADOW / 实验）</th>
                  <th className="px-2 py-1 text-left" rowSpan={2}>处理质量</th>
                  <th className="px-2 py-1 text-left" rowSpan={2}>学习状态</th>
                </tr>
                <tr>
                  <th className="px-2 py-1 text-right">均值</th>
                  <th className="px-2 py-1 text-right">离散度</th>
                  <th className="px-2 py-1 text-right">z</th>
                  <th className="px-2 py-1 text-right">n</th>
                  <th className="px-2 py-1 text-right">均值</th>
                  <th className="px-2 py-1 text-right">离散度</th>
                  <th className="px-2 py-1 text-right">raw-query z</th>
                  <th className="px-2 py-1 text-right">n</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.channels.map((channel) => {
                  const learning = learningMeta(channel.learningDecision);
                  return (
                    <tr key={channel.channel} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-1 text-slate-700 dark:text-slate-200">{channel.channel}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{formatValue(channel.rawQueryValue)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{channel.authoritative.ready ? formatValue(channel.authoritative.center) : '--'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{channel.authoritative.ready ? formatValue(channel.authoritative.scale) : '--'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{channel.authoritative.ready ? formatValue(channel.authoritative.standardizedResidual) : '--'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{channel.authoritative.sampleCount}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{channel.shadowProcessed.ready ? formatValue(channel.shadowProcessed.center) : '--'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{channel.shadowProcessed.ready ? formatValue(channel.shadowProcessed.scale) : '--'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{channel.shadowProcessed.ready ? formatValue(channel.shadowProcessed.standardizedResidual) : '--'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{channel.shadowProcessed.sampleCount}</td>
                      <td className="px-2 py-1 text-left">{channel.processedQuality || '--'}</td>
                      <td className={`px-2 py-1 ${learning.className}`} title={channel.learningBlockReason}>{learning.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
