import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_KEY = 'notification_settings'

const DEFAULT_SETTINGS = {
  enabled: false,
  time: '09:00',           // HH:MM in 24-hour format
  trackers: ['leetcode', 'jobs'],
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

// Returns a human-readable summary for each tracker to include in the notification
function buildNotificationBody(trackerIds) {
  const lines = []

  trackerIds.forEach((id) => {
    try {
      const raw = localStorage.getItem(`tracker_${id}`)
      const entries = raw ? JSON.parse(raw) : []

      if (id === 'leetcode') {
        const today = new Date().toISOString().slice(0, 10)
        const solvedToday = entries.filter(
          (e) => e.date === today && e.status === 'Solved'
        ).length
        lines.push(
          solvedToday > 0
            ? `🧩 LeetCode: ${solvedToday} solved today — keep it up!`
            : '🧩 LeetCode: No problems solved yet today.'
        )
      }

      if (id === 'jobs') {
        const active = entries.filter((e) =>
          ['Applied', 'Phone Screen', 'Technical', 'Onsite'].includes(e.status)
        ).length
        lines.push(
          active > 0
            ? `💼 Jobs: ${active} active application${active !== 1 ? 's' : ''} in your pipeline.`
            : '💼 Jobs: No active applications — time to apply!'
        )
      }
    } catch {
      // Skip broken tracker data silently
    }
  })

  return lines.join('\n') || 'Time to check in on your progress!'
}

export function useNotifications() {
  // Keep duplicate suppression across settings edits and interval restarts.
  const lastFiredMinute = useRef(null)
  const [settings, setSettings] = useState(loadSettings)
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // Scheduler: poll every 10s to survive browser background-tab timer throttling.
  // A 60s interval can be throttled to fire every 5+ minutes in inactive tabs,
  // causing it to skip the notification window entirely.
  useEffect(() => {
    if (!settings.enabled || permission !== 'granted') return

    const interval = setInterval(() => {
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const currentTime = `${hh}:${mm}`
      const todayMinuteKey = `${now.toISOString().slice(0, 10)}_${currentTime}`

      if (currentTime === settings.time && lastFiredMinute.current !== todayMinuteKey) {
        lastFiredMinute.current = todayMinuteKey
        const body = buildNotificationBody(settings.trackers)
        new Notification('Ascend — Daily Check-in', {
          body,
          icon: '/favicon.ico',
          tag: 'ascend-daily-reminder',
        })
      }
    }, 10_000) // 10s — survives up to ~5x browser throttling and still catches the minute

    return () => clearInterval(interval)
  }, [settings.enabled, settings.time, settings.trackers, permission])

  // Request permission and enable notifications
  const requestAndEnable = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'denied') return

    const result = await Notification.requestPermission()
    setPermission(result)

    if (result === 'granted') {
      setSettings((prev) => ({ ...prev, enabled: true }))
    }
  }, [])

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const disable = useCallback(() => {
    setSettings((prev) => ({ ...prev, enabled: false }))
  }, [])

  const sendTest = useCallback(() => {
    if (permission !== 'granted') return
    const body = buildNotificationBody(settings.trackers)
    new Notification('Ascend — Test Notification', {
      body,
      icon: '/favicon.ico',
      tag: 'ascend-test',
    })
  }, [permission, settings.trackers])

  return { settings, permission, requestAndEnable, updateSettings, disable, sendTest }
}
