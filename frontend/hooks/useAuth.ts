import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken, getStoredUser } from '@/lib/api';
import { User } from '@/lib/types';

/**
 * User data from localStorage — always has id/email/role, other fields may be missing.
 */
export type AuthUser = Pick<User, 'id' | 'email' | 'role'> & Partial<Omit<User, 'id' | 'email' | 'role'>> & { name?: string };

/**
 * Options for useRequireAuth hook
 */
export interface UseAuthOptions {
  /** Path to redirect to if not authenticated (default: '/login') */
  redirectTo?: string;
  /** Required roles - if empty, any authenticated user is allowed */
  requiredRoles?: ('admin' | 'landlord' | 'tenant')[];
  /** Path to redirect to if authenticated but wrong role (default: '/') */
  unauthorizedRedirect?: string;
}

/**
 * Return type for auth hooks
 */
export interface UseAuthReturn {
  /** The authenticated user, or null if not authenticated */
  user: AuthUser | null;
  /** Whether auth check is still loading */
  isLoading: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
}

/**
 * Core auth hook - checks authentication and optionally role
 *
 * Replaces duplicate useEffect patterns across pages that do:
 * 1. getAuthToken() / getStoredUser()
 * 2. Redirect to /login if not authenticated
 * 3. Redirect to / if wrong role
 *
 * @example
 * // Require any authenticated user
 * const { user, isLoading } = useRequireAuth();
 *
 * @example
 * // Require specific role
 * const { user, isLoading } = useRequireAuth({ requiredRoles: ['landlord'] });
 *
 * @example
 * // Custom redirect paths
 * const { user, isLoading } = useRequireAuth({
 *   redirectTo: '/custom-login',
 *   unauthorizedRedirect: '/unauthorized'
 * });
 */
export function useRequireAuth(options: UseAuthOptions = {}): UseAuthReturn {
  const {
    redirectTo = '/login',
    requiredRoles = [],
    unauthorizedRedirect = '/'
  } = options;

  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Serialize requiredRoles to avoid new array reference on every render
  const requiredRolesKey = requiredRoles.join(',');

  useEffect(() => {
    const checkAuth = () => {
      const token = getAuthToken();
      const storedUser = getStoredUser();

      // Not authenticated - redirect to login
      if (!token || !storedUser) {
        router.push(redirectTo);
        setIsLoading(false);
        return;
      }

      // Check role if required
      if (requiredRoles.length > 0) {
        const hasValidRole = requiredRoles.includes(storedUser.role);

        if (!hasValidRole) {
          router.push(unauthorizedRedirect);
          setIsLoading(false);
          return;
        }
      }

      // Authenticated (and role matches if required)
      setUser(storedUser as AuthUser);
      setIsLoading(false);
    };

    checkAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, redirectTo, requiredRolesKey, unauthorizedRedirect]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user
  };
}

/**
 * Convenience hook for admin-only pages
 *
 * @example
 * const { user, isLoading } = useRequireAdmin();
 * if (isLoading) return <LoadingSpinner />;
 */
export function useRequireAdmin(options?: Partial<UseAuthOptions>): UseAuthReturn {
  return useRequireAuth({ requiredRoles: ['admin'], ...options });
}

/**
 * Convenience hook for landlord-only pages
 *
 * @example
 * const { user, isLoading } = useRequireLandlord();
 * if (isLoading) return <LoadingSpinner />;
 */
export function useRequireLandlord(options?: Partial<UseAuthOptions>): UseAuthReturn {
  return useRequireAuth({ requiredRoles: ['landlord'], ...options });
}

/**
 * Convenience hook for tenant-only pages
 *
 * @example
 * const { user, isLoading } = useRequireTenant();
 * if (isLoading) return <LoadingSpinner />;
 */
export function useRequireTenant(options?: Partial<UseAuthOptions>): UseAuthReturn {
  return useRequireAuth({ requiredRoles: ['tenant'], ...options });
}

/**
 * Hook that just checks auth state without redirecting.
 * Useful for components that need to conditionally render based on auth.
 *
 * @param options.listenForChanges - Re-check auth when 'headerStateChanged' fires (e.g., after sign-in/sign-out)
 *
 * @example
 * const { user, isAuthenticated, isLoading } = useAuthState();
 *
 * @example
 * // Re-check on login/logout events (useful for Header)
 * const { user, isAuthenticated } = useAuthState({ listenForChanges: true });
 */
export function useAuthState(options?: { listenForChanges?: boolean }): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const token = getAuthToken();
      const storedUser = getStoredUser();

      if (token && storedUser) {
        setUser(storedUser as AuthUser);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };

    checkAuth();

    if (options?.listenForChanges) {
      window.addEventListener('headerStateChanged', checkAuth);
      return () => window.removeEventListener('headerStateChanged', checkAuth);
    }
  }, [options?.listenForChanges]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user
  };
}
