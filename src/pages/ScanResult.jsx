import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getScan, getSharedScan, getShareInfo, createShareLink, extendShareLink, revokeShareLink } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import BrandLogo from '../components/BrandLogo';
import Sidebar from '../components/Sidebar';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from 'recharts';
import styles from './ScanResult.module.css';

// ── Recommendation engine ─────────────────────────────────────────────────────
// Pure function — takes scan data, returns sorted array of action items.
function buildRecommendations(result, ownMentions, totalPrompts, categoryMap) {
  const recs = [];
  if (!result) return recs;

  const rating      = result.rating;
  const reviews     = result.reviews ?? 0;
  const avgRating   = result.avg_rating;
  const avgReviews  = result.avg_reviews ?? 0;
  const chatgptPct  = result.chatgpt_percent ?? 0;
  const geminiPct   = result.gemini_percent  ?? 0;
  const perplexPct  = result.perplexity_percent ?? 0;
  const recTotal    = (result.rec_score ?? 0) + (result.g_rec_score ?? 0) + (result.p_rec_score ?? 0);
  const mentionTotal= (result.score ?? 0) + (result.g_score ?? 0) + (result.p_score ?? 0);
  const visMap      = result.visibility_map || [];
  const milestones  = result.milestone_data || [];

  // 1 · Engine completely absent (high per engine)
  if (chatgptPct === 0 && totalPrompts > 0) {
    recs.push({
      priority: 'high',
      title: 'Invisible to ChatGPT (0%)',
      detail: 'ChatGPT didn\'t mention you in any prompt. It relies on web content — ensure you\'re listed on directories, review sites, and your Google Business Profile is complete.',
      category: 'AI Presence',
    });
  }
  if (geminiPct === 0 && totalPrompts > 0) {
    recs.push({
      priority: 'high',
      title: 'Invisible to Gemini (0%)',
      detail: 'Gemini pulls directly from Google\'s index. A 0% Gemini score strongly suggests your Google Business Profile needs attention — add photos, respond to reviews, verify your category.',
      category: 'AI Presence',
    });
  }
  if (perplexPct === 0 && totalPrompts > 0) {
    recs.push({
      priority: 'high',
      title: 'Invisible to Perplexity (0%)',
      detail: 'Perplexity uses web search. A 0% score suggests limited online presence — build citations on Yelp, TripAdvisor, and local directories.',
      category: 'AI Presence',
    });
  }

  // 2 · Rating below competitor average (high)
  if (rating && avgRating && rating < avgRating) {
    recs.push({
      priority: 'high',
      title: `Rating below local average (${rating}★ vs ${avgRating}★ avg)`,
      detail: `Competitors in your area average ${avgRating}★. AI engines treat star rating as a primary trust signal — closing this gap should be your top priority.`,
      category: 'Reviews',
    });
  }

  // 3 · Mentioned but rarely recommended (medium)
  if (mentionTotal > 3 && recTotal < mentionTotal * 0.4) {
    recs.push({
      priority: 'medium',
      title: 'Mentioned but rarely recommended',
      detail: `You appear in AI responses (${mentionTotal} mentions) but are in the recommended list only ${recTotal} time${recTotal !== 1 ? 's' : ''}. Businesses that rank in "top 3" lists need stronger review signals and consistent name/address/phone data across the web.`,
      category: 'AI Presence',
    });
  }

  // 4 · Category weaknesses (medium — up to 2 weakest categories)
  const catLabels = { best_of: 'best-of', discovery: 'discovery', local_intent: 'local intent', transactional: 'transactional' };
  const catTips   = {
    best_of:      '"Best X in [city]" queries — the highest-value for AI recommendations.',
    discovery:    'Exploratory "find me an X" queries from people browsing options.',
    local_intent: 'Location-specific "X in [city]" searches.',
    transactional:'High-intent "book/order/buy" queries — the most commercially valuable.',
  };
  const weakCats = Object.entries(categoryMap)
    .filter(([, d]) => d.total > 0 && d.mentioned / d.total < 0.35)
    .sort(([, a], [, b]) => (a.mentioned / a.total) - (b.mentioned / b.total))
    .slice(0, 2);
  weakCats.forEach(([cat, d]) => {
    recs.push({
      priority: 'medium',
      title: `Low visibility in "${catLabels[cat] || cat}" queries`,
      detail: `Only ${d.mentioned}/${d.total} "${cat.replace(/_/g, ' ')}" prompts mentioned you. ${catTips[cat] || ''}`,
      category: 'Visibility',
    });
  });

  // 5 · Review volume well below competitors (medium)
  if (reviews < avgReviews * 0.5 && avgReviews > 10) {
    recs.push({
      priority: 'medium',
      title: 'Review volume well below competitors',
      detail: `Competitors average ${avgReviews} reviews; you have ${reviews}. Volume signals popularity to AI engines — set up an automated review request for every new customer.`,
      category: 'Reviews',
    });
  }

  // 6 · Top competitor dominating AI (medium)
  if (visMap.length > 0) {
    const top = visMap[0];
    if (top.name !== result.name && top.mentions > ownMentions * 2 && top.mentions > 2) {
      recs.push({
        priority: 'medium',
        title: `"${top.name}" is dominating AI results`,
        detail: `${top.name} is mentioned ${top.mentions}× vs your ${ownMentions} across all prompts. Study their Google Business Profile, review strategy, and online presence.`,
        category: 'Competitors',
      });
    }
  }

  // 7 · Google Maps rank low (low)
  if (result.target_position && result.target_position > 3) {
    recs.push({
      priority: 'low',
      title: `Ranked #${result.target_position} locally on Google Maps`,
      detail: 'Local Google Maps ranking directly influences which businesses AI engines recommend. Improving review recency, keeping hours accurate, and adding photos all help.',
      category: 'Local SEO',
    });
  }

  // 8 · Close to a rating milestone (low)
  const near = milestones.find(m => m.needed > 0 && m.needed <= 25);
  if (near) {
    recs.push({
      priority: 'low',
      title: `Just ${near.needed} reviews away from ${near.target}★`,
      detail: `You're ${near.needed} five-star reviews away from hitting ${near.target}★ — a quick win. Send a review request to your happiest recent customers today.`,
      category: 'Reviews',
    });
  }

  // 9 · Top sources AI cites (medium — actionable)
  if (result.top_sources && result.top_sources.length > 0) {
    const top3 = result.top_sources.slice(0, 3)
      .map(s => `${s.domain} (${s.count}×)`).join(', ');
    recs.push({
      priority: 'medium',
      title: 'Top sources AI cites in your space',
      detail: `When AI engines respond to "${result.search_term}" queries, they most often cite: ${top3}. Strengthen your presence on these specific sites — claim listings, encourage reviews, build content there.`,
      category: 'Sources',
    });
  }

  // Sort: high → medium → low
  const order = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]);
}

