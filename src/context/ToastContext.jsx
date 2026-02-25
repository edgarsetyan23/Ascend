import { createContext, useCallback, useContext, useReducer } from 'react'

const ToastCtx = createContext(null)

function reducer(state, action) {
  if (action.type === 'ADD')    return [...state.slice(-3), action.toast]  // max 4 visible
  if (action.type === 'REMOVE') return state.filter((t) => t.id !== action.id)
  return state
}

// Error toasts stay longer — user needs time to read and decide to retry
const DURATIONS = { success: 3000, error: 6000, info: 4000 }

export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(reducer, [])

  const addToast = useCallback((message, variant = 'info', { onRetry } = {}) => {
    const id = crypto.randomUUID()
    dispatch({ type: 'ADD', toast: { id, message, variant, onRetry } })
    setTimeout(() => dispatch({ type: 'REMOVE', id }), DURATIONS[variant] ?? 4000)
  }, [])

  const dismiss = useCallback((id) => dispatch({ type: 'REMOVE', id }), [])

  return (
    <ToastCtx.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}

// ── Toast UI ──────────────────────────────────────────────────────────────────

const ICONS = { success: '✓', error: '⚠', info: 'ℹ' }

function ToastItem({ toast, onDismiss }) {
  return (
    <div className={`toast toast--${toast.variant}`} role="alert" aria-live="polite">
      <span className="toast-icon">{ICONS[toast.variant]}</span>
      <span className="toast-message">{toast.message}</span>
      <div className="toast-actions">
        {toast.onRetry && (
          <button
            className="toast-retry"
            onClick={() => { toast.onRetry(); onDismiss(toast.id) }}
          >
            Retry
          </button>
        )}
        <button
          className="toast-close"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  )
}

function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
