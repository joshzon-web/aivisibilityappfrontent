import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { SCAN_STATUSES } from '../constants/scanStatuses';
import { getBusinessScans, getBusiness, runScan, updateBusinessSchedule, deleteScan, getBusinessTerms, updateBusinessSearchLabel } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import Sidebar from '../components/Sidebar';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import styles from './Business.module.css';

export default function Business() {
  const { id } = useParams();
  const location = useLocation();
  useAuth();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [error, setError] = useState(null);
  const [scheduleUpdating, setScheduleUpdating] = useState(false);

  // Multi-term state
  const [terms, setTerms] = useState([]);
  const [activeTerm, setActiveTerm] = useState(null);
  const [showAddTerm, setShowAddTerm] = useState(false);
  const [newTerm, setNewTerm] = useState('');

  // Edit-area modal state — lets the user correct the location label that
  // future scans will use (e.g. "London" → "Streatham").
  const [editingArea, setEditingArea] = useState(false);
  const [areaDraft, setAreaDraft]     = useState('');
  const [savingArea, setSavingArea]   = useState(false);
  const [pdfLoading, setPdfLoading]   = useState(false);

  useEffect(() => {
    // cancelled prevents React 18 StrictMode's double-invoke (mount →
    // simulate-unmount → remount) from overwriting fresh data with an empty
    // reset from the second run. The cleanup sets cancelled=true so any
    // in-flight fetch from the first run is silently ignored.
    let cancelled = false;

    setLoading(true);
    setBusiness(null);
    setScans([]);
    setTerms([]);
    setActiveTerm(null);

    Promise.allSettled([
      getBusiness(id),
      getBusinessScans(id),
      getBusinessTerms(id),
    ])
      .then(([bizResult, scansResult, termsResult]) => {
        if (cancelled) return;
        let biz = null;
        if (bizResult.status === 'fulfilled') {
          biz = bizResult.value.data;
          setBusiness(biz);
        }
        if (scansResult.status === 'fulfilled') setScans(scansResult.value.data.scans);
        if (termsResult.status === 'fulfilled') {
          const t = termsResult.value.data.terms;
          setTerms(t);
          const defaultTerm = t[0] || null;
          setActiveTerm(defaultTerm);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id, location.key]);

  // Derived: scans filtered to the active term
  const filteredScans = activeTerm
    ? scans.filter(s => s.search_term === activeTerm)
    : scans;

  const handleNewScan = async () => {
    if (!business) return;
    setScanning(true);
    setError(null);
    setScanStatus(SCAN_STATUSES[0]);
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % SCAN_STATUSES.length;
      setScanStatus(SCAN_STATUSES[idx]);
    }, 8000);
    try {
      const term = activeTerm || business.search_term;
      const res = await runScan(business.place_id, term, { force_refresh: true });
      navigate(`/scan/${res.data.scan_id}`);
    } catch (e) {
      setError('Scan failed. Please try again.');
    } finally {
      clearInterval(interval);
      setScanning(false);
    }
  };

  const handleScheduleChange = async (interval) => {
    if (!business || scheduleUpdating) return;
    setScheduleUpdating(true);
    try {
      const res = await updateBusinessSchedule(id, interval);
      setBusiness(prev => ({ ...prev, scheduled_interval: res.data.scheduled_interval }));
    } catch (e) {
      setError('Could not update schedule. Please try again.');
    } finally {
      setScheduleUpdating(false);
    }
  };

  const handleDeleteScan = async (scanId, e) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete this scan?',
      message: 'This scan and its data will be permanently removed. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteScan(scanId);
      setScans(prev => prev.filter(s => s.id !== scanId));
    } catch {
      setError('Could not delete scan. Please try again.');
    }
  };

  const handleSaveArea = async () => {
    const label = areaDraft.trim();
    if (!label || !business || savingArea) return;
    setSavingArea(true);
    setError(null);
    try {
      const res = await updateBusinessSearchLabel(business.id, label);
      // Backend returns the updated row — reflect it in local state so
      // the header refreshes without a page reload.
      setBusiness(prev => ({
        ...prev,
        search_label:        res.data?.search_label || label,
        search_label_source: res.data?.search_label_source || 'user_override',
      }));
      setEditingArea(false);
    } catch (e) {
      setError('Could not update area. Please try again.');
    } finally {
      setSavingArea(false);
    }
  };

  const downloadPdf = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_URL}/businesses/${id}/report.pdf?token=${token}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
        alert(`Could not download report: ${err.detail || res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(business?.name || 'report').replace(/\s+/g, '_')}_Monthly_Report.pdf`;
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

  const handleAddTerm = async () => {
    if (!newTerm.trim() || !business) return;
    setScanning(true);
    setError(null);
    try {
      const res = await runScan(business.place_id, newTerm.trim(), { force_refresh: true });
      navigate(`/scan/${res.data.scan_id}`);
    } catch (e) {
      setError('Scan failed. Please try again.');
      setScanning(false);
    }
    // Don't reset scanning on success — we're navigating away
  };

  const scoreColour = (score) => {
    if (!score && score !== 0) return 'var(--muted)';
    if (score >= 60) return 'var(--accent2)';
    if (score >= 35) return 'var(--orange)';
    return 'var(--red)';
  };

  // Build chart data from filtered scans (oldest first)
  const chartData = [...filteredScans].reverse().map((s) => ({
    date: new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    score: s.ai_visibility_score,
    chatgpt: s.chatgpt_score,
    gemini: s.gemini_score,
    perplexity: s.perplexity_score,
  }));

  const latestScan = filteredScans[0];
  const previousScan = filteredScans[1];
  const scoreDiff = latestScan && previousScan
    ? latestScan.ai_visibility_score - previousScan.ai_visibility_score
    : null;

  if (loading) return (
    <div className={styles.loadingPage}>
      <div className={styles.spinner} />
      <span>Loading business data...</span>
    </div>
  );

  return (
    <div className={styles.layout}>
      <Sidebar extra={[{ label: '← Back', onClick: () => navigate(-1) }]} />

      <main className={styles.main}>
        <div className={styles.header + ' fade-up'}>
          <div>
            <h1 className={styles.businessName}>{business?.name || 'Business'}</h1>
            <p className={styles.searchTerm}>{business?.address}</p>
            {business && (
              <p
                style={{
                  fontSize: '0.78rem',
                  color: business.search_label ? 'var(--accent)' : 'var(--muted)',
                  margin: '4px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                title={
                  business.search_label_source === 'user_override'
                    ? 'Area set by you — used for every scan'
                    : business.search_label
                      ? `Area auto-picked from Google (${business.search_label_source || 'unknown'}) — click edit to override`
                      : 'No area set — first scan will choose one'
                }
              >
                Tracking in: <strong>{business.search_label || '—'}</strong>
                {business.search_label_source === 'user_override' && (
                  <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>· locked</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAreaDraft(business.search_label || '');
                    setEditingArea(true);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 'inherit',
                    textDecoration: 'underline',
                    opacity: 0.7,
                  }}
                >
                  edit
                </button>
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {scans.length > 0 && (
              <button
                onClick={downloadPdf}
                disabled={pdfLoading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '9px 16px', borderRadius: '8px', fontSize: '0.85rem',
                  background: 'transparent', color: 'var(--accent)',
                  border: '1px solid var(--accent)', fontWeight: 600,
                  cursor: pdfLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                  opacity: pdfLoading ? 0.6 : 1,
                }}
              >
                {pdfLoading ? 'Generating…' : '↓ Download report'}
              </button>
            )}
            <button
              className={styles.scanBtn}
              onClick={handleNewScan}
              disabled={scanning}
            >
              {scanning ? 'Scanning...' : '+ New scan'}
            </button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {/* Search term pill switcher */}
        {terms.length > 0 && (
          <div className={styles.termRow + ' fade-up'}>
            <span className={styles.termLabel}>Search terms:</span>
            {terms.map(term => (
              <button
                key={term}
                onClick={() => setActiveTerm(term)}
                className={styles.termPill + (activeTerm === term ? ' ' + styles.termPillActive : '')}
              >
                {term}
              </button>
            ))}
            <button
              className={styles.termPill}
              onClick={() => setShowAddTerm(true)}
              style={{ borderStyle: 'dashed' }}
            >
              + Add term
            </button>
          </div>
        )}

        {/* Auto-scan schedule toggle */}
        {business && (
          <div className={styles.scheduleRow + ' fade-up'} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 0', marginBottom: '4px',
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              Auto-scan:
            </span>
            {[
              { value: 'none',    label: 'Off' },
              { value: 'weekly',  label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ].map(({ value, label }) => {
              const active = (business.scheduled_interval || 'none') === value;
              return (
                <button
                  key={value}
                  onClick={() => handleScheduleChange(value)}
                  disabled={scheduleUpdating}
                  style={{
                    padding: '4px 14px', borderRadius: '999px', fontSize: '0.78rem',
                    fontWeight: active ? 700 : 400, cursor: 'pointer',
                    border: active ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    background: active ? 'rgba(56,189,248,0.12)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              );
            })}
            {business.last_auto_scan_at && (
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '6px' }}>
                Last auto-scan: {new Date(business.last_auto_scan_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        )}

        {/* Score over time chart */}
        {chartData.length > 1 && (
          <div className={styles.chartCard + ' fade-up-1'}>
            <div className={styles.chartHeader}>
              <h2 className={styles.chartTitle}>
                AI Visibility over time{activeTerm ? ` — "${activeTerm}"` : ''}
              </h2>
              {scoreDiff !== null && (
                <span className={styles.scoreDiff} style={{ color: scoreDiff >= 0 ? 'var(--accent2)' : 'var(--red)' }}>
                  {scoreDiff >= 0 ? '+' : ''}{scoreDiff} since last scan
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(56,189,248,0.06)" strokeDasharray="4 4" />
                <XAxis dataKey="date" tick={{ fill: '#5a7291', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#5a7291', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                  labelStyle={{ color: 'var(--text)' }}
                />
                <Line type="monotone" dataKey="score" stroke="#38bdf8" strokeWidth={2} dot={{ fill: '#38bdf8', r: 4 }} name="Overall" />
                <Line type="monotone" dataKey="chatgpt" stroke="#38bdf8" strokeWidth={1} strokeDasharray="4 4" dot={false} name="ChatGPT" opacity={0.5} />
                <Line type="monotone" dataKey="gemini" stroke="#a78bfa" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Gemini" opacity={0.5} />
                <Line type="monotone" dataKey="perplexity" stroke="#34d399" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Perplexity" opacity={0.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Latest score summary */}
        {latestScan && (
          <div className={styles.summaryRow + ' fade-up-2'}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Latest score</div>
              <div className={styles.summaryValue} style={{ color: scoreColour(latestScan.ai_visibility_score) }}>
                {latestScan.ai_visibility_score}<span style={{ fontSize: '1rem', opacity: 0.5 }}>/100</span>
              </div>
              {scoreDiff !== null && (
                <div className={styles.delta} style={{ color: scoreDiff > 0 ? 'var(--accent2)' : scoreDiff < 0 ? 'var(--red)' : 'var(--muted)' }}>
                  {scoreDiff > 0 ? '+' : ''}{scoreDiff}
                </div>
              )}
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>ChatGPT</div>
              <div className={styles.summaryValue} style={{ color: 'var(--accent)' }}>
                {latestScan.chatgpt_score ?? '—'}%
              </div>
              {previousScan && (
                <div className={styles.delta} style={{ color: (latestScan.chatgpt_score - previousScan.chatgpt_score) > 0 ? 'var(--accent2)' : (latestScan.chatgpt_score - previousScan.chatgpt_score) < 0 ? 'var(--red)' : 'var(--muted)' }}>
                  {latestScan.chatgpt_score - previousScan.chatgpt_score > 0 ? '+' : ''}{latestScan.chatgpt_score - previousScan.chatgpt_score}
                </div>
              )}
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Gemini</div>
              <div className={styles.summaryValue} style={{ color: '#a78bfa' }}>
                {latestScan.gemini_score ?? '—'}%
              </div>
              {previousScan && (
                <div className={styles.delta} style={{ color: (latestScan.gemini_score - previousScan.gemini_score) > 0 ? 'var(--accent2)' : (latestScan.gemini_score - previousScan.gemini_score) < 0 ? 'var(--red)' : 'var(--muted)' }}>
                  {latestScan.gemini_score - previousScan.gemini_score > 0 ? '+' : ''}{latestScan.gemini_score - previousScan.gemini_score}
                </div>
              )}
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Perplexity</div>
              <div className={styles.summaryValue} style={{ color: '#34d399' }}>
                {latestScan.perplexity_score ?? '—'}%
              </div>
              {latestScan.perplexity_score != null && previousScan?.perplexity_score != null && (
                <div className={styles.delta} style={{ color: (latestScan.perplexity_score - previousScan.perplexity_score) > 0 ? 'var(--accent2)' : (latestScan.perplexity_score - previousScan.perplexity_score) < 0 ? 'var(--red)' : 'var(--muted)' }}>
                  {latestScan.perplexity_score - previousScan.perplexity_score > 0 ? '+' : ''}{latestScan.perplexity_score - previousScan.perplexity_score}
                </div>
              )}
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Total scans</div>
              <div className={styles.summaryValue} style={{ color: 'var(--orange)' }}>
                {filteredScans.length}
              </div>
            </div>
          </div>
        )}

        {/* Scan history */}
        <div className={styles.historySection + ' fade-up-3'}>
          <h2 className={styles.sectionTitle}>
            Scan history{activeTerm && terms.length > 1 ? ` — "${activeTerm}"` : ''}
          </h2>
          {filteredScans.length === 0 ? (
            <div className={styles.empty}>
              {activeTerm
                ? `No scans yet for "${activeTerm}". Click "+ New scan" to run one.`
                : 'No scans yet. Run your first scan above.'}
            </div>
          ) : (
            <div className={styles.historyList}>
              {filteredScans.map((scan, i) => (
                <div
                  key={scan.id}
                  className={styles.historyRow + (i === 0 ? ' ' + styles.latest : '')}
                  onClick={() => navigate(`/scan/${scan.id}`)}
                >
                  <div className={styles.historyDate}>
                    {new Date(scan.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                    {i === 0 && <span className={styles.latestBadge}>Latest</span>}
                  </div>
                  {/* Show term badge when viewing all terms (no active filter) */}
                  {!activeTerm && scan.search_term && (
                    <span style={{
                      fontSize: '0.72rem', color: 'var(--muted)',
                      border: '1px solid var(--border)', borderRadius: '999px',
                      padding: '2px 8px', whiteSpace: 'nowrap',
                    }}>
                      {scan.search_term}
                    </span>
                  )}
                  <div className={styles.historyScores}>
                    <span style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>ChatGPT {scan.chatgpt_score ?? '—'}%</span>
                    <span style={{ color: '#a78bfa', fontSize: '0.8rem' }}>Gemini {scan.gemini_score ?? '—'}%</span>
                    <span style={{ color: '#34d399', fontSize: '0.8rem' }}>Perplexity {scan.perplexity_score ?? '—'}%</span>
                  </div>
                  <div
                    className={styles.historyScore}
                    style={{ color: scoreColour(scan.ai_visibility_score) }}
                  >
                    {scan.ai_visibility_score}
                    <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>/100</span>
                  </div>
                  <span className={styles.viewLink}>View →</span>
                  <button
                    onClick={(e) => handleDeleteScan(scan.id, e)}
                    title="Delete scan"
                    style={{
                      background: 'none', border: 'none', color: 'var(--muted)',
                      cursor: 'pointer', fontSize: '0.75rem', padding: '4px 6px',
                      borderRadius: '4px', transition: 'all 0.15s', flexShrink: 0,
                    }}
                    onMouseEnter={e => { e.target.style.color = 'var(--red)'; e.target.style.background = 'rgba(248,113,113,0.1)'; }}
                    onMouseLeave={e => { e.target.style.color = 'var(--muted)'; e.target.style.background = 'none'; }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Edit area modal */}
      {editingArea && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '32px', width: '460px', maxWidth: '90vw',
          }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--text)' }}>
              Edit tracking area
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.5 }}>
              The location label used in every AI prompt for this business.
              Use the neighbourhood your customers actually search by — e.g. <em>Streatham</em> instead of <em>London</em>.
            </p>
            <input
              autoFocus
              value={areaDraft}
              onChange={e => setAreaDraft(e.target.value)}
              placeholder='e.g. Streatham, SW16, Canary Wharf'
              onKeyDown={e => e.key === 'Enter' && !savingArea && areaDraft.trim() && handleSaveArea()}
              maxLength={80}
              style={{
                width: '100%', padding: '10px 14px', fontSize: '0.9rem',
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: '8px', color: 'var(--text)', outline: 'none',
                marginBottom: '16px', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
            {error && (
              <div style={{
                background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
                color: 'var(--red)', borderRadius: '8px', padding: '10px 14px',
                fontSize: '0.82rem', marginBottom: '16px',
              }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setEditingArea(false); setAreaDraft(''); setError(null); }}
                disabled={savingArea}
                style={{
                  padding: '9px 18px', borderRadius: '8px', fontSize: '0.85rem',
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--muted)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveArea}
                disabled={savingArea || !areaDraft.trim()}
                style={{
                  padding: '9px 20px', borderRadius: '8px', fontSize: '0.85rem',
                  background: 'var(--accent)', border: 'none',
                  color: 'var(--bg)', fontWeight: 600, cursor: 'pointer',
                  opacity: (savingArea || !areaDraft.trim()) ? 0.5 : 1,
                  fontFamily: 'DM Mono, monospace',
                }}
              >
                {savingArea ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add term modal */}
      {showAddTerm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '32px', width: '460px', maxWidth: '90vw',
          }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--text)' }}>
              Add search term
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.5 }}>
              What would a customer type to find this business? We'll run a full AI scan for this term and track it separately.
            </p>
            <input
              autoFocus
              value={newTerm}
              onChange={e => setNewTerm(e.target.value)}
              placeholder='e.g. "Italian restaurant" or "pasta near me"'
              onKeyDown={e => e.key === 'Enter' && !scanning && newTerm.trim() && handleAddTerm()}
              style={{
                width: '100%', padding: '10px 14px', fontSize: '0.9rem',
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: '8px', color: 'var(--text)', outline: 'none',
                marginBottom: '16px', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
            {error && (
              <div style={{
                background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
                color: 'var(--red)', borderRadius: '8px', padding: '10px 14px',
                fontSize: '0.82rem', marginBottom: '16px',
              }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowAddTerm(false); setNewTerm(''); setError(null); }}
                style={{
                  padding: '9px 18px', borderRadius: '8px', fontSize: '0.85rem',
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--muted)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddTerm}
                disabled={scanning || !newTerm.trim()}
                style={{
                  padding: '9px 20px', borderRadius: '8px', fontSize: '0.85rem',
                  background: 'var(--accent)', border: 'none',
                  color: 'var(--bg)', fontWeight: 600, cursor: 'pointer',
                  opacity: (scanning || !newTerm.trim()) ? 0.5 : 1,
                  fontFamily: 'DM Mono, monospace',
                }}
              >
                {scanning ? 'Scanning...' : 'Run scan →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {scanning && createPortal(
        <div className={styles.scanOverlay}>
          <div className={styles.scanCard}>
            <div className={styles.scanSpinnerLg} />
            <h2 className={styles.scanTitle}>Scanning AI engines</h2>
            <p className={styles.scanStatusText}>{scanStatus}</p>
            <p className={styles.scanSub}>This takes 60–90 seconds. Don't close this tab.</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