export default function ScanResult({ publicMode = false }) {
  // In public mode the URL param is :token, in private mode it's :id
  const params = useParams();
  const id = publicMode ? null : params.id;
  const shareToken = publicMode ? params.token : null;

  useAuth();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [expandedPrompt, setExpandedPrompt] = useState(null);

  // Share modal state (private mode only)
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareInfo, setShareInfo] = useState(null);     // { token, expires_at } | null
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    const fetcher = publicMode
      ? getSharedScan(shareToken).then(data => ({ data }))
      : getScan(id);

    fetcher
      .then((res) => setScan(res.data))
      .catch(err => {
        console.error(err);
        setLoadError(
          err?.response?.status === 404
            ? (publicMode ? 'This share link is invalid or has expired.' : 'Scan not found.')
            : 'Could not load scan.'
        );
      })
      .finally(() => setLoading(false));
  }, [id, shareToken, publicMode]);

  // Load share info when modal opens (private mode)
  useEffect(() => {
    if (!showShareModal || publicMode || !id) return;
    getShareInfo(id).then(res => setShareInfo(res.data)).catch(() => setShareInfo(null));
  }, [showShareModal, id, publicMode]);

  if (loading) return (
    <div className={styles.loadingPage}>
      <div className={styles.spinner} />
      <span>Loading scan results...</span>
    </div>
  );

  if (loadError || !scan) return (
    <div className={styles.loadingPage} style={{ flexDirection: 'column', textAlign: 'center', padding: '20px' }}>
      <div style={{ fontSize: '2rem', marginBottom: '12px', opacity: 0.5 }}>🔒</div>
      <div style={{ fontSize: '1rem', color: 'var(--text)', marginBottom: '8px' }}>
        {loadError || 'Scan not found.'}
      </div>
      {publicMode && (
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', maxWidth: 400 }}>
          The link may have been revoked or has passed its expiry date. Contact the sender for a fresh link.
        </div>
      )}
    </div>
  );

  // Share link handlers (private mode only)
  const shareUrl = shareInfo?.token
    ? `${window.location.origin}/share/scan/${shareInfo.token}`
    : null;

  const formatExpiry = (iso) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return null;
    }
  };

  const handleCreateShare = async () => {
    setShareLoading(true);
    try {
      const res = await createShareLink(id);
      setShareInfo(res.data);
    } catch {
      // noop — keep existing state
    } finally {
      setShareLoading(false);
    }
  };

  const handleExtendShare = async () => {
    setShareLoading(true);
    try {
      const res = await extendShareLink(id);
      setShareInfo(res.data);
    } catch {} finally { setShareLoading(false); }
  };

  const handleRevokeShare = async () => {
    const ok = await confirm({
      title: 'Revoke share link?',
      message: 'Anyone with the URL will lose access immediately. This cannot be undone.',
      confirmLabel: 'Revoke',
      danger: true,
    });
    if (!ok) return;
    setShareLoading(true);
    try {
      await revokeShareLink(id);
      setShareInfo({ token: null, expires_at: null });
    } catch {} finally { setShareLoading(false); }
  };

  const handleCopyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {}
  };

  const downloadPdf = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
      const token = localStorage.getItem('token') || '';
      // Use the business endpoint so we get the client monthly report (not the sales PDF).
      // scan.business_id is available after the scan loads — fall back to scan endpoint if missing.
      const bizId = scan?.business_id;
      const url_path = bizId
        ? `${API_URL}/businesses/${bizId}/report.pdf?token=${token}`
        : `${API_URL}/scans/${id}/report.pdf?token=${token}`;
      const res = await fetch(url_path);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
        alert(`Could not download report: ${err.detail || res.status}`);
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${(result?.name || 'report').replace(/\s+/g, '_')}_Monthly_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      alert('Download failed. Please check you are logged in and try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  const result = scan.result_json;
  const score = scan.ai_visibility_score;
  const businessId = scan.business_id;

  const scoreColour = score >= 60 ? 'var(--accent2)' : score >= 35 ? 'var(--orange)' : 'var(--red)';
  const scoreLabel = score >= 60 ? 'Strong' : score >= 35 ? 'Moderate' : 'Weak';

  // Correct field names from API
  const businessName = result?.name || 'Business';
  const chatgptChecks = result?.checks || [];
  const geminiChecks = result?.g_checks || [];
  const perplexityChecks = result?.p_checks || [];
  const allChecks = [
    ...chatgptChecks.map(c => ({ ...c, engine: 'chatgpt' })),
    ...geminiChecks.map(c => ({ ...c, engine: 'gemini' })),
    ...perplexityChecks.map(c => ({ ...c, engine: 'perplexity' })),
  ];

const perplexityMentions = perplexityChecks.filter(c => c.mentioned).length;
const perplexityTotal = perplexityChecks.length;

  const chatgptMentions = chatgptChecks.filter(c => c.mentioned).length;
  const geminiMentions = geminiChecks.filter(c => c.mentioned).length;
  const chatgptTotal = chatgptChecks.length;
  const geminiTotal = geminiChecks.length;

  const competitors = result?.competitors || [];
  const googleRating = result?.rating;
  const enginesRun = result?.engines_run || [];
  const enginesFailed = result?.engines_failed || [];

  // Build category breakdown from all checks
  const categoryMap = {};
  allChecks.forEach(c => {
    if (!categoryMap[c.category]) categoryMap[c.category] = { total: 0, mentioned: 0 };
    categoryMap[c.category].total++;
    if (c.mentioned) categoryMap[c.category].mentioned++;
  });

  const radarData = Object.entries(categoryMap).map(([cat, data]) => ({
    category: cat.replace(/_/g, ' '),
    score: Math.round((data.mentioned / data.total) * 100),
  }));

  const totalPrompts = chatgptChecks.length + geminiChecks.length + perplexityChecks.length;

  // Merge competitors with AI mention counts from visibility_map
  const visibilityMap = result?.visibility_map || [];
  const mentionsByName = Object.fromEntries(visibilityMap.map(v => [v.name, v.mentions]));

  // For the scanned business itself, use the check results directly — far more
  // accurate than text-matching its full name in AI responses, and works for
  // all existing stored scans without re-scanning.
  const ownMentions = chatgptMentions + geminiMentions + perplexityMentions;

  // Build recommendations from scan data (pure frontend logic, no API call)
  const recommendations = buildRecommendations(result, ownMentions, totalPrompts, categoryMap);

  const competitorsWithMentions = competitors.map(c => ({
    ...c,
    ai_mentions: c.name === businessName
      ? ownMentions
      : (mentionsByName[c.name] ?? 0),
  }));

  // Chart: AI mentions per competitor (sorted by mentions desc)
  const competitorChartData = [...competitorsWithMentions]
    .sort((a, b) => b.ai_mentions - a.ai_mentions)
    .slice(0, 8)
    .map(c => ({
      name: c.name?.length > 20 ? c.name.slice(0, 18) + '…' : c.name,
      fullName: c.name,
      ai_mentions: c.ai_mentions,
      rating: c.rating || 0,
    }));

  return (
    <div className={styles.layout}>
      {!publicMode && (
        <Sidebar extra={businessId ? [{ label: `↩ ${businessName}`, onClick: () => navigate(`/business/${businessId}`) }] : []} />
      )}

      <main className={styles.main} style={publicMode ? { marginLeft: 0, maxWidth: '100vw' } : undefined}>
        {publicMode && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 0 24px 0', marginBottom: '20px', borderBottom: '1px solid var(--border)',
          }}>
            <BrandLogo height={28} publicBrand={scan?.brand} />
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              AI Visibility Report
            </span>
          </div>
        )}
        <div className={styles.header + ' fade-up'}>
          <div>
            <h1 className={styles.businessName}>{businessName}</h1>
            <p className={styles.searchTerm}>"{result?.search_term}" · {result?.prompt_location}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            {!publicMode && (
              <button
                onClick={() => setShowShareModal(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', borderRadius: '999px', fontSize: '0.78rem',
                  background: 'transparent', color: 'var(--accent)', fontWeight: 600,
                  border: '1px solid rgba(56,189,248,0.35)', cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,189,248,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                ↗ Share
              </button>
            )}
            <div className={styles.scoreBadge} style={{ borderColor: scoreColour }}>
              <span className={styles.scoreNum} style={{ color: scoreColour }}>{score}</span>
              <span className={styles.scoreLabel} style={{ color: scoreColour }}>{scoreLabel}</span>
            </div>
            {(enginesRun.length > 0 || enginesFailed.length > 0) && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {enginesRun.map(e => (
                  <span key={e} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', background: 'rgba(56,189,248,0.1)', color: 'var(--accent)', border: '1px solid rgba(56,189,248,0.2)' }}>
                    ✓ {e.charAt(0).toUpperCase() + e.slice(1)}
                  </span>
                ))}
                {enginesFailed.map(f => (
                  <span key={f.engine} title={f.error} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'help' }}>
                    ✗ {f.engine.charAt(0).toUpperCase() + f.engine.slice(1)} failed
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Breadcrumb (private only) */}
        {!publicMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '20px' }}>
          <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0, fontSize: '0.78rem' }}>
            Dashboard
          </button>
          <span>›</span>
          {businessId ? (
            <button onClick={() => navigate(`/business/${businessId}`)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0, fontSize: '0.78rem' }}>
              {businessName}
            </button>
          ) : (
            <span>{businessName}</span>
          )}
          <span>›</span>
          <span style={{ color: 'var(--text)' }}>
            {new Date(scan.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        )}

        <div className={styles.tabs + ' fade-up-1'}>
          {['overview', 'prompts', 'competitors', 'reviews', 'sources', 'recommendations', 'report'].map(t => {
            const highCount = t === 'recommendations' ? recommendations.filter(r => r.priority === 'high').length : 0;
            return (
              <button
                key={t}
                className={styles.tab + (tab === t ? ' ' + styles.tabActive : '')}
                onClick={() => setTab(t)}
                style={{ position: 'relative' }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {highCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '4px', right: '4px',
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: 'var(--red)', display: 'block',
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div className={styles.tabContent + ' fade-up-2'}>
            <div className={styles.kpiRow}>
              <div className={styles.kpi}>
                <div className={styles.kpiValue} style={{ color: 'var(--accent)' }}>
                  {chatgptMentions}/{chatgptTotal}
                </div>
                <div className={styles.kpiLabel}>ChatGPT mentions</div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiValue} style={{ color: '#a78bfa' }}>
                  {geminiMentions}/{geminiTotal}
                </div>
                <div className={styles.kpiLabel}>Gemini mentions</div>
              </div>
              <div className={styles.kpi}>
              <div className={styles.kpiValue} style={{ color: '#34d399' }}>
                {perplexityMentions}/{perplexityTotal}
              </div>
              <div className={styles.kpiLabel}>Perplexity mentions</div>
            </div>
              <div className={styles.kpi}>
                <div className={styles.kpiValue} style={{ color: googleRating >= 4 ? 'var(--accent2)' : 'var(--orange)' }}>
                  {googleRating ? `${googleRating}★` : 'N/A'}
                </div>
                <div className={styles.kpiLabel}>Google rating</div>
              </div>
            </div>

            <div className={styles.chartsRow}>
              {radarData.length > 0 && (
                <div className={styles.chartCard}>
                  <h3 className={styles.chartTitle}>Score by category</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(56,189,248,0.1)" />
                      <PolarAngleAxis dataKey="category" tick={{ fill: '#5a7291', fontSize: 11 }} />
                      <Radar dataKey="score" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {competitors.length > 0 && (
                <div className={styles.chartCard}>
                  <h3 className={styles.chartTitle}>Competitor AI mentions</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={competitorChartData} layout="vertical" margin={{ left: 10, right: 40 }}>
                      <XAxis type="number" allowDecimals={false} tick={{ fill: '#5a7291', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#5a7291', fontSize: 10 }} width={130} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                        labelStyle={{ color: 'var(--text)' }}
                        formatter={(val, _, props) => [`${val} mentions · ${props.payload.rating}★`, props.payload.fullName]}
                      />
                      <Bar dataKey="ai_mentions" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="ai_mentions" position="right" style={{ fill: '#5a7291', fontSize: 10 }} />
                        {competitorChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fullName === businessName ? '#38bdf8' : '#1e3a5a'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Your rating</div>
                <div className={styles.statValue}>{result?.rating || 'N/A'}★ ({result?.reviews || 0} reviews)</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Area average rating</div>
                <div className={styles.statValue}>{result?.avg_rating || 'N/A'}★ ({result?.avg_reviews || 0} avg reviews)</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>ChatGPT visibility</div>
                <div className={styles.statValue}>{result?.chatgpt_percent ?? 0}%</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Gemini visibility</div>
                <div className={styles.statValue}>{result?.gemini_percent ?? 0}%</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Perplexity visibility</div>
                <div className={styles.statValue}>{result?.perplexity_percent ?? 0}%</div>
              </div>
              {(() => {
                const milestones = result?.milestone_data || [];
                const next = milestones.find(m => m.needed > 0);
                if (!next) return null;
                return (
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Reviews to reach {next.target}★</div>
                    <div className={styles.statValue} style={{ color: 'var(--accent)' }}>{next.needed} reviews needed</div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Prompts */}
        {tab === 'prompts' && (
          <div className={styles.tabContent + ' fade-up-2'}>
            <div className={styles.promptsFilter}>
              <span className={styles.promptsCount}>
                {chatgptChecks.length} ChatGPT · {geminiChecks.length} Gemini · {perplexityChecks.length} Perplexity prompts
              </span>
            </div>
            <div className={styles.promptsGrid}>
              {allChecks.map((r, i) => (
                <div
                  key={i}
                  className={styles.promptCard + (expandedPrompt === i ? ' ' + styles.promptExpanded : '')}
                  onClick={() => setExpandedPrompt(expandedPrompt === i ? null : i)}
                >
                  <div className={styles.promptHeader}>
                    <span className={styles.promptEngine} style={{ color: r.engine === 'gemini' ? '#a78bfa' : r.engine === 'perplexity' ? '#34d399' : 'var(--accent)' }}>
                      {r.engine === 'gemini' ? 'Gemini' : r.engine === 'perplexity' ? 'Perplexity' : 'ChatGPT'}
                    </span>
                    <span className={`${styles.promptBadge} ${r.mentioned ? styles.mentioned : styles.notMentioned}`}>
                      {r.mentioned ? '✓ Mentioned' : '✗ Not mentioned'}
                    </span>
                  </div>
                  <div className={styles.promptText}>{r.prompt}</div>
                  {r.category && <div className={styles.promptCategory}>{r.category.replace(/_/g, ' ').toUpperCase()}</div>}
                  {expandedPrompt === i && r.raw && (
                    <div className={styles.promptRaw}>{r.raw}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competitors */}
        {tab === 'competitors' && (
          <div className={styles.tabContent + ' fade-up-2'}>
            {/* AI mentions bar chart (already in overview, repeated here for context) */}
            {competitorChartData.length > 0 && (
              <div className={styles.chartCard} style={{ marginBottom: 24 }}>
                <h3 className={styles.chartTitle}>AI mention frequency</h3>
                <ResponsiveContainer width="100%" height={Math.max(180, competitorChartData.length * 36)}>
                  <BarChart data={competitorChartData} layout="vertical" margin={{ left: 10, right: 50 }}>
                    <XAxis type="number" allowDecimals={false} tick={{ fill: '#5a7291', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#5a7291', fontSize: 10 }} width={130} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                      formatter={(val, _, props) => [`${val} mention${val !== 1 ? 's' : ''} across ${chatgptChecks.length + geminiChecks.length + perplexityChecks.length} prompts`, props.payload.fullName]}
                    />
                    <Bar dataKey="ai_mentions" radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="ai_mentions" position="right" style={{ fill: '#5a7291', fontSize: 10 }} />
                      {competitorChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fullName === businessName ? '#38bdf8' : '#1e3a5a'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Info note */}
            <div style={{ background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: '0.78rem', color: 'var(--muted)' }}>
              ℹ Showing businesses found on Google Maps within 10km. AI may occasionally recommend businesses further afield that won't appear here.
            </div>

            {/* AI mentions ranked list */}
            {competitorsWithMentions.length === 0 ? (
              <div className={styles.empty}>No competitor data available.</div>
            ) : (
              <div className={styles.competitorsList}>
                {[...competitorsWithMentions]
                  .sort((a, b) => b.ai_mentions - a.ai_mentions)
                  .map((c, i) => {
                    const isYou = c.name === businessName;
                    const totalPrompts = chatgptChecks.length + geminiChecks.length + perplexityChecks.length;
                    const pct = totalPrompts > 0 ? Math.round((c.ai_mentions / totalPrompts) * 100) : 0;
                    return (
                      <div key={i} className={styles.competitorRow}
                        style={isYou ? { border: '1px solid rgba(56,189,248,0.3)', borderRadius: 8 } : {}}>
                        <div className={styles.compRank} style={{ color: isYou ? 'var(--accent)' : undefined }}>
                          #{i + 1}
                        </div>
                        <div className={styles.compInfo} style={{ flex: 1 }}>
                          <div className={styles.compName}>
                            {c.name}
                            {isYou && <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600 }}>YOU</span>}
                          </div>
                          {/* Mention bar */}
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: isYou ? '#38bdf8' : '#1e3a5a', borderRadius: 2, transition: 'width 0.4s' }} />
                            </div>
                            <span style={{ fontSize: '0.72rem', color: isYou ? 'var(--accent)' : c.ai_mentions > 0 ? 'var(--text)' : 'var(--muted)', whiteSpace: 'nowrap', minWidth: 60 }}>
                              {c.ai_mentions} / {totalPrompts} prompts
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Reviews */}
        {tab === 'reviews' && (
          <div className={styles.tabContent + ' fade-up-2'}>
            {/* Hero KPIs */}
            <div className={styles.kpiRow} style={{ marginBottom: '24px' }}>
              <div className={styles.kpi}>
                <div className={styles.kpiValue} style={{ color: result?.rating >= (result?.avg_rating || 0) ? 'var(--accent2)' : 'var(--orange)' }}>
                  {result?.rating ?? 'N/A'}★
                </div>
                <div className={styles.kpiLabel}>Your rating</div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiValue} style={{ color: 'var(--muted)' }}>
                  {result?.avg_rating ?? 'N/A'}★
                </div>
                <div className={styles.kpiLabel}>Area average</div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiValue} style={{ color: 'var(--text)' }}>
                  {(result?.reviews ?? 0).toLocaleString()}
                </div>
                <div className={styles.kpiLabel}>Your reviews</div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiValue} style={{ color: 'var(--muted)' }}>
                  {(result?.avg_reviews ?? 0).toLocaleString()}
                </div>
                <div className={styles.kpiLabel}>Area avg reviews</div>
              </div>
            </div>

            {/* Rating insight */}
            {(() => {
              const r = result?.rating;
              if (!r) return null;
              let insight, target;
              if (r < 4.0)      { target = '4.0'; insight = `Reaching ${target}★ would move you into the range AI engines prioritise for local recommendations.`; }
              else if (r < 4.5) { target = '4.5'; insight = `Reaching ${target}★ would significantly improve your AI visibility across all three engines.`; }
              else if (r < 4.7) { target = '4.7'; insight = `Reaching ${target}★ would place you in the top tier for AI recommendations in your area.`; }
              else              { target = null;   insight = `Your rating of ${r}★ is excellent. Increasing your review count will further strengthen AI visibility.`; }
              return (
                <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 10, padding: '14px 18px', marginBottom: '24px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
                    <strong>Your Google rating is currently {r}★.</strong> {insight}
                  </span>
                </div>
              );
            })()}

            {/* Review milestones — always shown, compute extras on the frontend */}
            {(() => {
              const rating = result?.rating;
              const reviews = result?.reviews;
              const baseMilestones = result?.milestone_data || [];

              // Compute 4.7★ milestone on the frontend (not in stored scan data)
              const reviewsFor47 = (() => {
                if (!rating || !reviews || rating >= 4.7) return 0;
                const target = 4.7;
                const denom = 5 - target;
                return Math.max(Math.ceil(((target * reviews) - (rating * reviews)) / denom), 0);
              })();

              const allMilestones = [
                ...baseMilestones,
                { target: 4.7, needed: reviewsFor47 },
              ];

              if (!rating) return null;
              return (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '0.75rem', letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Review milestones
                  </h3>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {allMilestones.map((m, i) => (
                      <div key={i} style={{
                        flex: '1', minWidth: '130px', background: 'var(--bg-card)',
                        border: m.needed === 0 ? '1px solid rgba(110,231,183,0.3)' : '1px solid var(--border)',
                        borderRadius: 10, padding: '14px 16px',
                      }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: m.needed === 0 ? 'var(--accent2)' : 'var(--accent)' }}>
                          {m.needed === 0 ? '✓' : m.needed}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: m.needed === 0 ? 'var(--accent2)' : 'var(--text)', fontWeight: 600, marginTop: 2 }}>
                          {m.target}★
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px' }}>
                          {m.needed === 0 ? 'Achieved' : `5★ reviews needed`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Competitor ratings chart */}
            {competitors.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '0.75rem', letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Competitor ratings comparison
                </h3>
                <div className={styles.chartCard} style={{ padding: '16px 0' }}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={[...competitorsWithMentions].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 8).map(c => ({
                        name: c.name?.length > 22 ? c.name.slice(0, 20) + '…' : c.name,
                        fullName: c.name,
                        rating: c.rating || 0,
                        reviews: c.reviews || 0,
                      }))}
                      layout="vertical"
                      margin={{ left: 10, right: 50 }}
                    >
                      <XAxis type="number" domain={[0, 5]} tick={{ fill: '#5a7291', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#5a7291', fontSize: 10 }} width={140} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                        formatter={(val, _, props) => [`${val}★ (${props.payload.reviews} reviews)`, props.payload.fullName]}
                      />
                      <Bar dataKey="rating" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="rating" position="right" formatter={v => `${v}★`} style={{ fill: '#5a7291', fontSize: 10 }} />
                        {[...competitorsWithMentions].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 8).map((entry, i) => (
                          <Cell key={i} fill={entry.name === businessName ? '#38bdf8' : entry.rating >= 4.3 ? '#2d8a4e' : entry.rating >= 3.8 ? '#ba7517' : '#c8102e'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Sources */}
        {tab === 'sources' && (
          <div className={styles.tabContent + ' fade-up-2'}>
            {(!result?.top_sources || result.top_sources.length === 0) ? (
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '24px 28px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '12px', opacity: 0.4 }}>🔗</div>
                <h3 style={{ fontSize: '1rem', color: 'var(--text)', marginBottom: '8px' }}>
                  Source data not available for this scan
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
                  Run a new scan to capture which websites AI engines cite when recommending businesses for "{result?.search_term}". This data wasn't recorded for older scans.
                </p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.88rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '20px' }}>
                  AI engines cited <strong style={{ color: 'var(--text)' }}>{result.top_sources.length}</strong> distinct sources
                  when responding to your {totalPrompts} prompts. These are the websites AI looks
                  to when forming recommendations in your space — invest where the citations are densest.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(() => {
                    const maxCount = Math.max(...result.top_sources.map(s => s.count));
                    return result.top_sources.map((s, i) => {
                      const widthPct = Math.round((s.count / maxCount) * 100);
                      return (
                        <div key={s.domain} style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          padding: '14px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                        }}>
                          {/* Rank */}
                          <span style={{
                            fontSize: '0.75rem', color: 'var(--muted)',
                            fontFamily: 'DM Mono, monospace', minWidth: 24,
                          }}>
                            #{i + 1}
                          </span>

                          {/* Favicon */}
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=32`}
                            alt=""
                            style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 3 }}
                            onError={e => { e.target.style.visibility = 'hidden'; }}
                          />

                          {/* Domain + bar */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                              <a
                                href={`https://${s.domain}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  fontSize: '0.88rem', color: 'var(--text)', fontWeight: 600,
                                  textDecoration: 'none',
                                }}
                                onMouseEnter={e => { e.target.style.color = 'var(--accent)'; }}
                                onMouseLeave={e => { e.target.style.color = 'var(--text)'; }}
                              >
                                {s.domain} ↗
                              </a>
                              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                {s.count}× cited
                              </span>
                            </div>
                            <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{
                                width: `${widthPct}%`, height: '100%',
                                background: '#38bdf8', borderRadius: 2,
                                transition: 'width 0.4s',
                              }} />
                            </div>
                          </div>

                          {/* Engine pills */}
                          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                            {s.engines.map(e => {
                              const colour =
                                e === 'gemini'     ? '#a78bfa' :
                                e === 'perplexity' ? '#34d399' :
                                                     'var(--accent)';
                              const bg =
                                e === 'gemini'     ? 'rgba(167,139,250,0.1)' :
                                e === 'perplexity' ? 'rgba(52,211,153,0.1)'  :
                                                     'rgba(56,189,248,0.1)';
                              return (
                                <span key={e} title={`Cited by ${e}`} style={{
                                  fontSize: '0.65rem', padding: '2px 7px',
                                  borderRadius: '999px', color: colour,
                                  background: bg, border: `1px solid ${colour}33`,
                                  fontWeight: 600, letterSpacing: '0.04em',
                                  textTransform: 'capitalize',
                                }}>
                                  {e === 'chatgpt' ? 'GPT' : e === 'gemini' ? 'Gem' : 'Plx'}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                <div style={{
                  background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.1)',
                  borderRadius: 8, padding: '12px 16px', marginTop: 20,
                  fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5,
                }}>
                  ℹ Citations come directly from AI engines when they used web search. Perplexity cites every response; ChatGPT and Gemini cite only when they performed live web searches.
                </div>
              </>
            )}
          </div>
        )}

        {/* Recommendations */}
        {tab === 'recommendations' && (
          <div className={styles.tabContent + ' fade-up-2'}>
            {/* Summary line */}
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                {recommendations.length === 0
                  ? '✓ All key signals look healthy. Keep collecting reviews and run monthly scans to maintain visibility.'
                  : <>
                      <span style={{ color: 'var(--red)', fontWeight: 600 }}>
                        {recommendations.filter(r => r.priority === 'high').length} high
                      </span>
                      {' · '}
                      <span style={{ color: 'var(--orange)', fontWeight: 600 }}>
                        {recommendations.filter(r => r.priority === 'medium').length} medium
                      </span>
                      {' · '}
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        {recommendations.filter(r => r.priority === 'low').length} low
                      </span>
                      {' '}priority actions identified. Tackle high-priority items first for the biggest score improvement.
                    </>
                }
              </p>
            </div>

            {recommendations.length === 0 ? (
              <div style={{
                background: 'rgba(110,231,183,0.06)', border: '1px solid rgba(110,231,183,0.2)',
                borderRadius: 10, padding: '20px 24px', color: 'var(--accent2)', fontSize: '0.88rem', lineHeight: 1.6,
              }}>
                <strong>Looking good!</strong> No critical issues found. Keep your review strategy active and run scans monthly to stay ahead of competitors.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recommendations.map((rec, i) => {
                  const borderColor = rec.priority === 'high' ? 'var(--red)' : rec.priority === 'medium' ? 'var(--orange)' : 'var(--accent)';
                  const badgeBg    = rec.priority === 'high' ? 'rgba(248,113,113,0.12)' : rec.priority === 'medium' ? 'rgba(251,146,60,0.12)' : 'rgba(56,189,248,0.08)';
                  const badgeBorder= rec.priority === 'high' ? 'rgba(248,113,113,0.35)' : rec.priority === 'medium' ? 'rgba(251,146,60,0.35)' : 'rgba(56,189,248,0.25)';
                  const badgeColor = rec.priority === 'high' ? 'var(--red)' : rec.priority === 'medium' ? 'var(--orange)' : 'var(--accent)';
                  return (
                    <div key={i} style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderLeft: `3px solid ${borderColor}`,
                      borderRadius: 10,
                      padding: '16px 20px',
                      display: 'flex',
                      gap: '14px',
                      alignItems: 'flex-start',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>{rec.title}</span>
                          <span style={{
                            fontSize: '0.62rem', padding: '2px 7px', borderRadius: '999px', fontWeight: 700,
                            letterSpacing: '0.07em', textTransform: 'uppercase',
                            background: badgeBg, color: badgeColor, border: `1px solid ${badgeBorder}`,
                            flexShrink: 0,
                          }}>
                            {rec.priority}
                          </span>
                          <span style={{
                            fontSize: '0.68rem', color: 'var(--muted)', padding: '2px 8px',
                            border: '1px solid var(--border)', borderRadius: '999px', marginLeft: 'auto', flexShrink: 0,
                          }}>
                            {rec.category}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>{rec.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Report */}

        {tab === 'report' && (
          <div className={styles.tabContent + ' fade-up-2'}>
            {!publicMode && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <button
                  onClick={downloadPdf}
                  disabled={pdfLoading}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem',
                    background: 'var(--accent)', color: '#000', fontWeight: 600,
                    border: 'none', cursor: pdfLoading ? 'not-allowed' : 'pointer',
                    opacity: pdfLoading ? 0.6 : 1,
                  }}
                >
                  {pdfLoading ? 'Generating…' : '↓ Download PDF report'}
                </button>
              </div>
            )}
            <div className={styles.reportCard}>
              {(result?.report || result?.ai_report || '')
                .replace(/\*{1,3}/g, '')
                .split('\n')
                .filter(line => line.trim())
                .map((line, i) => (
                  <p key={i} className={styles.reportText} style={{ marginBottom: '10px' }}>
                    {line.trim()}
                  </p>
                ))
              }
              {!result?.report && !result?.ai_report && (
                <p className={styles.reportText} style={{ opacity: 0.5 }}>No report generated.</p>
              )}
            </div>
          </div>
        )}

        {publicMode && (
          <footer style={{
            marginTop: 48, padding: '20px 0 8px',
            textAlign: 'center', borderTop: '1px solid var(--border)',
            fontSize: '0.72rem', color: 'var(--muted)', letterSpacing: '0.04em',
          }}>
            {scan?.brand?.share_footer
              ? scan.brand.share_footer
              : (
                <>
                  Powered by{' '}
                  <a
                    href={scan?.brand?.cta_url || 'https://redrockrep.com'}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--muted)', textDecoration: 'none', fontWeight: 600 }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; }}
                  >
                    {scan?.brand?.brand_name || 'RedRock Rep'}
                  </a>
                </>
              )
            }
          </footer>
        )}
      </main>

      {/* Share modal — owner only */}
      {showShareModal && !publicMode && (
        <div
          onClick={() => setShowShareModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px', backdropFilter: 'blur(2px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '24px 28px', width: '100%', maxWidth: 520,
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '1.05rem', color: 'var(--text)', margin: 0, marginBottom: '4px' }}>
                  Share this scan
                </h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                  Anyone with the link can view this report — no sign-in required.
                </p>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                style={{
                  background: 'none', border: 'none', color: 'var(--muted)',
                  fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1, padding: 0,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {shareInfo?.token ? (
              <>
                {/* Active share link */}
                <div style={{
                  background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)',
                  borderRadius: 8, padding: '10px 12px', marginBottom: '14px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <input
                    readOnly
                    value={shareUrl || ''}
                    onFocus={e => e.target.select()}
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      color: 'var(--text)', fontSize: '0.8rem', fontFamily: 'DM Mono, monospace',
                      minWidth: 0,
                    }}
                  />
                  <button
                    onClick={handleCopyShare}
                    style={{
                      padding: '6px 12px', borderRadius: 6, fontSize: '0.75rem',
                      background: shareCopied ? 'var(--accent2)' : 'var(--accent)',
                      color: '#000', border: 'none', cursor: 'pointer', fontWeight: 600,
                      whiteSpace: 'nowrap', transition: 'background 0.2s',
                    }}
                  >
                    {shareCopied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '18px', lineHeight: 1.5 }}>
                  {shareInfo.expires_at
                    ? <>Expires <strong style={{ color: 'var(--text)' }}>{formatExpiry(shareInfo.expires_at)}</strong></>
                    : 'No expiry set.'}
                </p>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleExtendShare}
                    disabled={shareLoading}
                    style={{
                      padding: '8px 14px', borderRadius: 8, fontSize: '0.8rem',
                      background: 'transparent', color: 'var(--accent)', fontWeight: 600,
                      border: '1px solid rgba(56,189,248,0.35)',
                      cursor: shareLoading ? 'wait' : 'pointer', opacity: shareLoading ? 0.5 : 1,
                    }}
                  >
                    Extend +30 days
                  </button>
                  <button
                    onClick={handleCreateShare}
                    disabled={shareLoading}
                    title="Rotate — generates a new link and invalidates the current one"
                    style={{
                      padding: '8px 14px', borderRadius: 8, fontSize: '0.8rem',
                      background: 'transparent', color: 'var(--muted)', fontWeight: 600,
                      border: '1px solid var(--border)',
                      cursor: shareLoading ? 'wait' : 'pointer', opacity: shareLoading ? 0.5 : 1,
                    }}
                  >
                    Rotate link
                  </button>
                  <button
                    onClick={handleRevokeShare}
                    disabled={shareLoading}
                    style={{
                      padding: '8px 14px', borderRadius: 8, fontSize: '0.8rem',
                      background: 'transparent', color: 'var(--red)', fontWeight: 600,
                      border: '1px solid rgba(239,68,68,0.35)',
                      cursor: shareLoading ? 'wait' : 'pointer', opacity: shareLoading ? 0.5 : 1,
                      marginLeft: 'auto',
                    }}
                  >
                    Revoke
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* No active link */}
                <div style={{
                  background: 'var(--bg)', border: '1px dashed var(--border)',
                  borderRadius: 8, padding: '20px', textAlign: 'center', marginBottom: '16px',
                }}>
                  <div style={{ fontSize: '1.6rem', marginBottom: '8px', opacity: 0.4 }}>🔗</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                    No share link exists yet. Create one to send this scan to prospects or clients.
                  </p>
                </div>
                <button
                  onClick={handleCreateShare}
                  disabled={shareLoading}
                  style={{
                    width: '100%', padding: '10px 16px', borderRadius: 8, fontSize: '0.88rem',
                    background: 'var(--accent)', color: '#000', fontWeight: 600,
                    border: 'none', cursor: shareLoading ? 'wait' : 'pointer',
                    opacity: shareLoading ? 0.6 : 1,
                  }}
                >
                  {shareLoading ? 'Creating…' : 'Create share link'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
