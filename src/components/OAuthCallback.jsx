import { useEffect } from 'react'

/**
 * OAuthCallback — landing page after Google OAuth redirect (new tab).
 * Stores the access token in localStorage so the storage event fires
 * in the original tab, then closes this tab.
 */
export function OAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const token = params.get('access_token')
    const state = params.get('state')

    if (token && state === 'gmail-scan') {
      // Writing to localStorage fires a 'storage' event in all OTHER open tabs.
      // EmailScanner listens for this key and picks up the token automatically.
      localStorage.setItem('gmail-scan-token', token)
    }

    // Close this tab — the original tab takes it from here.
    // Small delay gives the storage event time to propagate first.
    setTimeout(() => window.close(), 200)
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: '#666' }}>
      Signed in — closing tab…
    </div>
  )
}
