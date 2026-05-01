import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchBusinesses, runScan, probeBusinessLabel, resolveBusinessUrl } from '../api/client';
import { useBillingStatus } from './TrialBanner';
import styles from './NewScan.module.css';
import { SCAN_STATUSES } from '../constants/scanStatuses';

const STEPS = ['Search', 'Select', 'Scan'];

export default function NewScan({ onComplete, onCancel, clientId = null }) {
  const navigate = useNavigate();
  const { status: billingStatus } = useBillingStatus();
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [error, setError] = useState('');

  // Pre-scan area probe: we ask the backend for the smart label it would use
  // so the user can confirm / override BEFORE spending ~24 LLM calls scanning
  // the wrong neighbourhood. probe is the raw response; areaLabel is the
  // editable text the user actually confirms.
  const [probe, setProbe]             = useState(null);
  const [probing, setProbing]         = useState(false);
  const [areaLabel, setAreaLabel]     = useState('');

  const [urlMode, setUrlMode]     = useState(false);
  const [mapsUrl, setMapsUrl]     = useState('');
  const [resolving, setResolving] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError('');
    setSearching(true);
    try {
      const res = await searchBusinesses(query);
      setResults(res.data.results);
      setStep(1);
    } catch {
      setError('Could not find businesses. Check your query.');
    } finally {
      setSearching(false);
    }
  };

  const handleResolveUrl = async (e) => {
    e.preventDefault();
    setError('');
    setResolving(true);
    try {
      const res = await resolveBusinessUrl(mapsUrl);
      // Show candidates in the Select step — same flow as a normal search
      setResults(res.data.results);
      setUrlMode(false);
      setStep(1);
    } catch (err) {
      // Pre-fill the search box with whatever name we extracted so the
      // user can search manually without retyping
      const extracted = err.response?.data?.detail?.extracted_name || '';
      if (extracted) {
        setQuery(extracted);
        setUrlMode(false);
        setError('We couldn\'t resolve that link directly — try searching by name instead.');
      } else {
        setError('Could not find a business from that URL. Try copying the full link from your browser address bar.');
      }
    } finally {
      setResolving(false);
    }
  };

  const handleSelect = async (biz) => {
    setSelected(biz);
    setStep(2);
    // Fire the label probe in the background. Non-blocking: even if it fails
    // the scan still works (backend will re-resolve from place_id anyway).
    setProbe(null);
    setAreaLabel('');
    setProbing(true);
    try {
      const res = await probeBusinessLabel(biz.place_id);
      setProbe(res.data);
      setAreaLabel(res.data?.search_label || '');
    } catch {
      // Silent failure: leave areaLabel empty → backend picks automatically.
    } finally {
      setProbing(false);
    }
  };

  const handleScan = async (e) => {
    e.preventDefault();
    setError('');
    setScanning(true);

    let i = 0;
    setScanStatus(SCAN_STATUSES[0]);
    const interval = setInterval(() => {
      i++;
      if (i < SCAN_STATUSES.length) setScanStatus(SCAN_STATUSES[i]);
    }, 8000);

    try {
      // Only send an override when the user actually changed it from the
      // auto-picked label — otherwise let the backend resolve afresh.
      const trimmed = (areaLabel || '').trim();
      const autoPick = (probe?.search_label || '').trim();
      const override = trimmed && trimmed !== autoPick ? trimmed : undefined;
      const res = await runScan(selected.place_id, searchTerm, {
        search_label_override: override,
      });
      clearInterval(interval);
      onComplete(res.data.scan_id, res.data.business_id);
    } catch (err) {
      clearInterval(interval);
      const status = err?.response?.status;
      if (status === 402) {
        // Quota or trial exceeded — show upgrade prompt, not a generic error
        setError('__quota__:' + (err.response?.data?.detail || 'Scan limit reached.'));
      } else {
        setError(err.response?.data?.detail || 'Scan failed. Please try again.');
      }
      setScanning(false);
      setScanStatus('');
    }
  };

  return (
    <div className={styles.wrap}>
      {/* Steps indicator */}
      <div className={styles.steps + ' fade-up'}>
        {STEPS.map((s, i) => (
          <div key={s} className={styles.step}>
            <div className={`${styles.stepDot} ${i <= step ? styles.active : ''} ${i < step ? styles.done : ''}`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={i === step ? styles.stepLabelActive : styles.stepLabel}>{s}</span>
            {i < STEPS.length - 1 && <div className={`${styles.stepLine} ${i < step ? styles.lineDone : ''}`} />}
          </div>
        ))}
      </div>

      {/* Step 0 — Search */}
      {step === 0 && (
        <div className={styles.card + ' fade-up-1'}>
          {!urlMode ? (
            <>
              <h2 className={styles.cardTitle}>Find your business</h2>
              <p className={styles.cardSub}>Search Google Maps to find the business you want to scan</p>
              <form onSubmit={handleSearch} className={styles.form}>
                <input
                  className={styles.input}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. Bella Italia Manchester"
                  required
                  autoFocus
                />
                {error && <div className={styles.error}>{error}</div>}
                <div className={styles.btnRow}>
                  <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
                  <button type="submit" className={styles.btn} disabled={searching}>
                    {searching ? 'Searching...' : 'Search →'}
                  </button>
                </div>
              </form>
              <button
                type="button"
                className={styles.urlToggle}
                onClick={() => { setUrlMode(true); setError(''); }}
              >
                Can't find it? Paste a Google Maps URL →
              </button>
            </>
          ) : (
            <>
              <h2 className={styles.cardTitle}>Paste a Google Maps link</h2>
              <p className={styles.cardSub}>Open the business on Google Maps, copy the URL from your browser address bar, and paste it here.</p>
              <form onSubmit={handleResolveUrl} className={styles.form}>
                <input
                  className={styles.input}
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  placeholder="https://www.google.com/maps/place/..."
                  required
                  autoFocus
                />
                {error && <div className={styles.error}>{error}</div>}
                <div className={styles.btnRow}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => { setUrlMode(false); setError(''); }}
                  >
                    ← Back to search
                  </button>
                  <button type="submit" className={styles.btn} disabled={resolving}>
                    {resolving ? 'Looking up…' : 'Use this link →'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {/* Step 1 — Select */}
      {step === 1 && (
        <div className={styles.card + ' fade-up-1'}>
          <h2 className={styles.cardTitle}>Select your business</h2>
          <p className={styles.cardSub}>{results.length} results found</p>
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
                  <div className={styles.bizRating}>★ {biz.rating} ({biz.user_ratings_total} reviews)</div>
                )}
              </button>
            ))}
          </div>
          <button className={styles.cancelBtn} style={{marginTop: 16}} onClick={() => setStep(0)}>← Back</button>
        </div>
      )}

      {/* Step 2 — Scan */}
      {step === 2 && (
        <div className={styles.card + ' fade-up-1'}>
          {scanning ? (
            <div className={styles.scanning}>
              <div className={styles.scanSpinner} />
              <h2 className={styles.cardTitle}>Scanning AI engines</h2>
              <p className={styles.scanStatus}>{scanStatus}</p>
              <p className={styles.cardSub}>This takes 60–90 seconds. Don't close this tab.</p>
            </div>
          ) : (
            <>
              <h2 className={styles.cardTitle}>Configure scan</h2>
              <div className={styles.selectedBiz}>
                <div className={styles.bizName}>{selected.name}</div>
                <div className={styles.bizAddress}>{selected.address}</div>
              </div>
              <form onSubmit={handleScan} className={styles.form}>
                <div className={styles.field}>
                  <label>Search term</label>
                  <input
                    className={styles.input}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="e.g. best Italian restaurant Manchester"
                    required
                  />
                  <span className={styles.hint}>What would a customer type to find this business?</span>
                </div>

                {/* Area the scan will search in — default comes from Google,
                    user can edit if our auto-pick is too broad ("London")
                    or wrong ("Tower Hamlets" instead of "Canary Wharf"). */}
                <div className={styles.field}>
                  <label>Area to search in</label>
                  {probing ? (
                    <input
                      className={styles.input}
                      value="Resolving area…"
                      disabled
                    />
                  ) : (
                    <>
                      <input
                        className={styles.input}
                        value={areaLabel}
                        onChange={(e) => setAreaLabel(e.target.value)}
                        placeholder={probe?.search_label || 'e.g. Streatham'}
                        list="area-candidates"
                      />
                      {probe?.candidates?.length > 0 && (
                        <datalist id="area-candidates">
                          {probe.candidates.map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      )}
                      <span className={styles.hint}>
                        {probe?.search_label
                          ? `We'll use "${areaLabel || probe.search_label}" in prompts. `
                          : 'Optional — leave blank and we\'ll pick one. '}
                        {probe?.candidates?.length > 1 && 'Suggestions: '}
                        {probe?.candidates?.slice(0, 4).map((c, i, arr) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setAreaLabel(c)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                              color: 'var(--accent)',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              marginRight: 6,
                              fontSize: 'inherit',
                            }}
                          >
                            {c}{i < arr.length - 1 ? ',' : ''}
                          </button>
                        ))}
                      </span>
                    </>
                  )}
                </div>
                {/* Quota warning — show when ≤3 scans remaining, block at 0 */}
                {(() => {
                  const limit = billingStatus?.scans_limit;
                  const used  = billingStatus?.scans_used ?? 0;
                  if (limit === null || limit === undefined) return null; // unlimited plan
                  const remaining = Math.max(0, limit - used);
                  if (remaining > 3) return null;
                  if (remaining === 0) {
                    return (
                      <div style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 8, padding: '12px 16px', fontSize: '0.83rem', color: 'var(--red)',
                        marginBottom: 4,
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
                      borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem', color: '#f59e0b',
                      marginBottom: 4,
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
                      <button type="button" className={styles.cancelBtn} onClick={() => setStep(1)}>← Back</button>
                      <button
                        type="submit"
                        className={styles.btn}
                        disabled={outOfScans}
                        style={outOfScans ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                        title={outOfScans ? 'No scans remaining — upgrade your plan' : undefined}
                      >
                        Start scan →
                      </button>
                    </div>
                  );
                })()}
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
