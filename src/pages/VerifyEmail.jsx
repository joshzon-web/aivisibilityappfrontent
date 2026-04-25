import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyEmail } from '../api/client';
import { useAuth } from '../context/AuthContext';
import styles from './Auth.module.css';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

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
          <span className={styles.logoMark}>◈</span>
          <span className={styles.logoText}>AI VISIBILITY</span>
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
            <button
              className={styles.btn}
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
