/**
 * Convert an array of entries to a CSV string and trigger a browser download.
 *
 * @param {Array} entries - Array of plain objects
 * @param {Array} columns - Tracker column config (used for ordered headers)
 * @param {string} filename - Downloaded file name (without extension)
 */
export function exportCsv(entries, columns, filename = 'export') {
  if (!entries.length) return

  const keys = columns.map((c) => c.key)
  const headers = columns.map((c) => c.label)

  function escape(val) {
    if (val == null) return ''
    const str = String(val)
    // Wrap in quotes if value contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const rows = [
    headers.map(escape).join(','),
    ...entries.map((entry) =>
      keys.map((k) => escape(entry[k])).join(',')
    ),
  ]

  const csv = rows.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
