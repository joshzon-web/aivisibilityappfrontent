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
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const colors = {
    success: { bg: '#1d9e75', border: '#17845f' },
    error:   { bg: '#c8102e', border: '#a50d26' },
    info:    { bg: '#378add', border: '#2b6dba' },
  };
  const { bg, border } = colors[toast.type] || colors.info;

  return (
    <div
      onClick={() => onDismiss(toast.id)}
      style={{
        pointerEvents: 'all',
        background: bg,
        borderLeft: `4px solid ${border}`,
        color: '#fff',
        padding: '10px 16px',
        borderRadius: '6px',
        fontSize: '0.85rem',
        fontWeight: 500,
        maxWidth: '320px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        cursor: 'pointer',
        animation: 'toastIn 0.25s ease',
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
