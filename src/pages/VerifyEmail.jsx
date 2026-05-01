import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyEmail, resendVerification } from '../api/client';
import { useAuth } from '../context/AuthContext';
import styles from './Auth.module.css';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef(null);

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

  const handleResend = async (e) => {
    e.preventDefault();
    if (resendCooldown > 0) return;
    setResendLoading(true);
    try {
      await resendVerification(resendEmail);
      setResendSent(true);
      setResendCooldown(30);
    } catch {
      // show generic error
    } finally {
      setResendLoading(false);
    }
  };

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setErrorMsg('No verification token found in this link.');
      setStatus('error');
      return;
    }

    verifyEmail(token)
      .then((res) => {
        loginUser(res.data.token, { email: res.data.email, id: res.data.id });
        setStatus('success');
        // Short pause so the user sees the success message, then redirect
        setTimeout(() => navigate('/dashboard'), 1500);
      })
      .catch((err) => {
        setErrorMsg(
          err.response?.data?.detail ||
          'This verification link is invalid or has expired.'
        );
        setStatus('error');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.page}>
      <div className={styles.grid} />
      <div className={styles.card + ' fade-up'} style={{ textAlign: 'center' }}>
        <div className={styles.logo}>
          <img src="/lokscope-logo.png" alt="Lokscope" style={{ height: 28, width: 'auto' }} />
        </div>

        {status === 'verifying' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
            <h1 className={styles.title} style={{ fontSize: '1.4rem' }}>Verifying…</h1>
            <p className={styles.sub}>Hang on a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✅</div>
            <h1 className={styles.title} style={{ fontSize: '1.4rem' }}>Email verified!</h1>
            <p className={styles.sub}>Redirecting you to your dashboard…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
            <h1 className={styles.title} style={{ fontSize: '1.4rem' }}>Link not valid</h1>
            <p className={styles.sub} style={{ marginBottom: '24px' }}>{errorMsg}</p>

            {resendSent ? (
              <p style={{ color: 'var(--accent2)', fontSize: '0.85rem', marginBottom: '16px' }}>
                ✓ New link sent — check your inbox
              </p>
            ) : (
              <form onSubmit={handleResend} className={styles.form} style={{ textAlign: 'left', marginBottom: '16px' }}>
                <div className={styles.field}>
                  <label>Your email</label>
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={e => setResendEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <button type="submit" className={styles.btn} disabled={resendLoading || resendCooldown > 0}>
                  {resendLoading ? 'Sending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Send new verification link'}
                </button>
              </form>
            )}

            <button
              type="button"
              className={styles.toggleBtn}
              onClick={() => navigate('/auth')}
            >
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
