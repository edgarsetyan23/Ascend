import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listPublicEntries } from '../lib/publicApi.js'
import { useTheme } from '../hooks/useTheme.js'
import { ThemeToggle } from './ThemeToggle.jsx'
import { LeetCodeProfile } from './LeetCodeProfile.jsx'
import {
  ScoreCircle,
  CatBar,
  DropZone,
  scoreResume,
  extractTextFromPdf,
} from './ResumeReview.jsx'

// ── Resume data ─────────────────────────────────────────────────────────────

const EXPERIENCE = [
  {
    company: 'Amazon Web Services (AWS)',
    location: 'Toronto, ON',
    role: 'Software Development Engineer I, RDS Team',
    period: 'Jan 2025 – Jan 2026',
    bullets: [
      'Built a load-testing framework for a distributed telemetry service, generating sustained 10,000+ TPS and monitoring ECS task health and CPU utilization to validate capacity and surface bottlenecks pre-launch.',
      'Developed a synchronous instance configuration API end-to-end, persisting state in DynamoDB and instrumenting metrics/alarms in CloudWatch to manage RDS infrastructure.',
      'Supported on-call for a metrics ingestion service; triaged and resolved 25+ production incidents, executed mitigations via runbooks, and delivered follow-up fixes to prevent recurrence.',
      'Remediated stale CloudFormation deployments across 60+ AWS accounts by auditing stacks, removing failed/obsolete resources, and safely re-deploying to restore consistent infrastructure.',
      'Refactored CloudWatch dashboards to stay within service limits and automated KPI extraction for Monthly Business Reviews, reducing manual reporting overhead.',
    ],
  },
  {
    company: 'Tangerine Bank',
    location: 'Toronto, ON',
    role: 'Software Developer Intern',
    period: 'Apr 2021 – Aug 2021',
    bullets: [
      'Developed scalable Java components in a high-traffic web application, improving performance and reliability.',
      'Improved performance by refactoring SQL queries and optimizing indexing, reducing query latency and improving page-load responsiveness.',
      'Reduced deployment errors by 20% by optimizing Docker configurations and supporting Kubernetes operations, improving rollout stability.',
    ],
  },
  {
    company: 'Tangerine Bank',
    location: 'Toronto, ON',
    role: 'Software Developer Intern',
    period: 'Apr 2020 – Aug 2020',
    bullets: [
      'Built features for a high-performance Java web application using efficient algorithms and design patterns to improve scalability and user experience.',
      'Reduced build errors by 50% by automating build tasks with Maven, improving CI reliability and developer velocity.',
    ],
  },
]

const PROJECTS = [
  {
    name: 'Ascend — Accountability Tracker',
    stack: 'React 18, Vite, AWS Lambda, DynamoDB, API Gateway, Cognito, CDK, Node 22, Vercel',
    bullets: [
      'Built a full-stack personal productivity tracker with multiple tracker types (LeetCode, Daily Activity, Job Applications, Gaming).',
      'Architected a serverless backend with AWS CDK: HTTP API Gateway, JWT authorizer, 4 Lambda functions, and DynamoDB single-table design.',
      'Implemented a public portfolio view (/portfolio) with a hardcoded-owner Lambda whitelist — no auth required, read-only, tracker whitelist enforced server-side.',
      'Built a Gmail email scanner using a new-tab redirect OAuth flow to avoid Cross-Origin-Opener-Policy restrictions in strict browser security configurations; fetches only email metadata, pipes it through Claude Haiku for extraction, deduplicates against existing entries, and shows a review modal for bulk import.',
      'Built a LeetCode profile banner: a Vercel serverless proxy to the LeetCode GraphQL API with a 5-minute CDN cache, displaying live solved counts, difficulty breakdown, and language stats — with a localStorage-backed username and settable display name.',
    ],
  },
  {
    name: 'On-Call Debugging Assistant (Internal Hackathon — AWS RDS Toronto)',
    stack: 'AWS Lambda, Internal Web App',
    bullets: [
      'Built an internal web tool where engineers paste a ticket link/ID to launch guided Q&A troubleshooting flows backed by 3 diagnostic playbooks, outputting actionable next-step debugging checks and mitigations.',
      'Won 1st place in a 3-day AWS RDS Toronto team hackathon for improving overnight incident triage speed and consistency.',
    ],
  },
]

