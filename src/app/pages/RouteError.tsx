import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { AlertOctagon, LayoutDashboard, RotateCcw } from 'lucide-react';

function errorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    const detail = typeof error.data === 'string'
      ? error.data
      : typeof error.data?.message === 'string'
        ? error.data.message
        : error.statusText;
    return `HTTP ${error.status}${detail ? ` · ${detail}` : ''}`;
  }
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '页面渲染过程中出现异常。';
}

export default function RouteError() {
  const error = useRouteError();

  return (
    <main className="auth-shell">
      <section className="ops-surface route-error-panel p-5" aria-labelledby="route-error-title">
        <div className="route-error-icon">
          <AlertOctagon className="h-5 w-5" />
        </div>
        <div className="ops-eyebrow">页面异常</div>
        <h1 id="route-error-title" className="ops-title">当前页面暂时不可用</h1>
        <p className="text-sm ops-muted">
          系统已拦截本次渲染异常，请刷新页面或返回总览继续监测。
        </p>
        <div
          className="route-error-message ops-break-text mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          role="alert"
          aria-live="assertive"
        >
          {errorMessage(error)}
        </div>
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100">
          仅当前页面渲染被中断；返回总览后可继续选择井或重新进入实时监测。
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="ops-button-secondary px-3 py-2 text-sm" onClick={() => window.location.reload()} aria-label="刷新当前页面">
            <RotateCcw className="h-4 w-4" />
            刷新页面
          </button>
          <Link to="/" className="ops-button-primary px-3 py-2 text-sm" aria-label="返回井控总览页面">
            <LayoutDashboard className="h-4 w-4" />
            返回总览
          </Link>
        </div>
      </section>
    </main>
  );
}
