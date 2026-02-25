/**
 * Calculate the current streak from a list of entries.
 * A streak is a consecutive run of days (ending today or yesterday)
 * where at least one entry exists per day.
 *
 * @param {Array} entries - Array of entry objects
 * @param {string} dateField - The key on each entry that holds the date string (YYYY-MM-DD)
 * @returns {number} Current streak length in days
 */
export function calcStreak(entries, dateField) {
  if (!entries.length || !dateField) return 0

  // Collect unique date strings that have entries
  const dateset = new Set(
    entries
      .map((e) => e[dateField])
      .filter(Boolean)
      .map((d) => d.slice(0, 10)) // normalise to YYYY-MM-DD
  )

  if (!dateset.size) return 0

  // Build a cursor starting from today; walk backwards counting consecutive days
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function toDateStr(d) {
    return d.toISOString().slice(0, 10)
  }

  // If neither today nor yesterday has an entry, streak is broken
  const todayStr = toDateStr(today)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = toDateStr(yesterday)

  if (!dateset.has(todayStr) && !dateset.has(yesterdayStr)) return 0

  // Start from today (or yesterday if today has no entry)
  const cursor = new Date(dateset.has(todayStr) ? today : yesterday)
  let streak = 0

  while (dateset.has(toDateStr(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

/**
 * Returns the longest ever streak across all entries.
 */
export function calcLongestStreak(entries, dateField) {
  if (!entries.length || !dateField) return 0

  const dates = [...new Set(
    entries
      .map((e) => e[dateField])
      .filter(Boolean)
      .map((d) => d.slice(0, 10))
  )].sort()

  if (!dates.length) return 0

  let longest = 1
  let current = 1

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1])
    const curr = new Date(dates[i])
    const diff = (curr - prev) / (1000 * 60 * 60 * 24)

    if (diff === 1) {
      current++
      longest = Math.max(longest, current)
    } else {
      current = 1
    }
  }

  return longest
}
