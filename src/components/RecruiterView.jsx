import { ErrorBoundary } from './ErrorBoundary.jsx'
import { useEffect, useLayoutEffect, useRef, useState, lazy, Suspense } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { listPublicEntries } from '../lib/publicApi.js'
import { useTheme } from '../hooks/useTheme.js'
import { ThemeToggle } from './ThemeToggle.jsx'
import { LeetCodeProfile } from './LeetCodeProfile.jsx'
import { ActivityLog } from './ActivityLog.jsx'
import activityTracker from '../trackers/activity.js'
import { AscendCaseStudy } from './portfolio/AscendCaseStudy.jsx'
import { JobRelayCaseStudy } from './portfolio/JobRelayCaseStudy.jsx'
import { updatePortfolioMetadata } from '../lib/portfolioPages.js'
import { prefersReducedMotion } from '../utils/motion.js'
import '../styles/exhibit-view.css'

// Three.js is real weight — split it into its own chunk so it only
// downloads once someone actually lands on /portfolio, not as part of
// the base app bundle.
const TourGuide = lazy(() => import('./TourGuide.jsx').then((m) => ({ default: m.TourGuide })))
const PortfolioResumeReview = lazy(() => import('./portfolio/PortfolioResumeReview.jsx'))
const ACCENT = { light: '#4f7a63', dark: '#8fc2a6' }

// ── Resume data ─────────────────────────────────────────────────────────────
// "The Exhibit" — every entry is a plate in a small collection. (No
// plate numbers on screen — they were decoration, not navigation.)
// No invented content: every
// fact below is the same one on the PDF resume, just laid out as prose
// instead of a resume-shaped list of bullets.

