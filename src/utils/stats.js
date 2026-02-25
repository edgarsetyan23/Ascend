import { calcStreak } from './streak.js'

// ─── LeetCode Score ────────────────────────────────────────────────────────────

/**
 * Compute a composite "LeetCode Score" from solved entries.
 *
 * This is where YOU decide how to reward progress.
 * The function receives all LeetCode entries and should return a single number.
 *
 * Ideas to consider (mix and match):
 *   • Difficulty weights  — Easy=1, Medium=3, Hard=5 (or 1/5/10 for more spread)
 *   • First-try bonus     — attempts === 1 → multiply by 1.5
 *   • Recency bonus       — solved in last 30 days → extra weight
 *   • Category diversity  — bonus points for covering more unique categories
 *   • Penalty             — subtract points for "Revisit" status problems
 *
 * @param {Array<{
 *   difficulty: 'Easy'|'Medium'|'Hard',
 *   status: 'Solved'|'Attempted'|'Revisit',
 *   attempts: string|number,
 *   category: string,
 *   date: string,          // YYYY-MM-DD
 * }>} entries - All LeetCode entries (solved, attempted, revisit)
 * @returns {number} Composite score (displayed on the stats bar)
 */
export function computeLeetcodeScore(entries) {
  const weights = { Easy: 1, Medium: 3, Hard: 5 }
  const solved = entries.filter((e) => e.status === 'Solved')

  const base = solved.reduce((sum, e) => {
    const pts = weights[e.difficulty] ?? 0
    const firstTry = Number(e.attempts) === 1 ? 1.5 : 1
    return sum + pts * firstTry
  }, 0)

  const uniqueCategories = new Set(solved.map((e) => e.category).filter(Boolean)).size
  const diversityBonus = uniqueCategories * 2

  const revisitPenalty = entries.filter((e) => e.status === 'Revisit').length

  return Math.max(0, Math.round(base + diversityBonus - revisitPenalty))
}

// ─── Per-tracker stat chip builders ───────────────────────────────────────────

function leetcodeStats(entries) {
  const solved = entries.filter((e) => e.status === 'Solved')
  const byDiff = (d) => solved.filter((e) => e.difficulty === d).length

  return [
    { label: 'Solved', value: solved.length, color: '#6c63ff' },
    { label: 'Easy', value: byDiff('Easy'), color: '#10b981' },
    { label: 'Medium', value: byDiff('Medium'), color: '#f59e0b' },
    { label: 'Hard', value: byDiff('Hard'), color: '#ef4444' },
    { label: 'Score', value: computeLeetcodeScore(entries), color: '#8b5cf6' },
  ]
}

function jobsStats(entries) {
  const active = ['Phone Screen', 'Technical', 'Onsite']
  const pipeline = entries.filter((e) => active.includes(e.status)).length
  const offers = entries.filter((e) => e.status === 'Offer').length
  const rejected = entries.filter((e) => e.status === 'Rejected').length

  return [
    { label: 'Applied', value: entries.length, color: '#0ea5e9' },
    { label: 'Active', value: pipeline, color: '#f59e0b' },
    { label: 'Offers', value: offers, color: '#10b981' },
    { label: 'Rejected', value: rejected, color: '#ef4444' },
  ]
}

function activityStats(entries) {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const thisWeek = entries.filter((e) => {
    if (!e.date) return false
    return new Date(e.date) >= weekStart
  }).length

  // Most common category
  const catCounts = {}
  entries.forEach((e) => {
    if (e.category) catCounts[e.category] = (catCounts[e.category] ?? 0) + 1
  })
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  const streak = calcStreak(entries, 'date')

  return [
    { label: 'Total', value: entries.length, color: '#10b981' },
    { label: 'This Week', value: thisWeek, color: '#0ea5e9' },
    { label: 'Top Category', value: topCat, color: '#f59e0b' },
    { label: 'Streak', value: `${streak}d`, color: '#6c63ff' },
  ]
}

function gamingStats(entries) {
  const totalWins = entries.reduce((s, e) => s + (Number(e.wins) || 0), 0)
  const totalLosses = entries.reduce((s, e) => s + (Number(e.losses) || 0), 0)
  const totalGames = totalWins + totalLosses
  const winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) + '%' : '—'

  return [
    { label: 'Sessions', value: entries.length, color: '#f59e0b' },
    { label: 'Wins', value: totalWins, color: '#10b981' },
    { label: 'Losses', value: totalLosses, color: '#ef4444' },
    { label: 'Win Rate', value: winRate, color: '#6c63ff' },
  ]
}

const STAT_BUILDERS = {
  leetcode: leetcodeStats,
  jobs: jobsStats,
  activity: activityStats,
  gaming: gamingStats,
}

/**
 * Returns an array of { label, value, color } chips for the given tracker.
 */
export function computeStats(trackerId, entries) {
  const builder = STAT_BUILDERS[trackerId]
  return builder ? builder(entries) : []
}
