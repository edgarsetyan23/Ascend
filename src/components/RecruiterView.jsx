import { useEffect, useState, lazy, Suspense } from 'react'
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
import '../styles/exhibit-view.css'

// Three.js is real weight — split it into its own chunk so it only
// downloads once someone actually lands on /portfolio, not as part of
// the base app bundle.
const TourGuide = lazy(() => import('./TourGuide.jsx').then((m) => ({ default: m.TourGuide })))
const ACCENT = { light: '#4f7a63', dark: '#8fc2a6' }

// ── Resume data ─────────────────────────────────────────────────────────────
// "The Exhibit" — every entry is a numbered plate in a small collection,
// the way a gallery guide numbers its pieces. No invented content: every
// fact below is the same one on the PDF resume, just laid out as prose
// instead of a resume-shaped list of bullets.

const EXPERIENCE = [
  {
    id: 'aws',
    path: '/experience/aws',
    plate: '01',
    navTitle: 'Amazon Web Services',
    navSub: '2025 – 2026',
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
    plate: '02',
    navTitle: 'Tangerine Bank',
    navSub: 'Summer 2021',
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
    plate: '03',
    navTitle: 'Tangerine Bank',
    navSub: 'Summer 2020',
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
    plate: '01',
    navTitle: 'Ascend',
    navSub: 'Accountability Tracker',
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
    plate: '02',
    navTitle: 'On-Call Assistant',
    navSub: 'Hackathon, 1st place',
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
  plate: '01',
  navTitle: 'York University',
  navSub: 'Class of 2024',
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
  { label: 'Introduction', items: [{ id: 'root', path: '/', navTitle: 'Edgar Setyan', navSub: null }] },
  {
    label: 'Field Work',
    items: EXPERIENCE.map((e) => ({ id: e.id, path: e.path, plate: e.plate, navTitle: e.navTitle, navSub: e.navSub })),
  },
  {
    label: 'Studio Projects',
    items: PROJECTS.map((p) => ({ id: p.id, path: p.path, plate: p.plate, navTitle: p.navTitle, navSub: p.navSub })),
  },
  { label: 'Education', items: [{ id: 'york', path: EDUCATION.path, plate: EDUCATION.plate, navTitle: EDUCATION.navTitle, navSub: EDUCATION.navSub }] },
  { label: 'Toolkit', items: [{ id: 'skills', path: '/skills', navTitle: 'Technical Skills', navSub: null }] },
  {
    label: 'Live Demonstrations',
    items: [
      { id: 'leetcode', path: '/live/leetcode', navTitle: 'Problem-Solving Log', navSub: 'Live' },
      { id: 'activity', path: '/live/activity', navTitle: 'Daily Practice', navSub: 'Live' },
      { id: 'analyzer', path: '/analyzer/score', navTitle: 'Resume Review', navSub: 'Try it' },
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

// What the guide "says" as you move between sections — written to
// sound like one person talking, not six copies of the same template.
const GUIDE_LINES = {
  'Introduction': "Hey — I'm Edgar. This is my résumé, minus the fluff.",
  'Field Work': "Here's where I've actually worked.",
  'Studio Projects': "Stuff I built because I wanted to, not because someone assigned it.",
  'Education': 'Where it started, for what it’s worth.',
  'Toolkit': 'What I actually reach for day to day.',
  'Live Demonstrations': "These are real and running — go ahead, try them.",
}
const ID_TO_GROUP = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((item) => [item.id, g.label]))
)

// Real company/institution marks, sourced from Wikimedia Commons
// (public-domain or copyright-ineligible logo files; trademark use here
// is purely factual — identifying where I worked/studied, not implying
// endorsement). Only sections tied to an actual organization get one —
// no logo is invented for the personal-project sections.
const CARD_LOGOS = {
  'Field Work': [
    { src: '/logos/aws.svg', alt: 'Amazon Web Services' },
    { src: '/logos/tangerine.svg', alt: 'Tangerine Bank' },
  ],
  'Education': [
    { src: '/logos/york.svg', alt: 'York University' },
  ],
}

// ── Small building blocks ────────────────────────────────────────────────────

function PlateMark({ n }) {
  return <span className="exh-plate">{n}</span>
}

function HighlightList({ items }) {
  return (
    <ul className="exh-highlights">
      {items.map((item, i) => (
        <li key={i} className="exh-highlight exh-fade-in" style={{ animationDelay: `${80 + i * 60}ms` }}>{item}</li>
      ))}
    </ul>
  )
}

function DetailPanel({ file, code }) {
  return (
    <div className="exh-detail">
      <div className="exh-detail-label">Detail, enlarged — <span className="exh-detail-file">{file}</span></div>
      <pre className="exh-detail-code"><code>{code}</code></pre>
    </div>
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
    <div className="exh-table-wrap">
      <table className="exh-table">
        <thead>
          <tr>
            {['Problem', 'Difficulty', 'Category', 'Status', 'Date'].map((h) => (
              <th key={h} className="exh-th">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const diff = DIFFICULTY_BADGE[e.difficulty]
            const stat = STATUS_BADGE[e.status]
            return (
              <tr key={e.id ?? i} className="exh-tr">
                <td className="exh-td exh-td--bold">{e.problem ?? '—'}</td>
                <td className="exh-td">
                  {diff
                    ? <span className="exh-pill" style={{ backgroundColor: diff.bg, color: diff.color }}>{e.difficulty}</span>
                    : (e.difficulty ?? '—')}
                </td>
                <td className="exh-td">{e.category ?? '—'}</td>
                <td className="exh-td">
                  {stat
                    ? <span className="exh-pill" style={{ backgroundColor: stat.bg, color: stat.color }}>{e.status}</span>
                    : (e.status ?? '—')}
                </td>
                <td className="exh-td exh-td--muted">{e.date ?? '—'}</td>
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
    <div className="exh-analyzer-result">
      <div className="exh-analyzer-left">
        <ScoreCircle score={result.overall} />
        <p className="exh-wordcount-note">{result.wordCount} words</p>
        <span className={`exh-source-badge ${result.source === 'claude' ? 'exh-source-badge--ai' : 'exh-source-badge--local'}`}>
          {result.source === 'claude' ? '✦ Scored by Claude AI' : '⚙ Scored locally'}
        </span>
        <button className="exh-retry-btn" onClick={onReset}>
          Try another →
        </button>
      </div>
      <div className="exh-analyzer-right">
        <div className="exh-cat-bars">
          {result.categories.map((cat, i) => (
            <CatBar key={cat.key} label={cat.label} score={cat.score} weight={cat.weight} delay={i * 80} />
          ))}
        </div>
        {result.highlights && (
          <div className="exh-detected-groups">
            {result.highlights.awsServices?.length > 0 && (
              <div className="exh-detected-group">
                <span className="exh-detected-group-label">AWS Services</span>
                <div className="exh-detected-tags">
                  {result.highlights.awsServices.map(s => (
                    <span key={s} className="exh-detected-tag exh-detected-tag--aws">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {result.highlights.techStack?.length > 0 && (
              <div className="exh-detected-group">
                <span className="exh-detected-group-label">Tech Stack</span>
                <div className="exh-detected-tags">
                  {result.highlights.techStack.map(t => (
                    <span key={t} className="exh-detected-tag exh-detected-tag--tech">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {result.recommendations?.length > 0 && (
          <div className="exh-recs">
            <p className="exh-recs-title">What to Fix</p>
            {result.recommendations.map((rec, i) => (
              <div key={i} className="exh-rec">
                <div className="exh-rec-label">{rec.category}</div>
                <p className="exh-rec-text">{rec.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Exhibit frame — every plate shares this shell ───────────────────────────

function ExhibitFrame({ section, plate, title, byline, children }) {
  return (
    <div className="exh-frame">
      <div className="exh-eyebrow">
        {plate && <PlateMark n={plate} />}
        <span className="exh-eyebrow-text">{section}</span>
      </div>
      {title && <h1 className="exh-title">{title}</h1>}
      {byline && <p className="exh-byline">{byline}</p>}
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

  // The guide stands in the corner everywhere except the Introduction
  // plate, where "Start the tour" summons him to center stage. Resets
  // when you leave the Introduction plate, so returning later starts
  // fresh rather than staying centered forever.
  const [tourStarted, setTourStarted] = useState(false)
  useEffect(() => {
    if (activeId !== 'root') setTourStarted(false)
  }, [activeId])

  // Clicking an exhibit card sends the guide walking to that exact
  // card first, then opens the page a beat later — instead of
  // teleporting straight there. { right, bottom } are computed from
  // the clicked card's own on-screen position, in the same units the
  // corner/hero CSS already uses, so the position transition can
  // animate to literally anywhere, not just the two fixed spots.
  const [guideTargetRect, setGuideTargetRect] = useState(null)
  const [walkTick, setWalkTick] = useState(0)

  function handleCardClick(e, path) {
    const rect = e.currentTarget.getBoundingClientRect()
    setGuideTargetRect({
      right: window.innerWidth - (rect.left + rect.width / 2),
      bottom: window.innerHeight - (rect.top + rect.height / 2),
    })
    setWalkTick((n) => n + 1)
    window.setTimeout(() => {
      navigate(`/portfolio${path}`)
      setGuideTargetRect(null)
    }, 750)
  }

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

  const activeNavItem = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === activeId)
  const guideIsHero = activeId === 'root' && tourStarted
  const guideSize = guideIsHero ? 400 : 260

  function renderBody() {
    if (activeId === 'root') {
      return (
        <ExhibitFrame
          section="Introduction"
          title="Edgar Setyan"
          byline="SDE I, AWS RDS · Toronto, ON"
        >
          <p className="exh-intro-text">
            A small collection of the work behind my résumé — laid out the way I'd want to browse
            someone else's. Pick a piece from the list on the left, or start the tour below.
          </p>
          <div className="exh-root-links">
            <a href="https://github.com/edgarsetyan23" target="_blank" rel="noopener noreferrer" className="exh-root-link">GitHub →</a>
            <a href="https://www.linkedin.com/in/edgarsetyan/" target="_blank" rel="noopener noreferrer" className="exh-root-link">LinkedIn →</a>
            <a href="mailto:edgar.setyan23@gmail.com" className="exh-root-link">edgar.setyan23@gmail.com</a>
            <a href="/Edgar_Resume.pdf" download="Edgar_Setyan_Resume.pdf" className="exh-root-link exh-root-link--primary">Download résumé →</a>
          </div>

          <button
            className="exh-start-tour"
            onClick={() => setTourStarted(true)}
          >
            {tourStarted ? 'Pick a stop below ↓' : 'Start the tour →'}
          </button>

          <div className="exh-tour-grid">
            {NAV_GROUPS.filter((g) => g.label !== 'Introduction').map((group, i) => (
              <button
                key={group.label}
                className="exh-card exh-fade-in"
                style={{ animationDelay: `${200 + i * 90}ms` }}
                onClick={(e) => handleCardClick(e, group.items[0].path)}
              >
                {CARD_LOGOS[group.label] && (
                  <div className="exh-card-logos">
                    {CARD_LOGOS[group.label].map((logo) => (
                      <span key={logo.alt} className="exh-card-logo-chip">
                        <img src={logo.src} alt={logo.alt} />
                      </span>
                    ))}
                  </div>
                )}
                <span className="exh-card-label">{group.label}</span>
                <span className="exh-card-teaser">{GUIDE_LINES[group.label]}</span>
                <span className="exh-card-count">
                  {group.items.length} {group.items.length === 1 ? 'entry' : 'entries'} →
                </span>
              </button>
            ))}
          </div>
        </ExhibitFrame>
      )
    }

    const exp = EXPERIENCE.find((e) => e.id === activeId)
    if (exp) {
      return (
        <ExhibitFrame section="Field Work" plate={exp.plate}
          title={exp.data.role} byline={`${exp.data.company} · ${exp.data.location} · ${exp.data.period}`}>
          <HighlightList items={exp.data.highlights} />
        </ExhibitFrame>
      )
    }

    const proj = PROJECTS.find((p) => p.id === activeId)
    if (proj) {
      return (
        <ExhibitFrame section="Studio Projects" plate={proj.plate}
          title={proj.data.name} byline={proj.data.stack}>
          <HighlightList items={proj.data.highlights} />
          {proj.snippet && <DetailPanel file={proj.snippet.file} code={proj.snippet.code} />}
        </ExhibitFrame>
      )
    }

    if (activeId === 'york') {
      return (
        <ExhibitFrame section="Education" plate={EDUCATION.plate}
          title={EDUCATION.data.school} byline={`${EDUCATION.data.degree} · ${EDUCATION.data.grad}`} />
      )
    }

    if (activeId === 'skills') {
      return (
        <ExhibitFrame section="Toolkit" title="Technical Skills"
          byline="Grouped by domain, not proficiency level — I don't self-rate skills on a bar chart.">
          <div className="exh-skills">
            {Object.entries(SKILLS).map(([category, items]) => (
              <div key={category} className="exh-skill-row">
                <span className="exh-skill-category">{category}</span>
                <div className="exh-pills">
                  {items.map((item) => (
                    <span key={item} className="exh-pill exh-pill--tag">{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ExhibitFrame>
      )
    }

    if (activeId === 'leetcode') {
      return (
        <ExhibitFrame section="Live Demonstrations" title="Problem-Solving Log"
          byline="Live-fetched, not a screenshot — this reflects my actual solved count as of now.">
          {loading && <p className="exh-loading">Loading live data…</p>}
          {error && <p className="exh-error">Could not load data: {error}</p>}
          {!loading && !error && (
            <>
              <LeetCodeProfile fixedUsername="user2986fQ" fixedDisplayName="Eddy-Setyan" />
              <LeetcodeTable entries={leetcode} />
            </>
          )}
        </ExhibitFrame>
      )
    }

    if (activeId === 'activity') {
      return (
        <ExhibitFrame section="Live Demonstrations" title="Daily Practice Log"
          byline={`${activity.length} entries logged in Ascend's activity tracker.`}>
          {loading && <p className="exh-loading">Loading live data…</p>}
          {error && <p className="exh-error">Could not load data: {error}</p>}
          {!loading && !error && (
            <ActivityLog tracker={activityTracker} entries={activity} readOnly />
          )}
        </ExhibitFrame>
      )
    }

    if (activeId === 'analyzer') {
      return (
        <ExhibitFrame section="Live Demonstrations" title="Resume Review, Live"
          byline="A Claude-powered resume scorer benchmarked for early-career SWEs, built into Ascend. Drop a PDF — nothing is stored.">
          <div className="exh-analyzer-card">
            {analyzing ? (
              <div className="exh-analyzer-loading">
                <div className="exh-spinner" />
                <div>
                  <p className="exh-analyzer-loading-title">Analyzing with Claude AI…</p>
                  <p className="exh-analyzer-loading-sub">Scoring across 6 categories for a 1-year SWE profile</p>
                </div>
              </div>
            ) : score ? (
              <AnalyzerResult result={score} onReset={() => { setScore(null); setAnalyzeErr(null) }} />
            ) : (
              <div className="exh-dropzone-wrap">
                <div className="exh-analyzer-criteria">
                  {['Metrics & Impact', 'Action Verbs', 'AWS Depth', 'Tech Keywords', 'Structure', 'Length & Format'].map(c => (
                    <span key={c} className="exh-pill exh-pill--tag">{c}</span>
                  ))}
                </div>
                <DropZone onFile={handleFile} isExtracting={extracting} />
                {analyzeErr && <p className="exh-error">{analyzeErr}</p>}
              </div>
            )}
          </div>
        </ExhibitFrame>
      )
    }

    return null
  }

  return (
    <div className="exh-page">
      <nav className="exh-topbar">
        <Link to="/" className="exh-brand">
          <span className="exh-brand-mark">✦</span>
          <span className="exh-brand-name">Ascend</span>
        </Link>
        <span className="exh-topbar-crumb">{activeNavItem ? activeNavItem.navTitle : 'Edgar Setyan'}</span>
        <div className="exh-topbar-actions">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <Link to="/" className="exh-back-link">← Back to app</Link>
        </div>
      </nav>

      <div className="exh-shell">
        <aside className="exh-sidebar">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="exh-nav-group">
              <div className="exh-nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`exh-nav-item ${activeId === item.id ? 'exh-nav-item--active' : ''}`}
                  onClick={() => navigate(item.path === '/' ? '/portfolio' : `/portfolio${item.path}`)}
                >
                  {item.plate && <PlateMark n={item.plate} />}
                  <span className="exh-nav-item-text">
                    <span className="exh-nav-item-title">{item.navTitle}</span>
                    {item.navSub && <span className="exh-nav-item-sub">{item.navSub}</span>}
                  </span>
                </button>
              ))}
            </div>
          ))}
          <a
            href="https://github.com/edgarsetyan23/Ascend"
            target="_blank"
            rel="noopener noreferrer"
            className="exh-sidebar-source-link"
          >
            View the code →
          </a>
        </aside>

        <main className="exh-main">
          <div key={activeId} className="exh-plate-enter">{renderBody()}</div>
        </main>
      </div>

      <div
        className={`exh-guide-wrap ${guideIsHero ? 'exh-guide-wrap--hero' : ''}`}
        style={guideTargetRect ? { right: `${guideTargetRect.right}px`, bottom: `${guideTargetRect.bottom}px`, transform: 'translate(0, 0)' } : undefined}
      >
        <div key={`${activeId}-${tourStarted}-${walkTick}`} className="exh-guide-caption exh-fade-in">
          {guideTargetRect
            ? 'On my way →'
            : guideIsHero
            ? "Let's start with Field Work — or pick any stop below."
            : GUIDE_LINES[ID_TO_GROUP[activeId]] ?? GUIDE_LINES['Introduction']}
        </div>
        <Suspense fallback={<div className="exh-guide-canvas" style={{ width: guideSize, height: guideSize }} />}>
          <TourGuide
            accentColor={theme === 'dark' ? ACCENT.dark : ACCENT.light}
            size={guideSize}
            walkKey={`${activeId}-${tourStarted}-${walkTick}`}
          />
        </Suspense>
      </div>
    </div>
  )
}