const EXPERIENCE = [
  {
    id: 'aws',
    path: '/experience/aws',
    navTitle: 'Amazon Web Services',
    navSub: '2025 – 2026',
    note: 'My first job after graduating.',
    logo: '/logos/aws.svg',
    // Real AWS brand orange — used only here, as a deliberate one-off
    // accent so this entry (most recent job, most weight on the
    // résumé) visually pops against the site's uniform sage green
    // rather than blending in with every other plate.
    flashAccent: '#FF9900',
    // Same numbers already sitting in the highlight sentences below —
    // pulled out, not invented, given a big-number callout instead of
    // staying buried mid-paragraph. Verified production work leads;
    // the load-test number is a design target, not a measured result,
    // so it's labeled as one and kept last rather than leading with an
    // unqualified "10,000+" that would read as achieved throughput.
    // The target stays fused to its qualifier in the VALUE itself
    // ("10,000+ TPS target") — the caption doesn't need to also spell
    // out "not measured production traffic" on top of that; the
    // qualifier only needs to appear once, not in every element that
    // touches this number (see the intro paragraph and highlights
    // below, which state it plainly a single time each).
    stats: [
      { value: '25+', label: 'on-call incidents resolved' },
      { value: '60+', label: 'AWS accounts · stale deployments remediated' },
      // Non-breaking space: at the lead size this wraps, and "TPS target"
      // should break as a unit rather than leave "target" on its own.
    ],
    // A prose lede synthesized from the highlights below — same facts,
    // woven into a paragraph instead of only existing as bullet
    // fragments. Status wording matches the résumé: the config API's
    // logic was "approved ahead of integration", and the load-test
    // work stayed a prototype built toward a design target.
    // No new claims added beyond what the highlights below state.
    intro: "On the RDS team in Toronto, I worked on Java backend logic and production operations. The work included an instance-configuration API, a local load-testing prototype, and the on-call rotation.",
    data: {
      company: 'Amazon Web Services (AWS)',
      role: 'Software Development Engineer I, RDS Team',
      location: 'Toronto, ON',
      // Through April 2026: still under contract (and paid) until then.
      period: 'Jan 2025 – Apr 2026',
      highlights: [
        'Implemented core Java logic for a synchronous RDS instance-configuration API with DynamoDB persistence and CloudWatch instrumentation; implementation approved ahead of integration.',
        'Developed a local load-testing prototype for a distributed telemetry service with a 10,000+ TPS design target, adding ECS task-health and CPU monitoring to investigate capacity and surface bottlenecks.',
        'Supported on-call for a metrics ingestion service; triaged and resolved 25+ production incidents, executed mitigations via runbooks, and delivered follow-up fixes to prevent recurrence.',
        'Remediated stale CloudFormation deployments across 60+ AWS accounts by auditing stacks, removing failed/obsolete resources, and safely re-deploying to restore consistent infrastructure.',
      ],
    },
  },
  {
    id: 'tangerine-2021',
    path: '/experience/tangerine/2021',
    navTitle: 'Tangerine Bank',
    navSub: 'Summer 2021',
    note: 'My second internship — same company, a year later.',
    logo: '/logos/tangerine.svg',
    // A prose lede synthesized purely from the highlights below (no
    // new facts). Deliberately lighter than AWS — no stat callouts —
    // so the most recent, most substantial entry carries more weight
    // instead of every plate using the same template.
    intro: 'Second summer at Tangerine, one step further into the stack: Java components for a high-traffic application, then SQL and indexing work to cut query latency. By the end of it I was in the deploy pipeline itself — tightening Docker configs and supporting Kubernetes operations, which cut deployment errors by 20%.',
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
    navTitle: 'Tangerine Bank',
    navSub: 'Summer 2020',
    note: 'My first internship — where it started.',
    logo: '/logos/tangerine.svg',
    intro: 'First internship, first real production codebase: building features for a high-performance Java application with scalable design in mind, then automating the build process with Maven — cutting build errors in half and improving CI reliability and developer velocity.',
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
    id: 'jobrelay',
    path: '/projects/jobrelay',
    navTitle: 'JobRelay',
    navSub: 'Async Job Processing',
    note: 'A project about what happens to a job when something breaks.',
    repoUrl: 'https://github.com/edgarsetyan23/jobrelay',
    data: {
      name: 'JobRelay — Asynchronous Job Processing',
      stack: 'TypeScript, Express, PostgreSQL, Redis, BullMQ',
      summary: 'An image-processing service built to accept jobs durably and recover when Redis or a worker fails. The local dashboard lets you trigger failures and follow each attempt.',
      // Same three bullets as the résumé. The benchmark keeps its full
      // qualifier (concurrency 4, local 40-job synthetic run) so it
      // never reads as a production throughput number.
      highlights: [
        'Built a TypeScript/Express image-processing service with PostgreSQL, Redis, and BullMQ; implemented a transactional outbox to durably accept jobs during Redis outages and dispatch them after recovery.',
        'Implemented idempotent submissions, bounded retries with exponential backoff and jitter, and worker-crash recovery; built a live dashboard for job status, attempt history, and fault injection.',
        'Added integration tests for duplicate delivery, Redis outages, and real worker termination; benchmarked 76.3 completed jobs/sec at concurrency 4 in a local 40-job synthetic-image run.',
      ],
    },
  },
  {
    id: 'ascend',
    path: '/projects/ascend',
    navTitle: 'Ascend',
    navSub: 'Accountability Tracker',
    note: "A tracker and the portfolio built on top of it.",
    repoUrl: 'https://github.com/edgarsetyan23/Ascend',
    data: {
      name: 'Ascend — Personal Accountability Platform',
      stack: 'React 18, Vite, AWS Lambda, DynamoDB, API Gateway, Cognito, CDK, Node 22, Vercel',
      summary: 'A tracker for applications, coding practice, and activity, with a public portfolio attached. The Gmail importer suggests application updates for review before anything is saved.',
      highlights: [
        'Built a Gmail importer that sends each email’s subject, sender, date, and a short snippet to Claude Haiku and suggests new applications and status updates; every suggestion is shown for review, and only the ones I select are saved.',
        'Protected the AI endpoints with per-instance rate limits, a two-call concurrency cap, and request size caps.',
      ],
    },

  },
  {
    id: 'oncall',
    path: '/projects/oncall-assistant',
    navTitle: 'On-Call Assistant',
    navSub: 'Hackathon, 1st place',
    note: 'A team hackathon win; I built the diagnostic routing.',
    data: {
      name: 'On-Call Debugging Assistant',
      stack: 'AWS Lambda, Internal Web App — 1st place, AWS RDS Toronto Hackathon',
      summary: 'A team hackathon project that turns an incident ticket into a guided troubleshooting checklist, using three diagnostic playbooks. It won first place at the AWS RDS Toronto hackathon.',
      highlights: [
        "Wrote the diagnostic routing script: it matched distinctive keywords in the incident ticket to one of three troubleshooting playbooks, then ran CPU, connection, storage, and recent-error checks on the affected database to drive the playbook's next steps.",
        'Won 1st place in a 3-day team hackathon for faster, more consistent overnight incident triage.',
      ],
    },
  },
]

