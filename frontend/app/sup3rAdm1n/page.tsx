'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSuperAuth } from '@/lib/super-auth-context';

/**
 * Super Admin Login Page
 *
 * Secret login page for Letably platform staff.
 * No robots meta tag, no links from public pages.
 */
export default function SuperAdminLoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, login, error: authError } = useSuperAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/sup3rAdm1n/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[SuperAdmin] Form submitted, email:', email);
    setError('');
    setIsSubmitting(true);

    try {
      console.log('[SuperAdmin] Calling login...');
      const success = await login(email, password);
      console.log('[SuperAdmin] Login result:', success);

      if (success) {
        router.push('/sup3rAdm1n/dashboard');
      }
      // If not successful, the error will be set via the useEffect below
    } catch (err: unknown) {
      console.error('[SuperAdmin] Login exception:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update local error when authError changes from the context
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <>
      {/* No robots - keep this page secret */}
      <meta name="robots" content="noindex, nofollow" />

      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 px-4">
        <div className="w-full max-w-md">
          {/* Branding */}
          <div className="text-center mb-8">
            <Image
              src="/letably-icon.png"
              alt="Letably"
              width={80}
              height={80}
              className="mx-auto mb-4"
              priority
            />
            <h1 className="text-2xl font-bold text-white mb-1">Letably</h1>
            <p className="text-gray-400">Platform Administration</p>
          </div>

          {/* Login Form */}
          <div className="bg-gray-800 rounded-lg shadow-xl p-8">
            <h2 className="text-xl font-semibold text-white mb-6 text-center">
              Super Admin Login
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="admin@letably.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-600 mt-6">
            Letably Platform v1.0
          </p>
        </div>
      </div>
    </>
  );
}
