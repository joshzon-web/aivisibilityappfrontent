import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';
import api from '../api/client';

export default function Settings() {
  const { user, logoutUser, brand, refreshBrand } = useAuth();
  const navigate = useNavigate();

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
      // Only send non-empty values; empty string → clear the field (null on backend)
      const payload = {};
      for (const [k, v] of Object.entries(form)) {
        let val = v.trim() || null;
        // Ensure URL fields always have a scheme before saving
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0, padding: '28px 20px',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ marginBottom: 28, cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
          <BrandLogo height={28} />
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
              padding: '8px 10px', borderRadius: 6, textAlign: 'left', fontSize: '0.85rem' }}>
            ← Dashboard
          </button>
          <button
            style={{ background: 'rgba(56,189,248,0.08)', border: 'none',
              color: 'var(--accent)', cursor: 'default', fontWeight: 600,
              padding: '8px 10px', borderRadius: 6, textAlign: 'left', fontSize: '0.85rem' }}>
            ◈ White-label
          </button>
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 8 }}>{user?.email}</div>
          <button onClick={logoutUser}
            style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
              borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: '0.78rem' }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '48px 48px 80px', maxWidth: 760 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
          White-label
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 40 }}>
          Customise how your brand appears on PDFs and shared report links.
        </p>

        {/* ── Logo ─────────────────────────────────────────────────────────── */}
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

        {/* ── Brand form ───────────────────────────────────────────────────── */}
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

          {/* ── Live preview ─────────────────────────────────────────────── */}
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, color: 'var(--text)' }}>
              Share-page preview
            </h2>
            <div style={{
              border: '1px solid var(--border)', borderRadius: 12,
              padding: '20px 24px', background: 'var(--bg-card)',
            }}>
              {/* Mini header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
                <BrandLogo height={24} />
                <span style={{ fontSize: '0.68rem', color: 'var(--muted)', letterSpacing: '0.08em',
                  textTransform: 'uppercase' }}>
                  AI Visibility Report
                </span>
              </div>
              {/* Mini footer */}
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
      </main>
    </div>
  );
}
