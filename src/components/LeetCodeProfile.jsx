import { useState, useEffect, useRef } from 'react'

const LS_KEY      = 'lc-username'
const LS_NAME_KEY = 'lc-display-name'
const TOTAL_PROBLEMS = 3851

function makeFallback(username) {
  return {
    username,
    avatar: null,
    rank: null,
    solved: { total: 0, easy: 0, medium: 0, hard: 0 },
    languages: [],
  }
}

/**
 * fixedUsername / fixedDisplayName — used by the portfolio page to render
 * a read-only view of a specific profile without touching localStorage or
 * showing any edit controls.
 */
export function LeetCodeProfile({ fixedUsername = '', fixedDisplayName = '' }) {
  const isFixed = !!fixedUsername

  const [savedUsername, setSavedUsername] = useState(
    () => fixedUsername || localStorage.getItem(LS_KEY) || ''
  )
  const [displayName, setDisplayName] = useState(
    () => fixedDisplayName || (!isFixed ? localStorage.getItem(LS_NAME_KEY) || '' : '')
  )
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]     = useState('')

  const [input, setInput]     = useState('')
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(
    () => !!(fixedUsername || localStorage.getItem(LS_KEY))
  )
  const inputRef     = useRef(null)
  const nameInputRef = useRef(null)

  useEffect(() => {
    if (!savedUsername) return
    setLoading(true)
    fetch(`/api/leetcode-stats?username=${encodeURIComponent(savedUsername)}`)
      .then((r) => r.json())
      .then((d) => setData(d.error ? makeFallback(savedUsername) : d))
      .catch(() => setData(makeFallback(savedUsername)))
      .finally(() => setLoading(false))
  }, [savedUsername])

  useEffect(() => {
    if (!savedUsername && inputRef.current) inputRef.current.focus()
  }, [savedUsername])

  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus()
  }, [editingName])

  function handleConnect(e) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    localStorage.setItem(LS_KEY, trimmed)
    setLoading(true)
    setSavedUsername(trimmed)
    setInput('')
  }

  function handleChange() {
    localStorage.removeItem(LS_KEY)
    setSavedUsername('')
    setData(null)
    setInput('')
  }

  function handleSaveName(e) {
    e.preventDefault()
    const trimmed = nameInput.trim()
    if (trimmed) {
      localStorage.setItem(LS_NAME_KEY, trimmed)
      setDisplayName(trimmed)
    }
    setEditingName(false)
  }

  function handleClearName() {
    localStorage.removeItem(LS_NAME_KEY)
    setDisplayName('')
    setEditingName(false)
  }

  // ── Prompt (only shown in interactive / non-fixed mode) ──────────────────
  if (!savedUsername) {
    return (
      <div className="lc-profile lc-profile--prompt">
        <div className="lc-prompt-icon">🧩</div>
        <p className="lc-prompt-label">Connect your LeetCode profile</p>
        <form className="lc-prompt-form" onSubmit={handleConnect}>
          <input
            ref={inputRef}
            className="lc-prompt-input"
            placeholder="your-username"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
          />
          <button className="lc-prompt-btn" type="submit" disabled={!input.trim()}>
            Connect
          </button>
        </form>
      </div>
    )
  }

  if (loading) return <div className="lc-profile lc-profile--loading" />

  const { username, avatar, rank, solved, languages } = data
  const pct   = Math.round((solved.total / TOTAL_PROBLEMS) * 100)
  const label = displayName || username

  const R = 30, STROKE = 5
  const circ = 2 * Math.PI * R
  const dash = (circ * pct) / 100

  return (
    <div className="lc-profile">

      {/* ── Left: avatar + identity ── */}
      <div className="lc-identity">
        {avatar
          ? <img className="lc-avatar" src={avatar} alt="LeetCode avatar" />
          : <div className="lc-avatar lc-avatar--placeholder">🧩</div>
        }
        <div className="lc-identity-text">

          {/* Name row — editable only in interactive mode */}
          {!isFixed && editingName ? (
            <form className="lc-name-edit-form" onSubmit={handleSaveName}>
              <input
                ref={nameInputRef}
                className="lc-name-edit-input"
                placeholder={username}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                spellCheck={false}
              />
              <button className="lc-name-edit-save" type="submit">✓</button>
              <button className="lc-name-edit-cancel" type="button" onClick={() => setEditingName(false)}>✕</button>
              {displayName && (
                <button className="lc-name-edit-clear" type="button" onClick={handleClearName}>clear</button>
              )}
            </form>
          ) : (
            <div className="lc-name-row">
              <a
                href={`https://leetcode.com/u/${username}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="lc-username"
              >
                {label}
              </a>
              {!isFixed && (
                <button
                  className="lc-name-edit-btn"
                  onClick={() => { setNameInput(displayName); setEditingName(true) }}
                  title="Set display name"
                >✎</button>
              )}
            </div>
          )}

          {rank && <span className="lc-rank">Rank #{rank.toLocaleString()}</span>}

          {!isFixed && (
            <button className="lc-change-btn" onClick={handleChange} title="Change username">
              change account
            </button>
          )}
        </div>
      </div>

      <div className="lc-sep" />

      {/* ── Centre: donut + difficulty breakdown ── */}
      <div className="lc-solved-wrap">
        <svg className="lc-donut" viewBox="0 0 70 70" width="70" height="70">
          <circle cx="35" cy="35" r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
          <circle
            cx="35" cy="35" r={R}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={STROKE}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 35 35)"
          />
          <text x="35" y="33" textAnchor="middle" fontSize="12" fill="var(--text)" fontWeight="700">{solved.total}</text>
          <text x="35" y="44" textAnchor="middle" fontSize="7" fill="var(--text-muted)">solved</text>
        </svg>

        <div className="lc-difficulty-col">
          <span className="lc-diff lc-diff--easy">
            <span className="lc-diff-dot" />Easy <strong>{solved.easy}</strong>
          </span>
          <span className="lc-diff lc-diff--medium">
            <span className="lc-diff-dot" />Med. <strong>{solved.medium}</strong>
          </span>
          <span className="lc-diff lc-diff--hard">
            <span className="lc-diff-dot" />Hard <strong>{solved.hard}</strong>
          </span>
        </div>
      </div>

      <div className="lc-sep" />

      {/* ── Right: languages ── */}
      {languages.length > 0 && (
        <div className="lc-langs">
          <span className="lc-langs-label">Languages</span>
          {languages.map((l) => (
            <div key={l.name} className="lc-lang-row">
              <span className="lc-lang-name">{l.name}</span>
              <span className="lc-lang-count">{l.count}</span>
            </div>
          ))}
        </div>
      )}

      <a
        href={`https://leetcode.com/u/${username}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="lc-ext-link"
        title="Open LeetCode profile"
      >↗</a>

    </div>
  )
}
