import { useNavigate } from 'react-router-dom';

const APP_NAME    = '[App Name]';
const COMPANY     = '[Company Name]';
const CONTACT     = '[Contact Email]';
const EFFECTIVE   = '[Effective Date]';

export default function Privacy() {
  const navigate = useNavigate();

  const h2 = { fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', margin: '32px 0 10px' };
  const p  = { fontSize: '0.88rem', color: 'var(--muted)', lineHeight: 1.8, marginBottom: 12 };
  const li = { fontSize: '0.88rem', color: 'var(--muted)', lineHeight: 1.8, marginBottom: 6 };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '48px 24px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
            fontSize: '0.85rem', padding: 0, marginBottom: 32, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ← Back
        </button>

        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
          Privacy Policy
        </h1>
        <p style={{ ...p, marginBottom: 32 }}>
          Effective date: {EFFECTIVE} · {APP_NAME} is operated by {COMPANY}.
        </p>

        <h2 style={h2}>1. Who We Are</h2>
        <p style={p}>
          {COMPANY} operates {APP_NAME}, an AI visibility scanning and reporting platform for marketing agencies. This policy explains how we collect, use, and protect your personal data. For questions, contact us at {CONTACT}.
        </p>

        <h2 style={h2}>2. Data We Collect</h2>
        <p style={p}>We collect the following categories of data:</p>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li style={li}><strong style={{ color: 'var(--text)' }}>Account data</strong> — your email address, name, and hashed password when you sign up.</li>
          <li style={li}><strong style={{ color: 'var(--text)' }}>Billing data</strong> — payment is handled by Stripe. We store your Stripe customer ID and subscription status but never your full card details.</li>
          <li style={li}><strong style={{ color: 'var(--text)' }}>Business data</strong> — names, addresses, and Google Maps IDs of businesses you track using the Service.</li>
          <li style={li}><strong style={{ color: 'var(--text)' }}>Scan results</strong> — AI search results, scores, and reports generated on your behalf.</li>
          <li style={li}><strong style={{ color: 'var(--text)' }}>Usage data</strong> — how often you use the Service, features accessed, and scan counts (used for quota enforcement and product improvement).</li>
          <li style={li}><strong style={{ color: 'var(--text)' }}>Client contact data</strong> — names and email addresses of your clients, which you provide for automated report delivery.</li>
        </ul>

        <h2 style={h2}>3. How We Use Your Data</h2>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li style={li}>To provide and improve the Service</li>
          <li style={li}>To process payments and manage subscriptions</li>
          <li style={li}>To send transactional emails (scan notifications, password resets, billing alerts)</li>
          <li style={li}>To send report emails to your clients on your behalf</li>
          <li style={li}>To enforce usage quotas and prevent abuse</li>
          <li style={li}>To respond to support requests</li>
        </ul>
        <p style={p}>
          We do not sell your data to third parties. We do not use your data for advertising.
        </p>

        <h2 style={h2}>4. Third-Party Services</h2>
        <p style={p}>We use the following third-party services to operate {APP_NAME}:</p>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li style={li}><strong style={{ color: 'var(--text)' }}>Supabase</strong> — database and file storage (EU region). <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Privacy policy</a></li>
          <li style={li}><strong style={{ color: 'var(--text)' }}>Stripe</strong> — payment processing. <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Privacy policy</a></li>
          <li style={li}><strong style={{ color: 'var(--text)' }}>Resend</strong> — transactional email delivery. <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Privacy policy</a></li>
          <li style={li}><strong style={{ color: 'var(--text)' }}>OpenAI (ChatGPT)</strong> — AI search queries. Business names and search terms are sent to OpenAI's API to generate visibility data. <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Privacy policy</a></li>
          <li style={li}><strong style={{ color: 'var(--text)' }}>Google (Gemini & Maps API)</strong> — AI search queries and business location data. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Privacy policy</a></li>
          <li style={li}><strong style={{ color: 'var(--text)' }}>Perplexity AI</strong> — AI search queries. <a href="https://www.perplexity.ai/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Privacy policy</a></li>
          <li style={li}><strong style={{ color: 'var(--text)' }}>Crisp</strong> — in-app support chat. Your email may be shared with Crisp to personalise support sessions. <a href="https://crisp.chat/en/privacy/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Privacy policy</a></li>
        </ul>

        <h2 style={h2}>5. Cookies and Local Storage</h2>
        <p style={p}>
          We use browser local storage (not cookies) to store your authentication token and user preferences (theme, welcome modal state). We do not use tracking or advertising cookies. Crisp may set cookies for support chat functionality.
        </p>

        <h2 style={h2}>6. Data Retention</h2>
        <p style={p}>
          We retain your account data for as long as your account is active. Scan results are retained indefinitely to provide historical trend data — this is core to the product's value. If you delete your account, your personal data and scan results will be permanently deleted within 30 days. Billing records may be retained longer to comply with financial regulations.
        </p>

        <h2 style={h2}>7. Your Rights (UK/EU Users)</h2>
        <p style={p}>
          Under UK GDPR, you have the right to: access the data we hold about you; correct inaccurate data; request deletion of your data; object to processing; and data portability. To exercise any of these rights, contact us at {CONTACT}. We will respond within 30 days.
        </p>

        <h2 style={h2}>8. Security</h2>
        <p style={p}>
          We use industry-standard measures to protect your data: passwords are hashed using bcrypt, data is encrypted in transit (TLS), and access to production systems is restricted. However, no system is perfectly secure and we cannot guarantee absolute security.
        </p>

        <h2 style={h2}>9. Children</h2>
        <p style={p}>
          {APP_NAME} is not directed at children under 16. We do not knowingly collect data from children. If you believe a child has provided us data, contact us at {CONTACT} and we will delete it.
        </p>

        <h2 style={h2}>10. Changes to This Policy</h2>
        <p style={p}>
          We may update this policy from time to time. We will notify you of material changes by email or in-app notice. Continued use of the Service after changes constitutes acceptance of the revised policy.
        </p>

        <h2 style={h2}>11. Contact</h2>
        <p style={p}>
          For privacy questions or to exercise your rights, contact us at {CONTACT}.
        </p>

      </div>
    </div>
  );
}
