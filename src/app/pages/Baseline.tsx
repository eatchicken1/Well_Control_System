import { DatabaseZap, RotateCcw, ShieldCheck } from 'lucide-react';
import { useWellControl } from '../context/WellControlContext';

function BaselineMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="ops-panel-soft p-3">
      <div className="text-[11px] ops-muted">{label}</div>
      <div className="mt-1 text-2xl tabular-nums text-slate-900 dark:text-slate-100">{value}</div>
      <div className="mt-1 text-xs ops-muted">{note}</div>
    </div>
  );
}

export default function Baseline() {
  const { baselineInfo, cycleInfo, historyRecords, handleReset, thresholds } = useWellControl();
  const latestCycles = historyRecords.slice(-12).reverse();

  return (
    <div className="ops-page space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="ops-eyebrow">基线治理</div>
          <h1 className="ops-title">基线管理</h1>
          <p className="text-sm ops-muted">管理接单根周期模板、冻结样本和冷启动状态</p>
        </div>
        <button onClick={handleReset} className="ops-button-secondary">
          <RotateCcw className="h-4 w-4" />
          重置当前井基线
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <BaselineMetric label="合格周期" value={baselineInfo.qualifiedCycles.toString()} note={`冷启动要求 ${thresholds.coldStartCycleCount} 周期`} />
        <BaselineMetric label="冻结周期" value={baselineInfo.frozenCycles.toString()} note="后端 L4 样本不进入模板" />
        <BaselineMetric label="模板覆盖率" value={`${baselineInfo.templateCoverage.toFixed(0)}%`} note="历史周期包络覆盖率" />
        <BaselineMetric label="质量评分" value={`${baselineInfo.qualityScore.toFixed(0)}%`} note={baselineInfo.isColdStart ? `冷启动剩余 ${baselineInfo.coldStartRemaining}` : '可用于正式判别'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="ops-panel overflow-hidden">
          <div className="border-b border-slate-200 bg-[#f6fafc] px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
              <DatabaseZap className="h-4 w-4 text-cyan-500" />
              最近周期候选
            </div>
          </div>
          <div className="ops-scroll max-h-[calc(100vh-330px)] overflow-auto">
            {latestCycles.length === 0 ? (
              <div className="ops-empty-state m-3 min-h-[180px]">
                <div>
                  <div className="ops-empty-icon">
                    <DatabaseZap className="h-4 w-4" />
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-200">等待实时样本写入</div>
                  <div className="mt-1 text-xs">采集开始后，周期样本会在这里形成候选列表。</div>
                </div>
              </div>
            ) : (
              <table className="ops-table">
                <thead>
                  <tr>
                    <th className="text-left">时间</th>
                    <th className="text-right">周期</th>
                    <th className="text-right">立压</th>
                    <th className="text-right">出口流量响应</th>
                    <th className="text-right">全烃</th>
                    <th className="text-center">基线动作</th>
                  </tr>
                </thead>
                <tbody>
                  {latestCycles.map((record) => {
                    const frozen = record.backendLevel >= 4;
                    return (
                      <tr key={record.id}>
                        <td className="whitespace-nowrap text-xs ops-muted">{record.date} {record.time}</td>
                        <td className="text-right tabular-nums">S{record.cycleState}</td>
                        <td className="text-right tabular-nums">{record.spp.toFixed(2)}</td>
                        <td className="text-right tabular-nums">{record.returnResponse.toFixed(1)}%</td>
                        <td className="text-right tabular-nums">{record.totalGas.toFixed(2)}</td>
                        <td className="text-center">
                          <span className={`rounded px-2 py-0.5 text-xs ${frozen ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'}`}>
                            {frozen ? '冻结' : '候选'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <aside className="ops-panel h-fit p-4">
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            当前基线状态
          </div>
          <div className={`rounded-md border p-3 text-sm ${
            baselineInfo.isColdStart
              ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100'
          }`}>
            {baselineInfo.isColdStart ? '冷启动中：后端判级仍需更多周期支撑。' : '基线已具备正式判别条件。'}
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="ops-inline-tile flex justify-between px-3 py-2">
              <span className="ops-muted">当前周期</span>
              <span className="tabular-nums">#{cycleInfo.cycleIndex} · {cycleInfo.shortLabel}</span>
            </div>
            <div className="ops-inline-tile flex justify-between px-3 py-2">
              <span className="ops-muted">剩余冷启动</span>
              <span className="tabular-nums">{baselineInfo.coldStartRemaining}</span>
            </div>
            <div className="ops-inline-tile flex justify-between px-3 py-2">
              <span className="ops-muted">上次重置</span>
              <span>{baselineInfo.lastResetTime || '无'}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
