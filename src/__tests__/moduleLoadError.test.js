import { afterEach, expect, it, vi } from 'vitest'
import { clearAppCache } from '../utils/moduleLoadError.js'

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

it('repairs only this app shell, preserving tracker storage and unrelated workers/caches', async () => {
  const root = new URL('/', window.location.href).href
  const own = { scope: root, active: { scriptURL: root + 'sw.js' }, unregister: vi.fn() }
  const other = { scope: root + 'other/', active: { scriptURL: root + 'other/sw.js' }, unregister: vi.fn() }
  vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: async () => [own, other] } })
  const cacheName = 'workbox-precache-v2-' + root
  const remove = vi.fn()
  vi.stubGlobal('caches', { keys: async () => [cacheName, 'tracker-records', 'workbox-precache-v2-' + root + 'other/'], delete: remove })
  localStorage.setItem('tracker-entries', 'keep me')
  await clearAppCache()
  expect(own.unregister).toHaveBeenCalledOnce()
  expect(other.unregister).not.toHaveBeenCalled()
  expect(remove).toHaveBeenCalledExactlyOnceWith(cacheName)
  expect(localStorage.getItem('tracker-entries')).toBe('keep me')
})

it('does not block recovery when browser privacy settings deny cache access', async () => {
  vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: async () => { throw new Error('Denied') } } })
  vi.stubGlobal('caches', { keys: async () => { throw new Error('Denied') } })
  await expect(clearAppCache()).resolves.toBeUndefined()
})
