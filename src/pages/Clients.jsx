import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listClients, createClient, updateClient, deleteClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import EmptyState from '../components/EmptyState';
import BrandLogo from '../components/BrandLogo';
import styles from './Dashboard.module.css';

const EMPTY_FORM = { name: '', contact_name: '', contact_email: '', notes: '' };

export default function Clients() {
  const { user, logoutUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Edit state: editId = client id being edited, editForm = current field values
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  useEffect(() => {
    listClients()
      .then(res => setClients(res.data.clients))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = newForm.name.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await createClient(
        name,
        newForm.notes.trim() || undefined,
        newForm.contact_name.trim() || undefined,
        newForm.contact_email.trim() || undefined,
      );
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
      showToast('Client updated', 'success');
    } catch {
      showToast('Could not update client', 'error');
    } finally {
      setEditId(null);
    }
  };

  const handleDelete = async (client) => {
    const msg = client.business_count > 0
      ? `Delete "${client.name}"? ${client.business_count} business${client.business_count !== 1 ? 'es' : ''} will become unassigned (not deleted).`
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
      <aside className={styles.sidebar}>
        <div className={styles.logo}><BrandLogo height={28} /></div>
        <nav className={styles.nav}>
          <button className={styles.navItem} onClick={() => navigate('/dashboard')}>▦ Dashboard</button>
          <button className={styles.navItem} onClick={() => navigate('/prospecting')}>◈ Prospecting</button>
          <button className={styles.navItem + ' ' + styles.active}>◈ Clients</button>
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

      <main className={styles.main}>
        <div className={styles.header + ' fade-up'}>
          <div>
            <h1 className={styles.title}>Clients</h1>
            <p className={styles.sub}>{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
          </div>
          <button className={styles.newBtn} onClick={() => { setShowNew(v => !v); setEditId(null); }}>
            {showNew ? 'Cancel' : '+ New client'}
          </button>
        </div>

        {/* ── New client form ── */}
        {showNew && (
          <form onSubmit={handleCreate} className="fade-up-1" style={formCardStyle}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a1a2e', marginBottom: '4px' }}>
              New client
            </div>
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
            <div style={formRowStyle}>
              <div style={formFieldStyle}>
                <label style={labelStyle}>Notes (optional)</label>
                <input placeholder="e.g. Monthly reports due 1st" value={newForm.notes}
                  onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <button type="submit" disabled={saving || !newForm.name.trim()} style={submitBtnStyle(saving)}>
              {saving ? 'Creating…' : 'Create client'}
            </button>
          </form>
        )}

        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} /><span>Loading clients...</span>
          </div>
        ) : clients.length === 0 && !showNew ? (
          <EmptyState
            icon="📁"
            title="No clients yet"
            subtitle="Create a client folder to organise your tracked businesses by account."
            action={{ label: '+ New client', onClick: () => setShowNew(true) }}
          />
        ) : (
          <div className="fade-up-1" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {clients.map(client => (
              <div key={client.id} style={rowCardStyle}>
                {editId === client.id ? (
                  /* ── Inline edit form ── */
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={formRowStyle}>
                      <div style={formFieldStyle}>
                        <label style={labelStyle}>Company name *</label>
                        <input autoFocus value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Escape') setEditId(null); }}
                          style={inputStyle} />
                      </div>
                    </div>
                    <div style={formRowStyle}>
                      <div style={formFieldStyle}>
                        <label style={labelStyle}>Contact name</label>
                        <input value={editForm.contact_name}
                          onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))}
                          placeholder="John Smith" style={inputStyle} />
                      </div>
                      <div style={formFieldStyle}>
                        <label style={labelStyle}>Contact email</label>
                        <input type="email" value={editForm.contact_email}
                          onChange={e => setEditForm(f => ({ ...f, contact_email: e.target.value }))}
                          placeholder="john@acmebakery.com" style={inputStyle} />
                      </div>
                    </div>
                    <div style={formRowStyle}>
                      <div style={formFieldStyle}>
                        <label style={labelStyle}>Notes</label>
                        <input value={editForm.notes}
                          onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                          placeholder="Optional notes" style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleSaveEdit(client.id)} style={submitBtnStyle(false)}>Save</button>
                      <button onClick={() => setEditId(null)} style={cancelBtnStyle}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  /* ── Display row ── */
                  <>
                    <span style={{ fontSize: '1.2rem' }}>📁</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1a1a2e' }}>
                        {client.name}
                      </div>
                      {(client.contact_name || client.contact_email) && (
                        <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '2px' }}>
                          {[client.contact_name, client.contact_email].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      {client.notes && (
                        <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '1px' }}>
                          {client.notes}
                        </div>
                      )}
                    </div>
                    <span style={countBadgeStyle}>
                      {client.business_count ?? 0} business{client.business_count !== 1 ? 'es' : ''}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#bbb', whiteSpace: 'nowrap' }}>
                      {new Date(client.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <button onClick={() => startEdit(client)} title="Edit" style={iconBtnStyle}>✎</button>
                    <button onClick={() => handleDelete(client)} title="Delete" style={{ ...iconBtnStyle, color: '#c8102e' }}>✕</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const formCardStyle = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
  padding: '20px 24px', marginBottom: '20px',
  display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '600px',
};

const rowCardStyle = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
  padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px',
};

const formRowStyle = { display: 'flex', gap: '12px' };
const formFieldStyle = { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' };
const labelStyle = { fontSize: '0.75rem', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em' };

const inputStyle = {
  padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
  fontSize: '0.875rem', outline: 'none', width: '100%', boxSizing: 'border-box',
};

const submitBtnStyle = (disabled) => ({
  padding: '8px 18px', background: '#c8102e', color: '#fff',
  border: 'none', borderRadius: '6px', fontWeight: 600,
  fontSize: '0.85rem', cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.65 : 1, alignSelf: 'flex-start',
});

const cancelBtnStyle = {
  padding: '8px 14px', background: 'transparent', color: '#666',
  border: '1px solid #d1d5db', borderRadius: '6px',
  fontSize: '0.85rem', cursor: 'pointer',
};

const countBadgeStyle = {
  padding: '2px 8px', borderRadius: '4px',
  background: '#f3f4f6', color: '#555',
  fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap',
};

const iconBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: '0.9rem', color: '#666', padding: '4px 6px',
  borderRadius: '4px', lineHeight: 1, flexShrink: 0,
};
