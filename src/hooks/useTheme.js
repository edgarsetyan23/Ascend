import { useState, useEffect } from 'react'

const STORAGE_KEY = 'theme'

function getInitialTheme(defaultTheme, storageKey) {
  const saved = localStorage.getItem(storageKey)
  if (saved) return saved
  return defaultTheme
}

/**
 * `defaultTheme` / `storageKey` let a caller opt into its own default
 * and its own persisted preference, independent of the main app. The
 * public portfolio page uses this to default to light (a recruiter
 * landing fresh shouldn't get the tracker app's own dark default) and
 * to keep its toggle from bleeding into Edgar's own tracker theme.
 */
export function useTheme(defaultTheme = 'dark', storageKey = STORAGE_KEY) {
  const [theme, setTheme] = useState(() => getInitialTheme(defaultTheme, storageKey))

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(storageKey, theme)
  }, [theme, storageKey])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return { theme, toggleTheme }
}
