import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from './BrandLogo';
import { SidebarQuota } from './TrialBanner';
import styles from './Sidebar.module.css';

/**
 * Shared sidebar used across all private pages.
 *
 * Props:
 *   active — highlights the current nav item.
 *            One of: 'dashboard' | 'all-businesses' | 'prospecting' | 'whitelabel' | 'billing'
 *
 *   extra  — optional extra nav items rendered below the main nav (e.g. back links).
 *            Array of { label, onClick } objects.
 */
export default function Sidebar({ active, extra = [] }) {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  const navCls = (key) =>
    `${styles.navItem}${active === key ? ' ' + styles.navItemActive : ''}`;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo} onClick={() => navigate('/dashboard')}>
        <BrandLogo height={28} />
      </div>

      <nav className={styles.nav}>
        {/* Back / contextual links at top */}
        {extra.map(({ label, onClick }) => (
          <button key={label} className={styles.navItem} onClick={onClick}>
            {label}
          </button>
        ))}

        <button className={navCls('dashboard')} onClick={() => navigate('/dashboard')}>
          ▦ Clients
        </button>
        <button className={navCls('all-businesses')} onClick={() => navigate('/all-businesses')}>
          ≡ All businesses
        </button>
        <button className={navCls('prospecting')} onClick={() => navigate('/prospecting')}>
          ◈ Prospecting
        </button>
        <button className={navCls('whitelabel')} onClick={() => navigate('/settings')}>
          ◈ White-label
        </button>
        <button className={navCls('billing')} onClick={() => navigate('/settings?tab=billing')}>
          💳 Billing
        </button>
      </nav>

      <div className={styles.footer}>
        <SidebarQuota onNavigateBilling={() => navigate('/settings?tab=billing')} />
        <div className={styles.userInfo} style={{ marginTop: 12 }}>
          <div className={styles.userDot} />
          <span>{user?.email}</span>
        </div>
        <button className={styles.logoutBtn} onClick={logoutUser}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
