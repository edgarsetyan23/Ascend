import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { EmailScanner } from '../components/EmailScanner.jsx'
import { OAuthCallback } from '../components/OAuthCallback.jsx'

vi.mock('../context/ToastContext.jsx', () => ({ useToast: () => ({ addToast: vi.fn() }) }))

let channels
beforeEach(() => {
  vi.useFakeTimers()
  channels = new Set()
  vi.stubGlobal('BroadcastChannel', class {
    constructor(name) { this.name = name; channels.add(this) }
    postMessage(data) {
      for (const peer of channels) {
        if (peer !== this && peer.name === this.name) peer.onmessage?.({ data })
      }
    }
    close() { channels.delete(this) }
  })
  vi.spyOn(window, 'open').mockReturnValue({ closed: false })
  vi.spyOn(window, 'close').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [] }) }))
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

function scanner() {
  return render(<EmailScanner entries={[]} addEntry={vi.fn()} updateEntry={vi.fn()} />)
}
function start() {
  fireEvent.click(screen.getByRole('button', { name: /Scan Emails/ }))
  return new URL(window.open.mock.calls.at(-1)[0]).searchParams.get('state')
}

test('repeated scans use current entries after imports and pending sign-in edits', async () => {
  const application = { company: 'Acme', role: 'Engineer' }
  const imported = { ...application, id: 'entry-1', status: 'Applied' }
  const edited = { ...imported, status: 'Interview' }
  const followUp = { ...application, matchedEntryId: imported.id, suggestedStatus: 'Interview' }
  const requests = []
  fetch.mockImplementation(async (url, options) => {
    if (url === '/api/scan-emails') {
      requests.push(JSON.parse(options.body))
      return { ok: true, json: async () => ({ applications: [application], followUps: [followUp] }) }
    }
    return { ok: true, json: async () => url.includes('format=metadata')
      ? { payload: { headers: [] } } : { messages: [{ id: 'email-1' }] } }
  })
  const addEntry = vi.fn()
  const updateEntry = vi.fn()
  const view = render(<EmailScanner entries={[]} addEntry={addEntry} updateEntry={updateEntry} />)
  const first = start()
  expect(channels.size).toBe(1)
  await callback(first)
  fireEvent.click(screen.getByRole('button', { name: 'Apply 1 Selected' }))
  await act(async () => {})
  expect(addEntry).toHaveBeenCalledTimes(1)
  view.rerender(<EmailScanner entries={[imported]} addEntry={addEntry} updateEntry={updateEntry} />)
  const second = start()
  view.rerender(<EmailScanner entries={[edited]} addEntry={addEntry} updateEntry={updateEntry} />)
  expect(channels.size).toBe(1)
  await callback(first)
  expect(requests).toHaveLength(1)
  await callback(second)
  await callback(second)
  expect(requests).toHaveLength(2)
  expect(fetch).toHaveBeenCalledTimes(6)
  expect(channels.size).toBe(0)
  expect(requests[1].existingEntries).toEqual([edited])
  expect(screen.queryByText('Review scan results')).not.toBeInTheDocument()
  expect(screen.getByText(/everything is up to date/)).toBeInTheDocument()
  expect(updateEntry).not.toHaveBeenCalled()
})
async function callback(state, extra = 'access_token=test-token') {
  // A separate tab has no access to the initiating tab's sessionStorage.
  sessionStorage.clear()
  window.history.replaceState(null, '', `/oauth-callback#state=${state}&${extra}`)
  let view
  await act(async () => { view = render(<OAuthCallback />) })
  view.unmount()
}

test('generates fresh cryptographic state and accepts a separate-tab callback exactly once', async () => {
  const random = vi.spyOn(crypto, 'getRandomValues')
  scanner()
  const state = start()
  expect(random).toHaveBeenCalled()
  expect(state).toMatch(/^[a-f0-9]{64}$/)
  await callback(state)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token')
  await callback(state)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(start()).not.toBe(state)
})

test('rejects unsolicited legacy tokens and callbacks', async () => {
  scanner()
  await callback('gmail-scan')
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'gmail-scan-token', newValue: 'injected' })))
  expect(fetch).not.toHaveBeenCalled()
  expect(localStorage.getItem('gmail-scan-token')).toBeNull()
})

test('rejects a mismatched callback while preserving the pending login', async () => {
  scanner()
  const state = start()
  await callback('wrong')
  expect(fetch).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /Waiting for sign-in/ })).toBeDisabled()
  await callback(state)
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('rejects expired callbacks and permits retry', async () => {
  scanner()
  const state = start()
  act(() => vi.advanceTimersByTime(5 * 60 * 1000))
  await callback(state)
  expect(fetch).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /Scan Emails/ })).toBeEnabled()
})

test('denial consumes the login and permits retry', async () => {
  scanner()
  const state = start()
  await callback(state, 'error=access_denied')
  expect(screen.getByRole('button', { name: /Scan Emails/ })).toBeEnabled()
  await callback(state)
  expect(fetch).not.toHaveBeenCalled()
  start()
})

test('cancellation invalidates the old login even after another login starts', async () => {
  scanner()
  const state = start()
  fireEvent.click(screen.getByRole('button', { name: /Cancel sign-in/ }))
  const next = start()
  await callback(state)
  expect(fetch).not.toHaveBeenCalled()
  await callback(next)
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('unmount invalidates pending login', async () => {
  const view = scanner()
  const state = start()
  view.unmount()
  scanner()
  await callback(state)
  expect(fetch).not.toHaveBeenCalled()
})

test('checks wall-clock expiry even when the timeout has not run', async () => {
  scanner()
  const state = start()
  vi.setSystemTime(Date.now() + 5 * 60 * 1000)
  await callback(state)
  expect(fetch).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /Scan Emails/ })).toBeEnabled()
})

test('a malformed response consumes matching state and allows retry', async () => {
  scanner()
  const state = start()
  await callback(state, '')
  await callback(state)
  expect(fetch).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /Scan Emails/ })).toBeEnabled()
})

test('only the initiating scanner consumes a broadcast result', async () => {
  scanner()
  const first = start()
  scanner()
  const second = start()
  await callback(first)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: /Waiting for sign-in/ })).toBeDisabled()
  await callback(second)
  expect(fetch).toHaveBeenCalledTimes(2)
})
