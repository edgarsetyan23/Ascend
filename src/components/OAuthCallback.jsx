import { useEffect, useRef } from 'react'

/**
 * OAuthCallback — landing page after Google OAuth redirect (new tab).
 * Forwards the result across tabs; the initiating scanner owns state validation.
 */
export function OAuthCallback() {
  const sent = useRef(false)
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    const params = new URLSearchParams(window.location.hash.slice(1))
    window.history.replaceState(null, '', window.location.pathname)
    const token = params.get('access_token')
    const state = params.get('state')

    if (!state) return
    try {
      const channel = new BroadcastChannel('gmail-scan-oauth')
      channel.postMessage({ state, token, error: params.get('error') })
      channel.close()
      window.close()
    } catch {
      // The initiating tab allows cancellation and expires its pending login.
    }
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: '#666' }}>
      Return to the original tab to continue or retry sign-in. You can close this tab.
    </div>
  )
}
