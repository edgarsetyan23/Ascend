import { useState, useMemo } from 'react'

// Smite 2 ranked tiers — Amber → Deity
const TIER_CONFIG = {
  Amber:    { color: '#f59e0b', grad: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)', glow: 'rgba(245,158,11,0.30)',  rank: 1,  symbol: '✦',  label: '200 SR'    },
  Bronze:   { color: '#cd7f32', grad: 'linear-gradient(135deg, #a16207 0%, #7c2d12 100%)', glow: 'rgba(205,127,50,0.28)',  rank: 2,  symbol: '✧',  label: '800 SR'    },
  Silver:   { color: '#94a3b8', grad: 'linear-gradient(135deg, #64748b 0%, #334155 100%)', glow: 'rgba(148,163,184,0.22)', rank: 3,  symbol: '✵',  label: '1400 SR'   },
  Gold:     { color: '#eab308', grad: 'linear-gradient(135deg, #ca8a04 0%, #a16207 100%)', glow: 'rgba(234,179,8,0.38)',   rank: 4,  symbol: '✸',  label: '2000 SR'   },
  Platinum: { color: '#2dd4bf', grad: 'linear-gradient(135deg, #0d9488 0%, #0369a1 100%)', glow: 'rgba(45,212,191,0.32)',  rank: 5,  symbol: '❄',  label: '2600 SR'   },
  Diamond:  { color: '#38bdf8', grad: 'linear-gradient(135deg, #0284c7 0%, #4f46e5 100%)', glow: 'rgba(56,189,248,0.38)',  rank: 6,  symbol: '❋',  label: '3200 SR'   },
  Obsidian: { color: '#a78bfa', grad: 'linear-gradient(135deg, #4c1d95 0%, #1e1b4b 100%)', glow: 'rgba(167,139,250,0.42)', rank: 7,  symbol: '⬡',  label: '3800 SR'   },
  Master:   { color: '#c084fc', grad: 'linear-gradient(135deg, #9333ea 0%, #6d28d9 100%)', glow: 'rgba(192,132,252,0.44)', rank: 8,  symbol: '⚜',  label: '4400 SR'   },
  Demigod:  { color: '#fb923c', grad: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)', glow: 'rgba(251,146,60,0.48)',  rank: 9,  symbol: '✺',  animated: true, label: '5000 SR' },
  Deity:    { color: '#fbbf24', grad: 'linear-gradient(90deg, #f59e0b, #ef4444, #8b5cf6, #3b82f6, #f59e0b)', glow: 'rgba(251,191,36,0.55)', rank: 10, symbol: '☀', challenger: true, label: 'Top 100' },
}

function cfg(tier) {
  return TIER_CONFIG[tier] ?? TIER_CONFIG.Amber
}

// Extract division from rank text — handles both "Obsidian II" and "Obsidian 3"
const TO_ROMAN = { '1': 'I', '2': 'II', '3': 'III', 'I': 'I', 'II': 'II', 'III': 'III' }
function parseDivision(rank) {
  const m = String(rank ?? '').match(/\b(III|II|I|[123])\b/)
  return m ? (TO_ROMAN[m[1]] ?? null) : null
}

function emblemSymbol(tier, rank) {
  const c = cfg(tier)
  // Demigod and Deity have no divisions — always use their special symbol
  if (c.challenger || c.animated) return c.symbol
  return parseDivision(rank) ?? c.symbol
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
      className={`gaming-card ${c.challenger ? 'gaming-card--deity' : ''} ${c.animated ? 'gaming-card--demigod' : ''}`}
      style={{ '--tier-color': c.color, '--tier-glow': c.glow }}
    >
      <div className="gaming-emblem-wrap">
        <div className="gaming-emblem" style={{ background: c.grad }}>
          <span className="gaming-emblem-symbol">{emblemSymbol(entry.tier, entry.rank)}</span>
        </div>
        {entry.tier && <span className="gaming-tier-label" style={{ color: c.color }}>{entry.tier}</span>}
      </div>

      <div className="gaming-card-body">
        <div className="gaming-card-top">
          <span className="gaming-game-name">{entry.game || '—'}</span>
          {entry.rank && <span className="gaming-rank-text">{entry.rank}</span>}
        </div>
        <WLBar wins={entry.wins} losses={entry.losses} />
        {entry.notes && <p className="gaming-notes">{entry.notes}</p>}
      </div>

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

  const best = entries.reduce((b, e) => {
    const r = cfg(e.tier).rank ?? 0
    return r > b.rank ? { rank: r, tier: e.tier } : b
  }, { rank: 0, tier: null })

  const bestCfg = best.tier ? cfg(best.tier) : null

  return (
    <div className="gaming-stats-bar">
      <div className="gaming-stat">
        <span className="gaming-stat-value">{entries.length}</span>
        <span className="gaming-stat-label">Sessions</span>
      </div>
      {bestCfg && (
        <div className="gaming-stat">
          <span className="gaming-stat-value" style={{ color: bestCfg.color }}>{best.tier}</span>
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
          <p className="table-empty-title">No sessions logged yet</p>
          <p className="table-empty-sub">Log your first Smite 2 rank to get started</p>
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
          placeholder="Search sessions..."
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
