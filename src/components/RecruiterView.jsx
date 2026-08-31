import { useEffect, useLayoutEffect, useRef, useState, lazy, Suspense } from 'react'
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
    note: 'My first job after graduating.',
    logo: '/logos/aws.svg',
    // Real AWS brand orange — used only here, as a deliberate one-off
    // accent so this entry (current job, most weight on the résumé)
    // visually pops against the site's uniform sage green rather than
    // blending in with every other plate.
    flashAccent: '#FF9900',
    // Same three numbers already sitting in the highlight sentences
    // below — pulled out, not invented, and given a big-number
    // callout treatment instead of staying buried mid-paragraph.
    stats: [
      { value: '10,000+', label: 'sustained TPS' },
      { value: '60+', label: 'AWS accounts remediated' },
      { value: '25+', label: 'incidents resolved' },
    ],
    // A prose lede synthesized from the highlights below — same
    // facts (RDS team, Toronto, the load-testing framework, the
    // config API, on-call, the account cleanup), just woven into a
    // paragraph instead of only existing as bullet fragments. No new
    // claims added.
    intro: "A year on RDS's engineering team in Toronto, split roughly in half between building and keeping things running. On the building side: a load-testing framework and an instance configuration API, both shipped end-to-end. On the running side: the on-call rotation — 25+ incidents deep — plus a sweep across 60+ AWS accounts to clean up infrastructure that had gone stale.",
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
    note: 'My second internship — same company, a year later.',
    logo: '/logos/tangerine.svg',
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
    note: 'My first internship — where it started.',
    logo: '/logos/tangerine.svg',
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
    note: "The project this whole page you're looking at is built on.",
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
    note: 'A hackathon win I built with a team in three days.',
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
  note: 'Where it started, before any of the above.',
  logo: '/logos/york.svg',
  data: {
    school: 'York University',
    degree: 'Bachelor of Science Honours in Computer Science',
    location: 'Toronto, ON',
    grad: 'Class of 2024',
    // Empty until real course names are dropped in — nothing renders
    // for this until then (see the coursework block below), rather
    // than shipping placeholder/invented course names.
    coursework: [],
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
// The full ordered walkthrough for "Start the tour" — every exhibit,
// in the same order the sidebar lists them, ending with a trip back
// to the Introduction plate.
const TOUR_SEQUENCE = [
  ...EXPERIENCE.map((e) => e.path),
  ...PROJECTS.map((p) => p.path),
  EDUCATION.path,
  '/skills',
  '/live/leetcode',
  '/live/activity',
  '/analyzer/score',
  '/',
]

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

// What the guide "says" on the overview cards — one summary per
// section, since a card stands for the whole group (all 3 Field Work
// entries, both projects), not any one exhibit inside it.
const GUIDE_LINES = {
  'Introduction': "You're just in time — the doors are still open. I'm Edgar, come on in.",
  'Field Work': 'Two internships and the job that came after graduating.',
  'Studio Projects': "Stuff I built because I wanted to, not because someone assigned it.",
  'Education': 'Where it started, for what it’s worth.',
  'Toolkit': 'What I actually reach for day to day.',
  'Live Demonstrations': "These are real and running — go ahead, try them.",
}

// What he says once you're actually standing at one specific exhibit
// — every fact here is already sitting in that entry's own data
// (a stat, a highlight, the note), just spoken instead of read. This
// is the difference between "reactive" and "one line per section":
// the three Field Work pages used to share the exact same caption;
// now each gets its own, tied to what's actually on that page.
const EXHIBIT_LINES = {
  aws: 'Ten thousand requests a second, and I still answered the pager.',
  'tangerine-2021': 'Second summer, same bank — this time I was in the deploy pipeline.',
  'tangerine-2020': 'The first one — cut build errors in half with Maven before anything else.',
  ascend: "Meta moment: you're looking at the project I'm describing right now.",
  oncall: "Three days, one team, first place — still the fastest I've ever shipped something.",
  york: 'Everything above traces back here, four years earlier.',
  leetcode: 'Live-pulled from LeetCode — refresh and the numbers actually move.',
  activity: 'Every entry here is one I actually logged.',
  analyzer: "Drop your résumé in — I'm curious what it says about you.",
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

// Big-number callouts for an entry's headline stats — same facts
// already in its highlight sentences, just pulled out and given a
// treatment that actually catches the eye instead of staying buried
// mid-paragraph. `accent` overrides the site's sage green for entries
// that want their own visual identity (currently just AWS).
function StatRow({ stats, accent }) {
  return (
    <div className="exh-stat-row" style={accent ? { '--exh-stat-accent': accent } : undefined}>
      {stats.map((s) => (
        <div key={s.label} className="exh-stat">
          <span className="exh-stat-value">{s.value}</span>
          <span className="exh-stat-label">{s.label}</span>
        </div>
      ))}
    </div>
  )
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

// Connects consecutive points with a gentle wiggle (a quadratic curve
// per segment, control point offset perpendicular to that segment,
// alternating sides) instead of straight lines — reads as a wandering
// trail rather than a ruler-straight connector.
function buildTrailPath(points) {
  if (points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1]
    const p1 = points[i]
    const mx = (p0.x + p1.x) / 2
    const my = (p0.y + p1.y) / 2
    const dx = p1.x - p0.x
    const dy = p1.y - p0.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const bend = (i % 2 === 0 ? 1 : -1) * Math.min(36, len * 0.18)
    d += ` Q ${mx + nx * bend} ${my + ny * bend}, ${p1.x} ${p1.y}`
  }
  return d
}

// A winding trail behind the Introduction plate that actually connects
// the guide's home corner to each of the 5 exhibit cards — measured
// from their real on-screen positions (not guessed coordinates), so it
// stays accurate across viewport widths and however the grid reflows.
function IntroPath({ wrapEl, cardRefs }) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [points, setPoints] = useState([])

  useLayoutEffect(() => {
    // wrapEl is DOM-node state (set by a callback ref), not a stable
    // ref object — so this effect actually re-runs once the node goes
    // from null to real, instead of only ever firing once on a ref
    // object whose identity never changes.
    if (!wrapEl) return

    function measure() {
      const wrapRect = wrapEl.getBoundingClientRect()
      setBox({ w: wrapRect.width, h: wrapRect.height })

      // Home: roughly where the guide's corner spot is, so the trail
      // reads as starting from him.
      const home = { x: wrapRect.width - 40, y: wrapRect.height + 40 }
      const cardPoints = Object.entries(cardRefs.current)
        .filter(([, el]) => el)
        .map(([, el]) => {
          const r = el.getBoundingClientRect()
          return {
            x: r.left + r.width / 2 - wrapRect.left,
            y: r.top + r.height / 2 - wrapRect.top,
          }
        })
      setPoints([home, ...cardPoints])
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrapEl)
    return () => ro.disconnect()
  }, [wrapEl, cardRefs])

  if (points.length < 2 || box.w === 0) return null

  return (
    <svg
      className="exh-intro-path"
      viewBox={`0 0 ${box.w} ${box.h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={buildTrailPath(points)} fill="none" className="exh-intro-path-line" />
      {points.slice(1).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" className="exh-intro-path-dot" />
      ))}
    </svg>
  )
}

// Corner brackets — the classic display-case/vitrine framing device.
// Four small fixed-size L-shapes rather than a scaled SVG, so they
// stay crisp corners regardless of how tall/wide the frame's content
// makes it (a stretched viewBox would distort them into unequal arms).
function CaseBrackets() {
  return (
    <>
      <span className="exh-case-bracket exh-case-bracket--tl" aria-hidden="true" />
      <span className="exh-case-bracket exh-case-bracket--tr" aria-hidden="true" />
      <span className="exh-case-bracket exh-case-bracket--br" aria-hidden="true" />
      <span className="exh-case-bracket exh-case-bracket--bl" aria-hidden="true" />
    </>
  )
}

// Small laurel-branch flourish flanking the entrance banner's name —
// the one bit of ornamental "museum plaque" artwork on the page,
// hand-drawn as inline SVG rather than a sourced image so it stays
// crisp at any size and needs no licensing story. Mirrored via CSS
// transform for the right-hand side.
function BannerFlourish({ flip }) {
  return (
    <svg
      className="exh-banner-flourish"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      width="34" height="18" viewBox="0 0 34 18" fill="none" aria-hidden="true"
    >
      <path d="M2 9 C 12 2, 24 2, 32 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M7 8.6c1.6-3 4.3-4 6.2-3M13 7c1.6-3 4.3-4 6.2-3M19 5.6c1.6-3 4.3-4 6.2-3"
            stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

// Icons for the contact row — recognizable brand marks for GitHub/
// LinkedIn (standard, widely-reused glyph paths — the same shapes
// every portfolio site uses to link out to a profile) plus plain
// generic glyphs for email/download so the row reads as a set of
// real buttons instead of bare underlined text.
function GitHubIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}
function LinkedInIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}
function EmailIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  )
}
function DownloadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  )
}

// Studio Projects have no real-world logo to show (they're personal
// work, not an employer), so each gets a small hand-drawn icon badge
// instead — same "big emblem" treatment as the company logos on
// Field Work/Education, just built from a glyph instead of a
// sourced image.
function AscendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6l1.5 1.5L8 5" />
      <path d="M11 6h9" />
      <path d="M4 12l1.5 1.5L8 11" />
      <path d="M11 12h9" />
      <path d="M4 18l1.5 1.5L8 17" />
      <path d="M11 18h9" />
    </svg>
  )
}
function OnCallIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  )
}

// A dozen small particles bursting outward from where the guide
// lands center-stage — mounted fresh once per celebrateTick (the
// parent keys it), so building the angles/distances directly in the
// function body is enough; no memoization needed for something that
// only exists for under a second and remounts clean every time.
function TourBurst() {
  const count = 12
  const particles = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (Math.random() * 0.3 - 0.15)
    const distance = 70 + Math.random() * 60
    return {
      tx: Math.cos(angle) * distance,
      ty: Math.sin(angle) * distance,
      delay: Math.random() * 0.12,
      size: 4 + Math.random() * 4,
    }
  })
  return (
    <div className="exh-tour-burst" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className="exh-tour-burst-particle"
          style={{
            '--tx': `${p.tx}px`,
            '--ty': `${p.ty}px`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

function ExhibitFrame({ section, plate, title, note, byline, emblem, emblemVariant = 'logo', flashAccent, noBrackets, children }) {
  return (
    <div className="exh-frame">
      {/* Skipped on the Introduction plate (noBrackets) — that page
          already has a bracketed set on each of its 5 exhibit cards
          below, so a 6th set framing the plate itself just piled on
          more corners rather than reading as "under glass." Every
          other, single-exhibit plate keeps the vitrine framing. */}
      {!noBrackets && <CaseBrackets />}
      <div className="exh-eyebrow">
        {plate && <PlateMark n={plate} />}
        <span className="exh-eyebrow-text">{section}</span>
      </div>
      <div className="exh-frame-head">
        <div className="exh-frame-head-text">
          {title && <h1 className="exh-title">{title}</h1>}
          {note && <p className="exh-note">{note}</p>}
        </div>
        {emblem && (
          <div
            className={`exh-frame-emblem ${emblemVariant === 'icon' ? 'exh-frame-emblem--icon' : ''} ${flashAccent ? 'exh-frame-emblem--flash' : ''}`}
            style={flashAccent ? { '--exh-flash-accent': flashAccent } : undefined}
          >
            {emblem}
          </div>
        )}
      </div>
      {byline && <p className="exh-byline">{byline}</p>}
      {children}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function RecruiterView() {
  // Defaults to light (not the tracker app's own dark default) and
  // uses its own storage key — a recruiter landing here fresh
  // shouldn't get dropped into a near-black page, and toggling theme
  // here shouldn't flip Edgar's own tracker app to match.
  const { theme, toggleTheme } = useTheme('light', 'portfolio-theme')
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

  // Mobile gets a deliberately simpler page, not a shrunk-down copy
  // of the desktop one: no 3D guide, no speech bubble, no floor, no
  // guided tour. That whole system carries real weight (a WebGL
  // bundle, positioning math tuned for a big screen) for something
  // that reads as gimmicky rather than charming at phone size —
  // simpler to just not build the page around it there, and let
  // sidebar/card navigation (already the manual fallback on desktop
  // too) be the whole story.
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 860)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 860)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // The guide stands in the corner everywhere except the Introduction
  // plate, where "Start the tour" summons him to center stage. Resets
  // when you leave the Introduction plate, so returning later starts
  // fresh rather than staying centered forever.
  const [tourStarted, setTourStarted] = useState(false)
  useEffect(() => {
    if (activeId !== 'root') setTourStarted(false)
  }, [activeId])

  // The guided tour: once started, steps through TOUR_SEQUENCE in
  // order. Stop 1 happens on its own, right after the "Start the
  // tour" celebration beat (see the auto-advance effect below) —
  // every stop after that waits for an explicit "Next stop" click
  // (advanceTour) rather than moving on a timer. Any manual
  // navigation elsewhere (sidebar, a card, browser back/forward)
  // cancels it — see handleCardClick and the sidebar button below —
  // so it never fights a visitor who takes over.
  const [autoTourActive, setAutoTourActive] = useState(false)
  const [autoTourStep, setAutoTourStep] = useState(0)
  // True for the moment right after the tour finishes on its own
  // (last stop is always back home) — distinct from just "not
  // active," since that's also true before a tour ever started.
  // Drives the finale beat: visitors drift in from the edges and the
  // contact links get a spotlight, nudging toward "now go connect."
  const [tourFinale, setTourFinale] = useState(false)
  // Bumped once per "Start the tour" click — gives the guide his hop
  // -and-spin flourish and the page a brief spotlight dim, so hitting
  // the button reads as an event instead of a plain state change.
  const [celebrateTick, setCelebrateTick] = useState(0)

  function startAutoTour() {
    setTourStarted(true)
    setAutoTourActive(true)
    setAutoTourStep(0)
    setTourFinale(false)
    setCelebrateTick((t) => t + 1)
  }

  // Any deliberate manual navigation (a card, the sidebar, the stop
  // button) cancels the tour and clears the finale — a visitor taking
  // over shouldn't stay parked in "just finished" mode.
  function cancelAutoTour() {
    setAutoTourActive(false)
    setTourFinale(false)
  }

  // Mirrors autoTourActive into a ref so the delayed auto-advance
  // below — a setTimeout scheduled once per "Start the tour" click —
  // can check the LATEST value when it fires instead of the one
  // captured when it was scheduled. Without this, clicking "Stop the
  // tour" during the guide's hop-in beat wouldn't actually stop him
  // from walking off to stop 1 a moment later anyway.
  const autoTourActiveRef = useRef(false)
  useEffect(() => { autoTourActiveRef.current = autoTourActive }, [autoTourActive])

  // "Start the tour" takes him to stop 1 on his own, right after his
  // hop-in celebration on the Introduction plate — only stop 2 onward
  // wait for an explicit "Next stop" click. The delay just clears
  // that celebration beat (the flash/spotlight/burst below run ~1.6s)
  // rather than needing to be frame-perfect against it. Keyed to
  // celebrateTick alone so it only ever fires from a fresh "Start the
  // tour" click, never from unrelated state changes mid-tour.
  useEffect(() => {
    if (celebrateTick === 0 || !autoTourActive) return
    const timer = setTimeout(() => {
      if (!autoTourActiveRef.current) return
      const path = TOUR_SEQUENCE[0]
      navigate(path === '/' ? '/portfolio' : `/portfolio${path}`)
      setAutoTourStep(1)
    }, 1700)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrateTick])

  // Called only by the "Next stop" click — takes the guide to the
  // current step's page. On the last stop (always back home), it
  // navigates AND ends the tour in the same click, so there's no
  // dangling extra click once you're already back at the start.
  function advanceTour() {
    const path = TOUR_SEQUENCE[autoTourStep]
    const isLastStop = autoTourStep === TOUR_SEQUENCE.length - 1
    navigate(path === '/' ? '/portfolio' : `/portfolio${path}`)
    if (isLastStop) {
      setAutoTourActive(false)
      setTourFinale(true)
    } else {
      setAutoTourStep((s) => s + 1)
    }
  }

  // Refs for measuring the 5 exhibit cards' real on-screen positions,
  // so the background trail (IntroPath) can actually connect to them.
  const [introWrapEl, setIntroWrapEl] = useState(null)
  const cardRefs = useRef({})

  // Clicking an exhibit card sends the guide walking to that exact
  // card first, then opens the page a beat later — instead of
  // teleporting straight there. { right, bottom } are computed from
  // the clicked card's own on-screen position, in the same units the
  // corner/hero CSS already uses, so the position transition can
  // animate to literally anywhere, not just the two fixed spots.
  const [guideTargetRect, setGuideTargetRect] = useState(null)
  const [walkTick, setWalkTick] = useState(0)

  function handleCardClick(e, path) {
    cancelAutoTour()
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

  // Corner mode used to anchor him to the raw viewport corner
  // (right: 20px, bottom: 12px), completely independent of where the
  // actual content column sits — on a wide window that leaves a huge
  // dead gap between the last content and him. Measuring the real
  // .exh-frame instead and deriving his resting spot from ITS edges
  // means he stands right where the content actually ends, on every
  // page, at any window size — not a fixed distance from an
  // unrelated screen corner. Skipped in hero mode, which already has
  // its own deliberate centered position.
  const [guideHomeRect, setGuideHomeRect] = useState(null)
  useLayoutEffect(() => {
    if (guideIsHero) return
    const el = document.querySelector('.exh-frame')
    if (!el) { setGuideHomeRect(null); return }

    function measure() {
      // Below this width the sidebar collapses and the whole layout
      // stacks — content and the guide are already close together
      // there, so defer entirely to the simpler mobile CSS corner
      // position instead of fighting it with a computed one.
      if (window.innerWidth <= 860) { setGuideHomeRect(null); return }
      const wrapEl = document.querySelector('.exh-guide-wrap')
      if (!wrapEl) return
      const rect = el.getBoundingClientRect()
      // right/bottom position the WRAP'S OWN right/bottom edge — with
      // align-items: flex-end the wrap grows leftward and upward from
      // that anchor, so its own width/height have to be subtracted or
      // "just past the frame's edge" still leaves the wrap's body
      // (and the caption, which is often wider than the canvas)
      // overlapping the content instead of clearing it. Measuring the
      // wrap's actual current size — stable regardless of where it's
      // positioned — makes this correct for any caption length or
      // guide size instead of assuming one.
      const wrapRect = wrapEl.getBoundingClientRect()
      const GAP = 28
      const right = Math.max(20, window.innerWidth - rect.right - GAP - wrapRect.width)
      const rawBottom = window.innerHeight - rect.bottom - GAP - wrapRect.height
      // Clamp so a very tall page never pushes him below the fold and
      // a very short one never floats him implausibly close to the
      // top — he stays in a believable "standing in the room" range.
      const bottom = Math.min(Math.max(rawBottom, 12), window.innerHeight * 0.5)
      setGuideHomeRect({ right, bottom })
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [activeId, guideIsHero, autoTourActive, tourFinale])

  function renderBody() {
    if (activeId === 'root') {
      return (
        <div className="exh-intro-wrap" ref={setIntroWrapEl}>
          <IntroPath wrapEl={introWrapEl} cardRefs={cardRefs} />
          <ExhibitFrame
            section="Introduction"
            title="Edgar Setyan"
            byline="SDE I, AWS RDS · Toronto, ON"
            noBrackets
          >
            <p className="exh-intro-text">
              {isMobile
                ? "A small collection of the work behind my résumé — laid out the way I'd want to browse someone else's. Pick a piece below to dig in."
                : "A small collection of the work behind my résumé — laid out the way I'd want to browse someone else's. Pick a piece from the list on the left, or start the tour below."}
            </p>
            <div className={`exh-root-links ${tourFinale ? 'exh-root-links--spotlight' : ''}`}>
              <a href="https://github.com/edgarsetyan23" target="_blank" rel="noopener noreferrer" className="exh-root-link">
                <span className="exh-root-link-icon"><GitHubIcon /></span> GitHub
              </a>
              <a href="https://www.linkedin.com/in/edgarsetyan/" target="_blank" rel="noopener noreferrer" className="exh-root-link">
                <span className="exh-root-link-icon"><LinkedInIcon /></span> LinkedIn
              </a>
              <a href="mailto:edgar.setyan23@gmail.com" className="exh-root-link">
                <span className="exh-root-link-icon"><EmailIcon /></span> edgar.setyan23@gmail.com
              </a>
              <a href="/Edgar_Resume.pdf" download="Edgar_Setyan_Resume.pdf" className="exh-root-link exh-root-link--primary">
                <span className="exh-root-link-icon"><DownloadIcon /></span> Download résumé
              </a>
            </div>

            {!isMobile && (
              <button
                className="exh-start-tour"
                onClick={autoTourActive ? cancelAutoTour : startAutoTour}
              >
                {autoTourActive ? 'Stop the tour ✕' : tourStarted ? 'Pick a stop below ↓' : "Come on, I'll show you around →"}
              </button>
            )}

            <div className="exh-tour-grid">
              {NAV_GROUPS.filter((g) => g.label !== 'Introduction').map((group, i) => (
                <button
                  key={group.label}
                  ref={(el) => { cardRefs.current[group.label] = el }}
                  className="exh-card exh-fade-in"
                  style={{ animationDelay: `${200 + i * 90}ms` }}
                  onClick={(e) => handleCardClick(e, group.items[0].path)}
                >
                  <div className="exh-card-eyebrow">
                    <PlateMark n={String(i + 1).padStart(2, '0')} />
                    {CARD_LOGOS[group.label] && (
                      <div className="exh-card-logos">
                        {CARD_LOGOS[group.label].map((logo) => (
                          <span key={logo.alt} className="exh-card-logo-chip">
                            <img src={logo.src} alt={logo.alt} />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="exh-card-label">{group.label}</span>
                  <span className="exh-card-teaser">{GUIDE_LINES[group.label]}</span>
                  <span className="exh-card-count">
                    {group.items.length} {group.items.length === 1 ? 'entry' : 'entries'} →
                  </span>
                </button>
              ))}
            </div>
          </ExhibitFrame>
        </div>
      )
    }

    const exp = EXPERIENCE.find((e) => e.id === activeId)
    if (exp) {
      return (
        <ExhibitFrame section="Field Work" plate={exp.plate} note={exp.note}
          title={exp.data.role} byline={`${exp.data.company} · ${exp.data.location} · ${exp.data.period}`}
          emblem={exp.logo && <img src={exp.logo} alt={exp.data.company} />}
          flashAccent={exp.flashAccent}>
          {exp.intro && <p className="exh-intro-text">{exp.intro}</p>}
          {exp.stats && <StatRow stats={exp.stats} accent={exp.flashAccent} />}
          <HighlightList items={exp.data.highlights} />
        </ExhibitFrame>
      )
    }

    const proj = PROJECTS.find((p) => p.id === activeId)
    if (proj) {
      return (
        <ExhibitFrame section="Studio Projects" plate={proj.plate} note={proj.note}
          title={proj.data.name} byline={proj.data.stack}
          emblem={proj.id === 'ascend' ? <AscendIcon /> : <OnCallIcon />} emblemVariant="icon">
          <HighlightList items={proj.data.highlights} />
          {proj.snippet && <DetailPanel file={proj.snippet.file} code={proj.snippet.code} />}
        </ExhibitFrame>
      )
    }

    if (activeId === 'york') {
      return (
        <ExhibitFrame section="Education" plate={EDUCATION.plate} note={EDUCATION.note}
          title={EDUCATION.data.school} byline={`${EDUCATION.data.degree} · ${EDUCATION.data.grad}`}
          emblem={<img src={EDUCATION.logo} alt={EDUCATION.data.school} />}>
          {EDUCATION.data.coursework?.length > 0 && (
            <div className="exh-skills">
              <div className="exh-skill-row">
                <span className="exh-skill-category">Coursework</span>
                <div className="exh-pills">
                  {EDUCATION.data.coursework.map((c) => (
                    <span key={c} className="exh-pill exh-pill--tag">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </ExhibitFrame>
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
          {autoTourActive && !isMobile && (
            <>
              <button className="exh-tour-next-btn" onClick={advanceTour}>
                {autoTourStep === TOUR_SEQUENCE.length - 1 ? 'Back to start →' : 'Next stop →'}
              </button>
              <button className="exh-tour-stop-btn" onClick={cancelAutoTour}>
                ⏸ Stop tour
              </button>
            </>
          )}
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <Link to="/" className="exh-back-link">← Back to app</Link>
        </div>
      </nav>

      {/* Full-bleed entrance sign — spans the whole page, not just the
          content column next to the sidebar, so it actually sits dead
          center of the page instead of centered within a narrow
          column that itself sits left-of-center. Introduction only. */}
      {activeId === 'root' && (
        <div className="exh-museum-banner">
          <span className="exh-museum-banner-eyebrow">Welcome to the</span>
          <div className="exh-museum-banner-row">
            <BannerFlourish />
            <span className="exh-museum-banner-name">The Edgar Setyan Gallery</span>
            <BannerFlourish flip />
          </div>
        </div>
      )}

      <div className="exh-shell">
        <aside className="exh-sidebar">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="exh-nav-group">
              <div className="exh-nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`exh-nav-item ${activeId === item.id ? 'exh-nav-item--active' : ''}`}
                  onClick={() => { cancelAutoTour(); navigate(item.path === '/' ? '/portfolio' : `/portfolio${item.path}`) }}
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

      {!isMobile && (
        <div
          className={`exh-guide-wrap ${guideIsHero ? 'exh-guide-wrap--hero' : ''}`}
          style={
            guideTargetRect
              ? { right: `${guideTargetRect.right}px`, bottom: `${guideTargetRect.bottom}px`, transform: 'translate(0, 0)' }
              : !guideIsHero && guideHomeRect
              ? { right: `${guideHomeRect.right}px`, bottom: `${guideHomeRect.bottom}px`, transform: 'translate(0, 0)' }
              : undefined
          }
        >
          <div key={`${activeId}-${tourStarted}-${walkTick}`} className="exh-guide-caption exh-fade-in">
            {guideTargetRect
              ? 'On my way →'
              : tourFinale
              ? "That's the tour! I'd love to actually connect — pick one below."
              : guideIsHero
              ? "Alright, let's start with the first stop →"
              : EXHIBIT_LINES[activeId] ?? GUIDE_LINES[ID_TO_GROUP[activeId]] ?? GUIDE_LINES['Introduction']}
            {/* Points at wherever his head actually is. His head sits
                exactly on the model's Y-rotation axis, so idle sway,
                walking, and the click-spin never move it off-center —
                canvas-center is always his head, in both corner and
                hero mode. Corner mode right-aligns the caption and
                canvas to the same edge, so "half the canvas width
                in from that edge" lands the tail right above him;
                hero mode already centers everything, so its own CSS
                override (no inline style here) is already correct. */}
            <span
              className="exh-speech-tail"
              style={!guideIsHero ? { right: guideSize / 2 - 7.5 } : undefined}
              aria-hidden="true"
            />
          </div>
          <Suspense fallback={<div className="exh-guide-canvas" style={{ width: guideSize, height: guideSize }} />}>
            <TourGuide
              accentColor={theme === 'dark' ? ACCENT.dark : ACCENT.light}
              size={guideSize}
              walkKey={`${activeId}-${tourStarted}-${walkTick}`}
              celebrateKey={celebrateTick}
            />
          </Suspense>
        </div>
      )}
      {/* Three layers for the "Start the tour" moment, all keyed to
          celebrateTick so they replay every click, not just the
          first: a quick bright flash announcing the spot he's headed
          to, a slower dim-and-lift on everything else as he glides
          there, and a burst of particles once he arrives. None of it
          needs to be frame-perfect against the 1s CSS glide; roughly
          bracketing it reads as one moment either way. */}
      {!isMobile && guideIsHero && (
        <>
          <div key={`flash-${celebrateTick}`} className="exh-tour-flash" aria-hidden="true" />
          <div key={`dim-${celebrateTick}`} className="exh-spotlight" aria-hidden="true" />
          <TourBurst key={`burst-${celebrateTick}`} />
        </>
      )}
    </div>
  )
}
