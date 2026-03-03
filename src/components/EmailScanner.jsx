import { useState, useEffect } from 'react'
import { useToast } from '../context/ToastContext.jsx'

/**
 * EmailScanner — scans Gmail for job application emails and lets the user:
 *   1. Import new applications into the Jobs tracker
 *   2. Apply status updates (follow-ups) to existing tracked applications
 *
 * OAuth flow (new-tab redirect, no popup):
 *   1. Click → open new tab with Google OAuth URL
 *   2. User signs in → Google redirects to /oauth-callback in that tab
 *   3. OAuthCallback writes token to localStorage → closes the tab
 *   4. The 'storage' event fires here → scan starts automatically
 *
 * Props:
 *   addEntry    — from useEntries; adds one row to DynamoDB + optimistic UI
 *   updateEntry — from useEntries; updates an existing row's status
 *   entries     — current tracker entries; used for deduplication + follow-up matching
 */
export function EmailScanner({ addEntry, updateEntry, entries }) {
  const { addToast } = useToast()
  const [scanning, setScanning] = useState(false)
  const [oauthPending, setOauthPending] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)
  const [modal, setModal] = useState({
    show: false,
    apps: [],
    followUps: [],
    selectedApps: new Set(),
    selectedFollowUps: new Set(),
  })

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
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30_000)
    const signal = controller.signal

    try {
      // 1. Search Gmail for application-related emails (last 90 days)
      const q = encodeURIComponent(
        '("thank you for applying" OR "application received" OR "application submitted" OR ' +
        '"we received your application" OR "application confirmation" OR "your application for" OR ' +
        '"applied to" OR "thanks for applying" OR "application to" OR "we have received your application" OR ' +
        '"interview" OR "next steps" OR "offer" OR "unfortunately" OR "move forward") ' +
        'newer_than:90d'
      )
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=50`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal }
      )
      const listData = await listRes.json()

      if (!listRes.ok || listData.error) {
        throw new Error(listData.error?.message ?? `Gmail API error ${listRes.status}`)
      }

      const messages = listData.messages ?? []
      if (messages.length === 0) {
        setStatus('No matching emails found — try checking your Gmail manually.')
        return
      }
      setStatus(`Found ${messages.length} email${messages.length !== 1 ? 's' : ''} — analyzing with Claude…`)

      // 2. Fetch metadata only — no email body ever sent
      const metas = await Promise.all(
        messages.map((msg) =>
          fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata` +
              `&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` }, signal }
          ).then((r) => r.json())
        )
      )

      // 3. Flatten header arrays into plain objects
      const emails = metas.map((meta) => ({
        subject: meta.payload?.headers?.find((h) => h.name === 'Subject')?.value ?? '',
        from: meta.payload?.headers?.find((h) => h.name === 'From')?.value ?? '',
        date: meta.payload?.headers?.find((h) => h.name === 'Date')?.value ?? '',
        snippet: meta.snippet ?? '',
      }))

      // 4. Send to serverless function — pass existing entries so Claude can match follow-ups
      const existingEntries = entries.map((e) => ({
        id: e.id,
        company: e.company,
        role: e.role,
        status: e.status,
      }))

      const scanRes = await fetch('/api/scan-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails, existingEntries }),
        signal,
      })
      const { applications = [], followUps = [], error: apiError } = await scanRes.json()
      if (apiError) throw new Error(apiError)

      // 5. Deduplicate new applications against existing entries (case-insensitive)
      const existingKeys = new Set(
        entries.map((e) => `${e.company?.toLowerCase()}|${e.role?.toLowerCase()}`)
      )
      const newApps = applications.filter(
        (a) => !existingKeys.has(`${a.company?.toLowerCase()}|${a.role?.toLowerCase()}`)
      )

      // 6. Filter follow-ups to only those where the suggested status differs from current
      const actionableFollowUps = followUps.filter((fu) => {
        const existing = entries.find((e) => e.id === fu.matchedEntryId)
        return existing && existing.status !== fu.suggestedStatus
      })

      const totalActions = newApps.length + actionableFollowUps.length
      if (totalActions === 0) {
        setStatus(
          `Scan complete — everything is up to date. ` +
          `(${applications.length} application${applications.length !== 1 ? 's' : ''} detected, ` +
          `${followUps.length} follow-up${followUps.length !== 1 ? 's' : ''} detected)`
        )
      } else {
        setStatus(null)
        showModal(newApps, actionableFollowUps)
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

  function showModal(apps, followUps) {
    setModal({
      show: true,
      apps,
      followUps,
      selectedApps: new Set(apps.map((_, i) => i)),
      selectedFollowUps: new Set(followUps.map((_, i) => i)),
    })
  }

  function toggleApp(idx) {
    setModal((prev) => {
      const next = new Set(prev.selectedApps)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return { ...prev, selectedApps: next }
    })
  }

  function toggleFollowUp(idx) {
    setModal((prev) => {
      const next = new Set(prev.selectedFollowUps)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return { ...prev, selectedFollowUps: next }
    })
  }

  function selectAllApps() {
    setModal((prev) => ({ ...prev, selectedApps: new Set(prev.apps.map((_, i) => i)) }))
  }
  function deselectAllApps() {
    setModal((prev) => ({ ...prev, selectedApps: new Set() }))
  }
  function selectAllFollowUps() {
    setModal((prev) => ({ ...prev, selectedFollowUps: new Set(prev.followUps.map((_, i) => i)) }))
  }
  function deselectAllFollowUps() {
    setModal((prev) => ({ ...prev, selectedFollowUps: new Set() }))
  }

  async function handleImport() {
    // Import new applications
    for (const idx of modal.selectedApps) {
      const app = modal.apps[idx]
      await addEntry({
        company: app.company,
        role: app.role,
        status: 'Applied',
        appliedDate: app.appliedDate,
        source: app.source || 'Other',
      })
    }
    // Apply follow-up status updates
    for (const idx of modal.selectedFollowUps) {
      const fu = modal.followUps[idx]
      await updateEntry(fu.matchedEntryId, { status: fu.suggestedStatus })
    }
    const appCount = modal.selectedApps.size
    const fuCount = modal.selectedFollowUps.size
    const parts = []
    if (appCount > 0) parts.push(`${appCount} application${appCount !== 1 ? 's' : ''} imported`)
    if (fuCount > 0) parts.push(`${fuCount} status update${fuCount !== 1 ? 's' : ''} applied`)
    if (parts.length > 0) addToast(parts.join(', '), 'success')
    setModal({ show: false, apps: [], followUps: [], selectedApps: new Set(), selectedFollowUps: new Set() })
  }

  function closeModal() {
    setModal({ show: false, apps: [], followUps: [], selectedApps: new Set(), selectedFollowUps: new Set() })
  }

  const totalSelected = modal.selectedApps.size + modal.selectedFollowUps.size

  return (
    <>
      {/* ── Scan button bar ─────────────────────────────────────── */}
      <div className="email-scanner-bar">
        <div className="email-scanner-bar-top">
          <button className="btn btn--secondary" onClick={handleScan} disabled={scanning || oauthPending}>
            {scanning ? 'Scanning…' : oauthPending ? 'Waiting for sign-in…' : '📧 Scan Emails'}
          </button>
          <span className="email-scanner-hint">Finds new applications and status updates from your Gmail</span>
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
                Review scan results
              </span>
              <button className="btn btn--ghost" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            <div className="email-scanner-sections">
              {/* ── New Applications section ── */}
              {modal.apps.length > 0 && (
                <div className="email-scanner-section">
                  <div className="email-scanner-section-header">
                    <span className="email-scanner-section-title">
                      New Applications <span className="email-scanner-section-count">{modal.apps.length}</span>
                    </span>
                    <div className="email-scanner-section-actions">
                      <button className="btn btn--ghost btn--xs" onClick={deselectAllApps}>None</button>
                      <button className="btn btn--ghost btn--xs" onClick={selectAllApps}>All</button>
                    </div>
                  </div>
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
                              checked={modal.selectedApps.size === modal.apps.length}
                              onChange={modal.selectedApps.size === modal.apps.length ? deselectAllApps : selectAllApps}
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
                                checked={modal.selectedApps.has(idx)}
                                onChange={() => toggleApp(idx)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Status Updates section ── */}
              {modal.followUps.length > 0 && (
                <div className="email-scanner-section">
                  <div className="email-scanner-section-header">
                    <span className="email-scanner-section-title">
                      Status Updates <span className="email-scanner-section-count">{modal.followUps.length}</span>
                    </span>
                    <div className="email-scanner-section-actions">
                      <button className="btn btn--ghost btn--xs" onClick={deselectAllFollowUps}>None</button>
                      <button className="btn btn--ghost btn--xs" onClick={selectAllFollowUps}>All</button>
                    </div>
                  </div>
                  <div className="email-scanner-table-wrap">
                    <table className="email-scanner-table">
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>Role</th>
                          <th>Status Change</th>
                          <th>
                            <input
                              type="checkbox"
                              checked={modal.selectedFollowUps.size === modal.followUps.length}
                              onChange={modal.selectedFollowUps.size === modal.followUps.length ? deselectAllFollowUps : selectAllFollowUps}
                              title="Select / deselect all"
                            />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {modal.followUps.map((fu, idx) => {
                          const existing = entries.find((e) => e.id === fu.matchedEntryId)
                          return (
                            <tr key={idx}>
                              <td>{fu.company || <em>Unknown</em>}</td>
                              <td>{fu.role || <em>Unknown</em>}</td>
                              <td>
                                <span className="email-scanner-status-change">
                                  <span className="email-scanner-status-from">{existing?.status ?? '—'}</span>
                                  <span className="email-scanner-status-arrow">→</span>
                                  <span className="email-scanner-status-to">{fu.suggestedStatus}</span>
                                </span>
                              </td>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={modal.selectedFollowUps.has(idx)}
                                  onChange={() => toggleFollowUp(idx)}
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="email-scanner-modal-footer">
              <button className="btn btn--ghost" onClick={closeModal}>Cancel</button>
              <button
                className="btn btn--primary"
                onClick={handleImport}
                disabled={totalSelected === 0}
              >
                Apply {totalSelected > 0 ? totalSelected : ''} Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
