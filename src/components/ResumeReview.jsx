import { useState, useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { analyzeResume } from '../utils/resumeAnalyzer.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// ─── Blueprint checklist items ────────────────────────────────────────────
const BLUEPRINT = [
  { id: 'one-page',    text: 'One page max',                      tip: 'At 1 YOE, one tight page beats two sparse ones' },
  { id: 'quantified', text: 'Quantified bullets (numbers, %)',    tip: 'Every impact bullet needs a metric' },
  { id: 'aws-named',  text: 'AWS services named explicitly',      tip: 'Lambda, DynamoDB, S3 — spell them out' },
  { id: 'verbs',      text: 'Strong action verbs on each bullet', tip: 'Built, deployed, reduced — not "responsible for"' },
  { id: 'github',     text: 'GitHub link in header',              tip: 'Non-negotiable for SWE roles' },
  { id: 'skills',     text: 'Dedicated Skills section',           tip: 'ATS keyword matching depends on this' },
  { id: 'projects',   text: 'Projects section (2+ projects)',     tip: 'Fills experience gap at 1 YOE' },
  { id: 'education',  text: 'Education with graduation date',     tip: 'Recruiters need to verify recency' },
  { id: 'contact',    text: 'Complete contact info',              tip: 'Email, LinkedIn, GitHub, location' },
  { id: 'no-filler',  text: 'No filler words',                   tip: 'Cut "passionate", "hardworking", "team player"' },
]

function scoreColor(score) {
  if (score >= 80) return '#10b981'
  if (score >= 60) return '#0ea5e9'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

// ─── PDF text extraction ──────────────────────────────────────────────────
export async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    let lastY = null
    let pageText = ''
    for (const item of content.items) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) pageText += '\n'
      pageText += item.str
      lastY = item.transform[5]
    }
    pages.push(pageText)
  }
  return pages.join('\n')
}

// ─── SVG Score Circle ─────────────────────────────────────────────────────
export function ScoreCircle({ score, size = 120 }) {
  const r = size === 120 ? 44 : 28
  const circ = 2 * Math.PI * r
  const [offset, setOffset] = useState(circ)
  const color = scoreColor(score)

  useEffect(() => {
    const target = circ - (score / 100) * circ
    const raf = requestAnimationFrame(() => setOffset(target))
    return () => cancelAnimationFrame(raf)
  }, [score, circ])

  if (size === 72) {
    return (
      <svg width="72" height="72" viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <text x="36" y="40" textAnchor="middle" fill={color} fontSize="14" fontWeight="700">{score}</text>
      </svg>
    )
  }

  return (
    <div className="score-circle-wrap">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <text x="60" y="55" textAnchor="middle" fill={color} fontSize="22" fontWeight="700">{score}</text>
        <text x="60" y="72" textAnchor="middle" fill="var(--text-muted)" fontSize="10">/ 100</text>
      </svg>
      <div className="score-label" style={{ color }}>
        {score >= 80 ? 'Strong' : score >= 60 ? 'Good' : score >= 40 ? 'Needs Work' : 'Weak'}
      </div>
    </div>
  )
}

// ─── Animated category bar ─────────────────────────────────────────────────
export function CatBar({ label, score, weight, delay }) {
  const [width, setWidth] = useState(0)
  const color = scoreColor(score * 10)
  useEffect(() => {
    const t = setTimeout(() => setWidth((score / 10) * 100), delay)
    return () => clearTimeout(t)
  }, [score, delay])
  return (
    <div className="cat-bar-row">
      <div className="cat-bar-label"><span>{label}</span><span className="cat-bar-weight">{weight}</span></div>
      <div className="cat-bar-track">
        <div className="cat-bar-fill" style={{ width: `${width}%`, background: color, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
      </div>
      <span className="cat-bar-score" style={{ color }}>{score}/10</span>
    </div>
  )
}

// ─── Drop Zone ────────────────────────────────────────────────────────────
export function DropZone({ onFile, isExtracting }) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)
  function handleDrop(e) {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf') onFile(file)
  }
  return (
    <div
      className={`pdf-dropzone ${isDragging ? 'pdf-dropzone--active' : ''} ${isExtracting ? 'pdf-dropzone--loading' : ''}`}
      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !isExtracting && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept="application/pdf" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files[0]; if (f) onFile(f) }} />
      {isExtracting ? (
        <><div className="pdf-spinner" /><p className="pdf-drop-label">Extracting text…</p></>
      ) : (
        <>
          <div className="pdf-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <p className="pdf-drop-label">{isDragging ? 'Drop your PDF here' : 'Drop your resume PDF here'}</p>
          <p className="pdf-drop-sub">or click to browse</p>
          <p className="pdf-drop-hint">Overleaf → Menu → Download PDF</p>
        </>
      )}
    </div>
  )
}

