import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listScans, deleteScan } from '../api/client';
import { useAuth } from '../context/AuthContext';
import NewScan from '../components/NewScan';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { user, logoutUser } = useAuth();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewScan, setShowNewScan] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    listScans()
      .then((res) => setScans(res.data.scans))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    await deleteScan(id);
    setScans(scans.filter((s) => s.id !== id));
  };

  const handleScanComplete = (scanId) => {
    navigate(`/scan/${scanId}`);
  };

  const scoreColour = (score) => {
    if (score >= 60) return 'var(--accent2)';
    if (score >= 35) return 'var(--orange)';
    return 'var(--red)';
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
                <h1 className={styles.title}>Your scans</h1>
                <p className={styles.sub}>
                  {scans.length} scan{scans.length !== 1 ? 's' : ''} saved
                </p>
              </div>
              <button
                className={styles.newBtn}
                onClick={() => setShowNewScan(true)}
              >
                + New scan
              </button>
            </div>

            {loading ? (
              <div className={styles.loading}>
                <div className={styles.spinner} />
                <span>Loading scans...</span>
              </div>
            ) : scans.length === 0 ? (
              <div className={styles.empty + ' fade-up-1'}>
                <div className={styles.emptyIcon}>◈</div>
                <h2>No scans yet</h2>
                <p>Run your first AI visibility scan to get started</p>
                <button
                  className={styles.newBtn}
                  onClick={() => setShowNewScan(true)}
                >
                  + Run first scan
                </button>
              </div>
            ) : (
              <div className={styles.grid}>
                {scans.map((scan, i) => (
                  <div
                    key={scan.id}
                    className={styles.card + ` fade-up-${Math.min(i + 1, 4)}`}
                    onClick={() => navigate(`/scan/${scan.id}`)}
                  >
                    <div className={styles.cardTop}>
                      <div
                        className={styles.score}
                        style={{ color: scoreColour(scan.ai_visibility_score) }}
                      >
                        {scan.ai_visibility_score}
                        <span className={styles.scoreMax}>/100</span>
                      </div>
                      <button
                        className={styles.deleteBtn}
                        onClick={(e) => handleDelete(scan.id, e)}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>

                    <div className={styles.businessName}>{scan.business_name}</div>
                    <div className={styles.searchTerm}>{scan.search_term}</div>
                    <div className={styles.location}>{scan.location}</div>

                    <div className={styles.cardFooter}>
                      <span className={styles.date}>
                        {new Date(scan.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </span>
                      <span className={styles.viewLink}>View report →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
