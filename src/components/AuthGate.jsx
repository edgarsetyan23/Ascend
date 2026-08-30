import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export function AuthGate({ children }) {
  const { user, loading, login, register, confirm, resendCode, resetPassword, confirmReset } = useAuth();
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
        try {
          await register(email, password);
        } catch (e) {
          // Account exists but is unconfirmed — resend code and let them confirm
          if (e.name === 'UsernameExistsException') {
            await resendCode(email);
            setInfo('Account already registered — a new verification code has been sent.');
            setMode('confirm');
            return;
          }
          throw e;
        }
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
    login:  'Welcome back',
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
        <div className="auth-logo">☕</div>
        <h1 className="auth-title">Ascend</h1>
        <p className="auth-tagline">Track what matters.</p>
        <p className="auth-plaque">Exhibit 0 · handle with caffeine</p>

        {mode === 'login' && (
          <>
            <p className="auth-blurb">
              A personal command center for LeetCode grinding, job-application
              pipelines, and the daily habits that actually move the needle.
            </p>
            <div className="auth-features">
              <span className="auth-feature"><span className="auth-feature-icon">🎯</span>LeetCode drills</span>
              <span className="auth-feature"><span className="auth-feature-icon">📋</span>Application pipeline</span>
              <span className="auth-feature"><span className="auth-feature-icon">🔥</span>Daily streaks</span>
            </div>
            <p className="auth-private-note">
              Staff only past this point (headcount: 1) —{' '}
              <a href="/portfolio" className="auth-blurb-link">the gallery</a>
              {' '}is this way if you're a recruiter or just here to snoop.
            </p>
          </>
        )}

        {mode !== 'login' && (
          <a href="/portfolio" className="auth-portfolio-link">View the gallery →</a>
        )}

        <p className="auth-subtitle">{subtitle}</p>

        <form onSubmit={handleSubmit} className="auth-form">

          {/* Email — shown on all modes except confirm */}
          {mode !== 'confirm' && (
            <label className="auth-label">
              Email
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true">✉</span>
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
              </div>
            </label>
          )}

          {/* Password — login and signup only */}
          {(mode === 'login' || mode === 'signup') && (
            <label className="auth-label">
              Password
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true">🔒</span>
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
              </div>
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
              <div className="auth-input-wrap">
              <span className="auth-input-icon" aria-hidden="true">🔒</span>
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
              </div>
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
          {mode === 'confirm' && (
            <>
              <button onClick={async () => {
                try {
                  await resendCode(email);
                  setInfo('New code sent — check your email.');
                  setError('');
                } catch (e) {
                  setError(e.message ?? 'Could not resend code');
                }
              }}>
                Resend code
              </button>
              <button onClick={() => switchMode('login')}>Back to sign in</button>
            </>
          )}
          {(mode === 'forgot' || mode === 'reset') && (
            <button onClick={() => switchMode('login')}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
