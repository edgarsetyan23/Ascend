import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { listPublicEntries } from '../lib/publicApi.js'
import { useTheme } from '../hooks/useTheme.js'
import { ThemeToggle } from './ThemeToggle.jsx'
import { LeetCodeProfile } from './LeetCodeProfile.jsx'
import { ActivityLog } from './ActivityLog.jsx'
import activityTracker from '../trackers/activity.js'
import {
  ScoreCircle,
  CatBar,
  DropZone,
  scoreResume,
  extractTextFromPdf,
} from './ResumeReview.jsx'
import '../styles/spec-view.css'

// ── Resume data ─────────────────────────────────────────────────────────────
// Every entry below is rendered as a documented "endpoint" — method, path,
// status code, and a JSON response body built from the same facts that are
// on the PDF resume. Nothing here is decorative; the status codes reflect
// what actually happened (200 = completed as scoped, 201 = built from
// scratch, 202 = in progress, 400 = couldn't complete).

const EXPERIENCE = [
  {
    id: 'aws',
    path: '/experience/aws',
    status: '200',
    statusText: 'OK',
    data: {
      company: 'Amazon Web Services (AWS)',
      role: 'Software Development Engineer I, RDS Team',
      location: 'Toronto, ON',
      period: 'Jan 2025 – Jan 2026',
      highlights: [
        'Built a load-testing framework for a distributed telemetry service, generating sustained 10,000+ TPS and monitoring ECS task health and CPU utilization to validate capacity and surface bottlenecks pre-launch.',
        'Developed a synchronous instance configuration API end-to-end, persisting state in DynamoDB and instrumenting metrics/alarms in CloudWatch to manage RDS infrastructure.',
        'Supported on-call for a metrics ingestion service; triaged and resolved 25+ production incidents, executed mitigations via runbooks, and delivered follow-up fixes to prevent recurrence.',
        'Remediated stale CloudFormation deployments across 60+ AWS accounts by auditing stacks, removing failed/obsolete resources, and safely re-deploying to restore consistent infrastructure.',
        'Refactored CloudWatch dashboards to stay within service limits and automated KPI extraction for Monthly Business Reviews, reducing manual reporting overhead.',
      ],
    },
  },
  {
    id: 'tangerine-2021',
    path: '/experience/tangerine/2021',
    status: '200',
    statusText: 'OK',
    data: {
      company: 'Tangerine Bank',
      role: 'Software Developer Intern',
      location: 'Toronto, ON',
      period: 'Apr 2021 – Aug 2021',
      highlights: [
        'Developed scalable Java components in a high-traffic web application, improving performance and reliability.',
        'Improved performance by refactoring SQL queries and optimizing indexing, reducing query latency and improving page-load responsiveness.',
        'Reduced deployment errors by 20% by optimizing Docker configurations and supporting Kubernetes operations, improving rollout stability.',
      ],
    },
  },
  {
    id: 'tangerine-2020',
    path: '/experience/tangerine/2020',
    status: '200',
    statusText: 'OK',
    data: {
      company: 'Tangerine Bank',
      role: 'Software Developer Intern',
      location: 'Toronto, ON',
      period: 'Apr 2020 – Aug 2020',
      highlights: [
        'Built features for a high-performance Java web application using efficient algorithms and design patterns to improve scalability and user experience.',
        'Reduced build errors by 50% by automating build tasks with Maven, improving CI reliability and developer velocity.',
      ],
    },
  },
]

