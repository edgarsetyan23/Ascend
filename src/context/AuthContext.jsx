import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { signIn, signUp, confirmSignUp, signOut, getSession, forgotPassword, confirmPassword } from '../lib/cognito.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // user = IdToken claims object: { sub, email, ... }
  const [user, setUser] = useState(null);
  // token = raw IdToken JWT string, kept in memory only (not localStorage)
  const [token, setToken] = useState(null);
  // loading = true while we check for an existing session on mount
  const [loading, setLoading] = useState(true);

  // On mount: try to restore session (no-op with in-memory storage after refresh)
  useEffect(() => {
    getSession().then((session) => {
      if (session) {
        setUser(session.getIdToken().payload);
        setToken(session.getIdToken().getJwtToken());
      }
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (email, password) => {
    const { session } = await signIn(email, password);
    setUser(session.getIdToken().payload);
    setToken(session.getIdToken().getJwtToken());
  }, []);

  const register = useCallback(async (email, password) => {
    await signUp(email, password);
  }, []);

  const confirm = useCallback(async (email, code) => {
    await confirmSignUp(email, code);
  }, []);

  const resetPassword = useCallback(async (email) => {
    await forgotPassword(email)
  }, [])

  const confirmReset = useCallback(async (email, code, newPassword) => {
    await confirmPassword(email, code, newPassword)
  }, [])

  const logout = useCallback(() => {
    signOut();
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, confirm, resetPassword, confirmReset, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
