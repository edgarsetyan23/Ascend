import { useState } from 'react'
import { useNotifications } from '../hooks/useNotifications.js'

const TRACKER_OPTIONS = [
  { id: 'leetcode', label: '🧩 LeetCode' },
  { id: 'jobs',     label: '💼 Job Applications' },
]

export function NotificationSettings({ onClose }) {
  const { settings, permission, requestAndEnable, updateSettings, disable, sendTest } =
    useNotifications()
  const [testStatus, setTestStatus] = useState(null) // null | 'sent' | 'blocked'

  function handleToggle() {
    if (settings.enabled) {
      disable()
    } else if (permission === 'granted') {
      updateSettings({ enabled: true })
    } else {
      requestAndEnable()
    }
  }

  function handleTrackerToggle(id) {
    const next = settings.trackers.includes(id)
      ? settings.trackers.filter((t) => t !== id)
      : [...settings.trackers, id]
    updateSettings({ trackers: next })
  }

  function handleTest() {
    if (permission !== 'granted') {
      setTestStatus('blocked')
      return
    }
    sendTest()
    setTestStatus('sent')
    setTimeout(() => setTestStatus(null), 3000)
  }

  const isDenied = permission === 'denied'
  const isUnsupported = permission === 'unsupported'

  return (
    <div className="notif-overlay" onClick={onClose}>
      <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
        <div className="notif-header">
          <span>🔔 Daily Reminders</span>
          <button className="notif-close" onClick={onClose}>✕</button>
        </div>

        {isUnsupported && (
          <p className="notif-warn">
            Your browser doesn't support notifications.
          </p>
        )}

        {isDenied && (
          <p className="notif-warn">
            Notifications are blocked. Enable them in your browser's site
            settings, then reload.
          </p>
        )}

        {!isUnsupported && !isDenied && (
          <>
            {/* Master toggle */}
            <label className="notif-row notif-toggle-row">
              <span>Enable daily reminder</span>
              <button
                className={`toggle-pill ${settings.enabled ? 'toggle-pill--on' : ''}`}
                onClick={handleToggle}
                aria-pressed={settings.enabled}
              >
                {settings.enabled ? 'ON' : 'OFF'}
              </button>
            </label>

            {/* Time picker — only shown when enabled */}
            {settings.enabled && (
              <>
                <label className="notif-row">
                  <span>Reminder time</span>
                  <input
                    type="time"
                    className="notif-time"
                    value={settings.time}
                    onChange={(e) => updateSettings({ time: e.target.value })}
                  />
                </label>

                <div className="notif-section-label">Remind me about</div>
                {TRACKER_OPTIONS.map(({ id, label }) => (
                  <label key={id} className="notif-row notif-check-row">
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={settings.trackers.includes(id)}
                      onChange={() => handleTrackerToggle(id)}
                    />
                  </label>
                ))}
              </>
            )}

            {/* Test button — always visible so you can verify permission works */}
            <button
              className={`notif-test-btn ${testStatus === 'sent' ? 'notif-test-btn--sent' : testStatus === 'blocked' ? 'notif-test-btn--blocked' : ''}`}
              onClick={handleTest}
            >
              {testStatus === 'sent'
                ? 'Sent! Check your notifications ✓'
                : testStatus === 'blocked'
                ? 'Permission not granted — enable above first'
                : 'Send test notification'}
            </button>

            {settings.enabled && (
              <p className="notif-hint">
                The notification fires once per day at {settings.time} while
                this tab is open.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
