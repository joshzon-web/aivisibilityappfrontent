import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { resetPassword } from '../api/client';
import styles from './Auth.module.css';

function getStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOR = ['', 'var(--red)', 'var(--orange)', '#f59e0b', 'var(--accent2)'];

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [touched, setTouched]     = useState(false);

  const token = searchParams.get('token') || '';
  const strength = getStrength(password);
  const passwordsMatch = password === confirm;
  const confirmError = touched && confirm && !passwordsMatch ? "Passwords don't match" : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (!passwordsMatch)     return setError("Passwords don't match.");
    if (!token)              return setError('Invalid reset link — please request a new one.');

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.grid} />
      <div className={styles.card + ' fade-up'}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>◈</span>
          <span className={styles.logoText}>AI VISIBILITY</span>
        </div>

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✅</div>
            <h1 className={styles.title} style={{ fontSize: '1.4rem' }}>Password updated</h1>
            <p className={styles.sub}>You can now sign in with your new password.</p>
            <button
              className={styles.btn}
              style={{ marginTop: '8px' }}
              onClick={() => navigate('/auth')}
            >
              Sign in
            </button>
          </div>
        ) : (
          <>
            <h1 className={styles.title} style={{ fontSize: '1.5rem' }}>Choose a new password</h1>
            <p className={styles.sub}>Pick something strong — at least 8 characters.</p>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label>New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  autoFocus
                  required
                />
                {password && (
                  <div className={styles.strengthWrap}>
                    <div className={styles.strengthBar}>
                      {[1, 2, 3, 4].map(n => (
                        <div
                          key={n}
                          className={styles.strengthSegment}
                          style={{ background: n <= strength ? STRENGTH_COLOR[strength] : 'var(--border)' }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: STRENGTH_COLOR[strength] }}>
                      {STRENGTH_LABEL[strength]}
                    </span>
                  </div>
                )}
              </div>

              <div className={styles.field}>
                <label>Confirm new password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  style={confirmError ? { borderColor: 'var(--red)' } : {}}
                />
                {confirmError && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--red)' }}>{confirmError}</span>
                )}
              </div>

              {error && <div className={styles.error}>{error}</div>}

              <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? 'Saving…' : 'Set new password'}
              </button>
            </form>

            <p className={styles.toggle}>
              <button className={styles.toggleBtn} onClick={() => navigate('/auth')}>
                ← Back to sign in
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
