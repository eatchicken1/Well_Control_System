import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import {
  BellRing,
  CircleAlert,
  Eye,
  EyeOff,
  Gauge,
  History,
  LogIn,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { Checkbox } from '../components/ui/checkbox';
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
    <svg viewBox="0 0 56 64" aria-hidden="true" className="login-brand-mark-svg">
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
      <g className="login-rig-lines" fill="none" strokeLinecap="round" strokeLinejoin="round">
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
  { icon: Gauge, title: '多井监测', description: '集中查看多口井运行状态' },
  { icon: History, title: '历史复核', description: '追溯报警与参数演化' },
  { icon: BellRing, title: '报警分级', description: '多级风险识别与响应' },
  { icon: Settings2, title: '参数配置', description: '灵活调整监测策略' },
];

function formatLoginError(err: unknown) {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (import.meta.env.DEV && raw) {
    console.warn('[login] raw login error:', raw);
  }

  const normalized = raw.toLowerCase();
  if (/network error|failed to fetch|load failed|networkerror|err_network|network/i.test(raw)) {
    return '网络连接异常，请检查网络';
  }
  if (/unauthorized|forbidden|invalid|credential|401|403/.test(normalized)) {
    return '用户名或密码错误';
  }
  if (/http\s*5\d\d|500|502|503|504|internal server|request failed|service unavailable|bad gateway/.test(normalized)) {
    return '服务连接异常，请稍后重试';
  }
  if (/http\s*\d+|request failed/.test(normalized)) {
    return '登录服务暂时不可用';
  }
  if (raw && /[\u4e00-\u9fff]/.test(raw)) {
    return raw;
  }
  return '登录失败，请检查账号密码。';
}

function CapabilityItem({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="capability-item">
      <div className="capability-icon" aria-hidden="true">
        <Icon />
      </div>
      <div className="capability-copy">
        <div className="capability-title">{title}</div>
        <div className="capability-description">{description}</div>
      </div>
    </div>
  );
}

function LoginBrandPanel() {
  return (
    <section className="brand-panel" aria-label="井控溢流实时监测系统简介">
      <div className="brand-content">
        <header className="brand-header">
          <div className="brand-mark">
            <BrandMark />
          </div>
          <div className="brand-copy">
            <div className="brand-english">WELL CONTROL SYSTEM</div>
            <div className="brand-system-name">井控溢流实时监测系统</div>
          </div>
        </header>

        <div className="hero-content">
          <h1 className="hero-title" aria-label="实时感知 · 智能预警 · 安全可控">
            <span>实时感知</span>
            <span className="hero-title-separator">·</span>
            <span>智能预警</span>
            <span className="hero-title-separator">·</span>
            <span>安全可控</span>
          </h1>
          <div className="hero-accent" aria-hidden="true" />
          <p className="hero-description">
            面向多井实时监测、异常识别、风险判级与事件复核，为钻井作业提供持续可靠的井控安全支持。
          </p>
        </div>

        <div className="capability-grid" aria-label="系统能力">
          {featureItems.map((item) => <CapabilityItem key={item.title} {...item} />)}
        </div>
      </div>

      <div className="rig-line-art">
        <RigIllustration />
      </div>
    </section>
  );
}

interface LoginFormProps {
  username: string;
  password: string;
  rememberMe: boolean;
  showPassword: boolean;
  error: string;
  submitting: boolean;
  usernameReady: boolean;
  passwordReady: boolean;
  submitHint: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRememberChange: (value: boolean) => void;
  onTogglePassword: () => void;
  onForgotPassword: () => void;
  onSubmit: (event: FormEvent) => void;
}

