/**
 * TrialBanner — shows a sticky top banner when the user's trial is expiring
 * or has expired. Dismissed per-session via state (not localStorage, so it
 * reappears on next visit until they subscribe).
 *
 * Also exports useBillingStatus() — a lightweight hook that fetches
 * /billing/status once and shares it across the sidebar quota indicator.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBillingStatus } from '../api/client';

// ── Shared billing status hook ────────────────────────────────────────────────

let _cache = null;          // module-level cache — one fetch per page load
let _promise = null;

export function useBillingStatus() {
  const [status, setStatus] = useState(_cache);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) { setStatus(_cache); setLoading(false); return; }
    if (!_promise) {
      _promise = getBillingStatus()
        .then(r => { _cache = r.data; return _cache; })
        .catch(() => null);
    }
    _promise.then(data => { setStatus(data); setLoading(false); });
  }, []);

  const refresh = useCallback(() => {
    _cache = null; _promise = null;
    setLoading(true);
    getBillingStatus()
      .then(r => { _cache = r.data; setStatus(_cache); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { status, loading, refresh };
}


// ── Trial banner ──────────────────────────────────────────────────────────────

export default function TrialBanner() {
  const { status } = useBillingStatus();
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  if (dismissed || !status) return null;

  const { plan, is_trial_expired, trial_days_remaining, has_subscription } = status;

  // Only show for trial users — hide for paid/admin
  if (plan !== 'trial' || has_subscription) return null;

  const urgent   = is_trial_expired || trial_days_remaining <= 1;
  const bgColor  = urgent ? 'rgba(239,68,68,0.12)'  : 'rgba(245,158,11,0.1)';
  const border   = urgent ? 'rgba(239,68,68,0.35)'  : 'rgba(245,158,11,0.3)';
  const txtColor = urgent ? 'var(--red)'             : '#f59e0b';

  const message = is_trial_expired
    ? 'Your free trial has expired.'
    : trial_days_remaining === 0
      ? 'Your free trial expires today.'
      : `${trial_days_remaining} day${trial_days_remaining !== 1 ? 's' : ''} left on your free trial.`;

  return (
    <div style={{
      background: bgColor, borderBottom: `1px solid ${border}`,
      padding: '10px 20px', display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 16, flexWrap: 'wrap',
      fontSize: '0.82rem', color: txtColor, position: 'relative',
    }}>
      <span>{message}</span>
      <button
        onClick={() => navigate('/settings?tab=billing')}
        style={{
          padding: '4px 14px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 700,
          background: urgent ? 'var(--red)' : '#f59e0b',
          color: '#fff', border: 'none', cursor: 'pointer',
        }}
      >
        Subscribe →
      </button>
      {/* Only dismissible during countdown — expired banner stays until subscribed */}
      {!is_trial_expired && (
        <button
          onClick={() => setDismissed(true)}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: txtColor, cursor: 'pointer',
            fontSize: '1rem', lineHeight: 1, padding: '4px',
          }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}


// ── Sidebar quota pill ────────────────────────────────────────────────────────

export function SidebarQuota({ onNavigateBilling }) {
  const { status } = useBillingStatus();

  if (!status || status.plan === 'admin') return null;

  const { scans_used, scans_limit, plan, is_trial_expired } = status;

  // No scan limit on this plan
  if (scans_limit === null) return null;

  const remaining = Math.max(0, scans_limit - scans_used);
  const pct = Math.min(100, Math.round((scans_used / scans_limit) * 100));
  const barColor = pct >= 90 ? 'var(--red)' : pct >= 70 ? '#f59e0b' : 'var(--accent)';
  const label = plan === 'trial' ? 'Trial scans' : 'Scans this period';

  return (
    <div
      onClick={onNavigateBilling}
      style={{
        marginTop: 12, padding: '10px 12px', borderRadius: 8,
        background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
        cursor: 'pointer',
      }}
      title="Go to billing"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 500 }}>{label}</span>
        <span style={{
          fontSize: '0.7rem', color: is_trial_expired ? 'var(--red)' : remaining === 0 ? 'var(--red)' : 'var(--muted)',
          fontFamily: 'DM Mono, monospace',
        }}>
          {scans_used} / {scans_limit}
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2 }} />
      </div>
      {is_trial_expired && (
        <p style={{ fontSize: '0.68rem', color: 'var(--red)', margin: '5px 0 0', lineHeight: 1.3 }}>
          Trial expired · Subscribe →
        </p>
      )}
    </div>
  );
}
