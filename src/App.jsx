import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'

const RecruiterView = lazy(() => import('./components/RecruiterView.jsx').then(m => ({ default: m.RecruiterView })))
const TrackerApp = lazy(() => import('./TrackerApp.jsx'))
const OAuthCallback = lazy(() => import('./components/OAuthCallback.jsx').then(m => ({ default: m.OAuthCallback })))
const NotFound = lazy(() => import('./components/NotFound.jsx').then(m => ({ default: m.NotFound })))

function LegacyOverview() {
  const { search, hash } = useLocation()
  return <Navigate to={'/' + search + hash} replace />
}
export default function App() {
  const { pathname, hash, search } = useLocation()
  const legacyTracker = pathname === '/' && /^#(leetcode|jobs|activity|gaming|resume)$/.test(hash)
  return (
    <ErrorBoundary>
      <Suspense fallback={<p className="route-loading" role="status">Loading page...</p>}>
        <Routes>
          <Route path="/" element={legacyTracker ? <Navigate to={'/app' + search + hash} replace /> : <RecruiterView />} />
          <Route path="/portfolio" element={<LegacyOverview />} />
          <Route path="/portfolio/*" element={<RecruiterView />} />
          <Route path="/app" element={<TrackerApp />} />
          <Route path="/oauth-callback" element={<OAuthCallback />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