function LoginForm({
  username,
  password,
  rememberMe,
  showPassword,
  error,
  submitting,
  usernameReady,
  passwordReady,
  submitHint,
  onUsernameChange,
  onPasswordChange,
  onRememberChange,
  onTogglePassword,
  onForgotPassword,
  onSubmit,
}: LoginFormProps) {
  return (
    <section className="login-area" aria-label="系统登录">
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <header className="login-heading">
          <div className="login-heading-icon" aria-hidden="true">
            <LockKeyhole />
          </div>
          <div>
            <h2 className="login-title">系统登录</h2>
            <p className="login-subtitle">使用您的系统账户继续</p>
          </div>
        </header>

        <div className="login-form-group">
          <label className="login-form-label" htmlFor="login-username">用户名</label>
          <div className="login-input-wrapper">
            <span className="login-input-icon" aria-hidden="true"><UserRound /></span>
            <input
              id="login-username"
              className="login-input-control"
              aria-label="用户名"
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              autoComplete="username"
              aria-invalid={Boolean(error) && !usernameReady}
              aria-describedby="login-error login-submit-hint"
              placeholder="请输入用户名"
              required
            />
          </div>
        </div>

        <div className="login-form-group">
          <label className="login-form-label" htmlFor="login-password">密码</label>
          <div className="login-input-wrapper">
            <span className="login-input-icon" aria-hidden="true"><LockKeyhole /></span>
            <input
              id="login-password"
              className="login-input-control"
              type={showPassword ? 'text' : 'password'}
              aria-label="密码"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete="current-password"
              aria-invalid={Boolean(error) && !passwordReady}
              aria-describedby="login-error login-submit-hint"
              placeholder="请输入密码"
              required
            />
            <button
              type="button"
              className="login-password-toggle"
              onClick={onTogglePassword}
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
            >
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div id="login-error" className="login-error" role={error ? 'alert' : undefined} aria-live="polite">
          {error ? (
            <>
              <CircleAlert aria-hidden="true" />
              <span>{error}</span>
            </>
          ) : (
            <span aria-hidden="true">&nbsp;</span>
          )}
        </div>

        <div className="login-form-actions">
          <label className="login-remember-control">
            <Checkbox
              checked={rememberMe}
              onCheckedChange={(checked) => onRememberChange(checked === true)}
              className="login-checkbox"
              aria-label="记住我"
            />
            <span>记住我</span>
          </label>
          <button type="button" className="login-forgot-link" onClick={onForgotPassword}>
            忘记密码？
          </button>
        </div>

        <div id="login-submit-hint" className="sr-only" role="status" aria-live="polite">{submitHint}</div>
        <button className="login-button" type="submit" disabled={submitting} aria-describedby="login-submit-hint">
          <LogIn aria-hidden="true" />
          {submitting ? '正在验证……' : '进入系统'}
        </button>

        <div className="login-security-tip">
          <ShieldCheck aria-hidden="true" />
          <span>系统采用多重安全机制，保障您的数据安全</span>
        </div>
      </form>
    </section>
  );
}

function LoginFooter({ year }: { year: number }) {
  return <footer className="login-footer">© {year} Well Control System. 保留所有权利。</footer>;
}

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
  const submitHint = submitting
    ? '正在验证账号，请稍候。'
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
      if (mountedRef.current) setError(formatLoginError(err));
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-background-decoration" aria-hidden="true">
        <span className="login-arc login-arc-primary" />
        <span className="login-arc login-arc-secondary" />
        <span className="login-dot-field login-dot-field-top" />
        <span className="login-dot-field login-dot-field-bottom" />
        <span className="login-soft-band" />
      </div>

      <LoginBrandPanel />
      <LoginForm
        username={username}
        password={password}
        rememberMe={rememberMe}
        showPassword={showPassword}
        error={error}
        submitting={submitting}
        usernameReady={usernameReady}
        passwordReady={passwordReady}
        submitHint={submitHint}
        onUsernameChange={(value) => {
          setUsername(value);
          if (error) setError('');
        }}
        onPasswordChange={(value) => {
          setPassword(value);
          if (error) setError('');
        }}
        onRememberChange={setRememberMe}
        onTogglePassword={() => setShowPassword((visible) => !visible)}
        onForgotPassword={() => setError('请联系系统管理员重置密码。')}
        onSubmit={submit}
      />
      <LoginFooter year={copyrightYear} />
    </main>
  );
}
