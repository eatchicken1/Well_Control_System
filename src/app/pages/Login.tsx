import { FormEvent, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Activity, Database, Gauge, LockKeyhole, RadioTower, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function safeReturnPath(value: unknown) {
  const raw = typeof value === 'string' ? value : '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  return raw;
}

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = useMemo(() => safeReturnPath((location.state as { from?: string } | null)?.from), [location.state]);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查账号密码');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-login-panel">
        <div className="auth-login-copy">
          <div className="auth-brand-mark">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="ops-eyebrow">Well Control System</div>
          <h1>井控溢流实时监测系统</h1>
          <p>登录后进入实时井列表、报警判级、历史复核和参数配置工作台。</p>
          <div className="auth-signal-grid">
            <div><RadioTower className="h-4 w-4" /><span>MySQL 实时流</span></div>
            <div><Gauge className="h-4 w-4" /><span>多井状态</span></div>
            <div><Database className="h-4 w-4" /><span>数据库复核</span></div>
            <div><Activity className="h-4 w-4" /><span>报警判级</span></div>
          </div>
        </div>

        <form className="auth-form ops-panel" onSubmit={submit}>
          <div>
            <div className="ops-eyebrow">Secure sign in</div>
            <h2>系统登录</h2>
          </div>
          <label>
            <span>用户名</span>
            <input
              className="ops-field"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            <span>密码</span>
            <input
              className="ops-field"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="ops-button-primary auth-submit" type="submit" disabled={submitting}>
            <LockKeyhole className="h-4 w-4" />
            {submitting ? '正在登录' : '进入系统'}
          </button>
        </form>
      </section>
    </main>
  );
}
