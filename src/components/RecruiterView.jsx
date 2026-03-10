import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
    <div className="rc-table-wrap">
      <table className="rc-table">
        <thead>
          <tr>
            {['Problem', 'Difficulty', 'Category', 'Status', 'Date'].map((h) => (
              <th key={h} className="rc-th">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const diff = DIFFICULTY_BADGE[e.difficulty]
            const stat = STATUS_BADGE[e.status]
            return (
              <tr key={e.id ?? i} className="rc-tr">
                <td className="rc-td rc-td--bold">{e.problem ?? '—'}</td>
                <td className="rc-td">
                  {diff
                    ? <span className="badge" style={{ backgroundColor: diff.bg, color: diff.color }}>{e.difficulty}</span>
                    : (e.difficulty ?? '—')}
                </td>
                <td className="rc-td">{e.category ?? '—'}</td>
                <td className="rc-td">
                  {stat
                    ? <span className="badge" style={{ backgroundColor: stat.bg, color: stat.color }}>{e.status}</span>
                    : (e.status ?? '—')}
                </td>
                <td className="rc-td rc-td--muted">{e.date ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

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

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('rc-visible'); observer.unobserve(e.target) } }),
      { threshold: 0.08 }
    )
    document.querySelectorAll('.rc-animate-in').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
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
            <span className="rc-role-badge">SDE I · AWS RDS</span>
            <p className="rc-hero-desc">A full-stack productivity tracker I built on AWS — this is the live version.</p>
            <p className="rc-location">📍 Toronto, ON</p>
          </div>
          <div className="rc-hero-links">
            <a
              href="https://github.com/edgarsetyan23"
              target="_blank"
              rel="noopener noreferrer"
              className="rc-contact-link"
            >
              <svg className="rc-contact-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/edgarsetyan/"
              target="_blank"
              rel="noopener noreferrer"
              className="rc-contact-link"
            >
              <svg className="rc-contact-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
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
            <div key={i} className={`rc-card rc-animate-in ${job.company.includes('Amazon') ? 'rc-card--aws' : 'rc-card--bank'}`} style={{ transitionDelay: `${i * 60}ms` }}>
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
            <div key={i} className="rc-card rc-card--project rc-animate-in" style={{ transitionDelay: `${i * 60}ms` }}>
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
          <div className="rc-card rc-skills-card rc-animate-in">
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
          <div className="rc-card rc-card-header rc-animate-in">
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
                <LeetcodeTable entries={leetcode} />
              </div>

              <div className="rc-data-section">
                <div className="rc-data-header">
                  <span className="rc-data-title">Daily Activity Log</span>
                  <span className="rc-count-badge">{activity.length} entries</span>
                </div>
                <ActivityLog
                  tracker={activityTracker}
                  entries={activity}
                  readOnly
                />
              </div>
            </>
          )}
        </section>

        {/* ── GitHub CTA ─────────────────────────────────────────────── */}
        <div className="rc-github-cta">
          <a
            href="https://github.com/edgarsetyan23/Ascend"
            target="_blank"
            rel="noopener noreferrer"
            className="rc-github-cta-link"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            View the code →
          </a>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="rc-footer">
          <span className="rc-footer-note">Live data · Read-only · Built with Ascend</span>
          <Link to="/" className="rc-footer-back">← Back to Ascend</Link>
        </footer>
      </div>
    </div>
  )
}