// ─── API call with local fallback ─────────────────────────────────────────
export async function scoreResume(text) {
  try {
    const res = await fetch('/api/analyze-resume', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return { ...data, source: 'claude' }
  } catch {
    return { ...analyzeResume(text), source: 'local' }
  }
}

// ─── Summary Banner ───────────────────────────────────────────────────────
// Aggregates across ALL past scans to show what you're doing well
// and what consistently needs work.
function SummaryBanner({ entries }) {
  if (!entries.length) return null

  const bestScore = Math.max(...entries.map(e => e.overall))

  // Average each category across all scans
  const catTotals = {}
  const catCounts = {}
  entries.forEach(e => {
    (e.categories ?? []).forEach(c => {
      catTotals[c.label] = (catTotals[c.label] ?? 0) + c.score
      catCounts[c.label] = (catCounts[c.label] ?? 0) + 1
    })
  })
  const avgCats = Object.entries(catTotals)
    .map(([label, total]) => ({ label, avg: total / catCounts[label] }))
    .sort((a, b) => b.avg - a.avg)

  const topStrengths = avgCats.slice(0, 2).filter(c => c.avg >= 6)
  const topWeaknesses = avgCats.slice(-2).filter(c => c.avg < 7).reverse()

  // Most common recommendation categories across all scans
  const recFreq = {}
  entries.forEach(e => {
    const seen = new Set()
    ;(e.recommendations ?? []).forEach(r => {
      if (!seen.has(r.category)) { recFreq[r.category] = (recFreq[r.category] ?? 0) + 1; seen.add(r.category) }
    })
  })
  const topFix = Object.entries(recFreq).sort((a, b) => b[1] - a[1])[0]?.[0]

  return (
    <div className="resume-summary-banner">
      <div className="resume-summary-stat">
        <span className="resume-summary-label">Best Score</span>
        <span className="resume-summary-value" style={{ color: scoreColor(bestScore) }}>{bestScore}</span>
      </div>
      <div className="resume-summary-divider" />
      <div className="resume-summary-stat">
        <span className="resume-summary-label">Scans</span>
        <span className="resume-summary-value">{entries.length}</span>
      </div>
      {topStrengths.length > 0 && (
        <>
          <div className="resume-summary-divider" />
          <div className="resume-summary-group">
            <span className="resume-summary-label">Strongest</span>
            <div className="resume-summary-tags">
              {topStrengths.map(c => (
                <span key={c.label} className="resume-summary-tag resume-summary-tag--good">✓ {c.label}</span>
              ))}
            </div>
          </div>
        </>
      )}
      {topWeaknesses.length > 0 && (
        <>
          <div className="resume-summary-divider" />
          <div className="resume-summary-group">
            <span className="resume-summary-label">Needs Work</span>
            <div className="resume-summary-tags">
              {topWeaknesses.map(c => (
                <span key={c.label} className="resume-summary-tag resume-summary-tag--warn">↑ {c.label}</span>
              ))}
            </div>
          </div>
        </>
      )}
      {topFix && (
        <>
          <div className="resume-summary-divider" />
          <div className="resume-summary-group">
            <span className="resume-summary-label">Top Fix</span>
            <span className="resume-summary-tag resume-summary-tag--fix">⚠ {topFix}</span>
          </div>
        </>
      )}
    </div>
  )
}

// ─── History list ─────────────────────────────────────────────────────────
function HistoryList({ entries, onSelect, onDelete, onNew }) {
  // newest first
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="resume-history">
      <div className="resume-history-header">
        <h3 className="resume-history-title">Past Scans</h3>
        <button className="resume-new-btn" onClick={onNew}>+ Analyze New Resume</button>
      </div>
      <div className="resume-history-list">
        {sorted.map(entry => {
          const topFix = entry.recommendations?.[0]
          const date = new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          return (
            <div key={entry.id} className="resume-history-item" onClick={() => onSelect(entry)}>
              <ScoreCircle score={entry.overall} size={72} />
              <div className="resume-history-meta">
                <div className="resume-history-date">{date}</div>
                {topFix && (
                  <div className="resume-history-fix">⚠ {topFix.category}: {topFix.text}</div>
                )}
                <span className={`resume-source-badge ${entry.source === 'claude' ? 'resume-source-badge--ai' : 'resume-source-badge--local'}`}>
                  {entry.source === 'claude' ? '✦ Claude AI' : '⚙ Local'}
                </span>
              </div>
              <button
                className="resume-history-delete"
                title="Delete this scan"
                onClick={e => { e.stopPropagation(); onDelete(entry.id) }}
              >×</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Input panel ──────────────────────────────────────────────────────────
function InputPanel({ onAnalyze, onCancel, hasHistory }) {
  const [mode, setMode] = useState('upload')
  const [text, setText] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

  async function handleFile(file) {
    setIsExtracting(true); setExtractError('')
    try {
      const extracted = await extractTextFromPdf(file)
      if (extracted.trim().split(/\s+/).length < 50) {
        setExtractError('PDF extracted too little text. Try "paste text" mode.'); setIsExtracting(false); return
      }
      onAnalyze(extracted)
    } catch {
      setExtractError('Could not read this PDF. Try downloading a fresh copy from Overleaf.')
      setIsExtracting(false)
    }
  }

  function handleTextSubmit() {
    if (wordCount < 50) { setExtractError('Paste at least 50 words to get a meaningful score.'); return }
    setExtractError(''); onAnalyze(text)
  }

  return (
    <div className="resume-input-panel">
      <div className="resume-intro" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 className="resume-title">Resume Scorer</h2>
          <p className="resume-subtitle">Benchmarked for a 1-year post-grad SWE with AWS experience.</p>
        </div>
        {hasHistory && (
          <button className="resume-back-btn" onClick={onCancel}>← Back to history</button>
        )}
      </div>

      <div className="resume-mode-tabs">
        <button className={`resume-mode-tab ${mode === 'upload' ? 'resume-mode-tab--active' : ''}`}
          onClick={() => { setMode('upload'); setExtractError('') }}>Upload PDF</button>
        <button className={`resume-mode-tab ${mode === 'text' ? 'resume-mode-tab--active' : ''}`}
          onClick={() => { setMode('text'); setExtractError('') }}>Paste Text</button>
      </div>

      {mode === 'upload' ? (
        <DropZone onFile={handleFile} isExtracting={isExtracting} />
      ) : (
        <>
          <textarea className="resume-textarea" placeholder="Paste your full resume text here…"
            value={text} onChange={e => { setText(e.target.value); setExtractError('') }} spellCheck={false} />
          <div className="resume-textarea-footer">
            <span className={`resume-wordcount ${wordCount > 0 && wordCount < 50 ? 'resume-wordcount--warn' : ''}`}>
              {wordCount} words {wordCount > 0 && wordCount < 50 ? '(need 50+)' : ''}
            </span>
            <button className="resume-btn" onClick={handleTextSubmit}>Analyze Resume →</button>
          </div>
        </>
      )}

      {extractError && <p className="resume-error">{extractError}</p>}

      <div className="resume-blueprint-preview">
        <h3 className="blueprint-title">What we check for</h3>
        <div className="blueprint-grid">
          {BLUEPRINT.map(item => (
            <div key={item.id} className="blueprint-item blueprint-item--preview" title={item.tip}>
              <span className="blueprint-dot">◦</span>{item.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Results panel ────────────────────────────────────────────────────────
function ResultsPanel({ result, onBack }) {
  const { overall, wordCount, categories, recommendations, highlights, source } = result
  return (
    <div className="resume-results-wrap">
      <div className="resume-results-header">
        <button className="resume-back-btn" onClick={onBack}>← Back to history</button>
        <span className={`resume-source-badge ${source === 'claude' ? 'resume-source-badge--ai' : 'resume-source-badge--local'}`}>
          {source === 'claude' ? '✦ Scored by Claude AI' : '⚙ Scored locally'}
        </span>
      </div>
      <div className="resume-results">
        <div className="resume-left">
          <ScoreCircle score={overall} />
          <div className="cat-bars">
            {categories.map((cat, i) => (
              <CatBar key={cat.key} label={cat.label} score={cat.score} weight={cat.weight} delay={i * 80} />
            ))}
          </div>
          <p className="resume-wordcount-note">{wordCount} words detected</p>
        </div>
        <div className="resume-right">
          {recommendations.length > 0 && (
            <section className="resume-section">
              <h3 className="resume-section-title">What to Fix</h3>
              {recommendations.map((rec, i) => (
                <div key={i} className="resume-rec">
                  <div className="resume-rec-label">{rec.category}</div>
                  <p className="resume-rec-text">{rec.text}</p>
                </div>
              ))}
            </section>
          )}
          {(highlights.awsServices.length > 0 || highlights.techStack.length > 0) && (
            <section className="resume-section">
              <h3 className="resume-section-title">What We Detected</h3>
              {highlights.awsServices.length > 0 && (
                <div className="detected-group">
                  <span className="detected-group-label">AWS Services</span>
                  <div className="detected-tags">
                    {highlights.awsServices.map(s => <span key={s} className="detected-tag detected-tag--aws">{s}</span>)}
                  </div>
                </div>
              )}
              {highlights.techStack.length > 0 && (
                <div className="detected-group">
                  <span className="detected-group-label">Tech Stack</span>
                  <div className="detected-tags">
                    {highlights.techStack.map(t => <span key={t} className="detected-tag detected-tag--tech">{t}</span>)}
                  </div>
                </div>
              )}
            </section>
          )}
          <section className="resume-section">
            <h3 className="resume-section-title">Blueprint Checklist</h3>
            <div className="blueprint-list">
              {BLUEPRINT.map(item => (
                <div key={item.id} className="blueprint-item" title={item.tip}>
                  <span className="blueprint-dot">◦</span>
                  <span>{item.text}</span>
                  <span className="blueprint-tip">{item.tip}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────
export function ResumeReview({ entries = [], addEntry, deleteEntry, loading }) {
  const [view, setView] = useState('history') // 'history' | 'new' | 'result'
  const [selected, setSelected] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // After first load: if no history yet, go straight to the upload form
  useEffect(() => {
    if (!loading && entries.length === 0) setView('new')
  }, [loading, entries.length])

  async function handleAnalyze(text) {
    setIsAnalyzing(true)
    const result = await scoreResume(text)
    // Save to DynamoDB via the resume tracker — persists across sessions
    await addEntry(result)
    setIsAnalyzing(false)
    setView('history')
  }

  if (loading) {
    return (
      <div className="resume-wrap">
        <div className="resume-analyzing">
          <div className="pdf-spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
          <p className="resume-analyzing-label">Loading scan history…</p>
        </div>
      </div>
    )
  }

  if (isAnalyzing) {
    return (
      <div className="resume-wrap">
        <div className="resume-analyzing">
          <div className="pdf-spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
          <p className="resume-analyzing-label">Analyzing with Claude…</p>
          <p className="resume-analyzing-sub">Comparing against 1yr SWE profiles at top companies</p>
        </div>
      </div>
    )
  }

  return (
    <div className="resume-wrap">
      {/* Summary banner — always shown when there's history */}
      {entries.length > 0 && view !== 'new' && (
        <SummaryBanner entries={entries} />
      )}

      {view === 'history' && entries.length > 0 && (
        <HistoryList
          entries={entries}
          onSelect={e => { setSelected(e); setView('result') }}
          onDelete={deleteEntry}
          onNew={() => setView('new')}
        />
      )}

      {view === 'new' && (
        <InputPanel
          onAnalyze={handleAnalyze}
          onCancel={() => setView('history')}
          hasHistory={entries.length > 0}
        />
      )}

      {view === 'result' && selected && (
        <ResultsPanel result={selected} onBack={() => setView('history')} />
      )}
    </div>
  )
}
