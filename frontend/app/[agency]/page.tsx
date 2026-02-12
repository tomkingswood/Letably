'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAgency } from '@/lib/agency-context';
import { useAuth } from '@/lib/auth-context';
import { MessageAlert } from '@/components/ui/MessageAlert';

/**
 * Agency Root Page
 *
 * Shows a login form for unauthenticated users, redirects authenticated users to their dashboard.
 */
export default function AgencyPage() {
  const router = useRouter();
  const { agency, agencySlug, isLoading: agencyLoading } = useAgency();
  const { user, isAuthenticated, isLoading: authLoading, login, error: authError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect authenticated users to their dashboard
  useEffect(() => {
    if (authLoading || agencyLoading || !agencySlug) return;

    if (isAuthenticated && user) {
      switch (user.role) {
        case 'admin':
          router.push(`/${agencySlug}/admin`);
          break;
        case 'landlord':
          router.push(`/${agencySlug}/landlord`);
          break;
        case 'tenant':
          router.push(`/${agencySlug}/tenancy`);
          break;
      }
    }
  }, [authLoading, agencyLoading, isAuthenticated, user, agencySlug, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Use the login function from auth context which handles everything
      const success = await login(email, password);

      if (!success) {
        // Error will be set in authError from context
        setError(authError || 'Invalid email or password');
      }
      // If successful, the useEffect will handle the redirect
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update local error when authError changes
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  // Show loading while determining state
  if (agencyLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // If authenticated, show loading (redirect will happen)
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const primaryColor = agency?.primary_color || '#1E3A5F';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Agency Branding */}
        <div className="text-center mb-8">
          {agency?.logo_url ? (
            <Image
              src={agency.logo_url}
              alt={agency?.name || 'Agency'}
              width={300}
              height={120}
              className="h-20 w-auto mx-auto mb-4"
              priority
            />
          ) : (
            <h1
              className="text-3xl font-bold mb-2"
              style={{ color: primaryColor }}
            >
              {agency?.name}
            </h1>
          )}
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
            Sign In
          </h2>

          <MessageAlert type="error" message={error} className="mb-4" />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 text-white font-semibold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Powered by */}
        {agency?.show_powered_by && (
          <p className="text-center text-xs text-gray-400 mt-6">
            Powered by{' '}
            <a
              href="https://letably.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-600"
            >
              Letably
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
