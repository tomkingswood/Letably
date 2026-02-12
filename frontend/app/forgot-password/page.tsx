'use client';

import { useState } from 'react';
import { auth } from '@/lib/api';
import Link from 'next/link';
import { MessageAlert } from '@/components/ui/MessageAlert';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await auth.forgotPassword(email);
      setSubmitted(true);
      setMessage({
        type: 'success',
        text: 'If an account exists with that email, you will receive a password reset link.'
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to process request'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Forgot Password?
            </h1>
            <p className="text-gray-600">
              {submitted
                ? "Check your email for reset instructions"
                : "We'll send you a link to reset your password"}
            </p>
            {!submitted && (
              <p className="text-sm text-gray-500 mt-2">
                The email may take 1-2 minutes to arrive
              </p>
            )}
          </div>

          {/* Message */}
          {message && <MessageAlert type={message.type} message={message.text} className="mb-6" />}

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              {/* Back to Login */}
              <div className="text-center">
                <Link href="/login" className="text-primary hover:underline text-sm">
                  ← Back to Login
                </Link>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Success Icon */}
              <div className="flex justify-center">
                <div className="bg-green-100 rounded-full p-3">
                  <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                <p className="text-sm text-blue-900">
                  <strong>What's next?</strong>
                </p>
                <ul className="mt-2 text-sm text-blue-800 list-disc list-inside space-y-1">
                  <li>The email may take 1-2 minutes to arrive</li>
                  <li>Check your email inbox (and spam folder)</li>
                  <li>Click the reset link in the email</li>
                  <li>Create a new password</li>
                  <li>The link expires in 1 hour</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setEmail('');
                    setMessage(null);
                  }}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-semibold transition-colors"
                >
                  Send Another Link
                </button>

                <Link
                  href="/login"
                  className="block w-full text-center bg-primary hover:bg-primary-dark text-white py-2 rounded-lg font-semibold transition-colors"
                >
                  Back to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
