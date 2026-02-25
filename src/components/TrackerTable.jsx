import { useState, useMemo } from 'react'
import { exportCsv } from '../utils/exportCsv.js'

function Badge({ value, badgeMap }) {
  const style = badgeMap?.[value]
  if (!style) return <span>{value || '—'}</span>
  return (
    <span
      className="badge"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {value}
    </span>
  )
}

function CellValue({ col, value }) {
  if (!value && value !== 0) return <span className="cell-empty">—</span>

  if (col.badge) return <Badge value={value} badgeMap={col.badge} />

  if (col.type === 'url') {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="cell-link">
        Link ↗
      </a>
    )
  }

  if (col.type === 'textarea') {
    return (
      <span className="cell-truncate" title={value}>
        {value}
      </span>
    )
  }

  return <span>{value}</span>
}

// Columns shown in the table (hide textarea columns to keep table clean)
function visibleColumns(columns) {
  return columns.filter((c) => c.type !== 'textarea')
}

export function TrackerTable({ tracker, entries, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(tracker.defaultSort)

  const cols = useMemo(() => visibleColumns(tracker.columns), [tracker.columns])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const base = q
      ? entries.filter((e) =>
          cols.some((c) => String(e[c.key] ?? '').toLowerCase().includes(q))
        )
      : entries

    return [...base].sort((a, b) => {
      const av = a[sort.key] ?? ''
      const bv = b[sort.key] ?? ''
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [entries, search, sort, cols])

  function handleSort(key) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    )
  }

  function SortIcon({ colKey }) {
    if (sort.key !== colKey) return <span className="sort-icon sort-icon--inactive">⇅</span>
    return <span className="sort-icon">{sort.dir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="tracker-table-wrap">
      <div className="table-toolbar">
        <input
          type="search"
          className="search-input"
          placeholder="Search entries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="toolbar-actions">
          <button
            className="btn btn--ghost"
            onClick={() => exportCsv(filtered, tracker.columns, tracker.name)}
            disabled={!filtered.length}
            title="Export visible rows as CSV"
          >
            ⬇ Export CSV
          </button>
          <button className="btn btn--primary" onClick={onAdd}>
            + Add Entry
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        entries.length === 0 ? (
          // First-time empty state — invite the user to add their first entry
          <div className="table-empty-state">
            <span className="table-empty-icon">{tracker.icon}</span>
            <p className="table-empty-title">No {tracker.name} entries yet</p>
            <p className="table-empty-sub">Track your first entry to get started</p>
            <button className="btn btn--primary" onClick={onAdd}>+ Add First Entry</button>
          </div>
        ) : (
          // Search returned nothing
          <div className="table-empty-state table-empty-state--search">
            <p className="table-empty-title">No results for &ldquo;{search}&rdquo;</p>
            <button className="btn btn--ghost" onClick={() => setSearch('')}>Clear search</button>
          </div>
        )
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                {cols.map((col) => (
                  <th
                    key={col.key}
                    className="table-th"
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label} <SortIcon colKey={col.key} />
                  </th>
                ))}
                <th className="table-th table-th--actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} className="table-row">
                  {cols.map((col) => (
                    <td key={col.key} className="table-td">
                      <CellValue col={col} value={entry[col.key]} />
                    </td>
                  ))}
                  <td className="table-td table-td--actions">
                    <button
                      className="row-action row-action--edit"
                      onClick={() => onEdit(entry)}
                      aria-label="Edit entry"
                    >
                      ✏️
                    </button>
                    <button
                      className="row-action row-action--delete"
                      onClick={() => onDelete(entry.id)}
                      aria-label="Delete entry"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="table-footer">
        {filtered.length} of {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
      </div>
    </div>
  )
}
