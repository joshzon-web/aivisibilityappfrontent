import { useNavigate } from 'react-router-dom';
import styles from './MobileNav.module.css';

const TABS = [
  { key: 'dashboard',      label: 'Clients',    path: '/dashboard',      icon: '🏢' },
  { key: 'all-businesses', label: 'Locations',  path: '/all-businesses', icon: '📍' },
  { key: 'prospecting',    label: 'Prospect',   path: '/prospecting',    icon: '🔍' },
  { key: 'settings',       label: 'Settings',   path: '/settings',       icon: '⚙️' },
];

export default function MobileNav({ active }) {
  const navigate = useNavigate();

  return (
    <nav className={styles.nav}>
      {TABS.map(({ key, label, path, icon }) => (
        <button
          key={key}
          className={active === key ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => navigate(path)}
        >
          <span className={styles.icon}>{icon}</span>
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
