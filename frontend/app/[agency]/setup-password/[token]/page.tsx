'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/api';
import { getErrorMessage } from '@/lib/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { MessageAlert } from '@/components/ui/MessageAlert';
import { validatePassword } from '@/lib/validation';

interface SetupUser {
  email: string;
  first_name: string;
  last_name: string;
}

export default function SetupPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<SetupUser | null>(null);
  const [agencySlug, setAgencySlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    // Clear any existing session to avoid confusion when setting up a different user's password
    const existingToken = localStorage.getItem('token');
    if (existingToken) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Notify header to update its state
      window.dispatchEvent(new Event('headerStateChanged'));
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const res = await auth.validateSetupToken(token);
      setUser(res.data.user);
      setAgencySlug(res.data.agency_slug);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Invalid or expired setup link'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { error: passwordError } = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const res = await auth.setPasswordWithToken(token, password);
      const data = res.data;

      if (data.token && data.agency) {
        // Store auth data with agency-scoped keys
        const slug = data.agency.slug;
        localStorage.setItem(`token_${slug}`, data.token);
        localStorage.setItem(`user_${slug}`, JSON.stringify(data.user));
        localStorage.setItem('lastAgencySlug', slug);
        window.dispatchEvent(new Event('headerStateChanged'));
        // Redirect to tenant portal
        router.push(`/${slug}/tenancy`);
        return;
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to set password'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-gray-600 mt-4">Verifying your link...</p>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-red-500 text-5xl mb-4">!</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Link Invalid or Expired</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              href="/login"
              className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-green-500 text-5xl mb-4">&#10003;</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Password Set Successfully!</h1>
            <p className="text-gray-600 mb-6">
              Your password has been set. Redirecting you to login...
            </p>
            <Link
              href={agencySlug ? `/${agencySlug}/login` : '/login'}
              className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-primary text-4xl mb-4">&#127968;</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome!
            </h1>
            <p className="text-gray-600">
              Hi {user?.first_name}, please set up your password to access your tenant portal.
            </p>
          </div>

          {/* Email Display */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-1">Your email address:</p>
            <p className="font-medium text-gray-900">{user?.email}</p>
          </div>

          {/* Error Message */}
          <MessageAlert type="error" message={error} className="mb-6" />

          {/* Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Create Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
            />

            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Password requirements:</p>
              <ul className="list-disc list-inside space-y-1">
                <li className={password.length >= 8 ? 'text-green-600' : ''}>
                  At least 8 characters
                </li>
              </ul>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Setting Password...' : 'Set Password & Continue'}
            </Button>
          </form>

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t text-center">
            <p className="text-sm text-gray-600">
              Having trouble? Please contact your letting agent for assistance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
