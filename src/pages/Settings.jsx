import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import BrandLogo from '../components/BrandLogo';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';
import api, { createCheckout, createPortalSession, updateProfile, changePassword, getNotificationPrefs, updateNotificationPrefs } from '../api/client';
import { useBillingStatus } from '../components/TrialBanner';

// ── Plan definitions (mirrors core/billing.py) ────────────────────────────────
const PLANS = {
  trial:  { display: 'Free Trial',  scans: 10,   businesses: 3,   clients: 3 },
  solo:   { display: 'Solo',        scans: 25,   businesses: 5,   clients: 5,   price: '£49 / mo' },
  agency: { display: 'Agency',      scans: 75,   businesses: 20,  clients: null, price: '£129 / mo' },
  pro:    { display: 'Pro',         scans: 200,  businesses: null, clients: null, price: '£299 / mo' },
  admin:  { display: 'Admin',       scans: null, businesses: null, clients: null },
};

const PLAN_ORDER = ['trial', 'solo', 'agency', 'pro'];

const PLAN_FEATURES = {
  solo:   ['25 scans / month', '5 businesses', '5 client folders', 'Branded PDFs', 'Share links'],
  agency: ['75 scans / month', '20 businesses', 'Unlimited client folders', 'Branded PDFs', 'Share links', 'Custom sender emails'],
  pro:    ['200 scans / month', 'Unlimited businesses', 'Unlimited client folders', 'Everything in Agency', 'Priority support'],
};


// ── Account tab ──────────────────────────────────────────────────────────────

function AccountTab() {
  const { user, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Profile
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName,  setLastName]  = useState(user?.last_name  || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved,  setProfileSaved]  = useState(false);
  const [profileError,  setProfileError]  = useState('');

  // Password
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [pwdSaving,   setPwdSaving]   = useState(false);
  const [pwdSuccess,  setPwdSuccess]  = useState('');
  const [pwdError,    setPwdError]    = useState('');

  const inputStyle = {
    width: '100%', padding: '10px 14px', fontSize: '0.88rem',
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: '8px', color: 'var(--text)', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const labelStyle = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600,
    color: 'var(--muted)', marginBottom: '6px', letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSaving(true);
    try {
      await updateProfile({ first_name: firstName.trim() || null, last_name: lastName.trim() || null });
      updateUser({ first_name: firstName.trim() || null, last_name: lastName.trim() || null });
      setProfileSaved(true);
    } catch (err) {
      setProfileError(err.response?.data?.detail || 'Could not save. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');
    if (newPwd.length < 8) { setPwdError('New password must be at least 8 characters.'); return; }
    if (newPwd !== confirmPwd) { setPwdError('Passwords do not match.'); return; }
    setPwdSaving(true);
    try {
      await changePassword(currentPwd, newPwd);
      setPwdSuccess('Password updated.');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err) {
      setPwdError(err.response?.data?.detail || 'Could not update password.');
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Account</h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 40 }}>
        Manage your profile, password and app preferences.
      </p>

      {/* ── Profile ── */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 20, color: 'var(--text)' }}>Profile</h2>
        <form onSubmit={handleProfileSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>First name</label>
              <input
                style={inputStyle}
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setProfileSaved(false); }}
                placeholder="Jane"
                maxLength={80}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Last name</label>
              <input
                style={inputStyle}
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setProfileSaved(false); }}
                placeholder="Smith"
                maxLength={80}
              />
            </div>
          </div>
          <div style={{ marginBottom: 28 }}>
            <label style={labelStyle}>Email</label>
            <input
              style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }}
              value={user?.email || ''}
              readOnly
            />
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 5 }}>
              To change your email address, please contact support.
            </p>
          </div>
          {profileError && (
            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
              color: 'var(--red)', borderRadius: 8, padding: '10px 14px',
              fontSize: '0.82rem', marginBottom: 16 }}>
              {profileError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" disabled={profileSaving} style={{
              padding: '10px 28px', borderRadius: 8, fontSize: '0.88rem',
              background: 'var(--accent)', border: 'none', color: 'var(--bg)',
              fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Mono, monospace',
              opacity: profileSaving ? 0.6 : 1,
            }}>
              {profileSaving ? 'Saving…' : 'Save profile'}
            </button>
            {profileSaved && <span style={{ fontSize: '0.82rem', color: 'var(--accent2)' }}>✓ Saved</span>}
          </div>
        </form>
      </section>

      {/* ── Change password ── */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 20, color: 'var(--text)' }}>Change password</h2>
        <form onSubmit={handlePasswordChange} style={{ maxWidth: 400 }}>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Current password</label>
            <input
              style={inputStyle}
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>New password</label>
            <input
              style={inputStyle}
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Confirm new password</label>
            <input
              style={inputStyle}
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {pwdError && (
            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
              color: 'var(--red)', borderRadius: 8, padding: '10px 14px',
              fontSize: '0.82rem', marginBottom: 16 }}>
              {pwdError}
            </div>
          )}
          {pwdSuccess && (
            <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)',
              color: 'var(--accent2)', borderRadius: 8, padding: '10px 14px',
              fontSize: '0.82rem', marginBottom: 16 }}>
              {pwdSuccess}
            </div>
          )}
          <button type="submit" disabled={pwdSaving || !currentPwd || !newPwd || !confirmPwd} style={{
            padding: '10px 28px', borderRadius: 8, fontSize: '0.88rem',
            background: 'var(--accent)', border: 'none', color: 'var(--bg)',
            fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Mono, monospace',
            opacity: (pwdSaving || !currentPwd || !newPwd || !confirmPwd) ? 0.5 : 1,
          }}>
            {pwdSaving ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>

      {/* ── Appearance ── */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 20, color: 'var(--text)' }}>Appearance</h2>
        <div style={{
          border: '1px solid var(--border)', borderRadius: 12,
          padding: '16px 20px', background: 'var(--bg-card)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 400,
        }}>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
              {theme === 'dark' ? 'Dark mode' : 'Light mode'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              {theme === 'dark' ? 'Switch to a lighter interface' : 'Switch to a darker interface'}
            </div>
          </div>
          <button
            onClick={toggleTheme}
            style={{
              padding: '8px 18px', borderRadius: 8, fontSize: '0.83rem',
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text)', cursor: 'pointer', fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {theme === 'dark' ? '☀ Light mode' : '◑ Dark mode'}
          </button>
        </div>
      </section>

      {/* ── Notifications ── */}
      <NotificationsSection />
    </div>
  );
}

