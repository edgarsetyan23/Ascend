import { useState, useEffect } from 'react'
import { useToast } from '../context/ToastContext.jsx'

/**
 * EmailScanner — scans Gmail for job application confirmation emails
 * and lets the user review + import them into the Jobs tracker.
 *
 * OAuth flow (new-tab redirect, no popup):
 *   1. Click → open new tab with Google OAuth URL
 *   2. User signs in → Google redirects to /oauth-callback in that tab
 *   3. OAuthCallback writes token to localStorage → closes the tab
 *   4. The 'storage' event fires here → scan starts automatically
 *
 * Props:
 *   addEntry  — from useEntries(activeId); adds one row to DynamoDB + optimistic UI
 *   entries   — current tracker entries; used for deduplication
 */
export function EmailScanner({ addEntry, entries }) {
  const { addToast } = useToast()
  const [scanning, setScanning] = useState(false)
  const [oauthPending, setOauthPending] = useState(false) // waiting for sign-in tab
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)
  const [modal, setModal] = useState({ show: false, apps: [], selected: new Set() })

  // Listen for the token written by OAuthCallback in the sign-in tab
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== 'gmail-scan-token' || !e.newValue) return
      localStorage.removeItem('gmail-scan-token')
      setOauthPending(false)
      setScanning(true)
      handleToken(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleScan() {
    setError(null)
    setStatus(null)
    setOauthPending(true)
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      redirect_uri: `${window.location.origin}/oauth-callback`,
      response_type: 'token',
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      state: 'gmail-scan',
    })
    window.open(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, '_blank')
  }

  async function handleToken(accessToken) {
    console.log('[EmailScanner] handleToken called — starting Gmail search')
    // Hard 30-second timeout — aborts all in-flight fetches if anything hangs
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30_000)
    const signal = controller.signal

    try {
      // 1. Search Gmail for application-confirmation emails (last 90 days)
      // Broad query — no subject: restriction so it matches body text too
      const q = encodeURIComponent(
        '("thank you for applying" OR "application received" OR "application submitted" OR ' +
        '"we received your application" OR "application confirmation" OR "your application for" OR ' +
        '"applied to" OR "thanks for applying" OR "application to" OR "we have received your application") ' +
        'newer_than:90d'
      )
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=50`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal }
      )
      const listData = await listRes.json()
      console.log('[EmailScanner] Gmail list response:', listData)

      if (!listRes.ok || listData.error) {
        const msg = listData.error?.message ?? `Gmail API error ${listRes.status}`
        throw new Error(msg)
      }

      const messages = listData.messages ?? []

      if (messages.length === 0) {
        setStatus('No matching emails found — try checking your Gmail manually for application confirmations.')
        return
      }
      setStatus(`Found ${messages.length} email${messages.length !== 1 ? 's' : ''} — extracting with Claude…`)

      // 2. Fetch metadata only for each message (parallel) — no email body ever sent
      const metaRequests = messages.map((msg) =>
        fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata` +
            `&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` }, signal }
        ).then((r) => r.json())
      )
      const metas = await Promise.all(metaRequests)

      // 3. Flatten header arrays into plain objects
      const emails = metas.map((meta) => ({
        subject: meta.payload?.headers?.find((h) => h.name === 'Subject')?.value ?? '',
        from: meta.payload?.headers?.find((h) => h.name === 'From')?.value ?? '',
        date: meta.payload?.headers?.find((h) => h.name === 'Date')?.value ?? '',
        snippet: meta.snippet ?? '',
      }))

      // 4. Send to our serverless function — Claude extracts structured data
      const scanRes = await fetch('/api/scan-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
        signal,
      })
      const { applications = [], error: apiError } = await scanRes.json()
      if (apiError) throw new Error(apiError)

      // 5. Deduplicate against existing tracker entries (case-insensitive company+role)
      const existingKeys = new Set(
        entries.map((e) => `${e.company?.toLowerCase()}|${e.role?.toLowerCase()}`)
      )
      const newApps = applications.filter(
        (a) => !existingKeys.has(`${a.company?.toLowerCase()}|${a.role?.toLowerCase()}`)
      )

      if (newApps.length === 0) {
        setStatus(`Scan complete — no new applications found (${applications.length} detected, all already tracked).`)
      } else {
        setStatus(null)
        showModal(newApps)
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Scan timed out — please try again.')
      } else {
        setError(`Scan failed: ${err.message}`)
      }
      setStatus(null)
    } finally {
      clearTimeout(timeoutId)
      setScanning(false)
    }
  }

  function showModal(apps) {
    setModal({ show: true, apps, selected: new Set(apps.map((_, i) => i)) })
  }

  function toggleSelect(idx) {
    setModal((prev) => {
      const next = new Set(prev.selected)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return { ...prev, selected: next }
    })
  }

  function selectAll() {
    setModal((prev) => ({ ...prev, selected: new Set(prev.apps.map((_, i) => i)) }))
  }

  function deselectAll() {
    setModal((prev) => ({ ...prev, selected: new Set() }))
  }

  async function handleImport() {
    for (const idx of modal.selected) {
      const app = modal.apps[idx]
      await addEntry({
        company: app.company,
        role: app.role,
        status: 'Applied',
        appliedDate: app.appliedDate,
        source: app.source || 'Other',
      })
    }
    setModal({ show: false, apps: [], selected: new Set() })
  }

  function closeModal() {
    setModal({ show: false, apps: [], selected: new Set() })
  }

  const selectedCount = modal.selected.size

  return (
    <>
      {/* ── Scan button bar ─────────────────────────────────────── */}
      <div className="email-scanner-bar">
        <div className="email-scanner-bar-top">
          <button className="btn btn--secondary" onClick={handleScan} disabled={scanning || oauthPending}>
            {scanning ? 'Scanning…' : oauthPending ? 'Waiting for sign-in…' : '📧 Scan Emails'}
          </button>
          <span className="email-scanner-hint">Finds job application emails from your Gmail</span>
        </div>
        {status && !error && <p className="email-scanner-status">{status}</p>}
        {error && <p className="email-scanner-error">{error}</p>}
      </div>

      {/* ── Review modal ─────────────────────────────────────────── */}
      {modal.show && (
        <div className="email-scanner-modal-overlay" onClick={closeModal}>
          <div className="email-scanner-modal" onClick={(e) => e.stopPropagation()}>
            <div className="email-scanner-modal-header">
              <span className="email-scanner-modal-title">
                {`${modal.apps.length} application${modal.apps.length !== 1 ? 's' : ''} detected`}
              </span>
              <button className="btn btn--ghost" onClick={closeModal} aria-label="Close">
                ✕
              </button>
            </div>

            <>
              <div className="email-scanner-table-wrap">
                  <table className="email-scanner-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Role</th>
                        <th>Applied Date</th>
                        <th>Source</th>
                        <th>
                          <input
                            type="checkbox"
                            checked={selectedCount === modal.apps.length}
                            onChange={selectedCount === modal.apps.length ? deselectAll : selectAll}
                            title="Select / deselect all"
                          />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {modal.apps.map((app, idx) => (
                        <tr key={idx}>
                          <td>{app.company || <em>Unknown</em>}</td>
                          <td>{app.role || <em>Unknown</em>}</td>
                          <td>{app.appliedDate || '—'}</td>
                          <td>{app.source || '—'}</td>
                          <td>
                            <input
                              type="checkbox"
                              checked={modal.selected.has(idx)}
                              onChange={() => toggleSelect(idx)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="email-scanner-modal-footer">
                  <button className="btn btn--ghost" onClick={deselectAll}>
                    Deselect All
                  </button>
                  <button className="btn btn--ghost" onClick={selectAll}>
                    Select All
                  </button>
                  <button
                    className="btn btn--primary"
                    onClick={handleImport}
                    disabled={selectedCount === 0}
                  >
                    Import {selectedCount > 0 ? selectedCount : ''} Selected
                  </button>
                </div>
            </>
          </div>
        </div>
      )}
    </>
  )
}