const PROJECTS = [
  {
    id: 'ascend',
    path: '/projects/ascend',
    status: '201',
    statusText: 'Created',
    data: {
      name: 'Ascend — Accountability Tracker',
      stack: 'React 18, Vite, AWS Lambda, DynamoDB, API Gateway, Cognito, CDK, Node 22, Vercel',
      highlights: [
        'Built a full-stack personal productivity tracker with multiple tracker types (LeetCode, Daily Activity, Job Applications, Gaming).',
        'Architected a serverless backend with AWS CDK: HTTP API Gateway, JWT authorizer, 4 Lambda functions, and DynamoDB single-table design.',
        'Implemented this page (/portfolio) itself via a hardcoded-owner Lambda whitelist — no auth required, read-only, tracker whitelist enforced server-side.',
        'Built a Gmail email scanner using a new-tab redirect OAuth flow to avoid Cross-Origin-Opener-Policy restrictions; fetches only email metadata, pipes it through Claude Haiku for extraction, deduplicates against existing entries, and shows a review modal for bulk import.',
        'Built a LeetCode profile banner: a Vercel serverless proxy to the LeetCode GraphQL API with a 5-minute CDN cache, displaying live solved counts, difficulty breakdown, and language stats.',
      ],
    },
    snippet: {
      file: 'src/hooks/useEntries.js',
      code: `// Optimistic update strategy:
//   1. Apply the change to local state immediately (instant UI feedback)
//   2. Fire the API call in the background
//   3. On success: replace the optimistic record with the server's response
//   4. On failure: roll back to the previous state and surface the error
export function useEntries(trackerId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // ...`,
    },
  },
  {
    id: 'oncall',
    path: '/projects/oncall-assistant',
    status: '201',
    statusText: 'Created',
    data: {
      name: 'On-Call Debugging Assistant',
      stack: 'AWS Lambda, Internal Web App — 1st place, AWS RDS Toronto Hackathon',
      highlights: [
        'Built an internal web tool where engineers paste a ticket link/ID to launch guided Q&A troubleshooting flows backed by 3 diagnostic playbooks, outputting actionable next-step debugging checks and mitigations.',
        'Won 1st place in a 3-day AWS RDS Toronto team hackathon for improving overnight incident triage speed and consistency.',
      ],
    },
  },
]

const EDUCATION = {
  id: 'york',
  path: '/education/york',
  status: '200',
  statusText: 'OK',
  data: {
    school: 'York University',
    degree: 'Bachelor of Science Honours in Computer Science',
    location: 'Toronto, ON',
    grad: 'Class of 2024',
  },
}

const SKILLS = {
  Languages:      ['Java', 'Kotlin', 'SQL', 'Python', 'JavaScript'],
  Backend:        ['REST APIs', 'Distributed Systems', 'Spring Boot'],
  Cloud:          ['AWS RDS', 'DynamoDB', 'CloudFormation', 'CloudWatch', 'Lambda', 'ECS'],
  Infrastructure: ['Docker', 'Kubernetes', 'Linux/Unix', 'CI/CD'],
}

// ── Sidebar nav structure ────────────────────────────────────────────────────

const NAV_GROUPS = [
  { label: 'Overview', items: [{ id: 'root', method: 'GET', path: '/' }] },
  {
    label: 'Experience',
    items: EXPERIENCE.map((e) => ({ id: e.id, method: 'GET', path: e.path })),
  },
  {
    label: 'Projects',
    items: PROJECTS.map((p) => ({ id: p.id, method: 'GET', path: p.path })),
  },
  { label: 'Education', items: [{ id: 'york', method: 'GET', path: EDUCATION.path }] },
  { label: 'Skills', items: [{ id: 'skills', method: 'GET', path: '/skills' }] },
  {
    label: 'Live',
    items: [
      { id: 'leetcode', method: 'GET', path: '/live/leetcode' },
      { id: 'activity', method: 'GET', path: '/live/activity' },
      { id: 'analyzer', method: 'POST', path: '/analyzer/score' },
    ],
  },
]

// Every path above is real: the URL is /portfolio + item.path (root '/' means
// just /portfolio). Reverse-map path → nav id so the current URL is the only
// source of truth for which entry is showing — no separate "selected" state
// to fall out of sync with the address bar, refresh, or back/forward.
const PATH_TO_ID = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items).map((item) => [item.path, item.id])
)

function sectionIdFromPathname(pathname) {
  let sub = pathname.replace(/^\/portfolio/, '') || '/'
  if (sub !== '/' && sub.endsWith('/')) sub = sub.slice(0, -1)
  return PATH_TO_ID[sub] ?? 'root'
}

// ── Small building blocks ────────────────────────────────────────────────────

function MethodBadge({ method }) {
  return <span className={`spec-method spec-method--${method.toLowerCase()}`}>{method}</span>
}

function StatusChip({ code, text }) {
  const tier = code[0] // '2', '4', etc.
  return (
    <span className={`spec-status spec-status--${tier}xx`}>
      {code} {text}
    </span>
  )
}

