import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { applyTheme } from './theme';
import type { User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  demo: () => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (u) applyTheme(u.theme);
  }, []);

  useEffect(() => {
    api
      .get<{ user: User }>('/users/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    const onUnauthorized = () => {
      setUserState(null);
      qc.clear();
    };
    window.addEventListener('studentos:unauthorized', onUnauthorized);
    return () => window.removeEventListener('studentos:unauthorized', onUnauthorized);
  }, [qc, setUser]);

  const finish = (u: User) => {
    qc.clear();
    setUser(u);
    return u;
  };

  const value: AuthState = {
    user,
    loading,
    login: async (email, password) => finish((await api.post<{ user: User }>('/auth/login', { email, password })).user),
    register: async (name, email, password) => finish((await api.post<{ user: User }>('/auth/register', { name, email, password })).user),
    demo: async () => finish((await api.post<{ user: User }>('/auth/demo')).user),
    logout: async () => {
      await api.post('/auth/logout').catch(() => undefined);
      qc.clear();
      setUserState(null);
    },
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
