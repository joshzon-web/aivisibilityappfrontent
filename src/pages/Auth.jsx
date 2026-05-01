import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login, signup, resendVerification, forgotPassword } from '../api/client';
import { useAuth } from '../context/AuthContext';
import styles from './Auth.module.css';
import { getPasswordStrength as getStrength, STRENGTH_LABEL, STRENGTH_COLOR } from '../hooks/usePasswordStrength';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'login');

  // Shared fields
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [showResendPrompt, setShowResendPrompt] = useState(false);

  // Signup-only fields
  const [firstName, setFirstName]         = useState('');
  const [lastName, setLastName]           = useState('');
  const [confirmPassword, setConfirm]     = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [touched, setTouched]             = useState({});   // track blur for inline errors

  // Forgot-password inline flow
  const [forgotMode, setForgotMode]     = useState(false);
  const [forgotEmail, setForgotEmail]   = useState('');
  const [forgotSent, setForgotSent]     = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Post-signup "check your email" screen
  const [verifyEmail, setVerifyEmail]       = useState('');
  const [emailSendFailed, setEmailSendFailed] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendStatus, setResendStatus]     = useState('');
  const cooldownRef = useRef(null);

  const { loginUser } = useAuth();
  const navigate      = useNavigate();

  // Countdown for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(cooldownRef.current);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResendStatus('');
    try {
      await resendVerification(verifyEmail);
      setResendStatus('sent');
      setResendCooldown(30);
    } catch {
      setResendStatus('error');
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setShowResendPrompt(false);
    setTouched({});
    setConfirm('');
    setFirstName('');
    setLastName('');
    setAgreedToTerms(false);
    setForgotMode(false);
    setForgotSent(false);
    setForgotEmail('');
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await forgotPassword(forgotEmail);
    } catch {
      // Always show success — never reveal if email exists
    } finally {
      setForgotLoading(false);
      setForgotSent(true);
    }
  };

  // Inline validation helpers
  const passwordStrength = getStrength(password);
  const passwordsMatch   = password === confirmPassword;
  const confirmError     = touched.confirm && confirmPassword && !passwordsMatch
    ? "Passwords don't match" : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      if (!firstName.trim()) return setError('Please enter your first name.');
      if (!lastName.trim())  return setError('Please enter your last name.');
      if (password.length < 8) return setError('Password must be at least 8 characters.');
      if (!passwordsMatch)   return setError("Passwords don't match.");
      if (!agreedToTerms)    return setError('Please agree to the Terms of Service to continue.');
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await login(email, password);
        loginUser(res.data.token, { email: res.data.email, id: res.data.id });
        navigate('/dashboard');
      } else {
        const signupRes = await signup(email, password, firstName.trim(), lastName.trim());
        setEmailSendFailed(signupRes.data?.email_sent === false);
        setVerifyEmail(email);
      }
    } catch (err) {
      const detail = err.response?.data?.detail || '';
      if (err.response?.status === 403 && detail.toLowerCase().includes('verify')) {
        setShowResendPrompt(true);
      } else {
        setError(detail || 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── "Check your email" screen ─────────────────────────────────────────────
  if (verifyEmail) {
    return (
      <div className={styles.page}>
        <div className={styles.grid} />
        <div className={styles.cardWrap + ' fade-up'}>
          <div className={styles.logo}>
            <img src="/lokscope-logo.png" alt="Lokscope" style={{ height: 28, width: 'auto' }} />
          </div>
          <div className={styles.card} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✉️</div>
          <h1 className={styles.title} style={{ fontSize: '1.4rem' }}>Check your email</h1>
          {emailSendFailed ? (
            <>
              <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: '12px' }}>
                We couldn't send the verification email. Use the button below to try again.
              </p>
              <p style={{ fontWeight: 600, marginBottom: '16px', color: 'var(--text)' }}>{verifyEmail}</p>
            </>
          ) : (
            <>
              <p className={styles.sub} style={{ marginBottom: '4px' }}>We sent a verification link to</p>
              <p style={{ fontWeight: 600, marginBottom: '16px', color: 'var(--text)' }}>{verifyEmail}</p>
              <p className={styles.sub} style={{ fontSize: '0.82rem', lineHeight: 1.6, marginBottom: 0 }}>
                Click the link to activate your account and start your 7-day free trial.<br />
                The link expires in 24 hours — check your spam folder if you don't see it.
              </p>
            </>
          )}

          <button
            className={styles.btn}
            onClick={handleResend}
            disabled={resendCooldown > 0}
            style={{ marginTop: '20px', opacity: resendCooldown > 0 ? 0.5 : 1 }}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}
          </button>
          {resendStatus === 'sent' && (
            <p style={{ color: 'var(--accent2)', fontSize: '0.8rem', marginTop: '8px' }}>
              ✓ New link sent — check your inbox
            </p>
          )}
          {resendStatus === 'error' && (
            <p style={{ color: 'var(--red)', fontSize: '0.8rem', marginTop: '8px' }}>
              Couldn't send — try again in a moment
            </p>
          )}

          <p className={styles.toggle} style={{ marginTop: '20px' }}>
            Already verified?{' '}
            <button
              className={styles.toggleBtn}
              onClick={() => { setVerifyEmail(''); switchMode('login'); }}
            >
              Sign in
            </button>
          </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Forgot password screen ────────────────────────────────────────────────
  if (forgotMode) {
    return (
      <div className={styles.page}>
        <div className={styles.grid} />
        <div className={styles.cardWrap + ' fade-up'}>
          <div className={styles.logo}>
            <img src="/lokscope-logo.png" alt="Lokscope" style={{ height: 28, width: 'auto' }} />
          </div>
          <div className={styles.card}>

          {forgotSent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✉️</div>
              <h1 className={styles.title} style={{ fontSize: '1.4rem' }}>Check your email</h1>
              <p className={styles.sub}>
                If an account exists for <strong style={{ color: 'var(--text)' }}>{forgotEmail}</strong>,
                a reset link is on its way. It expires in 1 hour.
              </p>
              <p className={styles.sub} style={{ fontSize: '0.8rem' }}>
                Check your spam folder if you don't see it.
              </p>
              <button
                className={styles.btn}
                style={{ marginTop: '8px' }}
                onClick={() => switchMode('login')}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h1 className={styles.title} style={{ fontSize: '1.5rem' }}>Forgot password?</h1>
              <p className={styles.sub}>
                Enter your email and we'll send you a reset link.
              </p>
              <form onSubmit={handleForgotSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label>Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoFocus
                    required
                  />
                </div>
                <button type="submit" className={styles.btn} disabled={forgotLoading}>
                  {forgotLoading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <p className={styles.toggle}>
                <button className={styles.toggleBtn} onClick={() => switchMode('login')}>
                  ← Back to sign in
                </button>
              </p>
            </>
          )}
          </div>
        </div>
      </div>
    );
  }

  // ── Login / signup form ───────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.grid} />

      <div className={styles.cardWrap + ' fade-up'}>
        <div className={styles.logo}>
          <img src="/lokscope-logo.png" alt="Lokscope" style={{ height: 28, width: 'auto' }} />
        </div>
        <div className={styles.card}>

        <h1 className={styles.title}>
          {mode === 'login' ? 'Welcome back' : 'Start your free trial'}
        </h1>
        <p className={styles.sub}>
          {mode === 'login'
            ? 'Sign in to your dashboard'
            : '7 days free · No credit card required'}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>

          {/* Name row — signup only */}
          {mode === 'signup' && (
            <div className={styles.nameRow}>
              <div className={styles.field}>
                <label>First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Jane"
                  autoComplete="given-name"
                  required
                />
              </div>
              <div className={styles.field}>
                <label>Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Smith"
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className={styles.field}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          {/* Password */}
          <div className={styles.field}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
            {/* Strength bar — signup only */}
            {mode === 'signup' && password && (
              <div className={styles.strengthWrap}>
                <div className={styles.strengthBar}>
                  {[1, 2, 3, 4].map(n => (
                    <div
                      key={n}
                      className={styles.strengthSegment}
                      style={{ background: n <= passwordStrength ? STRENGTH_COLOR[passwordStrength] : 'var(--border)' }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: '0.72rem', color: STRENGTH_COLOR[passwordStrength] }}>
                  {STRENGTH_LABEL[passwordStrength]}
                </span>
              </div>
            )}
          </div>

          {/* Forgot password link — login only */}
          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginTop: '-10px' }}>
              <button
                type="button"
                className={styles.toggleBtn}
                onClick={() => { setForgotMode(true); setForgotEmail(email); setError(''); }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Confirm password — signup only */}
          {mode === 'signup' && (
            <div className={styles.field}>
              <label>Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirm(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, confirm: true }))}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                style={confirmError ? { borderColor: 'var(--red)' } : {}}
              />
              {confirmError && (
                <span style={{ fontSize: '0.75rem', color: 'var(--red)' }}>{confirmError}</span>
              )}
            </div>
          )}

          {/* Terms — signup only */}
          {mode === 'signup' && (
            <label className={styles.termsRow}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={e => setAgreedToTerms(e.target.checked)}
              />
              <span>
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className={styles.termsLink}>
                  Terms of Service
                </a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className={styles.termsLink}>
                  Privacy Policy
                </a>
              </span>
            </label>
          )}

          {showResendPrompt && (
            <div className={styles.error} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span>Your email hasn't been verified yet.</span>
              <button
                type="button"
                className={styles.btn}
                style={{ margin: 0 }}
                onClick={() => { setVerifyEmail(email); setShowResendPrompt(false); }}
              >
                Resend verification email
              </button>
            </div>
          )}
          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.btn} disabled={loading}>
            {loading
              ? 'Please wait…'
              : mode === 'login' ? 'Sign in' : 'Start free trial'}
          </button>
        </form>

        <p className={styles.toggle}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            className={styles.toggleBtn}
            onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>

        <p className={styles.pricingLink}>
          <button className={styles.toggleBtn} onClick={() => navigate('/pricing')}>
            See pricing & plans →
          </button>
        </p>
        </div>
      </div>
    </div>
  );
}
