import { useState, useMemo } from 'react'

const TIER_CONFIG = {
  Iron:        { color: '#9ca3af', grad: 'linear-gradient(135deg, #4b5563 0%, #1f2937 100%)', glow: 'rgba(156,163,175,0.15)', rank: 1, symbol: 'I'   },
  Bronze:      { color: '#cd7f32', grad: 'linear-gradient(135deg, #92400e 0%, #451a03 100%)', glow: 'rgba(205,127,50,0.28)',   rank: 2, symbol: 'II'  },
  Silver:      { color: '#94a3b8', grad: 'linear-gradient(135deg, #64748b 0%, #334155 100%)', glow: 'rgba(148,163,184,0.22)', rank: 3, symbol: 'III' },
  Gold:        { color: '#f59e0b', grad: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', glow: 'rgba(245,158,11,0.38)',   rank: 4, symbol: 'IV'  },
  Platinum:    { color: '#2dd4bf', grad: 'linear-gradient(135deg, #0d9488 0%, #0369a1 100%)', glow: 'rgba(45,212,191,0.32)',   rank: 5, symbol: 'V'   },
  Diamond:     { color: '#60a5fa', grad: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)', glow: 'rgba(96,165,250,0.38)',   rank: 6, symbol: '◆'   },
  Master:      { color: '#c084fc', grad: 'linear-gradient(135deg, #9333ea 0%, #db2777 100%)', glow: 'rgba(192,132,252,0.42)',  rank: 7, symbol: '✦'   },
  Grandmaster: { color: '#f87171', grad: 'linear-gradient(135deg, #dc2626 0%, #9333ea 100%)', glow: 'rgba(248,113,113,0.48)',  rank: 8, symbol: '✦', animated: true },
  Challenger:  { color: '#fbbf24', grad: 'linear-gradient(90deg, #f59e0b, #ef4444, #8b5cf6, #3b82f6, #f59e0b)', glow: 'rgba(251,191,36,0.55)', rank: 9, symbol: '★', challenger: true },
}

const TIER_ORDER = ['Iron','Bronze','Silver','Gold','Platinum','Diamond','Master','Grandmaster','Challenger']

function cfg(tier) {
  return TIER_CONFIG[tier] ?? TIER_CONFIG.Iron
}

function WLBar({ wins, losses }) {
  const w = Number(wins) || 0
  const l = Number(losses) || 0
  const total = w + l
  if (!total) return null
  const wr = Math.round((w / total) * 100)
  return (
    <div className="gaming-wl">
      <div className="gaming-wl-bar">
        <div className="gaming-wl-fill gaming-wl-fill--w" style={{ width: `${(w / total) * 100}%` }} />
        <div className="gaming-wl-fill gaming-wl-fill--l" style={{ width: `${(l / total) * 100}%` }} />
      </div>
      <div className="gaming-wl-stats">
        <span className="gaming-wl-w">{w}W</span>
        <span className="gaming-wl-sep">·</span>
        <span className="gaming-wl-l">{l}L</span>
        <span className="gaming-wl-sep">·</span>
        <span className="gaming-wl-wr" style={{ color: wr >= 50 ? '#4ade80' : '#f87171' }}>{wr}%</span>
      </div>
    </div>
  )
}

function GamingCard({ entry, onEdit, onDelete }) {
  const c = cfg(entry.tier)
  return (
    <div
      className={`gaming-card ${c.challenger ? 'gaming-card--challenger' : ''} ${c.animated ? 'gaming-card--gm' : ''}`}
      style={{ '--tier-color': c.color, '--tier-glow': c.glow }}
    >
      {/* Tier emblem */}
      <div className="gaming-emblem-wrap">
        <div className="gaming-emblem" style={{ background: c.grad }}>
          <span className="gaming-emblem-symbol">{c.symbol}</span>
        </div>
        {entry.tier && <span className="gaming-tier-label">{entry.tier}</span>}
      </div>

      {/* Main info */}
      <div className="gaming-card-body">
        <div className="gaming-card-top">
          <span className="gaming-game-name">{entry.game || '—'}</span>
          {entry.rank && <span className="gaming-rank-text">{entry.rank}</span>}
        </div>
        <WLBar wins={entry.wins} losses={entry.losses} />
        {entry.notes && <p className="gaming-notes">{entry.notes}</p>}
      </div>

      {/* Meta + actions */}
      <div className="gaming-card-side">
        {entry.date && <span className="gaming-date">{entry.date}</span>}
        <div className="gaming-actions">
          <button className="gaming-action-btn" onClick={() => onEdit(entry)} aria-label="Edit">✏</button>
          <button className="gaming-action-btn gaming-action-btn--del" onClick={() => onDelete(entry.id)} aria-label="Delete">✕</button>
        </div>
      </div>
    </div>
  )
}

function StatsHeader({ entries }) {
  const totalW = entries.reduce((s, e) => s + (Number(e.wins) || 0), 0)
  const totalL = entries.reduce((s, e) => s + (Number(e.losses) || 0), 0)
  const total  = totalW + totalL
  const wr     = total ? Math.round((totalW / total) * 100) : null

  const bestTierRank = entries.reduce((best, e) => {
    const r = cfg(e.tier).rank ?? 0
    return r > best.rank ? { rank: r, tier: e.tier } : best
  }, { rank: 0, tier: null })

  const bestCfg = bestTierRank.tier ? cfg(bestTierRank.tier) : null

  return (
    <div className="gaming-stats-bar">
      <div className="gaming-stat">
        <span className="gaming-stat-value">{entries.length}</span>
        <span className="gaming-stat-label">Sessions</span>
      </div>
      {bestCfg && (
        <div className="gaming-stat">
          <span className="gaming-stat-value" style={{ color: bestCfg.color }}>{bestTierRank.tier}</span>
          <span className="gaming-stat-label">Peak Tier</span>
        </div>
      )}
      {total > 0 && (
        <>
          <div className="gaming-stat">
            <span className="gaming-stat-value">
              <span style={{ color: '#4ade80' }}>{totalW}W</span>
              <span style={{ color: 'var(--text-subtle)', fontSize: '0.8em' }}> / </span>
              <span style={{ color: '#f87171' }}>{totalL}L</span>
            </span>
            <span className="gaming-stat-label">All Time</span>
          </div>
          <div className="gaming-stat">
            <span className="gaming-stat-value" style={{ color: wr >= 50 ? '#4ade80' : '#f87171' }}>{wr}%</span>
            <span className="gaming-stat-label">Win Rate</span>
          </div>
        </>
      )}
    </div>
  )
}

export function GamingView({ tracker, entries, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const base = q ? entries.filter(e =>
      [e.game, e.rank, e.tier, e.notes].some(v => String(v ?? '').toLowerCase().includes(q))
    ) : entries
    return [...base].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  }, [entries, search])

  if (!entries.length) {
    return (
      <div className="gaming-wrap">
        <div className="table-empty-state">
          <span className="table-empty-icon">{tracker.icon}</span>
          <p className="table-empty-title">No game sessions yet</p>
          <p className="table-empty-sub">Log your first rank to get started</p>
          <button className="btn btn--primary" onClick={onAdd}>+ Add First Session</button>
        </div>
      </div>
    )
  }

  return (
    <div className="gaming-wrap">
      <StatsHeader entries={entries} />

      <div className="gaming-toolbar">
        <input
          type="search"
          className="search-input"
          placeholder="Search games..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn btn--primary" onClick={onAdd}>+ Add Session</button>
      </div>

      <div className="gaming-cards">
        {filtered.map(entry => (
          <GamingCard key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>

      <div className="table-footer">{filtered.length} of {entries.length} sessions</div>
    </div>
  )
}
