import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';
import Sidebar from '../components/Sidebar';
import api, { getBillingStatus, createCheckout, createPortalSession } from '../api/client';

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

  return (
    <div style={{
      border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 12, padding: '20px 24px',
      background: isCurrent ? 'rgba(56,189,248,0.04)' : 'var(--bg-card)',
      flex: 1, minWidth: 200,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{plan.display}</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>{plan.price}</div>
        </div>
        {isCurrent && (
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
            background: 'rgba(56,189,248,0.15)', color: 'var(--accent)', borderRadius: 20, padding: '3px 10px',
          }}>
            Current
          </span>
        )}
      </div>
      <ul style={{ margin: '0 0 16px', padding: '0 0 0 16px', fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.8 }}>
        {(PLAN_FEATURES[planKey] || []).map(f => <li key={f}>{f}</li>)}
      </ul>
      {!isCurrent && !isDowngrade && (
        <button
          onClick={handleUpgradeClick}
          disabled={upgrading === planKey || portalLoading}
          style={{
            width: '100%', padding: '9px 0', borderRadius: 8, fontSize: '0.85rem',
            background: 'var(--accent)', border: 'none', color: 'var(--bg)',
            fontWeight: 700, cursor: 'pointer',
            opacity: (upgrading === planKey || portalLoading) ? 0.6 : 1,
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
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center', margin: 0 }}>
          Downgrade via subscription portal
        </p>
      )}
    </div>
  );
}

function BillingTab() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false); // polling after checkout
  const [upgrading, setUpgrading] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const checkoutSuccess = searchParams.get('checkout') === 'success';

  useEffect(() => {
    const load = async () => {
      try {
        const r = await getBillingStatus();
        setStatus(r.data);

        // If we're on the success return URL but the plan hasn't flipped yet,
        // the webhook is still in flight — poll until it lands (max 30s).
        // Plan is set exclusively by the verified Stripe webhook; we never
        // write it directly from the frontend.
        if (checkoutSuccess && (r.data?.plan === 'trial')) {
          setActivating(true);
          let attempts = 0;
          const poll = setInterval(async () => {
            attempts++;
            try {
              const pr = await getBillingStatus();
              if (pr.data?.plan !== 'trial') {
                setStatus(pr.data);
                setActivating(false);
                clearInterval(poll);
                // Clean up URL
                setSearchParams({ tab: 'billing', checkout: 'success' }, { replace: true });
              }
            } catch { /* silent — keep polling */ }
            if (attempts >= 15) { // 15 × 2s = 30s
              setActivating(false);
              clearInterval(poll);
            }
          }, 2000);
          return () => clearInterval(poll);
        }
      } catch {
        setError('Could not load billing status.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
            textTransform: 'uppercase', marginBottom: 16 }}>Upgrade</h2>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
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

      {/* All-plans overview (for trial users) */}
      {plan === 'trial' && (
        <section>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: 16 }}>All plans</h2>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {['solo', 'agency', 'pro'].map(p => (
              <PlanCard key={p} planKey={p} currentPlan={plan}
                hasSubscription={false}
                onUpgrade={handleUpgrade}
                onPortal={handleManage}
                upgrading={upgrading}
                portalLoading={portalLoading} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


// ── Main Settings page ────────────────────────────────────────────────────────

export default function Settings() {
  const { user, brand, refreshBrand } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab: 'whitelabel' | 'billing'
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') === 'billing' ? 'billing' : 'whitelabel');

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'billing' ? { tab: 'billing' } : {}, { replace: true });
  };

  const [form, setForm] = useState({
    brand_name:    brand.brand_name    || '',
    primary_color: brand.primary_color || '#c8102e',
    support_email: brand.support_email || '',
    cta_url:       brand.cta_url       || '',
    cta_text:      brand.cta_text      || '',
    share_footer:  brand.share_footer  || '',
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
  };
  const labelStyle = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600,
    color: 'var(--muted)', marginBottom: '6px', letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };
  const fieldStyle = { marginBottom: '20px' };
  const hintStyle  = { fontSize: '0.72rem', color: 'var(--muted)', marginTop: '5px' };

  const navBtn = (tab, label, active) => (
    <button
      onClick={() => switchTab(tab)}
      style={{
        background: active ? 'rgba(56,189,248,0.08)' : 'none',
        border: 'none',
        color: active ? 'var(--accent)' : 'var(--muted)',
        cursor: active ? 'default' : 'pointer',
        fontWeight: active ? 600 : 400,
        padding: '8px 10px', borderRadius: 6, textAlign: 'left', fontSize: '0.85rem',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar active={activeTab === 'billing' ? 'billing' : 'whitelabel'} />

      {/* Main content */}
      <main style={{ flex: 1, padding: '48px 48px 80px', maxWidth: 820, marginLeft: 240 }}>

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
                <div style={{
                  width: 100, height: 60, borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg-card)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', overflow: 'hidden', padding: 8,
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
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input
                        type="color"
                        value={form.primary_color}
                        onChange={set('primary_color')}
                        style={{ width: 44, height: 44, borderRadius: 8, border: '1px solid var(--border)',
                          padding: 2, background: 'var(--bg)', cursor: 'pointer' }}
                      />
                      <input
                        style={{ ...inputStyle, fontFamily: 'DM Mono, monospace', fontSize: '0.82rem' }}
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
              <section style={{ marginBottom: 40 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, color: 'var(--text)' }}>
                  Share-page preview
                </h2>
                <div style={{
                  border: '1px solid var(--border)', borderRadius: 12,
                  padding: '20px 24px', background: 'var(--bg-card)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
                    <BrandLogo height={24} />
                    <span style={{ fontSize: '0.68rem', color: 'var(--muted)', letterSpacing: '0.08em',
                      textTransform: 'uppercase' }}>
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

              {error && (
                <div style={{
                  background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
                  color: 'var(--red)', borderRadius: 8, padding: '10px 14px',
                  fontSize: '0.82rem', marginBottom: 20,
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button type="submit" disabled={saving} style={{
                  padding: '10px 28px', borderRadius: 8, fontSize: '0.88rem',
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
      </main>
    </div>
  );
}
