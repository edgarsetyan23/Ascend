export function StatsBar({ stats }) {
  if (!stats || stats.length === 0) return null

  return (
    <div className="stats-bar">
      {stats.map((stat) => (
        <div key={stat.label} className="stat-chip" style={{ '--stat-color': stat.color }}>
          <span className="stat-value" style={{ color: stat.color }}>
            {stat.value}
          </span>
          <span className="stat-label">{stat.label}</span>
        </div>
      ))}
    </div>
  )
}
