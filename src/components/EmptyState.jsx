import React from 'react';

/**
 * Reusable empty state component.
 *
 * Props:
 *   icon     — emoji or small image src string
 *   title    — bold heading
 *   subtitle — secondary text (optional)
 *   action   — { label: string, onClick: fn } (optional)
 */
export default function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      gap: '12px',
    }}>
      {icon && (
        <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{icon}</span>
      )}
      <p style={{
        margin: 0,
        fontWeight: 700,
        fontSize: '1rem',
        color: '#1a1a2e',
      }}>
        {title}
      </p>
      {subtitle && (
        <p style={{
          margin: 0,
          fontSize: '0.85rem',
          color: '#666',
          maxWidth: '320px',
          lineHeight: 1.5,
        }}>
          {subtitle}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: '8px',
            padding: '8px 18px',
            background: '#c8102e',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
