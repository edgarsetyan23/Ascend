import { createHash, createPublicKey, verify } from 'node:crypto'

export class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

const buckets = new Map()
let active = 0
export function resetLocalLimits() { buckets.clear(); active = 0 }

function count(key, limit, window) {
  const now = Date.now()
  for (const [key, bucket] of buckets) if (bucket.expires <= now) buckets.delete(key)
  const bucket = buckets.get(key) || { total: 0, expires: now + window }
  if (bucket.total >= limit) throw new RequestError(429, 'Too many AI requests. Please try again later.')
  bucket.total++
  buckets.set(key, bucket)
}

export function validateJSONRequest(req, maxBytes) {
  const headers = req.headers || {}
  if (!/^application\/json(?:\s*;|$)/i.test(headers['content-type'] || '')) throw new RequestError(415, 'Send application/json.')
  const origin = headers.origin
  const allowed = new Set(['https://www.edgarsetyan.com', 'https://edgarsetyan.com', 'https://useascend.vercel.app'])
  if (process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`)
  if (!process.env.VERCEL) { allowed.add('http://localhost:5173'); allowed.add('http://127.0.0.1:5173') }
  if (origin && !allowed.has(origin)) throw new RequestError(403, 'Origin not allowed.')
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new RequestError(400, 'JSON object required.')
  if (Buffer.byteLength(JSON.stringify(req.body)) > maxBytes) throw new RequestError(413, 'Request is too large.')
}

// Local caps protect a warm runtime. Optional Redis counters share quotas across runtimes.
// No prompt, email, or raw IP is sent to the quota store.
export async function reserveAIRequest(req, feature) {
  const ip = process.env.VERCEL ? req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() : req.socket?.remoteAddress
  const identity = createHash('sha256').update(`${feature}:${ip || 'unknown'}`).digest('hex')
  count(`${feature}:runtime`, 20, 60 * 60_000)
  count(`${feature}:client:${identity}`, 5, 10 * 60_000)
  if (active >= 2) throw new RequestError(429, 'The AI service is busy. Please try again shortly.')
  active++
  let released = false
  const release = () => { if (!released) { released = true; active-- } }
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (url || token) {
      if (!url?.startsWith('https://') || !token) throw new Error('Quota store configuration incomplete')
      const script = "local a=redis.call('INCR',KEYS[1]);if a==1 then redis.call('EXPIRE',KEYS[1],3600) end;local b=redis.call('INCR',KEYS[2]);if b==1 then redis.call('EXPIRE',KEYS[2],86400) end;return {a,b}"
      const response = await fetch(url, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['EVAL', script, '2', `ascend:ai:${feature}:${identity}`, `ascend:ai:${feature}:daily`]),
        signal: AbortSignal.timeout(3000),
      })
      const data = await response.json()
      if (!response.ok || data.error || !Array.isArray(data.result) || data.result.length !== 2
        || !data.result.every(Number.isFinite)) throw new Error('Quota store unavailable')
      if (data.result[0] > 10 || data.result[1] > 100) throw new RequestError(429, 'AI request limit reached. Please try again later.')
    }
    return release
  } catch (error) {
    release()
    if (error instanceof RequestError) throw error
    throw new RequestError(503, 'AI service temporarily unavailable.')
  }
}

let jwksCache
export async function requireTrackerUser(req) {
  const pool = process.env.VITE_USER_POOL_ID
  const audience = process.env.VITE_USER_POOL_CLIENT_ID
  if (!pool || !audience) throw new RequestError(503, 'Tracker authentication is not configured.')
  const region = pool.split('_')[0]
  if (!/^[a-z]{2}-[a-z]+-\d_\w+$/.test(pool)) throw new RequestError(503, 'Tracker authentication is not configured.')
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${pool}`
  try {
    const token = req.headers?.authorization?.match(/^Bearer ([\w.-]+)$/)?.[1]
    if (!token || token.length > 8192) throw new Error('Missing token')
    const parts = token.split('.')
    if (parts.length !== 3) throw new Error('Invalid token')
    const header = JSON.parse(Buffer.from(parts[0], 'base64url'))
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url'))
    if (header.alg !== 'RS256' || !header.kid || claims.iss !== issuer || claims.aud !== audience
      || claims.token_use !== 'id' || typeof claims.sub !== 'string'
      || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000
      || !Number.isFinite(claims.iat) || claims.iat > Date.now() / 1000 + 60) throw new Error('Invalid claims')
    if (!jwksCache || jwksCache.issuer !== issuer || jwksCache.expires < Date.now()) {
      const response = await fetch(`${issuer}/.well-known/jwks.json`, { signal: AbortSignal.timeout(3000) })
      if (!response.ok) throw new Error('JWKS unavailable')
      const body = await response.json()
      if (!Array.isArray(body.keys)) throw new Error('Invalid JWKS')
      jwksCache = { issuer, expires: Date.now() + 15 * 60_000, keys: body.keys }
    }
    const key = jwksCache.keys.find(key => key.kid === header.kid && key.kty === 'RSA' && key.use === 'sig')
    if (!key || !verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) throw new Error('Invalid signature')
    return claims.sub
  } catch {
    throw new RequestError(401, 'Sign in to Ascend to scan emails.')
  }
}

export function sendAIError(res, error) {
  const status = error instanceof RequestError ? error.status : 500
  if (status === 429) res.setHeader?.('Retry-After', '600')
  res.setHeader?.('Cache-Control', 'no-store')
  return res.status(status).json({ error: error instanceof RequestError ? error.message : 'AI request failed. Please try again.' })
}
