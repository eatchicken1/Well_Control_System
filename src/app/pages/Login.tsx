import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import {
  Activity,
  BellRing,
  Check,
  Database,
  Eye,
  EyeOff,
  Gauge,
  History,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const REMEMBERED_USERNAME_KEY = 'wcs-login-username';
const REMEMBER_LOGIN_KEY = 'wcs-remember-login';

function safeReturnPath(value: unknown) {
  const raw = typeof value === 'string' ? value : '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  return raw;
}

function BrandMark() {
  return (
    <svg viewBox="0 0 56 64" aria-hidden="true" className="auth-brand-svg">
      <path d="M28 1 54 10v26c0 14-9.7 21.7-26 27C11.7 57.7 2 50 2 36V10L28 1Z" fill="currentColor" />
      <g fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">
        <path d="m18 43 10-29 10 29M22 31h12M20 37h16M24 25h8M28 14v-4M16 43h24" />
        <path d="M28 10 23 43M28 10l5 33M23 19h10M21 25h14" />
      </g>
      <circle cx="28" cy="7" r="2" fill="white" />
    </svg>
  );
}

function RigIllustration() {
  return (
    <svg viewBox="0 0 580 220" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <g className="auth-rig-lines" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M0 192c58-8 83-4 126 0 47 4 77 5 122-1 55-7 81-2 119 3 44 6 90-2 127-4 31-2 53 1 86 5" />
        <path d="M0 203c51-5 87-2 130 2 48 5 84 2 122-3 54-7 83-2 119 2 45 5 83-4 128-3 31 1 53 3 81 1" />
        <path d="m70 191 11-6 11 1 10-7 18 4 13-3 11 7M424 193l16-8 13 3 13-5 24 6 13-4 13 4" />
        <path d="M140 190 174 35l34 155M174 35l-20 155M174 35l20 155M160 99h28M155 124h38M149 153h48" />
        <path d="M153 190h45M165 74h18M169 54h10M174 35V20M169 20h10" />
        <path d="M174 190v30M184 190v30M148 190v16M200 190v16" />
        <path d="M125 190h98l10 6h-118ZM125 196v17M223 196v17M137 213h74" />
        <path d="M104 190v-14h18v14M102 176h22v-9h-22ZM96 190v-8h6M232 190v-12h28v12M237 178v-5h14v5" />
        <path d="M258 190h35M268 183h18v7M286 183h12v7" />
      </g>
    </svg>
  );
}

const featureItems = [
  { icon: Gauge, title: '多井监测', description: '集中监测管理' },
  { icon: History, title: '历史复核', description: '回溯分析追踪' },
  { icon: BellRing, title: '报警判级', description: '分级及时预警' },
  { icon: Settings2, title: '参数配置', description: '灵活配置管理' },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = useMemo(() => safeReturnPath((location.state as { from?: string } | null)?.from), [location.state]);
  const [username, setUsername] = useState(() => localStorage.getItem(REMEMBERED_USERNAME_KEY) || 'admin');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem(REMEMBER_LOGIN_KEY) === 'true');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const mountedRef = useRef(true);
  const copyrightYear = new Date().getFullYear();
  const usernameReady = username.trim().length > 0;
  const passwordReady = password.length > 0;
  const canSubmit = !submitting;
  const submitHint = submitting
    ? '正在校验账号，请稍候。'
    : !usernameReady
      ? '请输入用户名后继续。'
      : !passwordReady
        ? '请输入密码后继续。'
        : '账号信息已填写，可以进入系统。';

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  if (user) return <Navigate to={from} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!usernameReady || !passwordReady) {
      setError('请输入用户名和密码。');
      return;
    }

    if (rememberMe) {
      localStorage.setItem(REMEMBERED_USERNAME_KEY, username.trim());
      localStorage.setItem(REMEMBER_LOGIN_KEY, 'true');
    } else {
      localStorage.removeItem(REMEMBERED_USERNAME_KEY);
      localStorage.removeItem(REMEMBER_LOGIN_KEY);
    }

    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : '登录失败，请检查账号密码。');
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-shell-geometry" aria-hidden="true">
        <span className="auth-orbit auth-orbit-one" />
        <span className="auth-orbit auth-orbit-two" />
        <span className="auth-geometry-node auth-geometry-node-one" />
        <span className="auth-geometry-node auth-geometry-node-two" />
      </div>

      <section className="auth-login-panel" aria-label="井控溢流实时监测系统登录">
        <div className="auth-login-copy">
          <div className="auth-brand-row">
            <div className="auth-brand-mark"><BrandMark /></div>
            <span className="auth-brand-name">WELL CONTROL SYSTEM</span>
          </div>

          <div className="auth-copy-content">
            <h1>井控溢流实时监测系统</h1>
            <p>专注于井控安全监测与溢流风险管理，助力钻井作业安全高效运行。</p>

            <div className="auth-signal-grid">
              {featureItems.map(({ icon: Icon, title, description }) => (
                <div className="auth-feature-card" key={title}>
                  <Icon className="auth-feature-icon" aria-hidden="true" />
                  <strong>{title}</strong>
                  <span>{description}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="auth-dot-field" aria-hidden="true" />
          <div className="auth-rig-illustration"><RigIllustration /></div>
        </div>

        <form className="auth-form" onSubmit={submit} noValidate>
          <header className="auth-form-header">
            <div className="auth-eyebrow">SECURE SIGN IN</div>
            <h2>系统登录</h2>
          </header>

          <div className="auth-form-fields">
            <label className="auth-field-label">
              <span>用户名</span>
              <div className="auth-input-shell">
                <UserRound className="auth-input-icon" aria-hidden="true" />
                <input
                  className="auth-input"
                  aria-label="用户名"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    if (error) setError('');
                  }}
                  autoComplete="username"
                  aria-invalid={Boolean(error) && !usernameReady}
                  aria-describedby={error ? 'login-error' : undefined}
                  placeholder="请输入用户名"
                  required
                />
              </div>
            </label>

            <label className="auth-field-label">
              <span>密码</span>
              <div className="auth-input-shell">
                <LockKeyhole className="auth-input-icon" aria-hidden="true" />
                <input
                  className="auth-input auth-password-input"
                  type={showPassword ? 'text' : 'password'}
                  aria-label="密码"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError('');
                  }}
                  autoComplete="current-password"
                  aria-invalid={Boolean(error) && !passwordReady}
                  aria-describedby={error ? 'login-error' : undefined}
                  placeholder="请输入密码"
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </label>
          </div>

          {error && <div id="login-error" role="alert" className="auth-error">{error}</div>}

          <div className="auth-form-options">
            <label className="auth-remember-control">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span className="auth-checkbox" aria-hidden="true"><Check /></span>
              <span>记住我</span>
            </label>
            <button type="button" className="auth-forgot" onClick={() => setError('请联系系统管理员重置密码。')}>
              忘记密码?
            </button>
          </div>

          <div id="login-submit-hint" className="sr-only" role="status" aria-live="polite">{submitHint}</div>
          <button className="ops-button-primary auth-submit" type="submit" disabled={!canSubmit} aria-describedby="login-submit-hint">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            {submitting ? '正在登录' : '进入系统'}
          </button>

          <div className="auth-security-note">
            <ShieldCheck aria-hidden="true" />
            <span>系统采用多重安全机制，保障您的数据安全</span>
          </div>
        </form>
      </section>

      <footer className="auth-footer">© {copyrightYear} Well Control System. 保留所有权利。</footer>
    </main>
  );
}
