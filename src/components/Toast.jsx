import React, { createContext, useContext, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';

const ToastContext = createContext(null);

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {ReactDOM.createPortal(
        <ToastContainer toasts={toasts} onDismiss={dismiss} />,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: 'var(--space-6)',
      right: 'var(--space-6)',
      zIndex: 'var(--z-toast)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
      pointerEvents: 'none',
      maxHeight: '60vh',
      overflow: 'hidden',
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  // Use theme colour variables; alpha backgrounds so the card feels in-theme
  const colours = {
    success: { accent: 'var(--accent2)',  bg: 'rgba(110,231,183,0.12)', border: 'rgba(110,231,183,0.4)' },
    error:   { accent: 'var(--red)',      bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.4)' },
    info:    { accent: 'var(--accent)',   bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.4)'  },
  };
  const { accent, bg, border } = colours[toast.type] || colours.info;

  return (
    <div
      onClick={() => onDismiss(toast.id)}
      style={{
        pointerEvents: 'all',
        background: bg,
        border: `1px solid ${border}`,
        borderLeft: `3px solid ${accent}`,
        color: 'var(--text)',
        padding: '10px 16px',
        borderRadius: '8px',
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
        maxWidth: '320px',
        boxShadow: 'var(--shadow-md)',
        cursor: 'pointer',
        animation: 'toastIn 0.2s ease',
        backdropFilter: 'blur(8px)',
      }}
    >
      {toast.message}
    </div>
  );
}

// Inject keyframe animation once
if (typeof document !== 'undefined' && !document.getElementById('toast-style')) {
  const style = document.createElement('style');
  style.id = 'toast-style';
  style.textContent = `
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}
