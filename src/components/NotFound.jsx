import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="nf-gate">
      <div className="nf-card">
        <div className="nf-glyph">🏔️</div>
        <p className="nf-code">404</p>
        <h1 className="nf-title">Page not found</h1>
        <p className="nf-body">
          The page may have moved. Return to the portfolio or open the tracker.
        </p>
        <div className="nf-actions">
          <Link to="/" className="nf-btn nf-btn--primary">Return to portfolio</Link>
          <a href="/app" className="nf-btn nf-btn--ghost">Open Ascend</a>
        </div>
      </div>
    </div>
  )
}
