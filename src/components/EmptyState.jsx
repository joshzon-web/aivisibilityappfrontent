import styles from './EmptyState.module.css';

/**
 * Reusable empty state component.
 *
 * Props:
 *   icon     — emoji or string
 *   title    — bold heading
 *   subtitle — secondary text (optional)
 *   action   — { label, onClick } (optional)
 */
export default function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className={styles.wrap}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <p className={styles.title}>{title}</p>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      {action && (
        <button className={styles.btn} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
