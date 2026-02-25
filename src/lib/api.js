import { getIdToken } from './cognito.js';

/**
 * Base URL comes from Vite env vars.
 *
 * In development:  VITE_API_URL is empty → relative URLs hit Vite's
 *                  proxy (or you set it in .env.local).
 * In production:   VITE_API_URL is the full API Gateway endpoint written
 *                  by scripts/generate-env.mjs after `cdk deploy`.
 *
 * Interview point: Vite replaces import.meta.env.* at BUILD time, not
 * runtime. The built JS contains the literal string. This is why we
 * never put secrets here — the value is baked into the bundle.
 */
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

/**
 * Thin wrapper around fetch that:
 *  1. Attaches the Cognito IdToken as a Bearer token
 *  2. Sets Content-Type: application/json on write requests
 *  3. Throws a descriptive Error on any non-2xx response
 *
 * @param {string} path     - e.g. '/trackers/fitness/entries'
 * @param {RequestInit} [options] - standard fetch options (method, body, …)
 * @returns {Promise<any>}  - parsed JSON response body
 */
export async function apiFetch(path, options = {}) {
  // Always get a fresh token. Cognito IdTokens expire after 1 hour.
  // getIdToken() calls getSession() which checks expiry and silently
  // refreshes using the refresh token if needed.
  const token = await getIdToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // API Gateway JWT Authorizer reads this header and rejects the
      // request with 401 before our Lambda ever executes.
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  // Parse JSON first — error responses also have a JSON body: { error: "..." }
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Surface the Lambda's error message if available, otherwise HTTP status
    throw new Error(data.error ?? `HTTP ${response.status}`);
  }

  return data;
}

// ─── Convenience helpers ────────────────────────────────────────────────────
// These map directly to the 4 Lambda routes defined in infra/lib/constructs/api.ts

/** GET /trackers/{trackerId}/entries  →  Entry[] newest first */
export const listEntries = (trackerId) =>
  apiFetch(`/trackers/${trackerId}/entries`);

/** POST /trackers/{trackerId}/entries  →  created Entry */
export const createEntry = (trackerId, data) =>
  apiFetch(`/trackers/${trackerId}/entries`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

/** PUT /trackers/{trackerId}/entries/{entryId}  →  updated Entry */
export const updateEntry = (trackerId, entryId, data) =>
  apiFetch(`/trackers/${trackerId}/entries/${entryId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

/** DELETE /trackers/{trackerId}/entries/{entryId}  →  { deleted: entryId } */
export const deleteEntry = (trackerId, entryId) =>
  apiFetch(`/trackers/${trackerId}/entries/${entryId}`, {
    method: 'DELETE',
  });
