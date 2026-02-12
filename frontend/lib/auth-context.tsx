'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { auth, setAgencySlug } from './api';
import { useAgency, Agency } from './agency-context';
import { getErrorMessage, User } from './types';

export type { User };

/**
 * Auth context state and methods
 */
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Token storage keys - scoped by agency
 */
const getTokenKey = (agencySlug: string | null) =>
  agencySlug ? `token_${agencySlug}` : 'token';

/**
 * User storage keys - scoped by agency
 */
const getUserKey = (agencySlug: string | null) =>
  agencySlug ? `user_${agencySlug}` : 'user';

/**
 * AuthProvider component
 *
 * Manages authentication state with agency context.
 * Tokens are stored per-agency to support multi-tenant login.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { agency, agencySlug } = useAgency();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set agency slug in API client synchronously (not in useEffect)
  // This ensures the slug is available before any child component effects fire API calls
  if (agencySlug) {
    setAgencySlug(agencySlug);
  }

  /**
   * Check for existing token and validate on mount
   */
  useEffect(() => {
    const checkAuth = async () => {
      if (!agencySlug) {
        setIsLoading(false);
        return;
      }

      const tokenKey = getTokenKey(agencySlug);
      const token = localStorage.getItem(tokenKey);

      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await auth.getCurrentUser();
        const userData = response.data.user;
        setUser(userData);
        // Update stored user data
        const userKey = getUserKey(agencySlug);
        localStorage.setItem(userKey, JSON.stringify(userData));
      } catch (err) {
        // Token invalid or expired
        const userKey = getUserKey(agencySlug);
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userKey);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [agencySlug]);

  /**
   * Login handler
   */
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null);

    if (!agencySlug) {
      setError('Agency context required for login');
      return false;
    }

    try {
      const response = await auth.login(email, password, agencySlug);
      const { token, user: userData } = response.data;

      // Store token and user data with agency scope
      const tokenKey = getTokenKey(agencySlug);
      const userKey = getUserKey(agencySlug);
      localStorage.setItem(tokenKey, token);
      localStorage.setItem(userKey, JSON.stringify(userData));

      setUser(userData);
      return true;
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Login failed'));
      return false;
    }
  }, [agencySlug]);

  /**
   * Logout handler
   */
  const logout = useCallback(() => {
    const tokenKey = getTokenKey(agencySlug);
    const userKey = getUserKey(agencySlug);
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    setUser(null);
    setError(null);
  }, [agencySlug]);

  /**
   * Refresh user data
   */
  const refreshUser = useCallback(async () => {
    try {
      const response = await auth.getCurrentUser();
      setUser(response.data.user);
    } catch (err) {
      // Token may be invalid
      logout();
    }
  }, [logout]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook to check if user has specific role
 */
export function useHasRole(...roles: string[]) {
  const { user } = useAuth();
  return user ? roles.includes(user.role) : false;
}

/**
 * Hook to require authentication
 * Returns true if authenticated, false otherwise
 */
export function useRequireAuth(redirectTo?: string) {
  const { isAuthenticated, isLoading } = useAuth();
  const { agencySlug } = useAgency();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && redirectTo && typeof window !== 'undefined') {
      window.location.href = `/${agencySlug}${redirectTo}`;
    }
  }, [isLoading, isAuthenticated, redirectTo, agencySlug]);

  return { isAuthenticated, isLoading };
}

export default AuthContext;
