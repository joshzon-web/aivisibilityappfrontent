import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getScan } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import styles from './ScanResult.module.css';

export default function ScanResult() {
  const { id } = useParams();
  const { logoutUser, user } = useAuth();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    getScan(id)
      .then((res) => setScan(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className={styles.loadingPage}>
      <div className={styles.spinner} />
      <span>Loading scan results...</span>
    </div>
  );

  if (!scan) return <div className={styles.loadingPage}>Scan not found.</div>;

  const result = scan.result_json;
  const score = scan.ai_visibility_score;

  const scoreColour = score >= 60 ? 'var(--accent2)' : score >= 35 ? 'var(--orange)' : 'var(--red)';
  const scoreLabel = score >= 60 ? 'Strong' : score >= 35 ? 'Moderate' : 'Weak';

  // The checks array contains all prompts for both engines
  const checks = result?.checks || [];
  const chatgptChecks = checks.filter(c => !c.engine || c.engine === 'chatgpt');
  const geminiChecks = checks.filter(c => c.engine === 'gemini');

  // If no engine field, split by index (first half chatgpt, second half gemini)
  const half = Math.floor(checks.length / 2);
  const chatgptResults = chatgptChecks.length > 0 ? chatgptChecks : checks.slice(0, half);
  const geminiResults = geminiChecks.length > 0 ? geminiChecks : checks.slice(half);

  const chatgptMentions = chatgptResults.filter(r => r.mentioned || r.business_mentioned).length;
  const geminiMentions = geminiResults.filter(r => r.mentioned || r.business_mentioned).length;
  const totalPerEngine = chatgptResults.length;

  const competitors = result?.competitors || [];
  const googleRating = result?.rating || result?.business?.rating;

  // Build radar data from scoring if available
  const categoryScores = result?.scoring?.category_scores || {};
  const radarData = Object.entries(categoryScores).map(([key, val]) => ({
    category: key.replace(/_/g, ' '),
    score: Math.round(val),
  }));

  // Build category breakdown from checks
  const categoryMap = {};
  checks.forEach(c => {
    if (!categoryMap[c.category]) categoryMap[c.category] = { total: 0, mentioned: 0 };
    categoryMap[c.category].total++;
    if (c.mentioned || c.business_mentioned) categoryMap[c.category].mentioned++;
  });

  const categoryData = Object.entries(categoryMap).map(([cat, data]) => ({
    category: cat.replace(/_/g, ' '),
    score: Math.round((data.mentioned / data.total) * 100),
  }));

  const radarFinal = radarData.length > 0 ? radarData : categoryData;

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.logo} onClick={() => navigate('/dashboard')} style={{cursor:'pointer'}}>
          <span className={styles.logoMark}>◈</span>
          <span className={styles.logoText}>AI VISIBILITY</span>
        </div>
        <nav className={styles.nav}>
          <button className={styles.navItem} onClick={() => navigate('/dashboard')}>← Dashboard</button>
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.userDot} />
            <span>{user?.email}</span>
          </div>
          <button className={styles.logoutBtn} onClick={logoutUser}>Sign out</button>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.header + ' fade-up'}>
          <div>
            <h1 className={styles.businessName}>{scan.business_name}</h1>
            <p className={styles.searchTerm}>"{scan.search_term}" · {scan.location}</p>
          </div>
          <div className={styles.scoreBadge} style={{ borderColor: scoreColour }}>
            <span className={styles.scoreNum} style={{ color: scoreColour }}>{score}</span>
            <span className={styles.scoreLabel} style={{ color: scoreColour }}>{scoreLabel}</span>
          </div>
        </div>

        <div className={styles.tabs + ' fade-up-1'}>
          {['overview', 'prompts', 'competitors', 'report'].map(t => (
            <button
              key={t}
              className={styles.tab + (tab === t ? ' ' + styles.tabActive : '')}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div className={styles.tabContent + ' fade-up-2'}>
            <div className={styles.kpiRow}>
              <div className={styles.kpi}>
                <div className={styles.kpiValue} style={{ color: 'var(--accent)' }}>
                  {chatgptMentions}/{totalPerEngine || checks.length}
                </div>
                <div className={styles.kpiLabel}>ChatGPT mentions</div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiValue} style={{ color: '#a78bfa' }}>
                  {geminiMentions}/{totalPerEngine || checks.length}
                </div>
                <div className={styles.kpiLabel}>Gemini mentions</div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiValue} style={{ color: 'var(--orange)' }}>
                  {competitors.length}
                </div>
                <div className={styles.kpiLabel}>Competitors found</div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiValue} style={{ color: googleRating >= 4 ? 'var(--accent2)' : 'var(--orange)' }}>
                  {googleRating ? `${googleRating}★` : 'N/A'}
                </div>
                <div className={styles.kpiLabel}>Google rating</div>
              </div>
            </div>

            <div className={styles.chartsRow}>
              {radarFinal.length > 0 && (
                <div className={styles.chartCard}>
                  <h3 className={styles.chartTitle}>Score by category</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={radarFinal}>
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
                    <BarChart data={competitors.slice(0, 6)} layout="vertical" margin={{ left: 10 }}>
                      <XAxis type="number" tick={{ fill: '#5a7291', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#5a7291', fontSize: 11 }} width={120} />
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} labelStyle={{ color: 'var(--text)' }} />
                      <Bar dataKey="ai_mention_count" radius={[0, 4, 4, 0]}>
                        {competitors.slice(0, 6).map((_, i) => (
                          <Cell key={i} fill={i === 0 ? '#38bdf8' : '#1e3a5a'} />
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
                <div className={styles.statValue}>{result?.chatgpt_percent || 0}%</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Gemini visibility</div>
                <div className={styles.statValue}>{result?.gemini_percent || 0}%</div>
              </div>
            </div>
          </div>
        )}

        {/* Prompts */}
        {tab === 'prompts' && (
          <div className={styles.tabContent + ' fade-up-2'}>
            <div className={styles.promptsGrid}>
              {checks.map((r, i) => (
                <div key={i} className={styles.promptCard}>
                  <div className={styles.promptHeader}>
                    <span className={styles.promptEngine} style={{ color: r.engine === 'gemini' ? '#a78bfa' : 'var(--accent)' }}>
                      {r.engine === 'gemini' ? 'Gemini' : 'ChatGPT'}
                    </span>
                    <span className={`${styles.promptBadge} ${(r.mentioned || r.business_mentioned) ? styles.mentioned : styles.notMentioned}`}>
                      {(r.mentioned || r.business_mentioned) ? '✓ Mentioned' : '✗ Not mentioned'}
                    </span>
                  </div>
                  <div className={styles.promptText}>{r.prompt}</div>
                  {r.category && <div className={styles.promptCategory}>{r.category.replace(/_/g, ' ')}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competitors */}
        {tab === 'competitors' && (
          <div className={styles.tabContent + ' fade-up-2'}>
            {competitors.length === 0 ? (
              <div className={styles.empty}>No competitor data available.</div>
            ) : (
              <div className={styles.competitorsList}>
                {competitors.map((c, i) => (
                  <div key={i} className={styles.competitorRow}>
                    <div className={styles.compRank}>#{i + 1}</div>
                    <div className={styles.compInfo}>
                      <div className={styles.compName}>{c.name}</div>
                      <div className={styles.compAddress}>{c.address}</div>
                    </div>
                    <div className={styles.compStats}>
                      <div className={styles.compStat}>
                        <span style={{ color: 'var(--accent)' }}>{c.ai_mention_count || 0}</span>
                        <span className={styles.compStatLabel}>AI mentions</span>
                      </div>
                      <div className={styles.compStat}>
                        <span style={{ color: 'var(--orange)' }}>{c.rating || 'N/A'}★</span>
                        <span className={styles.compStatLabel}>Rating</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Report */}
        {tab === 'report' && (
          <div className={styles.tabContent + ' fade-up-2'}>
            <div className={styles.reportCard}>
              <pre className={styles.reportText}>{result?.ai_report || result?.report || 'No report generated.'}</pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
