import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { listBusinesses, deleteBusiness, listClients, assignBusinessToClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import Sidebar from '../components/Sidebar';
import NewScan from '../components/NewScan';
import EmptyState from '../components/EmptyState';
import TrialBanner from '../components/TrialBanner';
import styles from './Dashboard.module.css';

export default function AllBusinesses() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();

  const [businesses, setBusinesses] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showNewScan, setShowNewScan] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('score');
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  const loadData = () => {
    setLoading(true);
    setLoadError(false);
    Promise.all([listBusinesses(), listClients()])
      .then(([bizRes, clientRes]) => {
        setBusinesses(bizRes.data.businesses);
        setClients(clientRes.data.clients);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  const userId = user?.id;
  useEffect(() => { if (userId) loadData(); }, [userId]); // eslint-disable-line

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  const handleDelete = async (biz, e) => {
    e.stopPropagation();
    const ok = await confirm({
      title: `Remove "${biz.name}"?`,
      message: 'This business and all its scans will be permanently removed. This cannot be undone.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteBusiness(biz.id);
      setBusinesses(prev => prev.filter(b => b.id !== biz.id));
      showToast(`"${biz.name}" removed`, 'success');
    } catch {
      showToast('Could not remove business', 'error');
    }
  };

  const handleScanComplete = (scanId) => navigate(`/scan/${scanId}`);

  const handleAssignClient = async (bizId, clientId, e) => {
    e.stopPropagation();
    setOpenMenuId(null);
    try {
      const res = await assignBusinessToClient(bizId, clientId);
      setBusinesses(prev => prev.map(b => b.id === bizId ? { ...b, client_id: res.data.client_id } : b));
      const clientName = clients.find(c => c.id === clientId)?.name;
      showToast(clientId ? `Moved to "${clientName}"` : 'Removed from client', 'success');
    } catch {
      showToast('Could not update client', 'error');
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

  const filtered = useMemo(() => {
    let list = [...businesses];

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
  }, [businesses, search, filter, sort]);

  return (
    <div className={styles.layout}>
      <Sidebar active="all-businesses" />

      <main className={styles.main} style={{ padding: 0 }}>
        <TrialBanner />
        <div className={styles.mainPad}>
          {showNewScan ? (
            <NewScan onComplete={handleScanComplete} onCancel={() => setShowNewScan(false)} />
          ) : (
            <>
              <div className={styles.header + ' fade-up'}>
                <div>
                  <h1 className={styles.title}>All locations</h1>
                  <p className={styles.sub}>{businesses.length} location{businesses.length !== 1 ? 's' : ''} tracked</p>
                </div>
                <button className={styles.newBtn} onClick={() => setShowNewScan(true)}>+ Track new business</button>
              </div>

              {loading ? (
                <div className={styles.skeletonGrid}>
                  {[1, 2, 3].map(i => <div key={i} className={styles.skeletonCard} />)}
                </div>
              ) : loadError ? (
                <EmptyState icon="⚠" title="Couldn't load businesses"
                  subtitle="Check your connection and try again."
                  action={{ label: 'Try again', onClick: loadData }} />
              ) : businesses.length === 0 ? (
                <EmptyState icon="◈" title="No businesses tracked yet"
                  subtitle="Go to a client and track their first business."
                  action={{ label: '← Back to clients', onClick: () => navigate('/dashboard') }} />
              ) : (
                <>
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
                        const assignedClientName = clients.find(c => c.id === biz.client_id)?.name;
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
                              <div className={styles.cardActions} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span className={styles.scanBadge} style={{ color: scoreColour(score) }}>{scoreLabel(score)}</span>
                                {/* ⋯ assign-to-client menu */}
                                <div style={{ position: 'relative' }} ref={openMenuId === biz.id ? menuRef : null}>
                                  <button className={styles.deleteBtn} title="Move to client"
                                    onClick={e => { e.stopPropagation(); setOpenMenuId(prev => prev === biz.id ? null : biz.id); }}
                                    style={{ fontSize: '1rem' }}>⋯</button>
                                  {openMenuId === biz.id && (
                                    <div onClick={e => e.stopPropagation()} className={styles.menu}>
                                      <div style={{ padding: '8px 12px 4px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Move to client
                                      </div>
                                      {clients.length === 0 && (
                                        <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--muted)' }}>No clients yet</div>
                                      )}
                                      {clients.map(c => (
                                        <button key={c.id} onClick={e => handleAssignClient(biz.id, c.id, e)}
                                          className={styles.menuItem}
                                          style={biz.client_id === c.id ? { color: 'var(--accent)' } : {}}>
                                          {biz.client_id === c.id ? '✓ ' : ''}{c.name}
                                        </button>
                                      ))}
                                      {biz.client_id && (
                                        <button onClick={e => handleAssignClient(biz.id, null, e)}
                                          className={`${styles.menuItem} ${styles.menuItemDanger}`}
                                          style={{ borderTop: '1px solid var(--border)' }}>
                                          Remove from client
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <button className={styles.deleteBtn} onClick={e => handleDelete(biz, e)} title="Remove">✕</button>
                              </div>
                            </div>

                            <div className={styles.businessName}>{biz.name}</div>
                            <div className={styles.searchTerm}>"{biz.search_term}"</div>
                            {biz.search_label && (
                              <div className={styles.location} style={{ color: 'var(--accent)', opacity: 0.85 }}>
                                Tracking in: {biz.search_label}{biz.search_label_source === 'user_override' ? ' •' : ''}
                              </div>
                            )}
                            {biz.address && <div className={styles.location}>{biz.address}</div>}

                            {assignedClientName && (
                              <div style={{
                                display: 'inline-block', marginTop: '4px', padding: '2px 7px',
                                borderRadius: '4px', background: 'rgba(55,138,221,0.12)', color: '#378add',
                                fontSize: '0.72rem', fontWeight: 600,
                              }}>
                                📁 {assignedClientName}
                              </div>
                            )}

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
        </div>
      </main>
    </div>
  );
}
