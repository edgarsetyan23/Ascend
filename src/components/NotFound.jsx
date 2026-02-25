import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="nf-gate">
      <div className="nf-card">
        <div className="nf-glyph">🔱</div>
        <p className="nf-code">404</p>
        <h1 className="nf-title">Lost in the Ether</h1>
        <p className="nf-body">
          This path leads nowhere. Even the gods cannot find what does not exist.
        </p>
        <div className="nf-actions">
          <Link to="/" className="nf-btn nf-btn--primary">Return to Ascend</Link>
          <a href="/portfolio" className="nf-btn nf-btn--ghost">View Portfolio</a>
        </div>
      </div>
    </div>
  )
}