function JsonBlock({ data }) {
  const entries = Object.entries(data)
  return (
    <pre className="spec-json">
      <code>
        <span className="spec-json-punct">{'{'}</span>
        {'\n'}
        {entries.map(([key, value], i) => {
          const isLast = i === entries.length - 1
          if (Array.isArray(value)) {
            return (
              <span key={key}>
                <span className="spec-json-indent">  </span>
                <span className="spec-json-key">"{key}"</span>
                <span className="spec-json-punct">: [</span>
                {'\n'}
                {value.map((item, j) => (
                  <span key={j}>
                    <span className="spec-json-indent">    </span>
                    <span className="spec-json-string">"{item}"</span>
                    <span className="spec-json-punct">{j < value.length - 1 ? ',' : ''}</span>
                    {'\n'}
                  </span>
                ))}
                <span className="spec-json-indent">  </span>
                <span className="spec-json-punct">]{isLast ? '' : ','}</span>
                {'\n'}
              </span>
            )
          }
          return (
            <span key={key}>
              <span className="spec-json-indent">  </span>
              <span className="spec-json-key">"{key}"</span>
              <span className="spec-json-punct">: </span>
              <span className="spec-json-string">"{value}"</span>
              <span className="spec-json-punct">{isLast ? '' : ','}</span>
              {'\n'}
            </span>
          )
        })}
        <span className="spec-json-punct">{'}'}</span>
      </code>
    </pre>
  )
}

const DIFFICULTY_BADGE = {
  Easy:   { bg: '#d1fae5', color: '#065f46' },
  Medium: { bg: '#fef3c7', color: '#92400e' },
  Hard:   { bg: '#fee2e2', color: '#991b1b' },
}
const STATUS_BADGE = {
  Solved:    { bg: '#d1fae5', color: '#065f46' },
  Attempted: { bg: '#fef3c7', color: '#92400e' },
  Revisit:   { bg: '#ede9fe', color: '#5b21b6' },
}

