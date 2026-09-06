export function isModuleLoadError(error) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk .+ failed/i.test(error?.message || '')
}

export function reloadPage() {
  window.location.reload()
}
