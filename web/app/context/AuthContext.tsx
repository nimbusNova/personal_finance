'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getMe } from '@/lib/api';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth');

interface User {
  id: number;
  email: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = (token: string) => {
    log.info('Login called, storing token');
    localStorage.setItem('token', token);
    getMe()
      .then((data) => {
        log.info(`User loaded: ${data.email}`);
        setUser(data);
      })
      .catch(() => setUser(null));
  };

  const logout = () => {
    log.info('Logout called');
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/login';
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      log.debug('No token found, skipping auth check');
      setIsLoading(false);
      return;
    }
    log.debug('Validating existing token');
    getMe()
      .then((data) => {
        log.info(`Session restored: ${data.email}`);
        setUser(data);
      })
      .catch(() => {
        log.warn('Token invalid, clearing session');
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
