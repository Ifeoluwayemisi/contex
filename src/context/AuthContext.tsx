import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { apiFetch, parseJsonSafely, getAuthToken, setAuthToken, clearAuthToken } from '../lib/api';

interface AuthModalState {
  isOpen: boolean;
  reason?: string;
  defaultTab?: 'login' | 'signup';
  returnAction?: () => void;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  authModal: AuthModalState;
  openAuthModal: (reason?: string, defaultTab?: 'login' | 'signup', returnAction?: () => void) => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState(true);
  const [authModal, setAuthModal] = useState<AuthModalState>({ isOpen: false });

  // On mount, check if existing session token is valid
  useEffect(() => {
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await apiFetch('/api/auth/me', {}, 1);
      const data = await parseJsonSafely(res, '/api/auth/me');
      if (data && data.user) {
        setUser(data.user);
        setToken(currentToken);
      } else {
        clearAuthToken();
        setUser(null);
        setToken(null);
      }
    } catch (err) {
      console.warn('Session verification notice:', err);
      clearAuthToken();
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }, 1);

    const data = await parseJsonSafely(res, '/api/auth/login');
    if (data.token && data.user) {
      setAuthToken(data.token);
      setToken(data.token);
      setUser(data.user);
      if (authModal.returnAction) {
        authModal.returnAction();
      }
      closeAuthModal();
    } else {
      throw new Error('Authentication succeeded but session token was missing.');
    }
  };

  const signup = async (email: string, password: string, name?: string) => {
    const res = await apiFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    }, 1);

    const data = await parseJsonSafely(res, '/api/auth/signup');
    if (data.token && data.user) {
      setAuthToken(data.token);
      setToken(data.token);
      setUser(data.user);
      if (authModal.returnAction) {
        authModal.returnAction();
      }
      closeAuthModal();
    } else {
      throw new Error('Registration succeeded but session token was missing.');
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' }, 0);
    } catch {
      // Ignore network errors on logout
    } finally {
      clearAuthToken();
      setToken(null);
      setUser(null);
    }
  };

  const openAuthModal = (
    reason?: string, 
    defaultTab: 'login' | 'signup' = 'login', 
    returnAction?: () => void
  ) => {
    setAuthModal({
      isOpen: true,
      reason,
      defaultTab,
      returnAction,
    });
  };

  const closeAuthModal = () => {
    setAuthModal({ isOpen: false });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        signup,
        logout,
        authModal,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
