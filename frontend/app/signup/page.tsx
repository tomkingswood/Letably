'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/types';
import { MessageAlert } from '@/components/ui/MessageAlert';
import { validatePassword } from '@/lib/validation';

interface FormData {
  // Agency fields
  agency_name: string;
  agency_email: string;
  agency_phone: string;
  // Admin fields
  admin_email: string;
  admin_password: string;
  admin_confirm_password: string;
  admin_first_name: string;
  admin_last_name: string;
  admin_phone: string;
}

export default function AgencySignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState<FormData>({
    agency_name: '',
    agency_email: '',
    agency_phone: '',
    admin_email: '',
    admin_password: '',
    admin_confirm_password: '',
    admin_first_name: '',
    admin_last_name: '',
    admin_phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ slug: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate step 1
    if (!formData.agency_name || formData.agency_name.length < 2) {
      setError('Agency name must be at least 2 characters');
      return;
    }

    if (!formData.agency_email) {
      setError('Agency email is required');
      return;
    }

    setStep(2);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.admin_first_name || !formData.admin_last_name) {
      setError('First and last name are required');
      return;
    }

    if (!formData.admin_email) {
      setError('Admin email is required');
      return;
    }

    const { error: passwordError } = validatePassword(formData.admin_password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (formData.admin_password !== formData.admin_confirm_password) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/agencies/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agency_name: formData.agency_name,
          agency_email: formData.agency_email,
          agency_phone: formData.agency_phone || undefined,
          admin_email: formData.admin_email,
          admin_password: formData.admin_password,
          admin_first_name: formData.admin_first_name,
          admin_last_name: formData.admin_last_name,
          admin_phone: formData.admin_phone || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setSuccess({ slug: data.agency.slug });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold mb-2 text-gray-900">Welcome to Letably!</h1>
            <p className="text-gray-600 mb-4">
              Your agency has been created successfully. You can now log in to your admin dashboard.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Your portal URL:</p>
              <code className="text-sm font-mono text-blue-600 break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/${success.slug}` : `https://letably.com/${success.slug}`}
              </code>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm font-medium text-amber-800 mb-2">Important - Save this URL!</p>
              <p className="text-sm text-amber-700">
                This is your unique portal address. Bookmark it now as you'll need it to log in. This is also where your tenants and landlords will access their accounts.
              </p>
            </div>

            <Link href={`/${success.slug}/login`}>
              <Button fullWidth size="lg">
                Go to Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center text-white hover:opacity-80">
          <span className="text-2xl font-bold">Letably</span>
        </Link>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-4">
              <div className={`flex items-center gap-2 ${step >= 1 ? 'text-white' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step >= 1 ? 'bg-white text-blue-900' : 'bg-gray-600 text-gray-400'
                }`}>
                  {step > 1 ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : '1'}
                </div>
                <span className="hidden sm:inline">Agency Details</span>
              </div>
              <div className="w-12 h-0.5 bg-gray-600">
                <div className={`h-full transition-all ${step >= 2 ? 'bg-white w-full' : 'w-0'}`} />
              </div>
              <div className={`flex items-center gap-2 ${step >= 2 ? 'text-white' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step >= 2 ? 'bg-white text-blue-900' : 'bg-gray-600 text-gray-400'
                }`}>
                  2
                </div>
                <span className="hidden sm:inline">Admin Account</span>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {step === 1 ? 'Create Your Agency' : 'Set Up Admin Account'}
              </h1>
              <p className="text-gray-600">
                {step === 1
                  ? 'Start your 14-day free trial of Letably'
                  : 'Create your administrator account'}
              </p>
            </div>

            <MessageAlert type="error" message={error} className="mb-6" />

            {/* Step 1: Agency Details */}
            {step === 1 && (
              <form onSubmit={handleStep1Submit} className="space-y-6">
                <div>
                  <Input
                    type="text"
                    label="Agency Name"
                    name="agency_name"
                    value={formData.agency_name}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Sheffield Property Management"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    This will be displayed to your tenants
                  </p>
                </div>

                <Input
                  type="email"
                  label="Agency Email"
                  name="agency_email"
                  value={formData.agency_email}
                  onChange={handleChange}
                  required
                  placeholder="info@youragency.com"
                />

                <Input
                  type="tel"
                  label="Agency Phone (Optional)"
                  name="agency_phone"
                  value={formData.agency_phone}
                  onChange={handleChange}
                  placeholder="0114 123 4567"
                />

                <Button type="submit" fullWidth size="lg">
                  Continue
                </Button>
              </form>
            )}

            {/* Step 2: Admin Account */}
            {step === 2 && (
              <form onSubmit={handleStep2Submit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="text"
                    label="First Name"
                    name="admin_first_name"
                    value={formData.admin_first_name}
                    onChange={handleChange}
                    required
                    placeholder="John"
                  />

                  <Input
                    type="text"
                    label="Last Name"
                    name="admin_last_name"
                    value={formData.admin_last_name}
                    onChange={handleChange}
                    required
                    placeholder="Smith"
                  />
                </div>

                <Input
                  type="email"
                  label="Admin Email"
                  name="admin_email"
                  value={formData.admin_email}
                  onChange={handleChange}
                  required
                  placeholder="you@youragency.com"
                />

                <Input
                  type="tel"
                  label="Phone (Optional)"
                  name="admin_phone"
                  value={formData.admin_phone}
                  onChange={handleChange}
                  placeholder="07700 900000"
                />

                <Input
                  type="password"
                  label="Password"
                  name="admin_password"
                  value={formData.admin_password}
                  onChange={handleChange}
                  required
                  placeholder="At least 8 characters"
                />

                <Input
                  type="password"
                  label="Confirm Password"
                  name="admin_confirm_password"
                  value={formData.admin_confirm_password}
                  onChange={handleChange}
                  required
                  placeholder="Re-enter your password"
                />

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <Button type="submit" fullWidth size="lg" disabled={loading}>
                    {loading ? 'Creating Agency...' : 'Create Agency'}
                  </Button>
                </div>
              </form>
            )}

            {/* Terms */}
            <div className="mt-8 text-center">
              <p className="text-xs text-gray-500">
                By creating an account, you agree to our{' '}
                <Link href="/terms" className="text-blue-600 hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  Privacy Policy
                </Link>
              </p>
            </div>

            {/* Login Link */}
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-600 font-semibold hover:underline">
                  Log In
                </Link>
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-white text-center">
            <div className="p-4">
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-1">14-Day Free Trial</h3>
              <p className="text-sm text-white/70">No credit card required</p>
            </div>
            <div className="p-4">
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-1">Secure & Compliant</h3>
              <p className="text-sm text-white/70">GDPR ready, bank-grade security</p>
            </div>
            <div className="p-4">
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-1">Quick Setup</h3>
              <p className="text-sm text-white/70">Up and running in minutes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
