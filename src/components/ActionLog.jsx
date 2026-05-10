import { useState, useEffect } from 'react';
import { getBusinessActions, createBusinessAction, deleteBusinessAction } from '../api/client';

const CATEGORIES = [
  { value: 'reviews',   label: 'Reviews',   color: 'var(--accent2)' },
  { value: 'platforms', label: 'Platforms',  color: 'var(--accent)'  },
  { value: 'content',   label: 'Content',    color: '#a78bfa'        },
  { value: 'local_seo', label: 'Local SEO',  color: 'var(--orange)'  },
  { value: 'other',     label: 'Other',      color: 'var(--muted)'   },
];

function categoryMeta(value) {
  return CATEGORIES.find(c => c.value === value) || CATEGORIES[CATEGORIES.length - 1];
}

export default function ActionLog({ businessId }) {
  const [actions, setActions]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [text, setText]           = useState('');
  const [category, setCategory]   = useState('other');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [showForm, setShowForm]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBusinessActions(businessId)
      .then(res => { if (!cancelled) setActions(res.data.actions); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [businessId]);

  const handleAdd = async () => {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await createBusinessAction(businessId, trimmed, category);
      setActions(prev => [res.data, ...prev]);
      setText('');
      setCategory('other');
      setShowForm(false);
    } catch {
      setError('Could not save action. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (actionId) => {
    try {
      await deleteBusinessAction(businessId, actionId);
      setActions(prev => prev.filter(a => a.id !== actionId));
    } catch {
      setError('Could not delete action.');
    }
  };

  return (
    <div style={{ marginTop: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          Activity log
        </h2>
        <button
          onClick={() => { setShowForm(v => !v); setError(null); }}
          style={{
            padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px',
            background: showForm ? 'transparent' : 'var(--accent)', color: showForm ? 'var(--muted)' : '#fff',
            border: showForm ? '1px solid var(--border)' : 'none', cursor: 'pointer',
          }}
        >
          {showForm ? 'Cancel' : '+ Log action'}
        </button>
      </div>

      {showForm && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '16px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                style={{
                  padding: '4px 12px', fontSize: '0.75rem', borderRadius: '999px', cursor: 'pointer',
                  border: `1px solid ${category === c.value ? c.color : 'var(--border)'}`,
                  background: category === c.value ? `${c.color}22` : 'transparent',
                  color: category === c.value ? c.color : 'var(--muted)',
                  transition: 'all 0.15s',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !saving && text.trim() && handleAdd()}
              placeholder='e.g. Claimed Tripadvisor listing, pushed for 20 new reviews…'
              maxLength={500}
              style={{
                flex: 1, padding: '9px 13px', fontSize: '0.85rem',
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: '8px', color: 'var(--text)', outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={handleAdd}
              disabled={saving || !text.trim()}
              style={{
                padding: '9px 18px', fontSize: '0.85rem', borderRadius: '8px',
                background: text.trim() ? 'var(--accent)' : 'var(--border)',
                color: text.trim() ? '#fff' : 'var(--muted)', border: 'none',
                cursor: text.trim() ? 'pointer' : 'default', flexShrink: 0,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {error && (
            <div style={{
              marginTop: '10px', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem',
              background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
              color: 'var(--red)',
            }}>
              {error}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '12px 0' }}>Loading…</div>
      ) : actions.length === 0 ? (
        <div style={{
          color: 'var(--muted)', fontSize: '0.85rem', padding: '20px',
          border: '1px dashed var(--border)', borderRadius: 'var(--radius)', textAlign: 'center',
        }}>
          No actions logged yet. Record what you change between scans to track what's working.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {actions.map(action => {
            const meta = categoryMeta(action.category);
            return (
              <div
                key={action.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '12px 14px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px',
                      border: `1px solid ${meta.color}`, color: meta.color,
                      background: `${meta.color}18`, flexShrink: 0,
                    }}>
                      {meta.label}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {new Date(action.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.5 }}>
                    {action.action_text}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(action.id)}
                  title="Delete"
                  style={{
                    background: 'none', border: 'none', color: 'var(--muted)',
                    cursor: 'pointer', fontSize: '0.75rem', padding: '4px 6px',
                    borderRadius: '4px', flexShrink: 0, lineHeight: 1,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.target.style.color = 'var(--red)'; e.target.style.background = 'rgba(248,113,113,0.1)'; }}
                  onMouseLeave={e => { e.target.style.color = 'var(--muted)'; e.target.style.background = 'none'; }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
