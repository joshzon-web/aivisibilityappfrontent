/**
 * Password strength calculator.
 * Returns a score 0–4 and the corresponding label + colour.
 * Shared between Auth.jsx and ResetPassword.jsx.
 */

export const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];
export const STRENGTH_COLOR = ['', 'var(--red)', 'var(--orange)', '#f59e0b', 'var(--accent2)'];

export function getPasswordStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}
