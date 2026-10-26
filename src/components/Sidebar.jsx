import { TRACKER_LIST } from '../trackers/index.js'
import { MotivationQuote } from './MotivationQuote.jsx'

export function Sidebar({ activeId, onSelect, entryCounts }) {
  return (
    <nav className="sidebar" aria-label="Trackers">
      <div className="sidebar-header">
        <span className="sidebar-logo">🏔️</span>
        <span className="sidebar-title">Ascend</span>
      </div>
      <ul className="sidebar-list">
        {TRACKER_LIST.map((tracker) => {
          const count = entryCounts[tracker.id]
          const isActive = tracker.id === activeId
          return (
            <li key={tracker.id}>
              <button
                className={`sidebar-item ${isActive ? 'sidebar-item--active' : ''}`}
                onClick={() => onSelect(tracker.id)}
                aria-label={tracker.name}
                aria-current={isActive ? 'page' : undefined}
                title={tracker.name}
                style={isActive ? { '--tracker-color': tracker.color } : {}}
              >
                <span className="sidebar-item-icon">{tracker.icon}</span>
                <span className="sidebar-item-name">{tracker.name}</span>
                <span className="sidebar-item-count">{count ?? '—'}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <MotivationQuote />
      <a href="/" className="sidebar-recruiter-link" title="Portfolio" aria-label="Portfolio">
        <span>👔</span>
        <span className="sidebar-item-name">Portfolio</span>
      </a>
    </nav>
  )
}
