import { afterEach, expect, test, vi } from 'vitest'
import { listPublicEntries } from '../lib/publicApi.js'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

test('rejects malformed successful responses instead of treating them as empty logs', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
  await expect(listPublicEntries('activity')).rejects.toThrow('Unexpected response shape')
})

test('returns public entries and exposes HTTP failures', async () => {
  const entries = [{ id: 'one', title: 'Practice' }]
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => entries })
    .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: 'Unavailable' }) }))
  expect(await listPublicEntries('activity')).toEqual(entries)
  await expect(listPublicEntries('activity')).rejects.toThrow('Unavailable')
})

test('aborts a stalled request after ten seconds', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })))
  const request = listPublicEntries('activity')
  const assertion = expect(request).rejects.toMatchObject({ name: 'AbortError' })
  await vi.advanceTimersByTimeAsync(10_000)
  await assertion
  expect(vi.getTimerCount()).toBe(0)
})