function LeetcodeTable({ entries }) {
  if (!entries.length) return null
  return (
    <div className="spec-table-wrap">
      <table className="spec-table">
        <thead>
          <tr>
            {['Problem', 'Difficulty', 'Category', 'Status', 'Date'].map((h) => (
              <th key={h} className="spec-th">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const diff = DIFFICULTY_BADGE[e.difficulty]
            const stat = STATUS_BADGE[e.status]
            return (
              <tr key={e.id ?? i} className="spec-tr">
                <td className="spec-td spec-td--bold">{e.problem ?? '—'}</td>
                <td className="spec-td">
                  {diff
                    ? <span className="spec-pill" style={{ backgroundColor: diff.bg, color: diff.color }}>{e.difficulty}</span>
                    : (e.difficulty ?? '—')}
                </td>
                <td className="spec-td">{e.category ?? '—'}</td>
                <td className="spec-td">
                  {stat
                    ? <span className="spec-pill" style={{ backgroundColor: stat.bg, color: stat.color }}>{e.status}</span>
                    : (e.status ?? '—')}
                </td>
                <td className="spec-td spec-td--muted">{e.date ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AnalyzerResult({ result, onReset }) {
  return (
    <div className="spec-analyzer-result">
      <div className="spec-analyzer-left">
        <ScoreCircle score={result.overall} />
        <p className="spec-wordcount-note">{result.wordCount} words</p>
        <span className={`spec-source-badge ${result.source === 'claude' ? 'spec-source-badge--ai' : 'spec-source-badge--local'}`}>
          {result.source === 'claude' ? '✦ Scored by Claude AI' : '⚙ Scored locally'}
        </span>
        <button className="spec-retry-btn" onClick={onReset}>
          Try another →
        </button>
      </div>
      <div className="spec-analyzer-right">
        <div className="spec-cat-bars">
          {result.categories.map((cat, i) => (
            <CatBar key={cat.key} label={cat.label} score={cat.score} weight={cat.weight} delay={i * 80} />
          ))}
        </div>
        {result.highlights && (
          <div className="spec-detected-groups">
            {result.highlights.awsServices?.length > 0 && (
              <div className="spec-detected-group">
                <span className="spec-detected-group-label">AWS Services</span>
                <div className="spec-detected-tags">
                  {result.highlights.awsServices.map(s => (
                    <span key={s} className="spec-detected-tag spec-detected-tag--aws">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {result.highlights.techStack?.length > 0 && (
              <div className="spec-detected-group">
                <span className="spec-detected-group-label">Tech Stack</span>
                <div className="spec-detected-tags">
                  {result.highlights.techStack.map(t => (
                    <span key={t} className="spec-detected-tag spec-detected-tag--tech">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {result.recommendations?.length > 0 && (
          <div className="spec-recs">
            <p className="spec-recs-title">What to Fix</p>
            {result.recommendations.map((rec, i) => (
              <div key={i} className="spec-rec">
                <div className="spec-rec-label">{rec.category}</div>
                <p className="spec-rec-text">{rec.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Endpoint doc wrapper ─────────────────────────────────────────────────────

function EndpointDoc({ method, path, status, statusText, title, summary, children }) {
  return (
    <div className="spec-doc">
      <div className="spec-doc-bar">
        <MethodBadge method={method} />
        <code className="spec-doc-path">{path}</code>
        {status && <StatusChip code={status} text={statusText} />}
      </div>
      {title && <h1 className="spec-doc-title">{title}</h1>}
      {summary && <p className="spec-doc-summary">{summary}</p>}
      {children}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function RecruiterView() {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const activeId = sectionIdFromPathname(location.pathname)

  const [leetcode, setLeetcode] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const [score,       setScore]       = useState(null)
  const [analyzing,   setAnalyzing]   = useState(false)
  const [extracting,  setExtracting]  = useState(false)
  const [analyzeErr,  setAnalyzeErr]  = useState(null)

  useEffect(() => {
    Promise.allSettled([listPublicEntries('leetcode'), listPublicEntries('activity')])
      .then(([lc, act]) => {
        if (lc.status === 'fulfilled') setLeetcode(lc.value)
        if (act.status === 'fulfilled') setActivity(act.value)
        if (lc.status === 'rejected' && act.status === 'rejected') setError(lc.reason?.message ?? 'Failed to load data')
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleFile(file) {
    setExtracting(true)
    setAnalyzeErr(null)
    let text
    try {
      text = await extractTextFromPdf(file)
      if (text.trim().split(/\s+/).length < 50) {
        setAnalyzeErr('PDF extracted too little text — try a text-based PDF.')
        setExtracting(false)
        return
      }
    } catch {
      setAnalyzeErr('Could not read this PDF. Try a fresh copy.')
      setExtracting(false)
      return
    }
    setExtracting(false)
    setAnalyzing(true)
    try {
      const result = await scoreResume(text)
      setScore(result)
    } catch {
      setAnalyzeErr('Scoring failed. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  // Analyzer status reflects real request state, not decoration.
  const analyzerStatus = analyzeErr
    ? { code: '400', text: 'Bad Request' }
    : score
    ? { code: '200', text: 'OK' }
    : (analyzing || extracting)
    ? { code: '202', text: 'Accepted' }
    : { code: '100', text: 'Continue' }

  const findNav = (id) => NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === id)
  const activeNav = findNav(activeId)

  function renderBody() {
    if (activeId === 'root') {
      return (
        <EndpointDoc
          method="GET"
          path="/"
          status="200"
          statusText="OK"
          title="Edgar Setyan"
          summary="SDE I, AWS RDS · Toronto, ON — this page documents my background the way I'd document an API: pick an endpoint on the left."
        >
          <div className="spec-root-links">
            <a href="https://github.com/edgarsetyan23" target="_blank" rel="noopener noreferrer" className="spec-root-link">GitHub →</a>
            <a href="https://www.linkedin.com/in/edgarsetyan/" target="_blank" rel="noopener noreferrer" className="spec-root-link">LinkedIn →</a>
            <a href="mailto:edgar.setyan23@gmail.com" className="spec-root-link">edgar.setyan23@gmail.com</a>
            <a href="/Edgar_Resume.pdf" download="Edgar_Setyan_Resume.pdf" className="spec-root-link spec-root-link--primary">Download résumé →</a>
          </div>
        </EndpointDoc>
      )
    }

    const exp = EXPERIENCE.find((e) => e.id === activeId)
    if (exp) {
      return (
        <EndpointDoc method="GET" path={exp.path} status={exp.status} statusText={exp.statusText}
          title={`${exp.data.role}`} summary={`${exp.data.company} · ${exp.data.location} · ${exp.data.period}`}>
          <JsonBlock data={exp.data} />
        </EndpointDoc>
      )
    }

    const proj = PROJECTS.find((p) => p.id === activeId)
    if (proj) {
      return (
        <EndpointDoc method="GET" path={proj.path} status={proj.status} statusText={proj.statusText}
          title={proj.data.name} summary={proj.data.stack}>
          <JsonBlock data={{ highlights: proj.data.highlights }} />
          {proj.snippet && (
            <div className="spec-snippet">
              <div className="spec-snippet-file">{proj.snippet.file}</div>
              <pre className="spec-snippet-code"><code>{proj.snippet.code}</code></pre>
            </div>
          )}
        </EndpointDoc>
      )
    }

    if (activeId === 'york') {
      return (
        <EndpointDoc method="GET" path={EDUCATION.path} status={EDUCATION.status} statusText={EDUCATION.statusText}
          title={EDUCATION.data.school} summary={`${EDUCATION.data.degree} · ${EDUCATION.data.grad}`}>
          <JsonBlock data={EDUCATION.data} />
        </EndpointDoc>
      )
    }

    if (activeId === 'skills') {
      return (
        <EndpointDoc method="GET" path="/skills" status="200" statusText="OK"
          title="Technical Skills" summary="Grouped by domain, not proficiency level — I don't self-rate skills on a bar chart.">
          <div className="spec-skills">
            {Object.entries(SKILLS).map(([category, items]) => (
              <div key={category} className="spec-skill-row">
                <span className="spec-skill-category">{category}</span>
                <div className="spec-pills">
                  {items.map((item) => (
                    <span key={item} className="spec-pill spec-pill--tag">{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </EndpointDoc>
      )
    }

    if (activeId === 'leetcode') {
      return (
        <EndpointDoc method="GET" path="/live/leetcode" status="200" statusText="OK"
          title="LeetCode Progress" summary="Live-fetched, not a screenshot — this reflects my actual solved count as of now.">
          {loading && <p className="spec-loading">Loading live data…</p>}
          {error && <p className="spec-error">Could not load data: {error}</p>}
          {!loading && !error && (
            <>
              <LeetCodeProfile fixedUsername="user2986fQ" fixedDisplayName="Eddy-Setyan" />
              <LeetcodeTable entries={leetcode} />
            </>
          )}
        </EndpointDoc>
      )
    }

    if (activeId === 'activity') {
      return (
        <EndpointDoc method="GET" path="/live/activity" status="200" statusText="OK"
          title="Daily Activity Log" summary={`${activity.length} entries logged in Ascend's activity tracker.`}>
          {loading && <p className="spec-loading">Loading live data…</p>}
          {error && <p className="spec-error">Could not load data: {error}</p>}
          {!loading && !error && (
            <ActivityLog tracker={activityTracker} entries={activity} readOnly />
          )}
        </EndpointDoc>
      )
    }

    if (activeId === 'analyzer') {
      return (
        <EndpointDoc method="POST" path="/analyzer/score" status={analyzerStatus.code} statusText={analyzerStatus.text}
          title="Resume Analyzer" summary="A Claude-powered resume scorer benchmarked for early-career SWEs, built into Ascend. Drop a PDF — nothing is stored.">
          <div className="spec-analyzer-card">
            {analyzing ? (
              <div className="spec-analyzer-loading">
                <div className="spec-spinner" />
                <div>
                  <p className="spec-analyzer-loading-title">Analyzing with Claude AI…</p>
                  <p className="spec-analyzer-loading-sub">Scoring across 6 categories for a 1-year SWE profile</p>
                </div>
              </div>
            ) : score ? (
              <AnalyzerResult result={score} onReset={() => { setScore(null); setAnalyzeErr(null) }} />
            ) : (
              <div className="spec-dropzone-wrap">
                <div className="spec-analyzer-criteria">
                  {['Metrics & Impact', 'Action Verbs', 'AWS Depth', 'Tech Keywords', 'Structure', 'Length & Format'].map(c => (
                    <span key={c} className="spec-pill spec-pill--tag">{c}</span>
                  ))}
                </div>
                <DropZone onFile={handleFile} isExtracting={extracting} />
                {analyzeErr && <p className="spec-error">{analyzeErr}</p>}
              </div>
            )}
          </div>
        </EndpointDoc>
      )
    }

    return null
  }

  return (
    <div className="spec-page">
      <nav className="spec-topbar">
        <Link to="/" className="spec-brand">
          <span className="spec-brand-mark">▸</span>
          <span className="spec-brand-name">Ascend</span>
        </Link>
        <code className="spec-topbar-url">
          curl https://edgarsetyan.com/api{activeNav ? activeNav.path : '/'}
        </code>
        <div className="spec-topbar-actions">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <Link to="/" className="spec-back-link">← Back to app</Link>
        </div>
      </nav>

      <div className="spec-shell">
        <aside className="spec-sidebar">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="spec-nav-group">
              <div className="spec-nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`spec-nav-item ${activeId === item.id ? 'spec-nav-item--active' : ''}`}
                  onClick={() => navigate(item.path === '/' ? '/portfolio' : `/portfolio${item.path}`)}
                >
                  <MethodBadge method={item.method} />
                  <span className="spec-nav-path">{item.path}</span>
                </button>
              ))}
            </div>
          ))}
          <a
            href="https://github.com/edgarsetyan23/Ascend"
            target="_blank"
            rel="noopener noreferrer"
            className="spec-sidebar-source-link"
          >
            View source →
          </a>
        </aside>

        <main className="spec-main">{renderBody()}</main>
      </div>
    </div>
  )
}