function NotificationsSection() {
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(null); // key of the pref being saved

  useEffect(() => {
    getNotificationPrefs().then(r => setPrefs(r.data)).catch(() => {});
  }, []);

  const toggle = async (key) => {
    if (!prefs || saving) return;
    const newVal = !prefs[key];
    setPrefs(p => ({ ...p, [key]: newVal }));
    setSaving(key);
    try {
      await updateNotificationPrefs({ [key]: newVal });
    } catch {
      // Revert on error
      setPrefs(p => ({ ...p, [key]: !newVal }));
    } finally {
      setSaving(null);
    }
  };

  const NOTIF_ITEMS = [
    {
      key: 'notify_scan_complete',
      label: 'Scan complete',
      desc: 'Email when a scheduled scan finishes — includes score and change vs last scan.',
    },
    {
      key: 'notify_score_drop',
      label: 'Score drop alert',
      desc: 'Email when a business score drops 10+ points — catch issues before your clients do.',
    },
    {
      key: 'notify_weekly_digest',
      label: 'Weekly digest',
      desc: 'Monday morning summary of all businesses — name, latest score, and change.',
    },
  ];

  return (
    <section style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
        Notifications
      </h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 20, lineHeight: 1.5 }}>
        All notification emails go to your account email address.
      </p>
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', maxWidth: 520 }}>
        {NOTIF_ITEMS.map((item, i) => {
          const on = prefs ? !!prefs[item.key] : false;
          return (
            <div
              key={item.key}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16, padding: '16px 20px',
                borderBottom: i < NOTIF_ITEMS.length - 1 ? '1px solid var(--border)' : 'none',
                background: 'var(--bg-card)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                  {item.desc}
                </div>
              </div>
              {/* Toggle switch */}
              <button
                onClick={() => toggle(item.key)}
                disabled={!prefs || saving === item.key}
                aria-label={on ? `Disable ${item.label}` : `Enable ${item.label}`}
                style={{
                  flexShrink: 0,
                  width: 44, height: 24, borderRadius: 12, border: 'none',
                  background: on ? 'var(--accent)' : 'var(--border)',
                  cursor: prefs && !saving ? 'pointer' : 'default',
                  position: 'relative', transition: 'background 0.2s',
                  opacity: !prefs ? 0.5 : 1,
                }}
              >
                <span style={{
                  position: 'absolute', top: 3,
                  left: on ? 23 : 3,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}


// ── Billing tab ───────────────────────────────────────────────────────────────

function UsageBar({ label, used, limit, unit = '' }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const barColor = pct >= 90 ? 'var(--red)' : pct >= 70 ? '#f59e0b' : 'var(--accent)';
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
          {used}{limit !== null ? ` / ${limit}` : ''}{unit ? ` ${unit}` : ''}
          {limit === null && <span style={{ color: 'var(--accent2)' }}> unlimited</span>}
        </span>
      </div>
      {limit !== null && (
        <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>
      )}
    </div>
  );
}

function PlanCard({ planKey, currentPlan, hasSubscription, onUpgrade, onPortal, upgrading, portalLoading }) {
  const plan = PLANS[planKey];
  const isCurrent = currentPlan === planKey;
  const currentIdx = PLAN_ORDER.indexOf(currentPlan);
  const cardIdx = PLAN_ORDER.indexOf(planKey);
  const isDowngrade = cardIdx < currentIdx;

  // If user already has a subscription, upgrades go through the portal (prorated correctly).
  // Only new subscribers (trial → paid) go through Stripe Checkout.
  const handleUpgradeClick = () => {
    if (hasSubscription) {
      onPortal();
    } else {
      onUpgrade(planKey);
    }
  };

  const isRecommended = planKey === 'agency' && !isCurrent;

  return (
    <div style={{
      border: `1px solid ${isCurrent ? 'var(--accent)' : isRecommended ? 'var(--accent2)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)', padding: '28px 28px',
      background: isCurrent ? 'rgba(56,189,248,0.04)' : isRecommended ? 'rgba(110,231,183,0.03)' : 'var(--bg-card)',
      flex: 1, minWidth: 200,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>{plan.display}</div>
        {isCurrent && (
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            background: 'rgba(56,189,248,0.15)', color: 'var(--accent)', borderRadius: 20, padding: '3px 10px',
          }}>Current</span>
        )}
        {isRecommended && (
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            background: 'rgba(110,231,183,0.15)', color: 'var(--accent2)', borderRadius: 20, padding: '3px 10px',
          }}>Most popular</span>
        )}
      </div>

      {/* Price */}
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: isCurrent ? 'var(--accent)' : isRecommended ? 'var(--accent2)' : 'var(--text)', marginBottom: 20, fontFamily: "'Syne', sans-serif" }}>
        {plan.price}
      </div>

      {/* Features — grows to fill card height */}
      <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.9, flex: 1, marginBottom: 24 }}>
        {(PLAN_FEATURES[planKey] || []).map(f => <li key={f}>{f}</li>)}
      </ul>

      {/* Button — always at bottom */}
      <div>
        {!isCurrent && !isDowngrade && (
          <button
            onClick={handleUpgradeClick}
            disabled={upgrading === planKey || portalLoading}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 10, fontSize: '0.88rem',
              background: isRecommended ? 'var(--accent2)' : 'var(--accent)',
              border: 'none',
              color: isRecommended ? '#0a1f17' : 'var(--bg)',
              fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Mono', monospace",
              opacity: (upgrading === planKey || portalLoading) ? 0.6 : 1,
              transition: 'opacity 0.15s, transform 0.15s',
            }}
          >
            {portalLoading ? 'Redirecting…' : upgrading === planKey ? 'Redirecting…' : `Upgrade to ${plan.display}`}
          </button>
        )}
        {!isCurrent && !isDowngrade && hasSubscription && (
          <p style={{ fontSize: '0.72rem', color: 'var(--muted)', textAlign: 'center', margin: '8px 0 0' }}>
            Prorated — you only pay the difference
          </p>
        )}
        {isDowngrade && (
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', margin: 0 }}>
            Downgrade via subscription portal
          </p>
        )}
      </div>
    </div>
  );
}

function BillingTab() {
  // Use the shared hook so the sidebar quota widget stays in sync
  const { status, loading, refresh } = useBillingStatus();
  const [activating, setActivating] = useState(false); // polling after checkout
  const [upgrading, setUpgrading] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const checkoutSuccess = searchParams.get('checkout') === 'success';

  // Always refresh when billing tab mounts so both the tab and sidebar show live data
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll after Stripe checkout redirect until webhook lands and plan flips
  useEffect(() => {
    if (!checkoutSuccess || !status || status.plan !== 'trial') return;
    setActivating(true);
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      refresh();
      if (attempts >= 15) { // 15 × 2s = 30s
        setActivating(false);
        clearInterval(poll);
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [checkoutSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop the activating spinner once plan flips
  useEffect(() => {
    if (activating && status?.plan !== 'trial') {
      setActivating(false);
      setSearchParams({ tab: 'billing', checkout: 'success' }, { replace: true });
    }
  }, [status?.plan, activating, setSearchParams]);

  const handleUpgrade = async (plan) => {
    setUpgrading(plan);
    setError('');
    try {
      const r = await createCheckout(plan);
      window.location.href = r.data.checkout_url;
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not start checkout. Please try again.');
      setUpgrading(null);
    }
  };

  const handleManage = async () => {
    setPortalLoading(true);
    setError('');
    try {
      const r = await createPortalSession();
      window.location.href = r.data.portal_url;
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not open billing portal.');
      setPortalLoading(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading…</p>;

  const plan = status?.plan || 'trial';
  const planInfo = PLANS[plan] || PLANS.trial;
  const currentIdx = PLAN_ORDER.indexOf(plan);
  const upgradablePlans = PLAN_ORDER.slice(Math.max(1, currentIdx + 1)).filter(p => PLANS[p].price); // exclude trial

  const statusLabel = {
    trialing:  { text: 'Trial',    color: '#f59e0b' },
    active:    { text: 'Active',   color: 'var(--accent2)' },
    past_due:  { text: 'Past due', color: 'var(--red)' },
    canceled:  { text: 'Canceled', color: 'var(--muted)' },
    incomplete:{ text: 'Incomplete', color: 'var(--red)' },
  }[status?.subscription_status || 'trialing'] || { text: status?.subscription_status, color: 'var(--muted)' };

  return (
    <div>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Billing</h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 36 }}>
        Manage your plan and track usage.
      </p>

      {/* Checkout success / activating banner */}
      {checkoutSuccess && (
        <div style={{
          background: activating ? 'rgba(245,158,11,0.1)' : 'rgba(52,211,153,0.12)',
          border: `1px solid ${activating ? 'rgba(245,158,11,0.4)' : 'rgba(52,211,153,0.4)'}`,
          color: activating ? '#f59e0b' : 'var(--accent2)',
          borderRadius: 10, padding: '12px 18px',
          fontSize: '0.85rem', marginBottom: 28,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {activating ? (
            <>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid currentColor',
                borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Activating your plan… this takes a few seconds.
            </>
          ) : (
            '🎉 You\'re all set! Your plan has been activated.'
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
          color: 'var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem', marginBottom: 24,
        }}>
          {error}
        </div>
      )}

      {/* ── Current plan ── */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em',
          textTransform: 'uppercase', marginBottom: 16 }}>Current plan</h2>
        <div style={{
          border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px',
          background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{planInfo.display}</span>
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                color: statusLabel.color, border: `1px solid ${statusLabel.color}`,
                borderRadius: 20, padding: '2px 8px',
              }}>{statusLabel.text}</span>
            </div>
            {plan === 'trial' && status?.trial_days_remaining !== null && (
              <p style={{ fontSize: '0.8rem', color: status?.trial_days_remaining <= 1 ? 'var(--red)' : 'var(--muted)', margin: 0 }}>
                {status?.is_trial_expired
                  ? 'Trial expired — subscribe to continue using the app.'
                  : status?.trial_days_remaining === 0
                    ? 'Trial expires today'
                    : `${status?.trial_days_remaining} day${status?.trial_days_remaining !== 1 ? 's' : ''} remaining in your trial`
                }
              </p>
            )}
            {plan !== 'trial' && status?.current_period_end && (
              <p style={{ fontSize: '0.8rem', color: status?.cancel_at_period_end ? 'var(--red)' : 'var(--muted)', margin: 0 }}>
                {status?.cancel_at_period_end ? 'Cancels' : 'Renews'}{' '}
                {new Date(status.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                {status?.cancel_at_period_end && ' — access continues until then'}
              </p>
            )}
          </div>
          {status?.has_subscription && (
            <button
              onClick={handleManage}
              disabled={portalLoading}
              style={{
                padding: '8px 20px', borderRadius: 8, fontSize: '0.83rem',
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text)', cursor: 'pointer', fontWeight: 500,
                opacity: portalLoading ? 0.6 : 1,
              }}
            >
              {portalLoading ? 'Opening…' : 'Manage subscription →'}
            </button>
          )}
        </div>
      </section>

      {/* ── Usage ── */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em',
          textTransform: 'uppercase', marginBottom: 16 }}>Usage this period</h2>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', background: 'var(--bg-card)' }}>
          <UsageBar label="Scans" used={status?.scans_used || 0} limit={status?.scans_limit ?? null} />
          <UsageBar label="Businesses tracked" used={status?.businesses_used || 0} limit={status?.businesses_limit ?? null} />
          <UsageBar label="Client folders" used={status?.clients_used || 0} limit={status?.clients_limit ?? null} />
        </div>
      </section>

      {/* ── Upgrade cards ── */}
      {upgradablePlans.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: 16 }}>{plan === 'trial' ? 'Plans' : 'Upgrade'}</h2>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
            {upgradablePlans.map(p => (
              <PlanCard key={p} planKey={p} currentPlan={plan}
                hasSubscription={status?.has_subscription}
                onUpgrade={handleUpgrade}
                onPortal={handleManage}
                upgrading={upgrading}
                portalLoading={portalLoading} />
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 12 }}>
            {status?.has_subscription
              ? 'Upgrades are prorated — you only pay the difference for the rest of your billing period.'
              : 'Payments are handled securely by Stripe. You can cancel or change plan at any time.'}
          </p>
        </section>
      )}

    </div>
  );
}


// ── Main Settings page ────────────────────────────────────────────────────────

export default function Settings() {
  const { brand, refreshBrand } = useAuth();
  const [searchParams] = useSearchParams();

  // Tab: 'whitelabel' | 'billing' | 'account'
  const tab = searchParams.get('tab');
  const activeTab = tab === 'billing' ? 'billing' : tab === 'account' ? 'account' : 'whitelabel';

  const [form, setForm] = useState({
    brand_name:    brand.brand_name    || '',
    primary_color: brand.primary_color || '#c8102e',
    support_email: brand.support_email || '',
    cta_url:       brand.cta_url       || '',
    cta_text:      brand.cta_text      || '',
    share_footer:  brand.share_footer  || '',
    sales_bullets: brand.sales_bullets || '',
    cta_headline:  brand.cta_headline  || '',
  });
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef(null);

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setSaved(false);
  };

  const ensureHttps = (field) => () => {
    const v = form[field].trim();
    if (v && !/^https?:\/\//i.test(v)) {
      setForm(f => ({ ...f, [field]: 'https://' + v }));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {};
      for (const [k, v] of Object.entries(form)) {
        let val = v.trim() || null;
        if (val && (k === 'cta_url') && !/^https?:\/\//i.test(val)) {
          val = 'https://' + val;
        }
        payload[k] = val;
      }
      await api.patch('/me/brand', payload);
      await refreshBrand();
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const data = new FormData();
      data.append('file', file);
      await api.post('/me/brand/logo', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refreshBrand();
    } catch (err) {
      setUploadError(err.response?.data?.detail || 'Upload failed. Use PNG or SVG under 500 KB.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    setUploadError('');
    setUploading(true);
    try {
      await api.patch('/me/brand', { logo_url: null });
      await refreshBrand();
    } catch {
      setUploadError('Could not remove logo.');
    } finally {
      setUploading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', fontSize: '0.88rem',
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: '8px', color: 'var(--text)', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  };
  // #1 — sentence case, muted gray (not all-caps)
  const labelStyle = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600,
    color: '#8b8fa8', marginBottom: '6px',
  };
  const fieldStyle = { marginBottom: '20px' };
  // #2 — slightly smaller and dimmer than field text
  const hintStyle  = { fontSize: '0.70rem', color: 'var(--muted)', marginTop: '5px', opacity: 0.58 };
  // #7 — live color preview helper
  const isValidHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v);
  const previewColor = isValidHex(form.primary_color) ? form.primary_color : 'var(--accent)';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar active={activeTab === 'billing' ? 'billing' : activeTab === 'account' ? 'account' : 'whitelabel'} />
      <MobileNav active="settings" />

      {/* Main content */}
      <main style={{ flex: 1, padding: 'clamp(24px, 4vw, 48px) clamp(20px, 4vw, 48px) clamp(80px, 10vw, 80px)', maxWidth: 820, marginLeft: 'var(--sidebar-offset, 240px)', boxSizing: 'border-box' }}>

        {/* ── Account tab ── */}
        {activeTab === 'account' && <AccountTab />}

        {/* ── Billing tab ── */}
        {activeTab === 'billing' && <BillingTab />}

        {/* ── White-label tab ── */}
        {activeTab === 'whitelabel' && (
          <>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
              White-label
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 40 }}>
              Customise how your brand appears on PDFs and shared report links.
            </p>

            {/* ── Logo ── */}
            <section style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, color: 'var(--text)' }}>
                Logo
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                {/* #6 — more padding inside logo preview so it breathes */}
                <div style={{
                  width: 120, borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg-card)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', overflow: 'hidden', padding: '20px 24px',
                }}>
                  <BrandLogo height={36} />
                </div>
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleLogoUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    style={{
                      padding: '8px 18px', borderRadius: 8, fontSize: '0.85rem',
                      background: 'var(--accent)', border: 'none', color: 'var(--bg)',
                      fontWeight: 600, cursor: 'pointer', marginRight: 10,
                      opacity: uploading ? 0.6 : 1,
                    }}
                  >
                    {uploading ? 'Uploading…' : 'Upload logo'}
                  </button>
                  {brand.logo_url && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={uploading}
                      style={{
                        padding: '8px 18px', borderRadius: 8, fontSize: '0.85rem',
                        background: 'transparent', border: '1px solid var(--border)',
                        color: 'var(--muted)', cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  )}
                  <p style={{ ...hintStyle, marginTop: 8 }}>
                    PNG, SVG, JPEG or WebP. Max 500 KB. Displayed at 28 px height.
                  </p>
                  {uploadError && (
                    <p style={{ ...hintStyle, color: 'var(--red)', marginTop: 6 }}>{uploadError}</p>
                  )}
                </div>
              </div>
            </section>

            {/* ── Brand form ── */}
            <form onSubmit={handleSave}>
              <section style={{ marginBottom: 40 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, color: 'var(--text)' }}>
                  Brand details
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Brand name</label>
                    <input style={inputStyle} value={form.brand_name}
                      onChange={set('brand_name')} placeholder="e.g. Acme Agency" maxLength={80} />
                    <p style={hintStyle}>Shown in PDF footers and on share pages.</p>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Primary colour</label>
                    {/* #4 — swatch embedded inside the left edge of the text input */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={isValidHex(form.primary_color) ? form.primary_color : '#38bdf8'}
                        onChange={set('primary_color')}
                        style={{
                          position: 'absolute', left: 10, width: 24, height: 24,
                          padding: 0, border: 'none', borderRadius: 4,
                          cursor: 'pointer', background: 'none',
                        }}
                      />
                      <input
                        style={{ ...inputStyle, paddingLeft: 44, fontFamily: 'DM Mono, monospace', fontSize: '0.82rem' }}
                        value={form.primary_color}
                        onChange={set('primary_color')}
                        placeholder="#c8102e"
                        maxLength={7}
                        pattern="^#[0-9a-fA-F]{6}$"
                      />
                    </div>
                    <p style={hintStyle}>Used for headings and accent elements in PDFs.</p>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Support email</label>
                    <input style={inputStyle} type="email" value={form.support_email}
                      onChange={set('support_email')} placeholder="hello@youragency.com" />
                    <p style={hintStyle}>Shown in PDFs so clients know who to contact.</p>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>CTA URL</label>
                    <input style={inputStyle} value={form.cta_url}
                      onChange={set('cta_url')}
                      onBlur={ensureHttps('cta_url')}
                      placeholder="youragency.com" />
                    <p style={hintStyle}>Link in "Powered by" footer on share pages. https:// added automatically.</p>
                  </div>
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Share-page footer text</label>
                  <input style={inputStyle} value={form.share_footer}
                    onChange={set('share_footer')}
                    placeholder={`Powered by ${form.brand_name || 'Your Agency'} — leave blank for default`}
                    maxLength={160} />
                  <p style={hintStyle}>
                    Replaces "Powered by RedRock Rep" on public share links. Leave blank to use
                    the default "Powered by {form.brand_name || 'Your Agency'}" with your brand name.
                  </p>
                </div>
              </section>

              {/* ── Live preview ── */}
              {/* #3 — section divider */}
              <section style={{ marginBottom: 40, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 32 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, color: 'var(--text)' }}>
                  Share-page preview
                </h2>
                <div style={{
                  border: '1px solid var(--border)', borderRadius: 12,
                  padding: '20px 24px', background: 'var(--bg-card)',
                }}>
                  {/* #7 — header border and accent text driven by form.primary_color live */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderBottom: `2px solid ${previewColor}`, paddingBottom: 16, marginBottom: 16 }}>
                    <BrandLogo height={24} />
                    <span style={{ fontSize: '0.68rem', color: previewColor, letterSpacing: '0.08em',
                      textTransform: 'uppercase', fontWeight: 600 }}>
                      AI Visibility Report
                    </span>
                  </div>
                  <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)',
                    textAlign: 'center', fontSize: '0.7rem', color: 'var(--muted)' }}>
                    {form.share_footer.trim()
                      ? form.share_footer.trim()
                      : <>Powered by <strong>{form.brand_name.trim() || 'Your Agency'}</strong></>
                    }
                  </div>
                </div>
              </section>

              {/* ── Prospecting report settings ── */}
              {/* #3 — section divider */}
              <section style={{ marginBottom: 40, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 32 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>
                  Prospecting report
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
                  Customise the one-page sales PDF sent to prospects. The cold email handles the pitch —
                  keep the PDF as clean data unless you want to add a services box.
                </p>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Services / how you help</label>
                  <textarea
                    value={form.sales_bullets}
                    onChange={set('sales_bullets')}
                    rows={5}
                    placeholder={'e.g.\nWe manage your Google Business Profile.\nWe help you get more 5-star reviews.\nWe protect against fake or unfair reviews.'}
                    style={{
                      ...inputStyle,
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      lineHeight: 1.6,
                      minHeight: 100,
                    }}
                  />
                  <p style={hintStyle}>
                    Each line becomes a bullet point in the "How we can help" box on the sales PDF.
                    Leave blank to hide the section entirely — recommended if your services differ by client.
                  </p>
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>CTA headline</label>
                  <input
                    style={inputStyle}
                    value={form.cta_headline}
                    onChange={set('cta_headline')}
                    placeholder="Ready to improve your AI visibility?"
                    maxLength={120}
                  />
                  <p style={hintStyle}>
                    The headline in the coloured footer band of the sales PDF. Leave blank to use the default.
                  </p>
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Footer tagline</label>
                  <input
                    style={inputStyle}
                    value={form.cta_text}
                    onChange={set('cta_text')}
                    placeholder="e.g. Managed for you from £99/month"
                    maxLength={120}
                  />
                  <p style={hintStyle}>
                    Shown below the CTA headline in the PDF footer.
                    Leave blank for a clean footer — avoid showing prices here unless you have fixed pricing.
                  </p>
                </div>
              </section>

              {error && (
                <div style={{
                  background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
                  color: 'var(--red)', borderRadius: 8, padding: '10px 14px',
                  fontSize: '0.82rem', marginBottom: 20,
                }}>
                  {error}
                </div>
              )}

              <div className="save-row" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {/* #8 — more padding, taller */}
                <button type="submit" disabled={saving} style={{
                  padding: '13px 40px', borderRadius: 8, fontSize: '0.88rem',
                  background: 'var(--accent)', border: 'none', color: 'var(--bg)',
                  fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Mono, monospace',
                  opacity: saving ? 0.6 : 1,
                }}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                {saved && (
                  <span style={{ fontSize: '0.82rem', color: 'var(--accent2)' }}>
                    ✓ Saved
                  </span>
                )}
              </div>
            </form>
          </>
        )}
      {/* Mobile-only help link — Crisp widget is hidden on mobile */}
      <div className="mobile-only" style={{ padding: '0 32px 24px' }}>
        <button
          onClick={() => window.$crisp?.push(['do', 'chat:open'])}
          style={{
            background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
            borderRadius: 10, padding: '12px 20px', fontSize: '0.85rem', cursor: 'pointer',
            width: '100%',
          }}
        >
          Help &amp; support →
        </button>
      </div>
</main>
    </div>
  );
}
