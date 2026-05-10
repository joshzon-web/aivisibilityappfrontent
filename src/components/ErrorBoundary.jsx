import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('ErrorBoundary caught:', error, info);
    }
  }

  handleReload = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '32px 36px', maxWidth: 480, width: '100%',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '0.72rem', fontWeight: 700, color: 'var(--red)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
          }}>
            Something went wrong
          </div>
          <h1 style={{
            fontSize: '1.4rem', color: 'var(--text)', margin: '0 0 12px',
          }}>
            We hit an unexpected error
          </h1>
          <p style={{
            fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 24px',
          }}>
            The page failed to render. Try reloading — if the problem persists, contact support via the chat bubble.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              background: 'var(--accent)', color: '#0b1220',
              border: 'none', borderRadius: 8, padding: '10px 22px',
              fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
