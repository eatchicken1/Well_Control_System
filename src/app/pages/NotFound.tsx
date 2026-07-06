import { Link } from 'react-router';
import { AlertTriangle, LayoutDashboard, RadioTower } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="ops-page flex min-h-[calc(100vh-120px)] items-center justify-center">
      <section className="ops-surface not-found-panel p-5" role="status" aria-live="polite" aria-labelledby="not-found-title">
        <div className="not-found-icon">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="ops-eyebrow">页面未找到</div>
        <h1 id="not-found-title" className="ops-title">当前路径不在监测工作台内</h1>
        <p className="text-sm ops-muted">
          请返回总览选择监测井，或进入实时监测继续查看当前井筒状态。
        </p>
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          当前访问地址没有对应页面，监测数据与报警队列不会因此被修改。
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/" className="ops-button-primary px-3 py-2 text-sm" aria-label="返回井控总览页面">
            <LayoutDashboard className="h-4 w-4" />
            返回总览
          </Link>
          <Link to="/monitoring" className="ops-button-secondary px-3 py-2 text-sm" aria-label="进入实时监测页面">
            <RadioTower className="h-4 w-4" />
            实时监测
          </Link>
        </div>
      </section>
    </div>
  );
}
