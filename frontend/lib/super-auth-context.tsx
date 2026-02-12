'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { superAuth, SuperUser } from './super-api';
import { getErrorMessage } from './types';

interface SuperAuthContextType {
  user: SuperUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const SuperAuthContext = createContext<SuperAuthContextType | undefined>(undefined);

export function SuperAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SuperUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = superAuth.getToken();

      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await superAuth.getCurrentUser();
        setUser(response.data.user);
      } catch (err) {
        // Token invalid or expired
        superAuth.clearToken();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null);

    try {
      console.log('[SuperAuth] Attempting login for:', email);
      const response = await superAuth.login(email, password);
      console.log('[SuperAuth] Login response:', response.data);
      const { token, user: userData } = response.data;

      superAuth.setToken(token);
      setUser(userData);
      return true;
    } catch (err: unknown) {
      console.error('[SuperAuth] Login error:', err);
      const errorMessage = getErrorMessage(err, 'Login failed');
      console.error('[SuperAuth] Error message:', errorMessage);
      setError(errorMessage);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    superAuth.clearToken();
    setUser(null);
    setError(null);
  }, []);

  const value: SuperAuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout
  };

  return (
    <SuperAuthContext.Provider value={value}>
      {children}
    </SuperAuthContext.Provider>
  );
}

export function useSuperAuth() {
  const context = useContext(SuperAuthContext);
  if (context === undefined) {
    throw new Error('useSuperAuth must be used within a SuperAuthProvider');
  }
  return context;
}

export default SuperAuthContext;