const EDUCATION = {
  id: 'york',
  path: '/education/york',
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

// Same groups and items as the résumé's Technical Skills section.
const SKILLS = {
  'Languages':         ['Java', 'Kotlin', 'Python', 'SQL', 'JavaScript', 'TypeScript'],
  'Frameworks & Data': ['Spring Boot', 'React', 'Node.js', 'Express', 'PostgreSQL', 'Redis', 'BullMQ', 'REST', 'GraphQL'],
  'AWS':               ['RDS', 'DynamoDB', 'Lambda', 'API Gateway', 'Cognito', 'ECS', 'CloudWatch', 'CloudFormation', 'CDK'],
  'Tools':             ['Docker', 'Kubernetes', 'Git', 'CI/CD', 'Linux', 'Maven', 'JUnit', 'Vitest'],
}

// ── Sidebar nav structure ────────────────────────────────────────────────────

const NAV_GROUPS = [
  { label: 'Introduction', items: [{ id: 'root', path: '/', navTitle: 'Overview', navSub: null }] },
  {
    label: 'Field Work',
    items: EXPERIENCE.map((e) => ({ id: e.id, path: e.path, navTitle: e.navTitle, navSub: e.navSub })),
  },
  {
    label: 'Studio Projects',
    items: PROJECTS.map((p) => ({ id: p.id, path: p.path, navTitle: p.navTitle, navSub: p.navSub })),
  },
  { label: 'Education', items: [{ id: 'york', path: EDUCATION.path, navTitle: EDUCATION.navTitle, navSub: EDUCATION.navSub }] },
  { label: 'Toolkit', items: [{ id: 'skills', path: '/skills', navTitle: 'Technical Skills', navSub: null }] },
  {
    label: 'Live Demonstrations',
    items: [
      { id: 'leetcode', path: '/live/leetcode', navTitle: 'Problem-Solving Log', navSub: 'Live' },
      { id: 'activity', path: '/live/activity', navTitle: 'Activity Archive', navSub: 'Past entries' },
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
// entries, all 3 projects), not any one exhibit inside it.
const GUIDE_LINES = {
  'Introduction': "Hi, I'm Edgar. Take a look at what I've built.",
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
  aws: 'Backend engineering and production operations on AWS RDS.',
  'tangerine-2021': 'Second summer, same bank — this time I was in the deploy pipeline.',
  'tangerine-2020': 'The first one — cut build errors in half with Maven before anything else.',
  jobrelay: 'Redis can go down and jobs still get accepted — the outbox holds them until it’s back.',
  ascend: 'The engineering behind this portfolio and my private trackers.',
  oncall: 'A ticket ID becomes a troubleshooting checklist. Built in three days.',
  york: 'Everything above traces back here — the CS fundamentals that made the AWS and Ascend work possible.',
  leetcode: 'Live-pulled from LeetCode — refresh and the numbers actually move.',
  activity: 'Every entry here is one I actually logged.',
  analyzer: "Drop your résumé in — I'm curious what it says about you.",
}

const ID_TO_GROUP = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((item) => [item.id, g.label]))
)

// ── Small building blocks ────────────────────────────────────────────────────

// Big-number callouts for an entry's headline stats — same facts
// already in its highlight sentences, just pulled out and given a
// treatment that actually catches the eye instead of staying buried
// mid-paragraph. `accent` overrides the site's sage green for entries
// that want their own visual identity (currently just AWS). `lead`
// is the oversized version that opens an exhibit, ahead of the prose.
function StatRow({ stats, accent, lead }) {
  return (
    <div className={`exh-stat-row ${lead ? 'exh-stat-row--lead' : ''}`} style={accent ? { '--exh-stat-accent': accent } : undefined}>
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

// ── Exhibit frame — every plate shares this shell ───────────────────────────

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
function JobRelayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="6" height="6" rx="1" />
      <rect x="15" y="14" width="6" height="6" rx="1" />
      <path d="M9 7h4a2 2 0 012 2v5" />
      <path d="M13 12l2 2 2-2" />
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
const PROJECT_ICONS = { jobrelay: JobRelayIcon, ascend: AscendIcon, oncall: OnCallIcon }

// A dozen small particles bursting outward from where the guide
// lands center-stage — mounted fresh once per celebrateTick (the
// parent keys it), so building the angles/distances directly in the
// function body is enough; no memoization needed for something that
// only exists for under a second and remounts clean every time.
function ExhibitFrame({ title, note, byline, emblem, emblemVariant = 'logo', flashAccent, noBrackets, children }) {
  return (
    <div className="exh-frame">
      {/* Skipped on the Introduction plate (noBrackets) — that page
          already has a bracketed set on each of its 5 exhibit cards
          below, so a 6th set framing the plate itself just piled on
          more corners rather than reading as "under glass." Every
          other, single-exhibit plate keeps the vitrine framing. */}
      {!noBrackets && <CaseBrackets />}
      <div className="exh-frame-head">
        <div className="exh-frame-head-text">
          {title && <h1 className="exh-title" tabIndex={-1}>{title}</h1>}
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
  const [feedErrors, setFeedErrors] = useState({})
  const [feedRetry, setFeedRetry] = useState(0)

  // Mobile gets a deliberately simpler page, not a shrunk-down copy
  // of the desktop one: no 3D guide, no speech bubble, no floor, no
  // guided tour. That whole system carries real weight (a WebGL
  // bundle, positioning math tuned for a big screen) for something
  // that reads as gimmicky rather than charming at phone size —
  // simpler to just not build the page around it there, and let
  // sidebar/card navigation (already the manual fallback on desktop
  // too) be the whole story.
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 1180)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 1180)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // The guide stands in the corner everywhere except the Introduction
  // plate, where "Start the tour" summons him to center stage. Resets
  // when you leave the Introduction plate, so returning later starts
  // fresh rather than staying centered forever.
  const [guideEnabled, setGuideEnabled] = useState(false)
  // Keep Mini Edgar visible on desktop, loading his scene after the text is ready.
  useEffect(() => {
    if (isMobile) return
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(() => setGuideEnabled(true), { timeout: 1200 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(() => setGuideEnabled(true), 400)
    return () => window.clearTimeout(id)
  }, [isMobile])
  const [tourStarted, setTourStarted] = useState(false)
  useEffect(() => {
    if (activeId !== 'root') setTourStarted(false)
  }, [activeId])

  // The case-study reveal on the Ascend exhibit — collapsed by
  // default so the exhibit stays scannable, expanded on demand via
  // "Show me the engineering". Resets on leaving the exhibit, same
  // reasoning as tourStarted above: coming back later should start
  // collapsed again, not stay expanded from a previous visit.
  const [showEngineering, setShowEngineering] = useState(false)
  useEffect(() => {
    if (activeId !== 'ascend') setShowEngineering(false)
  }, [activeId])

  // Plain "Show me the engineering" click: reveal it AND jump straight
  // to it, the same way "Try the sample workflow" already does for the
  // demo below. Without this, the only feedback from clicking is the
  // button's own label flipping to "Hide the engineering" — easy to
  // miss, since the section that just appeared renders well below the
  // fold. Skipped whenever pendingDemoFocus is already in flight (the
  // "Try the sample workflow" click below sets both flags at once and
  // wants the more specific demo-heading target, not the top of the
  // whole case study).
  useEffect(() => {
    if (!showEngineering || pendingDemoFocus) return
    const el = document.getElementById('ascend-case-study')
    if (!el) return
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    el.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEngineering])

  // "Try the sample workflow" — opens the case study (if collapsed)
  // and takes the visitor straight to the demo inside it, rather than
  // making them read down to the Explore section. Setting this flag
  // and showEngineering together, then reacting to the flag in an
  // effect below, means the scroll/focus attempt always happens AFTER
  // React has committed the case study (and the demo inside it) to
  // the DOM — never racing the render that adds them.
  const [pendingDemoFocus, setPendingDemoFocus] = useState(false)
  // Which plate this focus request was armed for — if the visitor
  // navigates away before the demo heading ever mounts there, the
  // request is stale and must be dropped (see below).
  const pendingDemoFocusIdRef = useRef(null)

  function goToSampleWorkflow() {
    setShowEngineering(true)
    setPendingDemoFocus(true)
    pendingDemoFocusIdRef.current = activeId
  }

  useEffect(() => {
    if (!pendingDemoFocus) return
    // Left the plate this was armed for before the heading showed up —
    // give up instead of leaving pendingDemoFocus stuck true forever.
    // Otherwise every later activeId change re-attaches a fresh
    // MutationObserver on .exh-main, and if the visitor ever comes back
    // to a plate where #ascend-demo-heading exists, this stale request
    // hijacks their scroll/focus out of nowhere.
    if (activeId !== pendingDemoFocusIdRef.current) {
      setPendingDemoFocus(false)
      return
    }

    function focusDemo() {
      const heading = document.getElementById('ascend-demo-heading')
      if (!heading) return false
      heading.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
      heading.focus({ preventScroll: true })
      return true
    }

    // Usually the demo heading is already in the DOM by the time this
    // effect runs (React commits state updates from the same click
    // together before effects fire) — but rather than assume that,
    // fall back to watching for it: covers a slow/interrupted render
    // instead of silently doing nothing if the elements aren't there
    // on the very first check.
    if (focusDemo()) {
      setPendingDemoFocus(false)
      return
    }
    const container = document.querySelector('.exh-main')
    if (!container) { setPendingDemoFocus(false); return }
    const observer = new MutationObserver(() => {
      if (focusDemo()) {
        observer.disconnect()
        setPendingDemoFocus(false)
      }
    })
    observer.observe(container, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pendingDemoFocus, activeId])

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
    setGuideEnabled(true)
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

  // The URL the tour ITSELF most recently navigated to — set at the
  // same moment as every navigate() call the tour makes, below. Lets
  // the effect further down tell "the tour just moved us here" apart
  // from "the visitor moved us here" (browser back/forward, editing
  // the URL, a bookmark) and cancel the tour only for the latter,
  // rather than an in-flight tour redirect silently overriding a
  // manual Back press a moment later.
  const tourNavPathRef = useRef(null)

  // "Start the tour" takes him to stop 1 on his own, right after his
  // hop-in celebration on the Introduction plate — only stop 2 onward
  // wait for an explicit "Next stop" click. The delay just clears
  // that celebration beat (the flash/spotlight/burst below run ~1.6s)
  // rather than needing to be frame-perfect against it — except for a
  // reduced-motion visitor, who gets none of that beat (it's all CSS
  // animation, stripped globally), so waiting 1.7s anyway would just
  // be a dead pause with nothing happening on screen. Keyed to
  // celebrateTick alone so it only ever fires from a fresh "Start the
  // tour" click, never from unrelated state changes mid-tour.
  useEffect(() => {
    if (celebrateTick === 0 || !autoTourActive) return
    const timer = setTimeout(() => {
      if (!autoTourActiveRef.current) return
      const path = TOUR_SEQUENCE[0]
      const to = path === '/' ? '/' : `/portfolio${path}`
      tourNavPathRef.current = to
      navigate(to)
      setAutoTourStep(1)
    }, prefersReducedMotion() ? 0 : 1700)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrateTick])

  // Any location change that the tour itself didn't just cause —
  // browser back/forward, editing the URL, a bookmark — cancels it.
  // Without this, pressing Back mid-tour could still get silently
  // overridden a moment later by an in-flight tour redirect (the
  // auto-advance-to-stop-1 timer above, or a "Next stop" click that
  // landed right before Back was pressed).
  useEffect(() => {
    if (autoTourActive && location.pathname !== tourNavPathRef.current) {
      cancelAutoTour()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Called only by the "Next stop" click — takes the guide to the
  // current step's page. On the last stop (always back home), it
  // navigates AND ends the tour in the same click, so there's no
  // dangling extra click once you're already back at the start.
  function advanceTour() {
    const path = TOUR_SEQUENCE[autoTourStep]
    const isLastStop = autoTourStep === TOUR_SEQUENCE.length - 1
    const to = path === '/' ? '/' : `/portfolio${path}`
    tourNavPathRef.current = to
    navigate(to)
    if (isLastStop) {
      setAutoTourActive(false)
      setTourFinale(true)
    } else {
      setAutoTourStep((s) => s + 1)
    }
  }


  // Exhibit cards are real <Link>s now — navigation is immediate and
  // native (open-in-new-tab, modifier-click, middle-click all just
  // work, for free, because it's an actual anchor). This handler is
  // purely cosmetic on top of that: it sends the guide walking toward
  // whichever card you clicked, then resets him a beat later. It
  // never gates or delays the navigation itself — { right, bottom }
  // are computed from the clicked card's own on-screen position, in
  // the same units the corner/hero CSS already uses.
  const [guideTargetRect, setGuideTargetRect] = useState(null)
  const [walkTick, setWalkTick] = useState(0)
  // Tracks the pending "walk's over, go back to resting" reset so a
  // second card click (or leaving the page) can clear a stale one
  // instead of it firing later and resetting state that's already
  // moved on.
  const cardWalkResetRef = useRef(null)
  useEffect(() => () => clearTimeout(cardWalkResetRef.current), [])
  // The plate we were on when the walk was armed. These cards are real
  // Links, so navigation to the destination plate happens immediately —
  // well before the 750ms timer above ever fires. Once activeId has
  // actually moved on, the clicked card's rect is a stale screen
  // position floating over whatever the new plate rendered there, so
  // the effect below drops it right away instead of riding out the rest
  // of a timer tuned for "still on the same page."
  const walkOriginIdRef = useRef(null)

  function handleCardClick(e) {
    cancelAutoTour()
    // No guide on mobile (isMobile) and no unsolicited motion for a
    // reduced-motion visitor — bail before touching any guide state.
    // A modifier/middle click opens the destination in a new tab or
    // window, where a walk animation playing in THIS tab toward a
    // page that just opened elsewhere would just be confusing.
    if (isMobile || prefersReducedMotion() || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    walkOriginIdRef.current = activeId
    const rect = e.currentTarget.getBoundingClientRect()
    setGuideTargetRect({
      right: window.innerWidth - (rect.left + rect.width / 2),
      bottom: window.innerHeight - (rect.top + rect.height / 2),
    })
    setWalkTick((n) => n + 1)
    clearTimeout(cardWalkResetRef.current)
    cardWalkResetRef.current = window.setTimeout(() => setGuideTargetRect(null), 750)
  }

  useEffect(() => {
    if (activeId !== walkOriginIdRef.current) {
      clearTimeout(cardWalkResetRef.current)
      setGuideTargetRect(null)
      walkOriginIdRef.current = activeId
    }
  }, [activeId])

  useEffect(() => { updatePortfolioMetadata(activeId) }, [activeId])

  const previousPathRef = useRef(null)
  useLayoutEffect(() => {
    if (previousPathRef.current === location.pathname) return
    const initialOverview = previousPathRef.current === null && location.pathname === '/'
    previousPathRef.current = location.pathname
    if (initialOverview) return
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.querySelector('.exh-title')?.focus({ preventScroll: true })
  }, [location.pathname])

  useEffect(() => {
    if (activeId !== 'leetcode' && activeId !== 'activity') return
    let cancelled = false
    const feed = activeId
    setLoading(true)
    setFeedErrors({})
    listPublicEntries(feed)
      .then(entries => {
        if (cancelled) return
        if (feed === 'leetcode') setLeetcode(entries)
        else setActivity(entries)
      })
      .catch(() => { if (!cancelled) setFeedErrors({ [feed]: true }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [activeId, feedRetry])

  const activeNavItem = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === activeId)
  const guideSize = 300

  const [guideHomeRect, setGuideHomeRect] = useState(null)
  useLayoutEffect(() => {
    if (activeId === 'root' || isMobile) return
    const column = document.querySelector('.exh-main')
    const wrap = document.querySelector('.exh-guide-wrap')
    if (!column || !wrap || window.innerWidth <= 1180) return
    function measure() {
      const rect = column.getBoundingClientRect()
      const guide = wrap.getBoundingClientRect()
      const contentRight = rect.right - parseFloat(getComputedStyle(column).paddingRight)
      const right = Math.max(20, window.innerWidth - contentRight - 28 - guide.width)
      const bottom = Math.min(Math.max(window.innerHeight - rect.bottom - 28 - guide.height, 12), window.innerHeight * 0.5)
      setGuideHomeRect({ right, bottom })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(column)
    observer.observe(wrap)
    window.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [activeId, isMobile, guideEnabled, autoTourActive, tourFinale])

  function renderGuideScene(size) {
    return (
          <ErrorBoundary compact compactTitle="Mini Edgar is unavailable"><Suspense fallback={<div className="exh-guide-canvas" style={{ width: size, height: size }} />}>
            <TourGuide
              accentColor={theme === 'dark' ? ACCENT.dark : ACCENT.light}
              size={size}
              walkKey={`${activeId}-${tourStarted}-${walkTick}`}
              celebrateKey={celebrateTick}
            />
          </Suspense></ErrorBoundary>
    )
  }

  function renderBody() {
    if (activeId === 'root') {
      return (
        <div className="exh-intro-wrap">
          <ExhibitFrame
            title="Edgar Setyan"
            byline="Software Engineer · Previously AWS RDS · Toronto, ON"
            noBrackets
          >
            {/* Leads with what I've built, not how to browse the site —
                a visitor should have the professional picture and the
                strongest evidence before ever being told to explore. */}
            <p className="exh-intro-text">
              I build backend services and tools that make production systems
              easier to operate.
            </p>
            {/* Short, unobtrusive — a statement of direction, not a
                banner. No claims about remote/relocation/seniority
                preferences that aren't actually decided. */}
            <p className="exh-availability-note">
              Currently looking for backend/cloud software engineering roles.
            </p>




            {/* Only "Download résumé" is a real button — it's the one
                action here that actually does something (starts a
                download). GitHub/LinkedIn/email are just where to find
                me, so they read as plain links (exh-root-link--plain),
                not three more boxes in a row. The AWS stats used to sit
                above this too; they now open the AWS plate instead of
                being repeated here. */}
            <div className={`exh-root-links ${tourFinale ? 'exh-root-links--spotlight' : ''}`}>
              <a href="https://github.com/edgarsetyan23" target="_blank" rel="noopener noreferrer" className="exh-root-link exh-root-link--plain">
                <span className="exh-root-link-icon"><GitHubIcon /></span> GitHub
              </a>
              <a href="https://www.linkedin.com/in/edgarsetyan/" target="_blank" rel="noopener noreferrer" className="exh-root-link exh-root-link--plain">
                <span className="exh-root-link-icon"><LinkedInIcon /></span> LinkedIn
              </a>
              <a href="mailto:edgar.setyan23@gmail.com" className="exh-root-link exh-root-link--plain">
                <span className="exh-root-link-icon"><EmailIcon /></span> edgar.setyan23@gmail.com
              </a>
              <a href="/Edgar_Resume.pdf" download="Edgar_Setyan_Resume.pdf" className="exh-root-link exh-root-link--primary">
                <span className="exh-root-link-icon"><DownloadIcon /></span> Download résumé
              </a>
            </div>

            {/* Featured work opens directly, independently of the tour. */}
            <div id="featured-work" className="exh-featured-row">
              <Link to={`/portfolio${EXPERIENCE[0].path}`} className="exh-featured-card">
                <img className="exh-featured-image" src="/previews/aws-rds.svg" alt="RDS engineering: backend services and production operations" width="800" height="400" />
                <span className="exh-featured-card-title">Amazon Web Services</span>
                <span className="exh-featured-card-why">
                  The year right after graduating — a load-testing prototype, real on-call pages, and a long AWS account cleanup.
                </span>
                <span className="exh-featured-card-arrow">Read the story →</span>
              </Link>
              <Link to="/portfolio/projects/jobrelay" className="exh-featured-card">
                <img className="exh-featured-image" src="/previews/jobrelay-dashboard.png" alt="JobRelay dispatch board with sample jobs in waiting, processing, completed, and failed states" width="800" height="400" />
                <span className="exh-featured-card-title">JobRelay</span>
                <span className="exh-featured-card-why">
                  Reliable background jobs with an outbox, bounded retries, and worker-crash recovery.
                </span>
                <span className="exh-featured-card-arrow">See the failure recovery →</span>
              </Link>
              <Link to={`/portfolio${PROJECTS.find((p) => p.id === 'ascend').path}`} className="exh-featured-card">
                <img className="exh-featured-image" src="/previews/ascend-workflow.png" alt="Sample import result showing two fictional job applications" width="800" height="400" />
                <span className="exh-featured-card-title">Ascend</span>
                <span className="exh-featured-card-why">
                  Explore the authentication, data model, and API behind this site.
                </span>
                <span className="exh-featured-card-arrow">Explore the engineering →</span>
              </Link>
            </div>



            {!isMobile && (
              <section className="exh-welcome" aria-labelledby="mini-edgar-welcome-title">
                <div className="exh-welcome-stage">
                  {guideEnabled ? renderGuideScene(144) : <span className="exh-welcome-loading" role="status">Mini Edgar is getting ready...</span>}
                  <span className="exh-welcome-plaque">Mini Edgar</span>
                </div>
                <div className="exh-welcome-copy">
                  <h2 id="mini-edgar-welcome-title">Prefer a guided tour?</h2>
                  <p>Mini Edgar can walk you through my experience, projects, and live demos.</p>
                  <div className="exh-welcome-actions">
                    <button type="button" className="exh-welcome-tour" onClick={autoTourActive ? cancelAutoTour : startAutoTour}>
                      {autoTourActive ? 'Stop the tour' : 'Take the tour →'}
                    </button>
                    <a href="#featured-work" onClick={cancelAutoTour}>Back to projects ↑</a>
                  </div>
                </div>
              </section>
            )}

            {/* An index, not a second row of cards — Field Work and Studio
                Projects already got their full-weight pitch in the
                featured row above, so this repeats the same five topics
                as a plain numbered list instead of five more boxes. */}
            <div className="exh-tour-grid">
              {NAV_GROUPS.filter((g) => g.label !== 'Introduction').map((group, i) => (
                <Link
                  key={group.label}
                  to={`/portfolio${group.items[0].path}`}
                  className="exh-card exh-fade-in"
                  style={{ animationDelay: `${200 + i * 90}ms` }}
                  onClick={handleCardClick}
                >
                  <div className="exh-card-row">
                    <span className="exh-card-label">{{ 'Field Work': 'Experience', 'Studio Projects': 'Projects', 'Education': 'Education', 'Toolkit': 'Skills', 'Live Demonstrations': 'Live demos' }[group.label]}</span>
                    <span className="exh-card-count">
                      {group.items.length > 1 ? 'Start with ' : 'Open '}{group.items[0].navTitle} →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </ExhibitFrame>
        </div>
      )
    }

    const exp = EXPERIENCE.find((e) => e.id === activeId)
    if (exp) {
      return (
        <ExhibitFrame note={exp.note}
          title={exp.data.role} byline={`${exp.data.company} · ${exp.data.location} · ${exp.data.period}`}
          emblem={exp.logo && <img src={exp.logo} alt={exp.data.company} />}
          flashAccent={exp.flashAccent}>
          {/* Stats open the exhibit, oversized, before the prose — only
              AWS has them, so it reads heavier than the internships
              instead of every Field Work plate sharing one template. */}
          {exp.stats && <StatRow stats={exp.stats} accent={theme === 'dark' ? '#ffb85c' : '#915000'} lead />}
          {exp.intro && <p className="exh-intro-text">{exp.intro}</p>}
          <HighlightList items={exp.data.highlights} />
        </ExhibitFrame>
      )
    }

    const proj = PROJECTS.find((p) => p.id === activeId)
    if (proj) {
      const ProjectIcon = PROJECT_ICONS[proj.id]
      return (
        <ExhibitFrame note={proj.note}
          title={proj.data.name} byline={proj.data.stack}
          emblem={ProjectIcon && <ProjectIcon />} emblemVariant="icon">
          <p className="exh-intro-text exh-project-summary">{proj.data.summary}</p>
          {proj.id === 'ascend' ? (
            // Grouped as one action row near the top of the exhibit —
            // source, the case-study reveal, and a direct shortcut
            // into its demo — rather than the sample-workflow action
            // only being reachable after reading the whole case study.
            <div className="exh-cs-actions-row">
              {proj.repoUrl && (
                <a href={proj.repoUrl} target="_blank" rel="noopener noreferrer" className="exh-repo-link">
                  <span className="exh-root-link-icon"><GitHubIcon /></span> View the source on GitHub →
                </a>
              )}
              <button
                type="button"
                className="exh-cs-toggle"
                onClick={() => setShowEngineering((s) => !s)}
                aria-expanded={showEngineering}
                aria-controls="ascend-case-study"
              >
                {showEngineering ? 'Hide the engineering ↑' : 'Show me the engineering →'}
              </button>
              <button
                type="button"
                className="exh-cs-toggle exh-cs-toggle--demo"
                onClick={goToSampleWorkflow}
                aria-expanded={showEngineering}
                aria-controls="ascend-case-study"
              >
                Try the sample workflow →
              </button>
            </div>
          ) : (
            proj.repoUrl && (
              <a href={proj.repoUrl} target="_blank" rel="noopener noreferrer" className="exh-repo-link">
                <span className="exh-root-link-icon"><GitHubIcon /></span> View the source on GitHub →
              </a>
            )
          )}
          {proj.id === 'oncall' && (
            <>
              <HighlightList items={proj.data.highlights} />
              <p className="exh-cs-text">Internal code and incident details are not published.</p>
            </>
          )}
          {proj.id === 'ascend' && <HighlightList items={proj.data.highlights} />}
          {proj.id === 'ascend' && showEngineering && <AscendCaseStudy />}
          {/* Short enough to show outright — no reveal toggle like
              Ascend's much longer case study. */}
          {proj.id === 'jobrelay' && <JobRelayCaseStudy />}
        </ExhibitFrame>
      )
    }

    if (activeId === 'york') {
      return (
        <ExhibitFrame note={EDUCATION.note}
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
        <ExhibitFrame title="Technical Skills"
          byline="Languages and tools used across my work and projects.">
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
        <ExhibitFrame title="Problem-Solving Log"
          byline="Profile statistics from LeetCode, alongside selected practice entries.">
          {loading && <p className="exh-loading" role="status">Loading live data…</p>}
          {feedErrors.leetcode && <div role="alert"><p className="exh-error">The problem-solving log is temporarily unavailable.</p><button className="exh-cs-toggle" onClick={() => setFeedRetry(value => value + 1)}>Try again</button></div>}
          {!loading && !feedErrors.leetcode && (
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
        <ExhibitFrame title="Activity Archive"
          byline="Historical coding, study, and activity notes from Ascend. These dates reflect the original entries.">
          <p className="exh-archive-note">An archive of past entries, rather than a current daily streak.</p>
          {loading && <p className="exh-loading" role="status">Loading live data…</p>}
          {feedErrors.activity && <div role="alert"><p className="exh-error">The activity archive is temporarily unavailable.</p><button className="exh-cs-toggle" onClick={() => setFeedRetry(value => value + 1)}>Try again</button></div>}
          {!loading && !feedErrors.activity && (
            <ActivityLog tracker={activityTracker} entries={activity} readOnly />
          )}
        </ExhibitFrame>
      )
    }

    if (activeId === 'analyzer') {
      return (
        <ExhibitFrame title="Resume Review, Live"
          byline="Feedback using an early-career AWS/backend rubric. Scores are subjective and do not predict hiring outcomes.">
          <Suspense fallback={<p role="status">Loading resume tool...</p>}><PortfolioResumeReview /></Suspense>
        </ExhibitFrame>
      )
    }

    return null
  }

  return (
    <div className={`exh-page ${!isMobile && activeId !== 'root' ? 'exh-page--with-guide' : ''}`}>
      <a className="exh-skip-link" href="#portfolio-content">Skip to content</a>
      <nav className="exh-topbar" aria-label="Portfolio actions">
        <Link to="/" className="exh-brand">
          <span className="exh-brand-mark">✦</span>
          <span className="exh-brand-name">Edgar Setyan</span>
        </Link>
        {/* No crumb on the home page — the name heading right below
            already says where you are, so "Overview" was one more
            header stacked above it. */}
        <span className="exh-topbar-crumb">{activeId === 'root' ? '' : activeNavItem?.navTitle}</span>
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
          {/* Résumé + contact stay reachable from every deep exhibit,
              not just the Introduction plate — compact icon links
              here rather than a second full row, since the intro
              already has the descriptive version of both. Root-only
              hidden to avoid showing the same two links twice on the
              one page that already has them spelled out. */}
          {activeId !== 'root' && (
            <>
              <a href="mailto:edgar.setyan23@gmail.com" className="exh-topbar-icon-link" aria-label="Email edgar.setyan23@gmail.com" title="Email">
                <EmailIcon />
              </a>
              <a href="/Edgar_Resume.pdf" download="Edgar_Setyan_Resume.pdf" className="exh-topbar-icon-link" aria-label="Download résumé" title="Download résumé">
                <DownloadIcon />
              </a>
            </>
          )}
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <Link to="/app" className="exh-back-link">← Open tracker</Link>
        </div>
      </nav>

      <div className="exh-shell">
        <button
          type="button"
          className="exh-mobile-nav-toggle"
          aria-expanded={mobileNavOpen}
          aria-controls="exhibit-navigation"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span><span className="exh-mobile-nav-label">Explore gallery</span><span className="exh-mobile-nav-current">{activeNavItem?.navTitle || 'Overview'}</span></span>
          <span aria-hidden="true">{mobileNavOpen ? '−' : '+'}</span>
        </button>
        <aside id="exhibit-navigation" aria-label="Gallery sections" className={`exh-sidebar${mobileNavOpen ? ' exh-sidebar--open' : ''}`}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="exh-nav-group">
              {/* "Introduction" over a lone "Overview" link was a
                  heading for one item — the link stands on its own. */}
              {group.label !== 'Introduction' && <div className="exh-nav-group-label">{group.label}</div>}
              {group.items.map((item) => (
                <Link
                  key={item.id}
                  to={item.path === '/' ? '/' : `/portfolio${item.path}`}
                  className={`exh-nav-item ${activeId === item.id ? 'exh-nav-item--active' : ''}`}
                  aria-current={activeId === item.id ? 'page' : undefined}
                  onClick={() => { cancelAutoTour(); setMobileNavOpen(false) }}
                >
                  <span className="exh-nav-item-text">
                    <span className="exh-nav-item-title">{item.navTitle}</span>
                    {item.navSub && <span className="exh-nav-item-sub">{item.navSub}</span>}
                  </span>
                </Link>
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

        <main id="portfolio-content" className="exh-main" tabIndex={-1}>
          <div key={activeId} className="exh-plate-enter">{renderBody()}</div>
        </main>
      </div>

      {!isMobile && activeId !== 'root' && guideEnabled && (
        <div
          className="exh-guide-wrap"
          style={
            guideTargetRect
              ? { right: `${guideTargetRect.right}px`, bottom: `${guideTargetRect.bottom}px`, transform: 'translate(0, 0)' }
              : guideHomeRect
              ? { right: `${guideHomeRect.right}px`, bottom: `${guideHomeRect.bottom}px`, transform: 'translate(0, 0)' }
              : undefined
          }
        >
          <div key={`${activeId}-${tourStarted}-${walkTick}`} className="exh-guide-caption exh-fade-in">
            {guideTargetRect
              ? 'On my way →'
              : tourFinale
              ? "That's the tour! I'd love to actually connect — pick one below."
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
              style={{ right: guideSize / 2 - 7.5 }}
              aria-hidden="true"
            />
          </div>
          {renderGuideScene(guideSize)}
        </div>
      )}

    </div>
  )
}
