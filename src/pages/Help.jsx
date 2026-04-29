import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import styles from './Help.module.css';

const FAQS = [
  {
    q: 'What is an AI visibility score?',
    a: 'Your AI visibility score (0–100) measures how often your business is mentioned or recommended when people ask AI assistants like ChatGPT, Gemini, and Perplexity for businesses like yours. A score of 70+ means you appear consistently across most relevant prompts; below 35 means AI models rarely surface you. The score is calculated by running dozens of realistic search prompts and checking whether your business appears in the response.',
  },
  {
    q: 'How often should I scan?',
    a: 'Once a month is the recommended baseline for most businesses — AI models update their training data and web index on roughly monthly cycles, so scanning more frequently than that rarely shows meaningful change. If a business has just made significant changes (new website, press coverage, major review influx), scanning again after 3–4 weeks makes sense. Use scheduled scans to automate this.',
  },
  {
    q: 'Why does the scan take 60–90 seconds?',
    a: 'Each scan runs dozens of prompts across three AI engines (ChatGPT, Gemini, and Perplexity) simultaneously, then scores and analyses the results. The engines themselves take 2–5 seconds to respond per prompt, and we run many prompts in parallel to keep the total time reasonable. The loading screen shows you which stage is currently running.',
  },
  {
    q: 'Why is my Perplexity score 0%?',
    a: "Perplexity searches the live web in real time and is highly sensitive to your business's current online footprint — reviews, citations, directory listings, and fresh web content. A 0% Perplexity score usually means the business has limited online presence outside its own website. Improving the number of third-party sites that mention the business (directories, review platforms, local press) typically raises this score within a few weeks.",
  },
  {
    q: 'How do I add my logo and brand colours?',
    a: 'Go to White-label in the sidebar. You can upload your agency logo, set a primary colour, add your support email, and customise the CTA text that appears on sales PDFs. Changes apply to all new PDFs and share links immediately — existing shared links update on next view.',
  },
  {
    q: 'What counts as a scan?',
    a: 'One scan = one full AI visibility analysis for one business + one search term. Running a scan for "Italian restaurants in Manchester" and then "best pizza near Manchester city centre" for the same business counts as two scans. Scheduled (automated) scans count the same as manual ones. Viewing an existing scan result never uses a scan credit.',
  },
  {
    q: 'How do I send reports to my clients?',
    a: "Open the business page for your client's location, then click the Report tab. You can download a white-labelled PDF to send manually, or create a shareable link that gives your client a live view of their results. To send reports automatically each time a scheduled scan runs, go to the client folder, enable Auto-send reports, and add your client's contact email.",
  },
  {
    q: 'Can I track multiple search terms per business?',
    a: "Yes. From the business page, use the search term selector to add additional terms — for example a restaurant might track both 'Italian restaurants in Soho' and 'best pasta near Oxford Circus'. Each term gets its own scan history and score. Scheduled scans run for all active terms automatically.",
  },
  {
    q: 'Can I white-label the client-facing reports?',
    a: "Yes — this is built in. Go to White-label in the sidebar to set your agency name, logo, and colours. PDFs and share links will show your branding instead of the platform defaults. You can also set a per-client sender name and email address so report emails appear to come directly from your agency.",
  },
  {
    q: 'How do I add a new client or business?',
    a: 'From the Clients dashboard, click "+ Add client" to create a client folder. Then open the client and click "Track new business" — search for the business by name and location, confirm the Google Maps listing, choose your search term, and run the first scan. The whole process takes about 2 minutes.',
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${styles.faqItem} ${open ? styles.faqItemOpen : ''}`}>
      <button className={styles.faqQuestion} onClick={() => setOpen((o) => !o)}>
        <span>{q}</span>
        <span className={styles.faqChevron}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className={styles.faqAnswer}>{a}</div>}
    </div>
  );
}

export default function Help() {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active="help" />
      <main className={styles.main}>
        <div className={styles.inner}>
          <h1 className={styles.heading}>Help &amp; FAQ</h1>
          <p className={styles.sub}>
            Answers to the most common questions. Can't find what you need?{' '}
            <button
              className={styles.chatLink}
              onClick={() => window.$crisp?.push(['do', 'chat:open'])}
            >
              Open live chat
            </button>
            .
          </p>

          <div className={styles.faqList}>
            {FAQS.map(({ q, a }) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>

          <div className={styles.chatCard}>
            <div className={styles.chatCardTitle}>Still need help?</div>
            <p className={styles.chatCardText}>
              Our support team is available via live chat. We typically reply within a few hours
              during business hours.
            </p>
            <button
              className={styles.chatBtn}
              onClick={() => window.$crisp?.push(['do', 'chat:open'])}
            >
              Open live chat →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
