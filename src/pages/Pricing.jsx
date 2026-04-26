import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import { useTheme } from '../context/ThemeContext';
import styles from './Pricing.module.css';

const PLANS = [
  {
    key: 'solo',
    name: 'Solo',
    price: '£49',
    period: '/ month',
    description: 'For freelancers managing a handful of clients.',
    features: [
      '25 scans / month',
      '5 businesses tracked',
      '5 client folders',
      'Branded PDF reports',
      'Shareable report links',
    ],
  },
  {
    key: 'agency',
    name: 'Agency',
    price: '£129',
    period: '/ month',
    description: 'For growing agencies with multiple clients.',
    features: [
      '75 scans / month',
      '20 businesses tracked',
      'Unlimited client folders',
      'Branded PDF reports',
      'Shareable report links',
      'Custom sender emails',
    ],
    recommended: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '£299',
    period: '/ month',
    description: 'For large agencies running at scale.',
    features: [
      '200 scans / month',
      'Unlimited businesses',
      'Unlimited client folders',
      'Everything in Agency',
      'Priority support',
    ],
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={styles.page}>
      {/* Nav */}
      <header className={styles.nav}>
        <div className={styles.navLogo} onClick={() => navigate('/auth')}>
          <BrandLogo height={26} />
        </div>
        <div className={styles.navActions}>
          <button className={styles.themeToggle} onClick={toggleTheme}>
            {theme === 'dark' ? '☀ Light' : '◑ Dark'}
          </button>
          <button className={styles.signInBtn} onClick={() => navigate('/auth')}>
            Sign in
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.badge}>7-day free trial · No card required</div>
        <h1 className={styles.headline}>
          Simple, transparent pricing
        </h1>
        <p className={styles.sub}>
          Every plan includes a full 7-day free trial. Pick the plan that fits your agency — upgrade or cancel any time.
        </p>
      </section>

      {/* Plan cards */}
      <section className={styles.grid}>
        {PLANS.map(plan => (
          <div
            key={plan.key}
            className={`${styles.card} ${plan.recommended ? styles.cardRecommended : ''}`}
          >
            {plan.recommended && (
              <div className={styles.recommendedBadge}>Most popular</div>
            )}

            <div className={styles.cardHeader}>
              <div className={styles.planName}>{plan.name}</div>
              <p className={styles.planDesc}>{plan.description}</p>
              <div className={styles.priceRow}>
                <span className={styles.price}>{plan.price}</span>
                <span className={styles.period}>{plan.period}</span>
              </div>
            </div>

            <ul className={styles.features}>
              {plan.features.map(f => (
                <li key={f} className={styles.feature}>
                  <span className={styles.check}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              className={`${styles.cta} ${plan.recommended ? styles.ctaRecommended : ''}`}
              onClick={() => navigate('/auth')}
            >
              Start free trial
            </button>
          </div>
        ))}
      </section>

      {/* Footer note */}
      <p className={styles.footnote}>
        Payments handled securely by Stripe. Cancel any time — no questions asked.
      </p>

      {/* Already have account */}
      <p className={styles.existing}>
        Already have an account?{' '}
        <button className={styles.existingLink} onClick={() => navigate('/auth')}>
          Sign in
        </button>
      </p>
    </div>
  );
}
