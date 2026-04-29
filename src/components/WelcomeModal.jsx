import { createPortal } from 'react-dom';

const STEPS = [
  {
    num: '➊',
    title: 'Add a client',
    desc: 'Create a folder for each agency client — keeps their businesses organised in one place.',
  },
  {
    num: '➋',
    title: 'Track a business',
    desc: 'Connect a Google Maps listing and set the search terms customers use to find them.',
  },
  {
    num: '➌',
    title: 'Run your first scan',
    desc: 'See exactly how visible the business is in ChatGPT, Gemini and Perplexity — scored out of 100.',
  },
];

/**
 * WelcomeModal — shown once to new users on their first Dashboard visit.
 *
 * Props:
 *   onGetStarted — called when user clicks "Get started" (e.g. open Add client form)
 *   onDismiss    — called when user skips or clicks outside
 */
export default function WelcomeModal({ onGetStarted, onDismiss }) {
  const handleGetStarted = () => {
    localStorage.setItem('welcome_seen', '1');
    onGetStarted?.();
  };

  const handleDismiss = () => {
    localStorage.setItem('welcome_seen', '1');
    onDismiss?.();
  };

  return createPortal(
    <div
      onClick={handleDismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '36px 36px 28px',
          maxWidth: 480, width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          animation: 'slideUp 0.25s ease',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            Welcome 👋
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            Here's how to get your first AI visibility report in 3 steps.
          </p>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
          {STEPS.map((step) => (
            <div key={step.num} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', color: 'var(--accent)',
              }}>
                {step.num}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)', marginBottom: 3 }}>
                  {step.title}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={handleGetStarted}
            style={{
              padding: '11px 28px', borderRadius: 10, fontSize: '0.9rem', fontWeight: 700,
              background: 'var(--accent)', border: 'none', color: 'var(--bg)',
              cursor: 'pointer', fontFamily: "'DM Mono', monospace",
            }}
          >
            Get started →
          </button>
          <button
            onClick={handleDismiss}
            style={{
              background: 'none', border: 'none', color: 'var(--muted)',
              fontSize: '0.82rem', cursor: 'pointer', padding: '8px 4px',
            }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