const SKILLS = {
  Languages:      ['Java', 'Kotlin', 'SQL', 'Python', 'JavaScript'],
  Backend:        ['REST APIs', 'Distributed Systems', 'Spring Boot'],
  Cloud:          ['AWS RDS', 'DynamoDB', 'CloudFormation', 'CloudWatch', 'Lambda', 'ECS'],
  Infrastructure: ['Docker', 'Kubernetes', 'Linux/Unix', 'CI/CD'],
}

const EDUCATION = {
  school: 'York University',
  location: 'Toronto, ON',
  degree: 'Bachelor of Science Honours in Computer Science',
  grad: 'Class of 2024',
}

// ── Live data table ──────────────────────────────────────────────────────────

function RecruiterTable({ entries, columns }) {
  if (!entries.length) {
    return <p className="rc-empty">No entries yet.</p>
  }
  return (
    <div className="rc-table-wrap">
      <table className="rc-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="rc-th">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={entry.id ?? i} className="rc-tr">
              {columns.map((col) => (
                <td key={col.key} className="rc-td">{entry[col.key] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const LEETCODE_COLS = [
  { key: 'problem',    label: 'Problem'    },
  { key: 'difficulty', label: 'Difficulty' },
  { key: 'category',   label: 'Category'   },
  { key: 'status',     label: 'Status'     },
  { key: 'date',       label: 'Date'       },
]

const ACTIVITY_COLS = [
  { key: 'title',    label: 'Title'    },
  { key: 'category', label: 'Category' },
  { key: 'impact',   label: 'Impact'   },
  { key: 'duration', label: 'Duration' },
  { key: 'date',     label: 'Date'     },
]

// ── Analyzer results display ─────────────────────────────────────────────────

function AnalyzerResult({ result, onReset }) {
  return (
    <div className="rc-analyzer-result">
      <div className="rc-analyzer-left">
        <ScoreCircle score={result.overall} />
        <p className="rc-wordcount-note">{result.wordCount} words</p>
        <span className={`resume-source-badge ${result.source === 'claude' ? 'resume-source-badge--ai' : 'resume-source-badge--local'}`}>
          {result.source === 'claude' ? '✦ Scored by Claude AI' : '⚙ Scored locally'}
        </span>
        <button className="rc-retry-btn" onClick={onReset}>
          Try another →
        </button>
      </div>
      <div className="rc-analyzer-right">
        <div className="cat-bars">
          {result.categories.map((cat, i) => (
            <CatBar key={cat.key} label={cat.label} score={cat.score} weight={cat.weight} delay={i * 80} />
          ))}
        </div>
        {result.highlights && (
          <div className="rc-detected-groups">
            {result.highlights.awsServices?.length > 0 && (
              <div className="detected-group">
                <span className="detected-group-label">AWS Services</span>
                <div className="detected-tags">
                  {result.highlights.awsServices.map(s => (
                    <span key={s} className="detected-tag detected-tag--aws">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {result.highlights.techStack?.length > 0 && (
              <div className="detected-group">
                <span className="detected-group-label">Tech Stack</span>
                <div className="detected-tags">
                  {result.highlights.techStack.map(t => (
                    <span key={t} className="detected-tag detected-tag--tech">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {result.recommendations?.length > 0 && (
          <div className="rc-recs">
            <p className="rc-recs-title">What to Fix</p>
            {result.recommendations.map((rec, i) => (
              <div key={i} className="resume-rec">
                <div className="resume-rec-label">{rec.category}</div>
                <p className="resume-rec-text">{rec.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function RecruiterView() {
  const { theme, toggleTheme } = useTheme()

  const [leetcode, setLeetcode] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  // ── Resume analyzer state ────────────────────────────────────────────────
  const [score,       setScore]       = useState(null)
  const [analyzing,   setAnalyzing]   = useState(false)
  const [extracting,  setExtracting]  = useState(false)
  const [analyzeErr,  setAnalyzeErr]  = useState(null)

  useEffect(() => {
    Promise.all([listPublicEntries('leetcode'), listPublicEntries('activity')])
      .then(([lc, act]) => { setLeetcode(lc); setActivity(act) })
      .catch((e) => setError(e.message))
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

  return (
    <div className="rc-page">

      {/* ── Top nav ──────────────────────────────────────────────────── */}
      <nav className="rc-nav">
        <div className="rc-nav-inner">
          <Link to="/" className="rc-nav-brand">
            <span className="rc-nav-logo">🔱</span>
            <span className="rc-nav-title">Ascend</span>
          </Link>
          <div className="rc-nav-actions">
            <Link to="/" className="rc-back-link">← Back</Link>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <a
              href="/Edgar_Resume.pdf"
              download="Edgar_Setyan_Resume.pdf"
              className="btn btn--primary rc-download-btn"
            >
              Download Resume
            </a>
          </div>
        </div>
      </nav>

      <div className="rc-body">

        {/* ── Hero ──────────────────────────────────────────────────── */}
        <div className="rc-hero">
          <div className="rc-hero-left">
            <h1 className="rc-name">Edgar Setyan</h1>
            <p className="rc-role">Software Development Engineer I · AWS RDS</p>
            <p className="rc-location">📍 Toronto, ON</p>
          </div>
          <div className="rc-hero-links">
            <a
              href="https://github.com/eddysetyan23"
              target="_blank"
              rel="noopener noreferrer"
              className="rc-contact-link"
            >
              <span className="rc-contact-icon">⌥</span>
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/edgarsetyan/"
              target="_blank"
              rel="noopener noreferrer"
              className="rc-contact-link"
            >
              <span className="rc-contact-icon">in</span>
              LinkedIn
            </a>
            <a href="mailto:edgar.setyan23@gmail.com" className="rc-contact-link">
              <span className="rc-contact-icon">@</span>
              edgar.setyan23@gmail.com
            </a>
          </div>
        </div>

        {/* ── Experience ─────────────────────────────────────────────── */}
        <section className="rc-section">
          <h2 className="rc-section-heading">
            <span className="rc-section-bar" />
            Experience
          </h2>
          {EXPERIENCE.map((job, i) => (
            <div key={i} className="rc-card">
              <div className="rc-card-header">
                <div>
                  <span className="rc-company">{job.company}</span>
                  <span className="rc-job-role">{job.role}</span>
                </div>
                <div className="rc-card-meta">
                  <span className="rc-period">{job.period}</span>
                  <span className="rc-job-location">{job.location}</span>
                </div>
              </div>
              <ul className="rc-bullets">
                {job.bullets.map((b, j) => (
                  <li key={j} className="rc-bullet">{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* ── Projects ───────────────────────────────────────────────── */}
        <section className="rc-section">
          <h2 className="rc-section-heading">
            <span className="rc-section-bar" />
            Projects
          </h2>
          {PROJECTS.map((proj, i) => (
            <div key={i} className="rc-card">
              <div className="rc-card-header">
                <span className="rc-company">{proj.name}</span>
                <span className="rc-stack-label">{proj.stack}</span>
              </div>
              <ul className="rc-bullets">
                {proj.bullets.map((b, j) => (
                  <li key={j} className="rc-bullet">{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* ── Technical Skills ───────────────────────────────────────── */}
        <section className="rc-section">
          <h2 className="rc-section-heading">
            <span className="rc-section-bar" />
            Technical Skills
          </h2>
          <div className="rc-card rc-skills-card">
            {Object.entries(SKILLS).map(([category, items]) => (
              <div key={category} className="rc-skill-row">
                <span className="rc-skill-category">{category}</span>
                <div className="rc-pills">
                  {items.map((item) => (
                    <span key={item} className="rc-pill">{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Education ──────────────────────────────────────────────── */}
        <section className="rc-section">
          <h2 className="rc-section-heading">
            <span className="rc-section-bar" />
            Education
          </h2>
          <div className="rc-card rc-card-header">
            <div>
              <span className="rc-company">{EDUCATION.school}</span>
              <span className="rc-job-role">{EDUCATION.degree}</span>
            </div>
            <div className="rc-card-meta">
              <span className="rc-period">{EDUCATION.grad}</span>
              <span className="rc-job-location">{EDUCATION.location}</span>
            </div>
          </div>
        </section>

        {/* ── Resume Analyzer (feature demo) ────────────────────────── */}
        <section className="rc-section">
          <h2 className="rc-section-heading">
            <span className="rc-section-bar" />
            Resume Analyzer
            <span className="rc-ai-badge">✦ Claude AI</span>
          </h2>

          <div className="rc-card rc-analyzer-card">
            {analyzing ? (
              <div className="rc-analyzer-loading">
                <div className="pdf-spinner" />
                <div>
                  <p className="rc-analyzer-loading-title">Analyzing with Claude AI…</p>
                  <p className="rc-analyzer-loading-sub">Scoring across 6 categories for a 1-year SWE profile</p>
                </div>
              </div>
            ) : score ? (
              <AnalyzerResult result={score} onReset={() => { setScore(null); setAnalyzeErr(null) }} />
            ) : (
              <div className="rc-dropzone-wrap">
                <div className="rc-analyzer-intro">
                  <p className="rc-analyzer-intro-text">
                    Built into Ascend: a Claude-powered resume scorer benchmarked for early-career SWEs.
                    Drop any PDF to see it in action — nothing is stored.
                  </p>
                  <div className="rc-analyzer-criteria">
                    {['Metrics & Impact', 'Action Verbs', 'AWS Depth', 'Tech Keywords', 'Structure', 'Length & Format'].map(c => (
                      <span key={c} className="rc-pill">{c}</span>
                    ))}
                  </div>
                </div>
                <DropZone onFile={handleFile} isExtracting={extracting} />
                {analyzeErr && <p className="rc-error">{analyzeErr}</p>}
              </div>
            )}
          </div>
        </section>

        {/* ── Live Tracker Data ──────────────────────────────────────── */}
        <section className="rc-section">
          <h2 className="rc-section-heading">
            <span className="rc-section-bar" />
            Live Tracker Data
            <span className="rc-live-badge">● LIVE</span>
          </h2>

          {loading && <p className="rc-loading">Loading live data…</p>}
          {error   && <p className="rc-error">Could not load data: {error}</p>}

          {!loading && !error && (
            <>
              <div className="rc-data-section">
                <div className="rc-data-header">
                  <span className="rc-data-title">LeetCode Progress</span>
                  <span className="rc-count-badge">{leetcode.length} problems logged</span>
                </div>
                <LeetCodeProfile fixedUsername="user2986fQ" fixedDisplayName="Eddy-Setyan" />
                <RecruiterTable entries={leetcode} columns={LEETCODE_COLS} />
              </div>

              <div className="rc-data-section">
                <div className="rc-data-header">
                  <span className="rc-data-title">Daily Activity Log</span>
                  <span className="rc-count-badge">{activity.length} entries</span>
                </div>
                <RecruiterTable entries={activity} columns={ACTIVITY_COLS} />
              </div>
            </>
          )}
        </section>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="rc-footer">
          <span className="rc-footer-note">Live data · Read-only · Built with Ascend</span>
          <Link to="/" className="rc-footer-back">← Back to Ascend</Link>
        </footer>
      </div>
    </div>
  )
}
