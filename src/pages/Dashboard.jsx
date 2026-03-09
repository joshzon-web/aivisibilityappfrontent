import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listBusinesses, deleteBusiness } from '../api/client';
import { useAuth } from '../context/AuthContext';
import NewScan from '../components/NewScan';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { user, logoutUser } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewScan, setShowNewScan] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    listBusinesses()
      .then((res) => setBusinesses(res.data.businesses))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    await deleteBusiness(id);
    setBusinesses(businesses.filter((b) => b.id !== id));
  };

  const handleScanComplete = (scanId) => {
    navigate(`/scan/${scanId}`);
  };

  const scoreColour = (score) => {
    if (!score && score !== 0) return 'var(--text-muted)';
    if (score >= 60) return 'var(--accent2)';
    if (score >= 35) return 'var(--orange)';
    return 'var(--red)';
  };

  const scoreLabel = (score) => {
    if (!score && score !== 0) return '—';
    if (score >= 60) return 'Good';
    if (score >= 35) return 'Fair';
    return 'Poor';
  };

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>◈</span>
          <span className={styles.logoText}>AI VISIBILITY</span>
        </div>

        <nav className={styles.nav}>
          <button className={styles.navItem + ' ' + styles.active}>
            ▦ Dashboard
          </button>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.userDot} />
            <span>{user?.email}</span>
          </div>
          <button className={styles.logoutBtn} onClick={logoutUser}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        {showNewScan ? (
          <NewScan
            onComplete={handleScanComplete}
            onCancel={() => setShowNewScan(false)}
          />
        ) : (
          <>
            <div className={styles.header + ' fade-up'}>
              <div>
                <h1 className={styles.title}>Tracked businesses</h1>
                <p className={styles.sub}>
                  {businesses.length} business{businesses.length !== 1 ? 'es' : ''} tracked
                </p>
              </div>
              <button
                className={styles.newBtn}
                onClick={() => setShowNewScan(true)}
              >
                + Track new business
              </button>
            </div>

            {loading ? (
              <div className={styles.loading}>
                <div className={styles.spinner} />
                <span>Loading businesses...</span>
              </div>
            ) : businesses.length === 0 ? (
              <div className={styles.empty + ' fade-up-1'}>
                <div className={styles.emptyIcon}>◈</div>
                <h2>No businesses tracked yet</h2>
                <p>Add your first business to start tracking AI visibility</p>
                <button
                  className={styles.newBtn}
                  onClick={() => setShowNewScan(true)}
                >
                  + Track first business
                </button>
              </div>
            ) : (
              <div className={styles.grid}>
                {businesses.map((biz, i) => {
                  const latest = biz.latest_scan;
                  const score = latest?.ai_visibility_score;
                  return (
                    <div
                      key={biz.id}
                      className={styles.card + ` fade-up-${Math.min(i + 1, 4)}`}
                      onClick={() => latest ? navigate(`/scan/${latest.id}`) : setShowNewScan(true)}
                    >
                      <div className={styles.cardTop}>
                        <div
                          className={styles.score}
                          style={{ color: scoreColour(score) }}
                        >
                          {score ?? '—'}
                          {score != null && <span className={styles.scoreMax}>/100</span>}
                        </div>
                        <div className={styles.cardActions}>
                          <span
                            className={styles.scanBadge}
                            style={{ color: scoreColour(score) }}
                          >
                            {scoreLabel(score)}
                          </span>
                          <button
                            className={styles.deleteBtn}
                            onClick={(e) => handleDelete(biz.id, e)}
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <div className={styles.businessName}>{biz.name}</div>
                      <div className={styles.searchTerm}>{biz.search_term}</div>
                      {biz.address && (
                        <div className={styles.location}>{biz.address}</div>
                      )}

                      <div className={styles.cardFooter}>
                        <span className={styles.scanCount}>
                          {biz.scan_count} scan{biz.scan_count !== 1 ? 's' : ''}
                        </span>
                        {latest ? (
                          <span className={styles.date}>
                            Last scanned {new Date(latest.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
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
      </main>
    </div>
  );
}
