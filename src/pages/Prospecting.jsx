import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchBusinesses, runProspectingScan } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { useBillingStatus } from '../components/TrialBanner';
import { SCAN_STATUSES } from '../constants/scanStatuses';
import styles from './Prospecting.module.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

const STEPS = ['Search', 'Select', 'Results'];

export default function Prospecting() {
  useAuth();
  const { status: billingStatus } = useBillingStatus();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [error, setError] = useState('');
  const [scanResult, setScanResult] = useState(null); // { scan_id, data }
  const [pdfLoading, setPdfLoading] = useState(false);

  const statusTimerRef = useRef(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError('');
    setSearching(true);
    try {
      const res = await searchBusinesses(query);
      setResults(res.data.results || []);
      setStep(1);
    } catch {
      setError('Could not find businesses. Please check your search and try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (biz) => {
    setSelected(biz);
    setSearchTerm(biz.name);
    setStep(2);
  };

  const handleScan = async () => {
    setError('');
    setScanning(true);
    let i = 0;
    setScanStatus(SCAN_STATUSES[0]);
    statusTimerRef.current = setInterval(() => {
      i++;
      if (i < SCAN_STATUSES.length) setScanStatus(SCAN_STATUSES[i]);
    }, 8000);

    try {
      const res = await runProspectingScan(selected.place_id, searchTerm || selected.name);
      clearInterval(statusTimerRef.current);
      setScanResult({ scan_id: res.data.scan_id, data: res.data.data });
    } catch (err) {
      clearInterval(statusTimerRef.current);
      const status = err?.response?.status;
      if (status === 402) {
        setError('__quota__:' + (err.response?.data?.detail || 'Scan limit reached.'));
      } else {
        setError(err.response?.data?.detail || 'Scan failed. Please try again.');
      }
    } finally {
      setScanning(false);
      setScanStatus('');
    }
  };

  const handleReset = () => {
    setStep(0);
    setQuery('');
    setResults([]);
    setSelected(null);
    setSearchTerm('');
    setScanResult(null);
    setError('');
  };

  const downloadPdf = async () => {
    if (pdfLoading || !scanResult?.scan_id) return;
    setPdfLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_URL}/scans/${scanResult.scan_id}/report.pdf?token=${token}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
        alert(`Could not download report: ${err.detail || res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(scanResult.data?.name || 'report').replace(/\s+/g, '_')}_AI_Visibility.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Download failed. Please check you are logged in and try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  const scoreColour = (score) => {
    if (score >= 60) return 'var(--accent2)';
    if (score >= 35) return 'var(--orange)';
    return 'var(--red)';
  };

  const scoreLabel = (score) => {
    if (score >= 60) return 'Strong';
    if (score >= 35) return 'Moderate';
    return 'Weak';
  };

  return (
    <div className={styles.layout}>
      <Sidebar active="prospecting" />

      <main className={styles.main}>
        {/* Page header */}
        <div className={styles.header + ' fade-up'}>
          <h1 className={styles.title}>Prospecting</h1>
          <p className={styles.sub}>
            Scan any business and download a one-off sales PDF — without adding it to your tracked businesses.
          </p>
        </div>

        {/* Step indicator */}
        <div className={styles.steps + ' fade-up-1'}>
          {STEPS.map((s, i) => (
            <div key={s} className={styles.step}>
              <div className={[
                styles.stepDot,
                i <= step ? styles.stepDotActive : '',
                i < step || (i === 2 && scanResult) ? styles.stepDotDone : '',
              ].filter(Boolean).join(' ')}>
                {(i < step || (i === 2 && scanResult)) ? '✓' : i + 1}
              </div>
              <span className={i === step ? styles.stepLabelActive : styles.stepLabel}>{s}</span>
              {i < STEPS.length - 1 && (
                <div className={[styles.stepLine, i < step ? styles.stepLineDone : ''].filter(Boolean).join(' ')} />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 0 — Search ── */}
        {step === 0 && (
          <div className={styles.card + ' fade-up-2'}>
            <h2 className={styles.cardTitle}>Find a business</h2>
            <p className={styles.cardSub}>Search Google Maps to find the business you want to prospect</p>
            <form onSubmit={handleSearch} className={styles.form}>
              <input
                className={styles.input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='e.g. "Bella Italia Manchester" or "pizza restaurant Rye"'
                required
                autoFocus
              />
              {error && <div className={styles.error}>{error}</div>}
              <div className={styles.btnRow}>
                <button type="submit" className={styles.btn} disabled={searching || !query.trim()}>
                  {searching ? 'Searching...' : 'Search →'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Step 1 — Select ── */}
        {step === 1 && (
          <div className={styles.card + ' fade-up-2'}>
            <h2 className={styles.cardTitle}>Select a business</h2>
            <p className={styles.cardSub}>{results.length} result{results.length !== 1 ? 's' : ''} found for "{query}"</p>
            {results.length === 0 ? (
              <div className={styles.error}>No results found. Try a different search.</div>
            ) : (
              <div className={styles.resultsList}>
                {results.map((biz) => (
                  <button
                    key={biz.place_id}
                    className={styles.resultItem}
                    onClick={() => handleSelect(biz)}
                  >
                    <div className={styles.bizName}>{biz.name}</div>
                    <div className={styles.bizAddress}>{biz.address}</div>
                    {biz.rating && (
                      <div className={styles.bizRating}>
                        ★ {biz.rating} ({biz.user_ratings_total?.toLocaleString()} reviews)
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
            <button className={styles.cancelBtn} style={{ marginTop: 16 }} onClick={() => setStep(0)}>
              ← Back
            </button>
          </div>
        )}

        {/* ── Step 2 — Confirm / Scanning / Results ── */}
        {step === 2 && (
          <div className={styles.card + ' fade-up-2'}>

            {/* Scanning state */}
            {scanning && (
              <div className={styles.scanning}>
                <div className={styles.scanSpinner} />
                <h2 className={styles.cardTitle} style={{ marginBottom: 12 }}>Scanning AI engines</h2>
                <p className={styles.scanStatus}>{scanStatus}</p>
                <p className={styles.cardSub}>This takes 60–90 seconds. Don't close this tab.</p>
              </div>
            )}

            {/* Pre-scan confirmation */}
            {!scanning && !scanResult && (
              <>
                <h2 className={styles.cardTitle}>Ready to scan</h2>
                <div className={styles.selectedBiz}>
                  <div className={styles.bizName}>{selected?.name}</div>
                  <div className={styles.bizAddress}>{selected?.address}</div>
                  {selected?.rating && (
                    <div className={styles.bizRating}>
                      ★ {selected.rating} ({selected.user_ratings_total?.toLocaleString()} reviews)
                    </div>
                  )}
                </div>
                <div className={styles.inputGroup} style={{ marginBottom: 20 }}>
                  <label className={styles.inputLabel}>Search term (what a customer would type)</label>
                  <input
                    className={styles.input}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder='e.g. "best pizza near me"'
                  />
                </div>
                <div className={styles.disclaimer}>
                  ℹ This scan won't appear in your tracked businesses list — it's a one-off prospecting tool.
                </div>

                {/* Quota warning — ≤3 remaining shows amber, 0 shows red + disables */}
                {(() => {
                  const limit = billingStatus?.scans_limit;
                  const used  = billingStatus?.scans_used ?? 0;
                  if (limit === null || limit === undefined) return null;
                  const remaining = Math.max(0, limit - used);
                  if (remaining > 3) return null;
                  if (remaining === 0) {
                    return (
                      <div style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 8, padding: '12px 16px', fontSize: '0.83rem', color: 'var(--red)', marginBottom: 4,
                      }}>
                        <div style={{ marginBottom: 8 }}>You have no scans remaining this period.</div>
                        <button
                          type="button"
                          onClick={() => navigate('/settings?tab=billing')}
                          style={{
                            padding: '6px 16px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 700,
                            background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer',
                          }}
                        >
                          View plans →
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div style={{
                      background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
                      borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem', color: '#f59e0b', marginBottom: 4,
                    }}>
                      ⚠ {remaining} scan{remaining !== 1 ? 's' : ''} remaining this period
                    </div>
                  );
                })()}

                {error && error.startsWith('__quota__:') ? (
                  <div style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 8, padding: '12px 16px', fontSize: '0.83rem', color: 'var(--red)',
                  }}>
                    <div style={{ marginBottom: 8 }}>{error.replace('__quota__:', '')}</div>
                    <button
                      type="button"
                      onClick={() => navigate('/settings?tab=billing')}
                      style={{
                        padding: '6px 16px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 700,
                        background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer',
                      }}
                    >
                      View plans →
                    </button>
                  </div>
                ) : error ? (
                  <div className={styles.error}>{error}</div>
                ) : null}

                {(() => {
                  const limit = billingStatus?.scans_limit;
                  const used  = billingStatus?.scans_used ?? 0;
                  const remaining = limit !== null && limit !== undefined ? Math.max(0, limit - used) : null;
                  const outOfScans = remaining !== null && remaining === 0;
                  return (
                    <div className={styles.btnRow}>
                      <button className={styles.cancelBtn} onClick={() => setStep(1)}>← Back</button>
                      <button
                        className={styles.btn}
                        onClick={handleScan}
                        disabled={!searchTerm.trim() || outOfScans}
                        style={outOfScans ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                        title={outOfScans ? 'No scans remaining — upgrade your plan' : undefined}
                      >
                        Run prospecting scan →
                      </button>
                    </div>
                  );
                })()}
              </>
            )}

            {/* Results */}
            {!scanning && scanResult && (() => {
              const d = scanResult.data;
              const score = d?.ai_visibility_score ?? 0;
              return (
                <>
                  <div className={styles.resultsHeader}>
                    <div>
                      <h2 className={styles.cardTitle} style={{ marginBottom: 4 }}>
                        {d?.name || selected?.name}
                      </h2>
                      <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: 0 }}>
                        {selected?.address}
                      </p>
                    </div>
                    <div className={styles.scoreBadge} style={{ borderColor: scoreColour(score) }}>
                      <span className={styles.scoreNum} style={{ color: scoreColour(score) }}>
                        {score}
                      </span>
                      <span className={styles.scoreLabel} style={{ color: scoreColour(score) }}>
                        {scoreLabel(score)}
                      </span>
                    </div>
                  </div>

                  {/* Engine breakdown */}
                  <div className={styles.enginesRow}>
                    <div className={styles.engineCard}>
                      <div className={styles.engineValue} style={{ color: 'var(--accent)' }}>
                        {d?.chatgpt_percent ?? 0}%
                      </div>
                      <div className={styles.engineLabel}>ChatGPT</div>
                    </div>
                    <div className={styles.engineCard}>
                      <div className={styles.engineValue} style={{ color: '#a78bfa' }}>
                        {d?.gemini_percent ?? 0}%
                      </div>
                      <div className={styles.engineLabel}>Gemini</div>
                    </div>
                    <div className={styles.engineCard}>
                      <div className={styles.engineValue} style={{ color: '#34d399' }}>
                        {d?.perplexity_percent ?? 0}%
                      </div>
                      <div className={styles.engineLabel}>Perplexity</div>
                    </div>
                  </div>

                  {/* PDF download */}
                  <div className={styles.actionsRow}>
                    <button
                      onClick={downloadPdf}
                      disabled={pdfLoading}
                      className={styles.pdfBtn}
                      style={{ cursor: pdfLoading ? 'not-allowed' : 'pointer', opacity: pdfLoading ? 0.6 : 1 }}
                    >
                      {pdfLoading ? 'Generating…' : '↓ Download prospecting report (PDF)'}
                    </button>
                  </div>

                  <div className={styles.resetRow}>
                    <button className={styles.resetLink} onClick={handleReset}>
                      ← Scan a different business
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </main>
    </div>
  );
}
