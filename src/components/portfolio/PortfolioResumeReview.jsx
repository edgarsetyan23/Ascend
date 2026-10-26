import { useState } from 'react'
import { ScoreCircle, CatBar, DropZone, scoreResume, extractTextFromPdf } from '../ResumeReview.jsx'

function AnalyzerResult({ result, onReset }) {
  return (
    <div className="exh-analyzer-result">
      {result.source === 'local' && <p className="exh-privacy-note" role="status">The AI service was unavailable. These results use a local heuristic scorer; no AI response was used.</p>}
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

export default function PortfolioResumeReview() {
  const [score,       setScore]       = useState(null)
  const [analyzing,   setAnalyzing]   = useState(false)
  const [extracting,  setExtracting]  = useState(false)
  const [analyzeErr,  setAnalyzeErr]  = useState(null)

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
    } catch (error) {
      setAnalyzeErr(/Choose a PDF|Resume text/.test(error.message) ? error.message : 'Could not read this PDF. Try a fresh copy.')
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
          <div className="exh-analyzer-card">
            <p className="exh-privacy-note">Your PDF is read in this browser. Extracted text is sent to Anthropic for feedback; Ascend does not save it from this public tool. <a href="https://privacy.claude.com/" target="_blank" rel="noopener noreferrer">Anthropic's privacy information</a> applies to that processing. If the AI service is unavailable, the result is labelled as a local heuristic score.</p>
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
                {analyzeErr && <p className="exh-error" role="alert">{analyzeErr}</p>}
              </div>
            )}
          </div>
  )
}
