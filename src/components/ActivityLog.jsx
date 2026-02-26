import { useState, useMemo } from 'react'

function formatDuration(mins) {
  if (!mins && mins !== 0) return null
  const m = Number(mins)
  if (!m) return null
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem ? `${h}h ${rem}m` : `${h}h`
}

function formatDateHeader(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((today - d) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function ActivityLog({ tracker, entries, onAdd, onEdit, onDelete, readOnly = false }) {
  const [search, setSearch] = useState('')

  const categoryCol = tracker.columns.find((c) => c.key === 'category')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return entries
    return entries.filter((e) =>
      ['title', 'category', 'notes'].some((k) =>
        String(e[k] ?? '').toLowerCase().includes(q)
      )
    )
  }, [entries, search])

  // Group by date, newest first
  const groups = useMemo(() => {
    const map = new Map()
    const sorted = [...filtered].sort((a, b) => {
      const da = a.date ?? a.createdAt ?? 0
      const db = b.date ?? b.createdAt ?? 0
      return db > da ? 1 : db < da ? -1 : 0
    })
    for (const entry of sorted) {
      const key = entry.date ?? 'Unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(entry)
    }
    return [...map.entries()]
  }, [filtered])

  // Day totals
  function dayTotal(dayEntries) {
    const total = dayEntries.reduce((sum, e) => sum + (Number(e.duration) || 0), 0)
    return formatDuration(total)
  }

  return (
    <div className="activity-log">
      {/* ── Toolbar — hidden in read-only mode ── */}
      {!readOnly && (
        <div className="activity-log-toolbar">
          <input
            className="search-input"
            placeholder="Search activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn btn--primary" onClick={onAdd}>
            + Add Entry
          </button>
        </div>
      )}

      {/* ── Groups ── */}
      {groups.length === 0 ? (
        <div className="activity-log-empty">
          {entries.length === 0 ? 'No entries yet — log your first activity.' : 'No results.'}
        </div>
      ) : (
        groups.map(([date, dayEntries]) => (
          <div key={date} className="activity-day">
            <div className="activity-day-header">
              <span className="activity-day-label">{formatDateHeader(date)}</span>
              <span className="activity-day-date">{date !== 'Unknown' ? date : ''}</span>
              {dayTotal(dayEntries) && (
                <span className="activity-day-total">{dayTotal(dayEntries)} total</span>
              )}
            </div>

            <div className="activity-entries">
              {dayEntries.map((entry) => {
                const badgeStyle = categoryCol?.badge?.[entry.category]
                const duration = formatDuration(entry.duration)
                return (
                  <div key={entry.id} className="activity-entry">
                    <div className="activity-entry-main">
                      {entry.category && (
                        <span
                          className="badge activity-entry-badge"
                          style={badgeStyle
                            ? { backgroundColor: badgeStyle.bg, color: badgeStyle.color }
                            : undefined
                          }
                        >
                          {entry.category}
                        </span>
                      )}
                      <span className="activity-entry-title">{entry.title}</span>
                      {duration && (
                        <span className="activity-entry-duration">{duration}</span>
                      )}
                    </div>
                    {entry.notes && (
                      <p className="activity-entry-notes">{entry.notes}</p>
                    )}
                    {!readOnly && (
                      <div className="activity-entry-actions">
                        <button
                          className="row-action"
                          onClick={() => onEdit(entry)}
                          title="Edit"
                        >✎</button>
                        <button
                          className="row-action"
                          onClick={() => onDelete(entry.id)}
                          title="Delete"
                        >🗑</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      <div className="activity-log-footer">
        {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
        {search && ` matching "${search}"`}
      </div>
    </div>
  )
}
