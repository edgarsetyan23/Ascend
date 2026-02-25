const BASE_URL = import.meta.env.VITE_API_URL ?? ''

/**
 * Fetch entries from the public (unauthenticated) endpoint.
 * Only 'leetcode' and 'activity' are whitelisted on the backend.
 */
export async function listPublicEntries(trackerId) {
  const res = await fetch(`${BASE_URL}/public/trackers/${trackerId}/entries`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}
