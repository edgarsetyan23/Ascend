/**
 * Input validation for Lambda handlers.
 *
 * Validates at the system boundary (incoming HTTP request) so Lambda business
 * logic can trust its inputs. Returns structured 400 errors — never 500s —
 * for invalid client data.
 */

const VALID_TRACKERS = new Set(['leetcode', 'activity', 'jobs', 'gaming', 'resume'])
const MAX_BODY_BYTES  = 10_000 // 10 KB — generous for any tracker entry

/**
 * Throws a 400 error if trackerId is not a known tracker.
 * Prevents arbitrary DynamoDB SK prefixes from user-controlled input.
 */
export function validateTrackerId(trackerId) {
  if (!trackerId || !VALID_TRACKERS.has(trackerId)) {
    const e = new Error(`Invalid tracker: "${trackerId}"`)
    e.statusCode = 400
    throw e
  }
}

/**
 * Throws a 400 error if body is missing, not an object, or too large.
 */
export function validateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const e = new Error('Request body must be a JSON object')
    e.statusCode = 400
    throw e
  }
  if (JSON.stringify(body).length > MAX_BODY_BYTES) {
    const e = new Error(`Request body exceeds ${MAX_BODY_BYTES} byte limit`)
    e.statusCode = 400
    throw e
  }
}
