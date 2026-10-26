import { generateKeyPairSync, sign } from 'node:crypto'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { requireTrackerUser, reserveAIRequest, resetLocalLimits, validateJSONRequest } from '../../api/_lib/ai-protection.js'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const key = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig' }
const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_preview'
const jwt = (extra = {}, signingKey = privateKey) => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: key.kid })).toString('base64url')
  const claims = Buffer.from(JSON.stringify({ sub: 'user-1', aud: 'preview-client', iss: issuer, token_use: 'id', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...extra })).toString('base64url')
  const message = `${header}.${claims}`
  return `${message}.${sign('RSA-SHA256', Buffer.from(message), signingKey).toString('base64url')}`
}
beforeEach(() => {
  resetLocalLimits()
  vi.stubEnv('VERCEL', '')
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
  vi.stubEnv('VITE_USER_POOL_ID', 'us-east-1_preview')
  vi.stubEnv('VITE_USER_POOL_CLIENT_ID', 'preview-client')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ keys: [key] }) }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

test('accepts a signed, current Cognito ID token for this app', async () => {
  await expect(requireTrackerUser({ headers: { authorization: `Bearer ${jwt()}` } })).resolves.toBe('user-1')
})
test.each([{ aud: 'another-app' }, { iss: 'https://attacker.example' }, { exp: 1 }, { token_use: 'access' }])('rejects an otherwise signed token with invalid claims: %j', async claims => {
  await expect(requireTrackerUser({ headers: { authorization: `Bearer ${jwt(claims)}` } })).rejects.toMatchObject({ status: 401 })
})
test('rejects a forged signature even when claims match', async () => {
  const attacker = generateKeyPairSync('rsa', { modulusLength: 2048 })
  await expect(requireTrackerUser({ headers: { authorization: `Bearer ${jwt({}, attacker.privateKey)}` } })).rejects.toMatchObject({ status: 401 })
})
test('rejects unauthenticated scanner requests', async () => {
  await expect(requireTrackerUser({ headers: {} })).rejects.toMatchObject({ status: 401 })
})
test('enforces burst limits before model calls and allows a later window', async () => {
  vi.useFakeTimers()
  try {
    for (let i = 0; i < 5; i++) (await reserveAIRequest({}, 'resume'))()
    await expect(reserveAIRequest({}, 'resume')).rejects.toMatchObject({ status: 429 })
    vi.advanceTimersByTime(10 * 60_000 + 1)
    const release = await reserveAIRequest({}, 'resume')
    release()
  } finally { vi.useRealTimers() }
})
test('caps simultaneous paid calls and releases capacity', async () => {
  const first = await reserveAIRequest({}, 'resume')
  const second = await reserveAIRequest({}, 'resume')
  await expect(reserveAIRequest({}, 'emails')).rejects.toMatchObject({ status: 429 })
  first(); second()
  const release = await reserveAIRequest({}, 'emails')
  release()
})
test('a configured shared quota store fails closed when unavailable', async () => {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://quota.example')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
  fetch.mockRejectedValue(new Error('Offline'))
  await expect(reserveAIRequest({}, 'resume')).rejects.toMatchObject({ status: 503 })
})
test('shared quotas reject requests after the daily budget', async () => {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://quota.example')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
  fetch.mockResolvedValue({ ok: true, json: async () => ({ result: [2, 101] }) })
  await expect(reserveAIRequest({}, 'resume')).rejects.toMatchObject({ status: 429 })
})
test('rejects foreign browser origins, unsupported content types, and oversized payloads', () => {
  expect(() => validateJSONRequest({ headers: { 'content-type': 'application/json', origin: 'https://attacker.example' }, body: {} }, 100)).toThrow('Origin not allowed')
  expect(() => validateJSONRequest({ headers: { 'content-type': 'text/plain' }, body: {} }, 100)).toThrow('application/json')
  expect(() => validateJSONRequest({ headers: { 'content-type': 'application/json' }, body: { text: 'x'.repeat(200) } }, 100)).toThrow('too large')
})
