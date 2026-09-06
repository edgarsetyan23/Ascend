export function isModuleLoadError(error) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk .+ failed/i.test(error?.message || '')
}

export async function clearAppCache() {
  const root = new URL('/', window.location.href).href
  // Remove only Ascend's worker and precached app shell. Tracker data, cookies,
  // localStorage and any unrelated caches or service workers are untouched.
  await Promise.allSettled([
    (async () => {
      if (!navigator.serviceWorker?.getRegistrations) return
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.filter(registration =>
        registration.scope === root && [registration.active, registration.waiting, registration.installing]
          .some(worker => worker?.scriptURL === new URL('sw.js', root).href)
      ).map(registration => registration.unregister()))
    })(),
    (async () => {
      if (!globalThis.caches) return
      const names = await caches.keys()
      await Promise.all(names.filter(name => name.startsWith('workbox-precache-') && name.endsWith(root))
        .map(name => caches.delete(name)))
    })(),
  ])
}

export async function reloadPage() {
  try { await clearAppCache() }
  finally { window.location.reload() }
}
