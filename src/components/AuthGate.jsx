import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export function AuthGate({ children }) {
  const { user, loading, login, register, confirm, resetPassword, confirmReset } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'confirm' | 'forgot' | 'reset'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode]         = useState('');
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="auth-loading">Loading...</div>;
  if (user) return children;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'signup') {
        await register(email, password);
        setMode('confirm');
      } else if (mode === 'confirm') {
        await confirm(email, code);
        await login(email, password);
      } else if (mode === 'forgot') {
        await resetPassword(email);
        setInfo(`Reset code sent to ${email}`)
        setMode('reset');
      } else if (mode === 'reset') {
        await confirmReset(email, code, newPassword);
        setInfo('Password updated — sign in with your new password');
        setMode('login');
        setCode('');
        setNewPassword('');
      }
    } catch (e) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError('');
    setInfo('');
  }

  const subtitle = {
    login:  'Sign in to your account',
    signup: 'Create your account',
    confirm: `Check ${email} for a verification code`,
    forgot: 'Enter your email to reset your password',
    reset:  'Enter the code we sent you',
  }[mode];

  const submitLabel = submitting ? 'Please wait...' : {
    login:   'Sign In',
    signup:  'Create Account',
    confirm: 'Verify Email',
    forgot:  'Send Reset Code',
    reset:   'Set New Password',
  }[mode];

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <div className="auth-logo">🔱</div>
        <h1 className="auth-title">Ascend</h1>
        <p className="auth-tagline">Chronicle your rise</p>

        {mode === 'login' && (
          <p className="auth-blurb">
            A personal tracker for LeetCode, job applications, and daily progress.
            This is a private app —{' '}
            <a href="/portfolio" className="auth-blurb-link">visit the portfolio</a>
            {' '}if you're a recruiter or just browsing.
          </p>
        )}

        {mode !== 'login' && (
          <a href="/portfolio" className="auth-portfolio-link">View portfolio →</a>
        )}

        <p className="auth-subtitle">{subtitle}</p>

        <form onSubmit={handleSubmit} className="auth-form">

          {/* Email — shown on all modes except confirm */}
          {mode !== 'confirm' && (
            <label className="auth-label">
              Email
              <input
                type="email"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus={mode !== 'reset'}
                autoComplete="email"
                placeholder="you@example.com"
                readOnly={mode === 'reset'}
              />
            </label>
          )}

          {/* Password — login and signup only */}
          {(mode === 'login' || mode === 'signup') && (
            <label className="auth-label">
              Password
              <input
                type="password"
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={mode === 'signup' ? 'Min 8 characters' : '••••••••'}
              />
            </label>
          )}

          {/* Forgot password link — login mode only */}
          {mode === 'login' && (
            <button
              type="button"
              className="auth-forgot-link"
              onClick={() => switchMode('forgot')}
            >
              Forgot password?
            </button>
          )}

          {/* Verification code — confirm and reset modes */}
          {(mode === 'confirm' || mode === 'reset') && (
            <label className="auth-label">
              {mode === 'confirm' ? 'Verification Code' : 'Reset Code'}
              <input
                type="text"
                className="auth-input auth-input--code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                required
                autoFocus
                inputMode="numeric"
                maxLength={6}
              />
            </label>
          )}

          {/* New password — reset mode only */}
          {mode === 'reset' && (
            <label className="auth-label">
              New Password
              <input
                type="password"
                className="auth-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Min 8 characters"
              />
            </label>
          )}

          {info  && <p className="auth-info">{info}</p>}
          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitLabel}
          </button>
        </form>

        <div className="auth-toggle">
          {mode === 'login' && (
            <button onClick={() => switchMode('signup')}>
              No account? <strong>Sign up</strong>
            </button>
          )}
          {mode === 'signup' && (
            <button onClick={() => switchMode('login')}>
              Already have an account? <strong>Sign in</strong>
            </button>
          )}
          {(mode === 'confirm' || mode === 'forgot' || mode === 'reset') && (
            <button onClick={() => switchMode('login')}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
