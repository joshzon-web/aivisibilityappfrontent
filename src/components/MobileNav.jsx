import { useNavigate } from 'react-router-dom';
import styles from './MobileNav.module.css';

const TABS = [
  { key: 'dashboard',      label: 'Clients',   path: '/dashboard' },
  { key: 'all-businesses', label: 'Locations', path: '/all-businesses' },
  { key: 'prospecting',    label: 'Prospect',  path: '/prospecting' },
  { key: 'settings',       label: 'Settings',  path: '/settings' },
];

export default function MobileNav({ active }) {
  const navigate = useNavigate();

  return (
    <nav className={styles.nav}>
      {TABS.map(({ key, label, path }) => (
        <button
          key={key}
          className={active === key ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => navigate(path)}
        >
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
