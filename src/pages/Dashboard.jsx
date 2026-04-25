import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { listClients, listBusinesses, createClient, updateClient, deleteClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import BrandLogo from '../components/BrandLogo';
import EmptyState from '../components/EmptyState';
import styles from './Dashboard.module.css';

// Deterministic avatar colour from client name
const AVATAR_COLORS = ['#c8102e', '#378add', '#7f77dd', '#1d9e75', '#f59e0b', '#e879a0'];
const avatarColor = (name) => AVATAR_COLORS[(name || ' ').charCodeAt(0) % AVATAR_COLORS.length];
const initials = (name) => (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

const EMPTY_FORM = { name: '', contact_name: '', contact_email: '', notes: '' };

export default function Dashboard() {
  const { user, logoutUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Search
  const [search, setSearch] = useState('');

  // Edit / menu state
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const menuRef = useRef(null);

  useEffect(() => {
    Promise.all([listClients(), listBusinesses()])
      .then(([cRes, bRes]) => {
        setClients(cRes.data.clients);
        setBusinesses(bRes.data.businesses);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Close card menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  // Compute per-client stats from businesses list
  const clientStats = (clientId) => {
    const bizsForClient = businesses.filter(b => b.client_id === clientId);
    const scores = bizsForClient
      .map(b => b.latest_scan?.ai_visibility_score)
      .filter(s => s != null);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const lastScanDates = bizsForClient
      .map(b => b.latest_scan?.created_at)
      .filter(Boolean)
      .map(d => new Date(d));
    const lastScan = lastScanDates.length ? new Date(Math.max(...lastScanDates)) : null;
    return { count: bizsForClient.length, avgScore, lastScan };
  };

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.contact_name?.toLowerCase().includes(q) ||
      c.contact_email?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const scoreColour = (score) => {
    if (score == null) return 'var(--muted)';
    if (score >= 60) return 'var(--accent2)';
    if (score >= 35) return 'var(--orange)';
    return 'var(--red)';
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = newForm.name.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await createClient(name, newForm.notes.trim() || undefined,
        newForm.contact_name.trim() || undefined, newForm.contact_email.trim() || undefined);
      setClients(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewForm(EMPTY_FORM);
      setShowNew(false);
      showToast(`Client "${name}" created`, 'success');
    } catch {
      showToast('Could not create client', 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (client) => {
    setOpenMenuId(null);
    setEditId(client.id);
    setEditForm({
      name: client.name || '',
      contact_name: client.contact_name || '',
      contact_email: client.contact_email || '',
      notes: client.notes || '',
    });
  };

  const handleSaveEdit = async (id) => {
    if (!editForm.name.trim()) return;
    try {
      const res = await updateClient(id, {
        name: editForm.name.trim(),
        contact_name: editForm.contact_name.trim() || null,
        contact_email: editForm.contact_email.trim() || null,
        notes: editForm.notes.trim() || null,
      });
      setClients(prev =>
        prev.map(c => c.id === id ? { ...c, ...res.data } : c)
            .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditId(null);
      showToast('Client updated', 'success');
    } catch {
      showToast('Could not update client', 'error');
    }
  };

  const handleDelete = async (client) => {
    setOpenMenuId(null);
    const { count } = clientStats(client.id);
    const msg = count > 0
      ? `Delete "${client.name}"? ${count} business${count !== 1 ? 'es' : ''} will become unassigned.`
      : `Delete "${client.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await deleteClient(client.id);
      setClients(prev => prev.filter(c => c.id !== client.id));
      showToast(`Client "${client.name}" deleted`, 'success');
    } catch {
      showToast('Could not delete client', 'error');
    }
  };

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}><BrandLogo height={28} /></div>
        <nav className={styles.nav}>
          <button className={styles.navItem + ' ' + styles.active}>▦ Clients</button>
          <button className={styles.navItem} onClick={() => navigate('/all-businesses')}>≡ All businesses</button>
          <button className={styles.navItem} onClick={() => navigate('/prospecting')}>◈ Prospecting</button>
          <button className={styles.navItem} onClick={() => navigate('/settings')}>◈ White-label</button>
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.userDot} />
            <span>{user?.email}</span>
          </div>
          <button className={styles.logoutBtn} onClick={logoutUser}>Sign out</button>
        </div>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        <div className={styles.header + ' fade-up'}>
          <div>
            <h1 className={styles.title}>Clients</h1>
            <p className={styles.sub}>{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {clients.length > 0 && (
              <div className={styles.searchWrap} style={{ width: '220px' }}>
                <span className={styles.searchIcon}>⌕</span>
                <input
                  className={styles.searchInput}
                  placeholder="Search clients..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>
                )}
              </div>
            )}
            <button className={styles.newBtn} onClick={() => { setShowNew(v => !v); setEditId(null); }}>
              {showNew ? 'Cancel' : '+ Add client'}
            </button>
          </div>
        </div>

        {/* New client form */}
        {showNew && (
          <form onSubmit={handleCreate} className="fade-up" style={formCardStyle}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', marginBottom: '4px' }}>New client</div>
            <div style={formRowStyle}>
              <div style={formFieldStyle}>
                <label style={labelStyle}>Company name *</label>
                <input autoFocus required placeholder="Acme Bakery" value={newForm.name}
                  onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={formRowStyle}>
              <div style={formFieldStyle}>
                <label style={labelStyle}>Contact name</label>
                <input placeholder="John Smith" value={newForm.contact_name}
                  onChange={e => setNewForm(f => ({ ...f, contact_name: e.target.value }))} style={inputStyle} />
              </div>
              <div style={formFieldStyle}>
                <label style={labelStyle}>Contact email</label>
                <input type="email" placeholder="john@acmebakery.com" value={newForm.contact_email}
                  onChange={e => setNewForm(f => ({ ...f, contact_email: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <button type="submit" disabled={saving || !newForm.name.trim()} style={submitBtnStyle(saving)}>
              {saving ? 'Creating…' : 'Create client'}
            </button>
          </form>
        )}

        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /><span>Loading clients...</span></div>
        ) : clients.length === 0 && !showNew ? (
          <EmptyState
            icon="📁"
            title="No clients yet"
            subtitle="Add your first client to start tracking their AI visibility."
            action={{ label: '+ Add client', onClick: () => setShowNew(true) }}
          />
        ) : filteredClients.length === 0 ? (
          <EmptyState icon="🔍" title="No clients match"
            action={{ label: 'Clear search', onClick: () => setSearch('') }} />
        ) : (
          <div className={styles.grid}>
            {filteredClients.map((client, i) => {
              const { count, avgScore, lastScan } = clientStats(client.id);
              const isEditing = editId === client.id;

              return (
                <div
                  key={client.id}
                  className={styles.card + ` fade-up-${Math.min(i + 1, 4)}`}
                  onClick={() => !isEditing && openMenuId !== client.id && navigate(`/clients/${client.id}`)}
                  style={{ cursor: isEditing ? 'default' : 'pointer' }}
                >
                  {isEditing ? (
                    /* ── Inline edit form ── */
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)', marginBottom: '2px' }}>Edit client</div>
                      <div style={formFieldStyle}>
                        <label style={labelStyle}>Company name</label>
                        <input autoFocus value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Escape') setEditId(null); }}
                          style={inputStyle} />
                      </div>
                      <div style={formRowStyle}>
                        <div style={formFieldStyle}>
                          <label style={labelStyle}>Contact name</label>
                          <input value={editForm.contact_name} placeholder="John Smith"
                            onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))} style={inputStyle} />
                        </div>
                        <div style={formFieldStyle}>
                          <label style={labelStyle}>Email</label>
                          <input type="email" value={editForm.contact_email} placeholder="john@acme.com"
                            onChange={e => setEditForm(f => ({ ...f, contact_email: e.target.value }))} style={inputStyle} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button onClick={() => handleSaveEdit(client.id)} style={submitBtnStyle(false)}>Save</button>
                        <button onClick={() => setEditId(null)} style={cancelBtnStyle}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    /* ── Display card ── */
                    <>
                      <div className={styles.cardTop}>
                        {/* Avatar */}
                        <div style={{
                          width: 44, height: 44, borderRadius: '10px',
                          background: avatarColor(client.name),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: "'Syne', sans-serif", fontWeight: 800,
                          fontSize: '1rem', color: '#fff', flexShrink: 0,
                        }}>
                          {initials(client.name)}
                        </div>

                        {/* ⋯ menu */}
                        <div style={{ position: 'relative' }} ref={openMenuId === client.id ? menuRef : null}
                          onClick={e => e.stopPropagation()}>
                          <button className={styles.deleteBtn}
                            onClick={e => { e.stopPropagation(); setOpenMenuId(prev => prev === client.id ? null : client.id); }}
                            style={{ fontSize: '1rem' }}
                          >⋯</button>
                          {openMenuId === client.id && (
                            <div style={{
                              position: 'absolute', right: 0, top: '100%', zIndex: 100,
                              background: '#0f1923', border: '1px solid var(--border)',
                              borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                              minWidth: '140px', overflow: 'hidden',
                            }}>
                              <button onClick={() => startEdit(client)} style={menuItemStyle}>✎ Edit</button>
                              <button onClick={() => handleDelete(client)} style={{ ...menuItemStyle, color: 'var(--red)' }}>✕ Delete</button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Name + contact */}
                      <div className={styles.businessName} style={{ marginTop: '12px' }}>{client.name}</div>
                      {(client.contact_name || client.contact_email) && (
                        <div className={styles.location} style={{ marginBottom: '4px' }}>
                          {[client.contact_name, client.contact_email].filter(Boolean).join(' · ')}
                        </div>
                      )}

                      {/* Stats row */}
                      <div style={{ display: 'flex', gap: '8px', margin: '12px 0', flexWrap: 'wrap' }}>
                        <span style={statPillStyle}>
                          {count} business{count !== 1 ? 'es' : ''}
                        </span>
                        {avgScore != null && (
                          <span style={{ ...statPillStyle, color: scoreColour(avgScore), borderColor: scoreColour(avgScore), background: 'transparent' }}>
                            avg {avgScore}/100
                          </span>
                        )}
                      </div>

                      {/* Footer */}
                      <div className={styles.cardFooter}>
                        <span className={styles.scanCount}>
                          {lastScan
                            ? `Last scan ${lastScan.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                            : 'No scans yet'}
                        </span>
                        <span className={styles.viewLink}>View →</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const formCardStyle = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px',
  padding: '20px 24px', marginBottom: '28px',
  display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '560px',
};
const formRowStyle = { display: 'flex', gap: '12px' };
const formFieldStyle = { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' };
const labelStyle = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const inputStyle = {
  padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px',
  fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box',
  background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit',
};
const submitBtnStyle = (disabled) => ({
  padding: '8px 18px', background: 'var(--accent)', color: 'var(--bg)',
  border: 'none', borderRadius: '6px', fontWeight: 600,
  fontSize: '0.85rem', cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.65 : 1, alignSelf: 'flex-start', fontFamily: "'DM Mono', monospace",
});
const cancelBtnStyle = {
  padding: '8px 14px', background: 'transparent', color: 'var(--muted)',
  border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer',
};
const statPillStyle = {
  fontSize: '0.72rem', fontFamily: "'DM Mono', monospace",
  border: '1px solid var(--border)', borderRadius: '999px',
  padding: '2px 8px', color: 'var(--muted)',
};
const menuItemStyle = {
  display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left',
  background: 'transparent', border: 'none', fontSize: '0.83rem',
  color: 'var(--text)', cursor: 'pointer',
};
