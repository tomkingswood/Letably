'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAgency } from '@/lib/agency-context';
import { auth } from '@/lib/api';
import { getErrorMessage } from '@/lib/types';
import { MessageAlert } from '@/components/ui/MessageAlert';
import { validatePassword } from '@/lib/validation';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { agency, agencySlug, isLoading: agencyLoading } = useAgency();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    const { error: passwordError } = validatePassword(formData.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await auth.register({
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone || undefined,
      });

      setSuccess(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (agencyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            {agency?.logo_url && (
              <Image
                src={agency.logo_url}
                alt={agency.name}
                width={200}
                height={80}
                className="h-16 w-auto mx-auto mb-6"
              />
            )}

            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${agency?.primary_color}20` }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: agency?.primary_color }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold mb-2">Registration Successful!</h1>
            <p className="text-gray-600 mb-6">
              Your account has been created. You can now log in to access your portal.
            </p>

            <Link href={`/${agencySlug}`}>
              <Button
                fullWidth
                size="lg"
                style={{ backgroundColor: agency?.primary_color }}
              >
                Go to Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* Agency Logo */}
          <div className="text-center mb-6">
            {agency?.logo_url ? (
              <Image
                src={agency.logo_url}
                alt={agency.name}
                width={200}
                height={80}
                className="h-16 w-auto mx-auto mb-4"
              />
            ) : (
              <h2
                className="text-2xl font-bold mb-2"
                style={{ color: agency?.primary_color }}
              >
                {agency?.name}
              </h2>
            )}
          </div>

          <h1 className="text-3xl font-bold text-center mb-2">Create Account</h1>
          <p className="text-gray-600 text-center mb-8">
            Sign up to access your tenant portal
          </p>

          <MessageAlert type="error" message={error} className="mb-4" />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="text"
                label="First Name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                placeholder="John"
              />

              <Input
                type="text"
                label="Last Name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                placeholder="Smith"
              />
            </div>

            <Input
              type="email"
              label="Email Address"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="you@example.com"
            />

            <Input
              type="tel"
              label="Phone Number (Optional)"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="07700 900000"
            />

            <Input
              type="password"
              label="Password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="At least 8 characters"
            />

            <Input
              type="password"
              label="Confirm Password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Re-enter your password"
            />

            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Password requirements:</p>
              <ul className="list-disc list-inside space-y-1">
                <li className={formData.password.length >= 8 ? 'text-green-600' : ''}>
                  At least 8 characters
                </li>
              </ul>
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              disabled={loading}
              style={{ backgroundColor: agency?.primary_color }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link
                href={`/${agencySlug}`}
                className="font-semibold hover:underline"
                style={{ color: agency?.primary_color }}
              >
                Log In
              </Link>
            </p>
          </div>

          {/* Terms */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              By creating an account, you agree to our{' '}
              <Link
                href={`/${agencySlug}/terms-and-conditions`}
                className="hover:underline"
                style={{ color: agency?.primary_color }}
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href={`/${agencySlug}/privacy-policy`}
                className="hover:underline"
                style={{ color: agency?.primary_color }}
              >
                Privacy Policy
              </Link>
            </p>
          </div>

          {/* Powered by Letably */}
          {agency?.show_powered_by && (
            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-400">
                Powered by{' '}
                <a
                  href="https://letably.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Letably
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgencyRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
