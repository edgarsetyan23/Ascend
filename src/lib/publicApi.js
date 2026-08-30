const BASE_URL = import.meta.env.VITE_API_URL ?? ''

/**
 * Fetch entries from the public (unauthenticated) endpoint.
 * Only 'leetcode' and 'activity' are whitelisted on the backend.
 */
export async function listPublicEntries(trackerId) {
  const res = await fetch(`${BASE_URL}/public/trackers/${trackerId}/entries`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  // The real endpoint always returns a bare array. A malformed or
  // unexpected 200 (an HTML error page from a proxy/CDN, a misrouted
  // response in a dev/preview environment without the real API
  // wired up, etc.) parses to `{}` above rather than throwing —
  // without this check that silently becomes the tracker's state,
  // and every consumer downstream assumes an array and crashes hard
  // (caught only by the top-level ErrorBoundary, taking down the
  // whole page). Treat it as a failed fetch instead, same as a
  // non-2xx response — callers already handle rejection safely.
  if (!Array.isArray(data)) throw new Error('Unexpected response shape')
  return data
}
