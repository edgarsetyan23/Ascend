import { useState, useMemo, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { RecruiterView } from './components/RecruiterView.jsx'
import { OAuthCallback } from './components/OAuthCallback.jsx'
import { NotFound } from './components/NotFound.jsx'
import { Sidebar } from './components/Sidebar.jsx'
import { StatsBar } from './components/StatsBar.jsx'
import { TrackerTable } from './components/TrackerTable.jsx'
import { SkeletonTable } from './components/SkeletonTable.jsx'
import { EntryModal } from './components/EntryModal.jsx'
import { ThemeToggle } from './components/ThemeToggle.jsx'
import { ResumeReview } from './components/ResumeReview.jsx'
import { NotificationSettings } from './components/NotificationSettings.jsx'
import { EmailScanner } from './components/EmailScanner.jsx'
import { LeetCodeProfile } from './components/LeetCodeProfile.jsx'
import { ActivityLog } from './components/ActivityLog.jsx'
import { AuthGate } from './components/AuthGate.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { useToast } from './context/ToastContext.jsx'
import { useEntries } from './hooks/useEntries.js'
import { useTheme } from './hooks/useTheme.js'
import { TRACKER_CONFIGS, TRACKER_LIST } from './trackers/index.js'
import { computeStats } from './utils/stats.js'

/**
 * Inner app — only rendered after the user is authenticated.
 * Separated from the shell so useAuth() and useEntries() always
 * run with a valid user in context.
 */
function AppShell() {
  const { logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { addToast } = useToast()
  const validIds = useMemo(() => new Set(TRACKER_LIST.map((t) => t.id)), [])
  const getTabFromHash = () => {
    const hash = window.location.hash.slice(1)
    return validIds.has(hash) ? hash : TRACKER_LIST[0].id
  }
  const [activeId, setActiveId] = useState(getTabFromHash)

  // Keep activeId in sync when user navigates with browser back/forward
  useEffect(() => {
    const onHashChange = () => setActiveId(getTabFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  const [modal, setModal] = useState(null) // null | { mode: 'add' | 'edit', entry?: object }
  const [showNotifSettings, setShowNotifSettings] = useState(false)
  // Persists the count for each tracker as the user visits tabs.
  // Starts empty — fills in one tracker at a time as entries load.
  const [cachedCounts, setCachedCounts] = useState({})

  const tracker = TRACKER_CONFIGS[activeId]

  /*
   * useEntries replaces useStorage.
   *
   * Interview point: The hook's interface is identical to the old
   * useStorage hook (same return shape), which is why nothing below
   * this line had to change. This is the "Dependency Inversion"
   * principle — the component depends on an interface, not a specific
   * implementation. Swapping localStorage for an API was a one-line
   * import change in this file.
   */
  const { entries, addEntry, updateEntry, deleteEntry, loading, error, refetch } = useEntries(activeId)

  // Surface API errors as toasts instead of a static banner.
  // Only fires when error transitions from null → a message.
  useEffect(() => {
    if (error) addToast(error, 'error', { onRetry: refetch })
  }, [error]) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => computeStats(activeId, entries), [activeId, entries])

  // Once entries finish loading for the active tracker, save the count.
  // This way the sidebar number stays visible after switching away.
  useEffect(() => {
    if (!loading) {
      setCachedCounts((prev) => ({ ...prev, [activeId]: entries.length }))
    }
  }, [activeId, entries, loading])

  // Merge cached counts with the live count for the active tracker.
  // Active tracker always wins (reflects adds/deletes instantly).
  const entryCounts = useMemo(() => ({
    ...cachedCounts,
    [activeId]: entries.length,
  }), [activeId, entries, cachedCounts])

  function handleAdd() {
    setModal({ mode: 'add' })
  }

  function handleEdit(entry) {
    setModal({ mode: 'edit', entry })
  }

  function handleDelete(id) {
    if (window.confirm('Delete this entry?')) {
      deleteEntry(id)
      addToast('Entry deleted', 'success')
    }
  }

  function handleSave(formData) {
    if (modal.mode === 'add') {
      addEntry(formData)
      addToast('Entry added', 'success')
    } else {
      updateEntry(modal.entry.id, formData)
      addToast('Entry updated', 'success')
    }
    setModal(null)
  }

  function handleSelectTracker(id) {
    window.location.hash = id
    setActiveId(id)
    setModal(null)
  }


  return (
    <div className="app">
      <Sidebar
        activeId={activeId}
        onSelect={handleSelectTracker}
        entryCounts={entryCounts}
      />

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <span className="tracker-icon">{tracker.icon}</span>
            <h1 className="tracker-name">{tracker.name}</h1>
          </div>

          <button
            className="notif-bell"
            onClick={() => setShowNotifSettings((v) => !v)}
            aria-label="Notification settings"
            title="Daily reminders"
          >
            🔔
          </button>

          <ThemeToggle theme={theme} onToggle={toggleTheme} />

          {/* Sign out clears the in-memory JWT — next action hits AuthGate */}
          <button
            className="topbar-icon-btn"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
          >
            ⏻
          </button>
        </header>

        {activeId === 'resume' ? (
          <div className="content">
            <ResumeReview
              entries={entries}
              addEntry={addEntry}
              deleteEntry={deleteEntry}
              loading={loading}
            />
          </div>
        ) : (
          <>
            <StatsBar stats={stats} />
            <div className="content">
              {loading ? (
                <SkeletonTable tracker={tracker} />
              ) : (
                <>
                  {activeId === 'leetcode' && <LeetCodeProfile />}
                  {activeId === 'jobs' && (
                    <EmailScanner addEntry={addEntry} entries={entries} />
                  )}
                  {activeId === 'activity' ? (
                    <ActivityLog
                      tracker={tracker}
                      entries={entries}
                      onAdd={handleAdd}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ) : (
                    <TrackerTable
                      tracker={tracker}
                      entries={entries}
                      onAdd={handleAdd}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {showNotifSettings && (
        <NotificationSettings onClose={() => setShowNotifSettings(false)} />
      )}

      {modal && (
        <EntryModal
          tracker={tracker}
          existing={modal.mode === 'edit' ? modal.entry : null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

/**
 * App — top-level shell.
 *
 * AuthGate wraps AppShell. It reads from AuthContext (provided by
 * AuthProvider in main.jsx). If the user is not logged in, it renders
 * the login/signup form. Once authenticated, it renders its children.
 *
 * Interview point: this is the "Route Guard" or "Protected Route"
 * pattern used universally in authenticated web apps.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/portfolio" element={<RecruiterView />} />
      <Route path="/oauth-callback" element={<OAuthCallback />} />
      <Route path="/" element={<AuthGate><AppShell /></AuthGate>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
