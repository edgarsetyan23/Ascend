import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/*
      BrowserRouter is outermost so useNavigate/Link work everywhere.
      AuthProvider must wrap App so that useAuth() works inside AuthGate.
      It reads the existing Cognito session on mount, so the user
      stays logged in across hot-reloads during development.
    */}
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
