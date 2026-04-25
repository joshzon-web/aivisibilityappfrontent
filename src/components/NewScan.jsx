import { useState } from 'react';
import { searchBusinesses, runScan, probeBusinessLabel } from '../api/client';
import styles from './NewScan.module.css';

const STEPS = ['Search', 'Select', 'Scan'];

export default function NewScan({ onComplete, onCancel, clientId = null }) {
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

    const statuses = [
      'Fetching business data...',
      'Finding local competitors...',
      'Running ChatGPT visibility scan...',
      'Running Gemini visibility scan...',
      'Scoring your AI presence...',
      'Generating AI report...',
    ];

    let i = 0;
    setScanStatus(statuses[0]);
    const interval = setInterval(() => {
      i++;
      if (i < statuses.length) setScanStatus(statuses[i]);
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
      setError(err.response?.data?.detail || 'Scan failed. Please try again.');
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
                {error && <div className={styles.error}>{error}</div>}
                <div className={styles.btnRow}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setStep(1)}>← Back</button>
                  <button type="submit" className={styles.btn}>Start scan →</button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
