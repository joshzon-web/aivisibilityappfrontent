import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  listBusinesses, deleteBusiness, listClients,
  assignBusinessToClient, updateClient,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import NewScan from '../components/NewScan';
import BrandLogo from '../components/BrandLogo';
import EmptyState from '../components/EmptyState';
import styles from './Dashboard.module.css';

export default function ClientDetail() {
  const { id: clientId } = useParams();
  const { user, logoutUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [businesses, setBusinesses] = useState([]);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showNewScan, setShowNewScan] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('score');
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);
  const [autoSend, setAutoSend] = useState(false);
  const [togglingAutoSend, setTogglingAutoSend] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    Promise.all([listBusinesses(), listClients()])
      .then(([bizRes, clientRes]) => {
        setBusinesses(bizRes.data.businesses);
        const found = (clientRes.data.clients || []).find(c => c.id === clientId);
        setClient(found || null);
        setAutoSend(found?.auto_send_reports ?? false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [clientId, user]);

  // Close ⋯ menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  const handleScanComplete = async (scanId, businessId) => {
    // Auto-assign the new business to this client
    if (businessId) {
      try {
        await assignBusinessToClient(businessId, clientId);
      } catch {
        // Silent — scan still succeeded
      }
    }
    navigate(`/scan/${scanId}`);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Remove this business from tracking?')) return;
    await deleteBusiness(id);
    setBusinesses(prev => prev.filter(b => b.id !== id));
  };

  const handleToggleAutoSend = async () => {
    if (!client?.contact_email) {
      showToast('Add a contact email to this client first', 'error');
      return;
    }
    const newVal = !autoSend;
    setTogglingAutoSend(true);
    try {
      await updateClient(clientId, { auto_send_reports: newVal });
      setAutoSend(newVal);
      showToast(newVal ? 'Auto-send reports enabled' : 'Auto-send reports disabled', 'success');
    } catch {
      showToast('Could not update setting', 'error');
    } finally {
      setTogglingAutoSend(false);
    }
  };

  const scoreColour = (score) => {
    if (!score && score !== 0) return 'var(--muted)';
    if (score >= 60) return 'var(--accent2)';
    if (score >= 35) return 'var(--orange)';
    return 'var(--red)';
  };

  const scoreLabel = (score) => {
    if (!score && score !== 0) return '—';
    if (score >= 60) return 'Strong';
    if (score >= 35) return 'Moderate';
    return 'Weak';
  };

  const getDelta = (biz) => {
    const latest = biz.latest_scan?.ai_visibility_score;
    const comp = biz.comparison_scan?.ai_visibility_score;
    if (latest == null || comp == null) return null;
    return latest - comp;
  };

  const isOldComparison = (biz) => {
    if (!biz.comparison_scan || !biz.latest_scan) return false;
    const latestDt = new Date(biz.latest_scan.created_at);
    const compDt = new Date(biz.comparison_scan.created_at);
    return (latestDt - compDt) < 25 * 24 * 60 * 60 * 1000;
  };

  // Filter to this client, then apply search/score/sort
  const filtered = useMemo(() => {
    let list = businesses.filter(b => b.client_id === clientId);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.name?.toLowerCase().includes(q) ||
        b.search_term?.toLowerCase().includes(q) ||
        b.address?.toLowerCase().includes(q)
      );
    }

    if (filter !== 'all') {
      list = list.filter(b => {
        const s = b.latest_scan?.ai_visibility_score;
        if (s == null) return false;
        if (filter === 'strong') return s >= 60;
        if (filter === 'moderate') return s >= 35 && s < 60;
        if (filter === 'weak') return s < 35;
        return true;
      });
    }

    list.sort((a, b) => {
      if (sort === 'score') return (b.latest_scan?.ai_visibility_score ?? -1) - (a.latest_scan?.ai_visibility_score ?? -1);
      if (sort === 'delta') return (getDelta(b) ?? -999) - (getDelta(a) ?? -999);
      if (sort === 'date') {
        const da = a.latest_scan?.created_at || a.created_at;
        const db_ = b.latest_scan?.created_at || b.created_at;
        return new Date(db_) - new Date(da);
      }
      if (sort === 'name') return (a.name || '').localeCompare(b.name || '');
      return 0;
    });

    return list;
  }, [businesses, search, filter, sort, clientId]);

  const clientBizCount = businesses.filter(b => b.client_id === clientId).length;

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}><BrandLogo height={28} /></div>
        <nav className={styles.nav}>
          <button className={styles.navItem} onClick={() => navigate('/dashboard')}>▦ Clients</button>
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
        {showNewScan ? (
          <NewScan
            clientId={clientId}
            onComplete={handleScanComplete}
            onCancel={() => setShowNewScan(false)}
          />
        ) : (
          <>
            {/* Back + header */}
            <button
              onClick={() => navigate('/dashboard')}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.82rem', marginBottom: '20px', padding: 0 }}
            >
              ← Back to clients
            </button>

            <div className={styles.header + ' fade-up'}>
              <div>
                <h1 className={styles.title}>{client?.name || '…'}</h1>
                {(client?.contact_name || client?.contact_email) && (
                  <p className={styles.sub}>
                    {[client.contact_name, client.contact_email].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className={styles.sub} style={{ marginTop: '2px' }}>
                  {clientBizCount} business{clientBizCount !== 1 ? 'es' : ''} tracked
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {/* Auto-send toggle */}
                <button
                  onClick={handleToggleAutoSend}
                  disabled={togglingAutoSend}
                  title={client?.contact_email ? undefined : 'Add a contact email first'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: 'none', border: 'none', cursor: client?.contact_email ? 'pointer' : 'not-allowed',
                    padding: '6px 0', opacity: togglingAutoSend ? 0.5 : 1,
                  }}
                >
                  {/* Toggle pill */}
                  <div style={{
                    width: '36px', height: '20px', borderRadius: '999px', flexShrink: 0,
                    background: autoSend ? 'var(--accent2)' : 'var(--border)',
                    position: 'relative', transition: 'background 0.2s',
                  }}>
                    <div style={{
                      position: 'absolute', top: '3px',
                      left: autoSend ? '19px' : '3px',
                      width: '14px', height: '14px', borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    Auto-send reports
                  </span>
                </button>
                <button className={styles.newBtn} onClick={() => setShowNewScan(true)}>
                  + Track new business
                </button>
              </div>
            </div>

            {loading ? (
              <div className={styles.loading}><div className={styles.spinner} /><span>Loading...</span></div>
            ) : loadError ? (
              <EmptyState icon="⚠" title="Couldn't load data"
                subtitle="Check your connection and try again."
                action={{ label: 'Try again', onClick: () => { setLoadError(false); setLoading(true); Promise.all([listBusinesses(), listClients()]).then(([bizRes, clientRes]) => { setBusinesses(bizRes.data.businesses); const found = (clientRes.data.clients || []).find(c => c.id === clientId); setClient(found || null); }).catch(() => setLoadError(true)).finally(() => setLoading(false)); } }} />
            ) : clientBizCount === 0 ? (
              <EmptyState
                icon="◈"
                title="No businesses tracked yet"
                subtitle="Track a business to start monitoring their AI visibility."
                action={{ label: '+ Track new business', onClick: () => setShowNewScan(true) }}
              />
            ) : (
              <>
                {/* Toolbar */}
                <div className={styles.toolbar + ' fade-up-1'}>
                  <div className={styles.searchWrap}>
                    <span className={styles.searchIcon}>⌕</span>
                    <input className={styles.searchInput} placeholder="Search businesses..."
                      value={search} onChange={e => setSearch(e.target.value)} />
                    {search && <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>}
                  </div>
                  <div className={styles.filterPills}>
                    {[
                      { value: 'all', label: 'All' },
                      { value: 'strong', label: '● Strong' },
                      { value: 'moderate', label: '● Moderate' },
                      { value: 'weak', label: '● Weak' },
                    ].map(f => (
                      <button key={f.value}
                        className={styles.filterPill + (filter === f.value ? ' ' + styles.filterPillActive : '')}
                        style={filter === f.value && f.value !== 'all' ? {
                          borderColor: f.value === 'strong' ? 'var(--accent2)' : f.value === 'moderate' ? 'var(--orange)' : 'var(--red)',
                          color: f.value === 'strong' ? 'var(--accent2)' : f.value === 'moderate' ? 'var(--orange)' : 'var(--red)',
                        } : {}}
                        onClick={() => setFilter(f.value)}
                      >{f.label}</button>
                    ))}
                  </div>
                  <select className={styles.sortSelect} value={sort} onChange={e => setSort(e.target.value)}>
                    <option value="score">Sort: Latest score</option>
                    <option value="delta">Sort: Score change</option>
                    <option value="date">Sort: Last scanned</option>
                    <option value="name">Sort: Name A–Z</option>
                  </select>
                </div>

                {filtered.length === 0 ? (
                  <EmptyState icon="🔍" title="No businesses match"
                    action={{ label: 'Clear filters', onClick: () => { setSearch(''); setFilter('all'); } }} />
                ) : (
                  <div className={styles.grid}>
                    {filtered.map((biz, i) => {
                      const latest = biz.latest_scan;
                      const score = latest?.ai_visibility_score;
                      const delta = getDelta(biz);
                      const oldComp = isOldComparison(biz);
                      return (
                        <div key={biz.id}
                          className={styles.card + ` fade-up-${Math.min(i + 1, 4)}`}
                          onClick={() => navigate(`/business/${biz.id}`)}
                        >
                          <div className={styles.cardTop}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                              <div className={styles.score} style={{ color: scoreColour(score) }}>
                                {score ?? '—'}
                                {score != null && <span className={styles.scoreMax}>/100</span>}
                              </div>
                              {delta !== null && (
                                <span style={{
                                  fontSize: '0.75rem', fontFamily: "'DM Mono', monospace", fontWeight: 600,
                                  color: delta > 0 ? 'var(--accent2)' : delta < 0 ? 'var(--red)' : 'var(--muted)',
                                }}>
                                  {delta > 0 ? '+' : ''}{delta}
                                </span>
                              )}
                            </div>
                            <div className={styles.cardActions}>
                              <span className={styles.scanBadge} style={{ color: scoreColour(score) }}>{scoreLabel(score)}</span>
                              <button className={styles.deleteBtn} onClick={e => handleDelete(biz.id, e)} title="Remove">✕</button>
                            </div>
                          </div>

                          <div className={styles.businessName}>{biz.name}</div>
                          <div className={styles.searchTerm}>"{biz.search_term}"</div>
                          {biz.search_label && (
                            <div className={styles.location}
                              title={biz.search_label_source === 'user_override' ? 'Area set by you' : 'Auto-picked'}
                              style={{ color: 'var(--accent)', opacity: 0.85 }}>
                              Tracking in: {biz.search_label}
                              {biz.search_label_source === 'user_override' ? ' •' : ''}
                            </div>
                          )}
                          {biz.address && <div className={styles.location}>{biz.address}</div>}

                          {latest && (
                            <div className={styles.enginePills}>
                              <span className={styles.enginePill} style={{ color: 'var(--accent)' }}>GPT {latest.chatgpt_score ?? '—'}%</span>
                              <span className={styles.enginePill} style={{ color: '#a78bfa' }}>Gem {latest.gemini_score ?? '—'}%</span>
                              <span className={styles.enginePill} style={{ color: '#34d399' }}>Plx {latest.perplexity_score ?? '—'}%</span>
                            </div>
                          )}

                          <div className={styles.cardFooter}>
                            <span className={styles.scanCount}>{biz.scan_count} scan{biz.scan_count !== 1 ? 's' : ''}</span>
                            {latest ? (
                              <span className={styles.date}>
                                {delta !== null
                                  ? <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>vs {oldComp ? 'first scan' : 'last month'}</span>
                                  : new Date(latest.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                }
                              </span>
                            ) : (
                              <span className={styles.viewLink}>Scan now →</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
