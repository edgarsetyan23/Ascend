const BASE_URL = import.meta.env.VITE_API_URL ?? ''

/**
 * Fetch entries from the public (unauthenticated) endpoint.
 * Only 'leetcode' and 'activity' are whitelisted on the backend.
 */
export async function listPublicEntries(trackerId) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(`${BASE_URL}/public/trackers/${trackerId}/entries`, { signal: controller.signal })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
    // A proxy/CDN can return HTML with status 200. Reject malformed data so
    // callers show an error instead of passing a non-array into the log UI.
    if (!Array.isArray(data)) throw new Error('Unexpected response shape')
    return data
  } finally {
    clearTimeout(timeout)
  }
}
