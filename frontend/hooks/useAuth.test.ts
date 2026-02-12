/**
 * Tests for useAuth hooks
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useRequireAuth, useRequireAdmin, useRequireLandlord, useRequireTenant, useAuthState } from './useAuth';
import * as api from '@/lib/api';

// Mock the API module
jest.mock('@/lib/api', () => ({
  getAuthToken: jest.fn(),
  getStoredUser: jest.fn(),
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

describe('useAuth hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useRequireAuth', () => {
    it('should redirect to login when not authenticated', async () => {
      (api.getAuthToken as jest.Mock).mockReturnValue(null);
      (api.getStoredUser as jest.Mock).mockReturnValue(null);

      const { result } = renderHook(() => useRequireAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockPush).toHaveBeenCalledWith('/login');
      expect(result.current.user).toBe(null);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should set user when authenticated', async () => {
      const mockUser = { id: 1, email: 'test@example.com', role: 'tenant' };
      (api.getAuthToken as jest.Mock).mockReturnValue('valid-token');
      (api.getStoredUser as jest.Mock).mockReturnValue(mockUser);

      const { result } = renderHook(() => useRequireAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should redirect to custom path when provided', async () => {
      (api.getAuthToken as jest.Mock).mockReturnValue(null);
      (api.getStoredUser as jest.Mock).mockReturnValue(null);

      const { result } = renderHook(() =>
        useRequireAuth({ redirectTo: '/custom-login' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockPush).toHaveBeenCalledWith('/custom-login');
    });

    it('should check role when requiredRoles provided', async () => {
      const mockUser = { id: 1, email: 'test@example.com', role: 'tenant' };
      (api.getAuthToken as jest.Mock).mockReturnValue('valid-token');
      (api.getStoredUser as jest.Mock).mockReturnValue(mockUser);

      const { result } = renderHook(() =>
        useRequireAuth({ requiredRoles: ['admin'] })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should redirect because user is not admin
      expect(mockPush).toHaveBeenCalledWith('/');
    });

    it('should allow access when user has required role', async () => {
      const mockUser = { id: 1, email: 'admin@example.com', role: 'admin' };
      (api.getAuthToken as jest.Mock).mockReturnValue('valid-token');
      (api.getStoredUser as jest.Mock).mockReturnValue(mockUser);

      const { result } = renderHook(() =>
        useRequireAuth({ requiredRoles: ['admin'] })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(result.current.user).toEqual(mockUser);
    });
  });

  describe('useRequireAdmin', () => {
    it('should allow admin users', async () => {
      const mockUser = { id: 1, email: 'admin@example.com', role: 'admin' };
      (api.getAuthToken as jest.Mock).mockReturnValue('valid-token');
      (api.getStoredUser as jest.Mock).mockReturnValue(mockUser);

      const { result } = renderHook(() => useRequireAdmin());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should redirect non-admin users', async () => {
      const mockUser = { id: 1, email: 'user@example.com', role: 'tenant' };
      (api.getAuthToken as jest.Mock).mockReturnValue('valid-token');
      (api.getStoredUser as jest.Mock).mockReturnValue(mockUser);

      const { result } = renderHook(() => useRequireAdmin());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  describe('useRequireLandlord', () => {
    it('should allow landlord users', async () => {
      const mockUser = { id: 1, email: 'landlord@example.com', role: 'landlord' };
      (api.getAuthToken as jest.Mock).mockReturnValue('valid-token');
      (api.getStoredUser as jest.Mock).mockReturnValue(mockUser);

      const { result } = renderHook(() => useRequireLandlord());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('useRequireTenant', () => {
    it('should allow users with role "tenant"', async () => {
      const mockUser = { id: 1, email: 'tenant@example.com', role: 'tenant' };
      (api.getAuthToken as jest.Mock).mockReturnValue('valid-token');
      (api.getStoredUser as jest.Mock).mockReturnValue(mockUser);

      const { result } = renderHook(() => useRequireTenant());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('useAuthState', () => {
    it('should return user without redirecting when authenticated', async () => {
      const mockUser = { id: 1, email: 'test@example.com', role: 'tenant' };
      (api.getAuthToken as jest.Mock).mockReturnValue('valid-token');
      (api.getStoredUser as jest.Mock).mockReturnValue(mockUser);

      const { result } = renderHook(() => useAuthState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should return null without redirecting when not authenticated', async () => {
      (api.getAuthToken as jest.Mock).mockReturnValue(null);
      (api.getStoredUser as jest.Mock).mockReturnValue(null);

      const { result } = renderHook(() => useAuthState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should NOT redirect - that's the difference from useRequireAuth
      expect(mockPush).not.toHaveBeenCalled();
      expect(result.current.user).toBe(null);
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
