// Skeleton loader for the tracker table.
// Renders shimmer placeholders that match the real table's structure
// so there's no layout shift when data arrives.

function visibleCols(tracker) {
  return (tracker.columns ?? []).filter((c) => c.type !== 'textarea')
}

// Width varies per column position so the shimmer looks natural, not robotic
const WIDTHS = ['72%', '52%', '64%', '48%', '80%', '56%', '68%']

export function SkeletonTable({ tracker }) {
  const cols = visibleCols(tracker)

  return (
    <div className="tracker-table-wrap">
      {/* Toolbar — disabled during load */}
      <div className="table-toolbar">
        <div className="skeleton skeleton--search" />
        <div className="skeleton skeleton--btn" />
        <div className="skeleton skeleton--btn skeleton--btn-primary" />
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              {cols.map((col) => (
                <th key={col.key} className="table-th">
                  <div className="skeleton skeleton--th" />
                </th>
              ))}
              <th className="table-th table-th--actions">
                <div className="skeleton skeleton--th" style={{ width: '48px' }} />
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, rowIdx) => (
              <tr key={rowIdx} className="table-row">
                {cols.map((_, colIdx) => (
                  <td key={colIdx} className="table-td">
                    <div
                      className="skeleton skeleton--cell"
                      style={{ width: WIDTHS[(rowIdx + colIdx) % WIDTHS.length] }}
                    />
                  </td>
                ))}
                <td className="table-td table-td--actions">
                  <div className="skeleton skeleton--icon" />
                  <div className="skeleton skeleton--icon" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
