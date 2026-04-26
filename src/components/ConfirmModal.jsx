/**
 * ConfirmModal — replaces window.confirm() with a proper modal.
 *
 * Usage (in any component inside <ConfirmModalProvider>):
 *
 *   const { confirm } = useConfirm();
 *
 *   const ok = await confirm({
 *     title:        'Delete client?',
 *     message:      '3 businesses will become unassigned.',
 *     confirmLabel: 'Delete',   // default: 'Confirm'
 *     danger:       true,       // red confirm button; default: false
 *   });
 *   if (ok) { ... }
 */
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';

const ConfirmContext = createContext(null);

export function ConfirmModalProvider({ children }) {
  const [modal, setModal] = useState(null); // { title, message, confirmLabel, danger }
  const resolveRef = useRef(null);

  const confirm = useCallback(({ title, message, confirmLabel = 'Confirm', danger = false }) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModal({ title, message, confirmLabel, danger });
    });
  }, []);

  const handleConfirm = () => {
    setModal(null);
    resolveRef.current?.(true);
  };

  const handleCancel = () => {
    setModal(null);
    resolveRef.current?.(false);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {modal && ReactDOM.createPortal(
        <ConfirmModalUI
          {...modal}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />,
        document.body
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmModalProvider>');
  return ctx;
}

function ConfirmModalUI({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 'var(--z-modal)',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '28px 32px',
          maxWidth: '420px',
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
          animation: 'modalIn 0.18s ease',
        }}
      >
        <h3 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: '1.1rem',
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: message ? '10px' : '20px',
        }}>
          {title}
        </h3>
        {message && (
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--muted)',
            lineHeight: 1.6,
            marginBottom: '24px',
          }}>
            {message}
          </p>
        )}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--muted)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              fontFamily: "'DM Mono', monospace",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: danger ? 'var(--red)' : 'var(--accent)',
              color: danger ? '#fff' : 'var(--bg)',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Inject modal animation once
if (typeof document !== 'undefined' && !document.getElementById('modal-style')) {
  const style = document.createElement('style');
  style.id = 'modal-style';
  style.textContent = `
    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.96) translateY(8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
  `;
  document.head.appendChild(style);
}
