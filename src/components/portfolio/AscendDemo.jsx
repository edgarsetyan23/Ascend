import { useState } from 'react'

// Entirely fictional — clearly so (invented company names, no real
// person's data) — and entirely local: no fetch, no localStorage, no
// auth, no Gmail, no Claude call. This is a stand-in for the review
// modal in the real EmailScanner.jsx, sized down to just the one
// interaction worth trying without connecting a real inbox: look at
// what a "scan" surfaced, decide what actually belongs in the
// tracker, and see what would land there.
const SAMPLE_APPLICATIONS = [
  { id: 'demo-1', company: 'Nimbus Cloud Systems', role: 'Backend Engineer', appliedDate: '2026-08-02', source: 'LinkedIn' },
  { id: 'demo-2', company: 'Solstice Analytics', role: 'Software Engineer II', appliedDate: '2026-08-14', source: 'Company Website' },
  { id: 'demo-3', company: 'Riverbed Data Co.', role: 'Platform Engineer', appliedDate: '2026-08-20', source: 'Indeed' },
  { id: 'demo-4', company: 'Fernwood Robotics', role: 'Site Reliability Engineer', appliedDate: '2026-08-25', source: 'Referral' },
]

const ALL_IDS = new Set(SAMPLE_APPLICATIONS.map((a) => a.id))

export function AscendDemo() {
  const [included, setIncluded] = useState(() => new Set(ALL_IDS))
  // null = still reviewing; an array = the simulated result of "import"
  const [imported, setImported] = useState(null)

  function toggle(id) {
    setIncluded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setIncluded((prev) => (prev.size === ALL_IDS.size ? new Set() : new Set(ALL_IDS)))
  }

  function simulateImport() {
    setImported(SAMPLE_APPLICATIONS.filter((a) => included.has(a.id)))
  }

  function reset() {
    setImported(null)
    setIncluded(new Set(ALL_IDS))
  }

  return (
    <div className="exh-demo">
      <div className="exh-demo-label">Interactive demo · Sample data</div>
      <p className="exh-demo-note">
        This is the review step from Ascend's real Gmail scanner, with four
        fictional applications standing in for a scanned inbox — no Gmail
        connection, no Claude call, no database write. Include or exclude
        rows the way you would in the real review modal, then simulate the
        import.
      </p>

      {imported === null ? (
        <>
          <div className="exh-table-wrap">
            <table className="exh-table">
              <thead>
                <tr>
                  <th className="exh-th">Company</th>
                  <th className="exh-th">Role</th>
                  <th className="exh-th">Applied</th>
                  <th className="exh-th">Source</th>
                  <th className="exh-th">
                    <button type="button" className="exh-demo-selectall" onClick={toggleAll}>
                      {included.size === ALL_IDS.size ? 'None' : 'All'}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_APPLICATIONS.map((app) => (
                  <tr key={app.id} className="exh-tr">
                    <td className="exh-td exh-td--bold">{app.company}</td>
                    <td className="exh-td">{app.role}</td>
                    <td className="exh-td exh-td--muted">{app.appliedDate}</td>
                    <td className="exh-td exh-td--muted">{app.source}</td>
                    <td className="exh-td">
                      <input
                        type="checkbox"
                        checked={included.has(app.id)}
                        onChange={() => toggle(app.id)}
                        aria-label={`Include ${app.company} — ${app.role}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="exh-demo-import-btn"
            onClick={simulateImport}
            disabled={included.size === 0}
          >
            Simulate import ({included.size} selected) →
          </button>
        </>
      ) : (
        <>
          <p className="exh-demo-result-heading">
            {imported.length === 0
              ? 'Nothing selected — nothing would be imported.'
              : `${imported.length} ${imported.length === 1 ? 'entry' : 'entries'} would land in the Jobs tracker:`}
          </p>
          {imported.length > 0 && (
            <ul className="exh-demo-result-list">
              {imported.map((app) => (
                <li key={app.id} className="exh-demo-result-row">
                  <span className="exh-demo-result-main">{app.company} — {app.role}</span>
                  <span className="exh-pill exh-pill--tag">Applied</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="exh-demo-reset-btn" onClick={reset}>
            ↺ Reset demo
          </button>
        </>
      )}
    </div>
  )
}
