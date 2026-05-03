import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { listClients, listBusinesses, createClient, updateClient, deleteClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';
import EmptyState from '../components/EmptyState';
import TrialBanner, { useBillingStatus } from '../components/TrialBanner';
import WelcomeModal from '../components/WelcomeModal';
import styles from './Dashboard.module.css';

// Deterministic avatar colour from client name
const AVATAR_COLORS = ['#c8102e', '#378add', '#7f77dd', '#1d9e75', '#f59e0b', '#e879a0'];
const avatarColor = (name) => AVATAR_COLORS[(name || ' ').charCodeAt(0) % AVATAR_COLORS.length];
const initials = (name) => (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

const EMPTY_FORM = { name: '', contact_name: '', contact_email: '', notes: '' };

export default function Dashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { status: billingStatus } = useBillingStatus();
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const menuRef = useRef(null);

  const loadData = () => {
    setLoading(true);
    setLoadError(false);
    Promise.all([listClients(), listBusinesses()])
      .then(([cRes, bRes]) => {
        setClients(cRes.data.clients);
        setBusinesses(bRes.data.businesses);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  const userId = user?.id;
  useEffect(() => { if (userId) loadData(); }, [userId]); // eslint-disable-line

  // Show welcome modal once — only if the user has no clients yet (avoids
  // showing it to someone logging in on a new device who already has data).
  useEffect(() => {
    if (!localStorage.getItem('welcome_seen') && clients.length === 0) {
      const t = setTimeout(() => setShowWelcome(true), 600);
      return () => clearTimeout(t);
    }
  }, [clients.length]); // re-evaluate once clients have loaded

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  const clientStats = (clientId) => {
    const bizsForClient = businesses.filter(b => b.client_id === clientId);
    const scores = bizsForClient.map(b => b.latest_scan?.ai_visibility_score).filter(s => s != null);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const lastScanDates = bizsForClient.map(b => b.latest_scan?.created_at).filter(Boolean).map(d => new Date(d));
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
    const ok = await confirm({
      title: `Delete "${client.name}"?`,
      message: count > 0
        ? `${count} business${count !== 1 ? 'es' : ''} will become unassigned. This cannot be undone.`
        : 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
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
      <Sidebar active="dashboard" />
      <MobileNav active="dashboard" />
      {showWelcome && (
        <WelcomeModal
          onGetStarted={() => { setShowWelcome(false); setShowNew(true); }}
          onDismiss={() => setShowWelcome(false)}
        />
      )}

      <main className={styles.main} style={{ padding: 0 }}>
        <TrialBanner />
        <div className={styles.mainPad}>

          {/* In-content expired trial notice — non-dismissible, stays above the grid */}
          {billingStatus?.is_trial_expired && billingStatus?.plan === 'trial' && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 12, padding: '20px 24px', marginBottom: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 16, flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--red)', marginBottom: 4 }}>
                  Your free trial has ended
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                  Subscribe to continue running scans and tracking new businesses. Your data is safe and waiting.
                </div>
              </div>
              <button
                onClick={() => navigate('/settings?tab=billing')}
                style={{
                  padding: '10px 22px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700,
                  background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                View plans →
              </button>
            </div>
          )}

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
            <form onSubmit={handleCreate} className={`${styles.formCard} fade-up`}>
              <div className={styles.formTitle}>New client</div>
              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label className={styles.label}>Company name *</label>
                  <input autoFocus required placeholder="Acme Bakery" value={newForm.name}
                    onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                    className={styles.input} />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label className={styles.label}>Contact name</label>
                  <input placeholder="John Smith" value={newForm.contact_name}
                    onChange={e => setNewForm(f => ({ ...f, contact_name: e.target.value }))}
                    className={styles.input} />
                </div>
                <div className={styles.formField}>
                  <label className={styles.label}>Contact email</label>
                  <input type="email" placeholder="john@acmebakery.com" value={newForm.contact_email}
                    onChange={e => setNewForm(f => ({ ...f, contact_email: e.target.value }))}
                    className={styles.input} />
                </div>
              </div>
              <button type="submit" disabled={saving || !newForm.name.trim()} className={styles.submitBtn}>
                {saving ? 'Creating…' : 'Create client'}
              </button>
            </form>
          )}

          {loading ? (
            <div className={styles.skeletonGrid}>
              {[1, 2, 3].map(i => <div key={i} className={styles.skeletonCard} />)}
            </div>
          ) : loadError ? (
            <EmptyState title="Couldn't load clients"
              subtitle="Check your connection and try again."
              action={{ label: 'Try again', onClick: loadData }} />
          ) : clients.length === 0 && !showNew ? (
            <EmptyState
              title="No clients yet"
              subtitle="Add your first client to start tracking their AI visibility."
              action={{ label: '+ Add client', onClick: () => setShowNew(true) }}
            />
          ) : filteredClients.length === 0 ? (
            <EmptyState title="No clients match"
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
                      <div onClick={e => e.stopPropagation()} className={styles.editForm}>
                        <div className={styles.formTitle}>Edit client</div>
                        <div className={styles.formField}>
                          <label className={styles.label}>Company name</label>
                          <input autoFocus value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Escape') setEditId(null); }}
                            className={styles.input} />
                        </div>
                        <div className={styles.formRow}>
                          <div className={styles.formField}>
                            <label className={styles.label}>Contact name</label>
                            <input value={editForm.contact_name} placeholder="John Smith"
                              onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))}
                              className={styles.input} />
                          </div>
                          <div className={styles.formField}>
                            <label className={styles.label}>Email</label>
                            <input type="email" value={editForm.contact_email} placeholder="john@acme.com"
                              onChange={e => setEditForm(f => ({ ...f, contact_email: e.target.value }))}
                              className={styles.input} />
                          </div>
                        </div>
                        <div className={styles.editActions}>
                          <button onClick={() => handleSaveEdit(client.id)} className={styles.submitBtn}>Save</button>
                          <button onClick={() => setEditId(null)} className={styles.cancelBtn}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={styles.cardTop}>
                          <div className={styles.avatar} style={{ background: avatarColor(client.name) }}>
                            {initials(client.name)}
                          </div>
                          <div style={{ position: 'relative' }} ref={openMenuId === client.id ? menuRef : null}
                            onClick={e => e.stopPropagation()}>
                            <button className={styles.deleteBtn}
                              onClick={e => { e.stopPropagation(); setOpenMenuId(prev => prev === client.id ? null : client.id); }}
                            >⋯</button>
                            {openMenuId === client.id && (
                              <div className={styles.menu}>
                                <button onClick={() => startEdit(client)} className={styles.menuItem}>✎ Edit</button>
                                <button onClick={() => handleDelete(client)} className={`${styles.menuItem} ${styles.menuItemDanger}`}>✕ Delete</button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className={styles.businessName} style={{ marginTop: '12px' }}>{client.name}</div>
                        {(client.contact_name || client.contact_email) && (
                          <div className={styles.location} style={{ marginBottom: '4px' }}>
                            {[client.contact_name, client.contact_email].filter(Boolean).join(' · ')}
                          </div>
                        )}

                        <div className={styles.statsRow}>
                          <span className={styles.statPill}>
                            {count} business{count !== 1 ? 'es' : ''}
                          </span>
                          {avgScore != null && (
                            <span className={styles.statPill} style={{ color: scoreColour(avgScore), borderColor: scoreColour(avgScore) }}>
                              avg {avgScore}/100
                            </span>
                          )}
                        </div>

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
        </div>
      </main>
    </div>
  );
}
