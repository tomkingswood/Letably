'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { tenancies as tenanciesApi } from '@/lib/api';
import AgreementDocument from '@/components/AgreementDocument';
import { useAuth } from '@/lib/auth-context';
import { useAgency } from '@/lib/agency-context';
import { getErrorMessage, Agreement, AgreementMemberData } from '@/lib/types';
import { validateSignatureAgainstName } from '@/lib/validation';
import { MessageAlert } from '@/components/ui/MessageAlert';

interface PageProps {
  params: Promise<{
    tenancyId: string;
    memberId: string;
  }>;
}

export default function SignAgreementPage({ params }: PageProps) {
  const { tenancyId, memberId } = use(params);
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { agencySlug } = useAgency();
  const [loading, setLoading] = useState(true);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [memberData, setMemberData] = useState<AgreementMemberData | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Signature form
  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [paymentOption, setPaymentOption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signatureError, setSignatureError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${agencySlug}`);
      return;
    }
    if (!authLoading && user) {
      fetchAgreement();
    }
  }, [authLoading, user, tenancyId, memberId]);

  const fetchAgreement = async () => {
    try {
      const response = await tenanciesApi.getTenantAgreement(tenancyId, memberId);
      setAgreement(response.data.agreement);
      setMemberData(response.data.member);

      // Pre-fill name from agreement if available
      if (response.data.agreement.primary_tenant_name) {
        setFullName(response.data.agreement.primary_tenant_name);
      }

      // Pre-fill payment option from member data if available
      if (response.data.member.payment_option) {
        setPaymentOption(response.data.member.payment_option);
      }
    } catch (err: unknown) {
      // Check if unauthorized - redirect to login
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr.response?.status === 401) {
        router.push(`/${agencySlug}`);
        return;
      }
      setError(getErrorMessage(err, 'Failed to load agreement'));
    } finally {
      setLoading(false);
    }
  };

  const validateSignature = (signature: string): boolean => {
    if (!memberData) return true;
    const expectedName = `${memberData.first_name || ''} ${memberData.last_name || ''}`.trim();
    return validateSignatureAgainstName(signature, expectedName);
  };

  const handleNameChange = (value: string) => {
    setFullName(value);

    // Validate signature as user types
    if (value.trim() && memberData) {
      const isValid = validateSignature(value);

      if (!isValid) {
        const expectedName = `${memberData?.first_name ?? ''} ${memberData?.last_name ?? ''}`.trim();
        setSignatureError(`Signature name must match "${expectedName}"`);
      } else {
        setSignatureError('');
      }
    } else {
      setSignatureError('');
    }
  };

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }

    // Validate signature matches expected name
    if (!validateSignature(fullName)) {
      const expectedName = `${memberData?.first_name ?? ''} ${memberData?.last_name ?? ''}`.trim();
      setSignatureError(`Signature name must match "${expectedName}"`);
      // Scroll to the signature input field
      const signatureInput = document.querySelector('input[type="text"]') as HTMLElement;
      if (signatureInput) {
        signatureInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        signatureInput.focus();
      }
      return;
    }

    if (!paymentOption) {
      setError('Please select a payment option');
      return;
    }

    if (!agreed) {
      setError('Please confirm your electronic signature');
      return;
    }

    setSubmitting(true);
    setError('');
    setSignatureError('');

    try {
      const response = await tenanciesApi.signAgreement(tenancyId, memberId, fullName, paymentOption);
      setSuccess('Agreement signed successfully!');
      setMemberData({ ...memberData!, is_signed: true, signed_at: new Date().toISOString() });

      // Dispatch event to update Header banner
      window.dispatchEvent(new Event('headerStateChanged'));

      // Refresh to show signed state
      setTimeout(() => {
        fetchAgreement();
      }, 1000);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to sign agreement');

      // Check if it's a signature validation error from the backend
      if (errorMessage.includes('Signature name must match')) {
        setSignatureError(errorMessage);
        // Scroll to the signature input field
        const signatureInput = document.querySelector('input[type="text"]') as HTMLElement;
        if (signatureInput) {
          signatureInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          signatureInput.focus();
        }
      } else {
        setError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading agreement...</div>
      </div>
    );
  }

  if (error && !agreement) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={() => router.push(`/${agencySlug}/tenancy`)}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const isSigned = Boolean(memberData?.is_signed);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-2">Tenancy Agreement</h1>
          <p className="text-xl">{agreement?.property_address}</p>
          {isSigned && (
            <div className="mt-4 inline-block px-4 py-2 bg-green-500 rounded-lg">
              Signed on {new Date(memberData!.signed_at!).toLocaleDateString('en-GB')}
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Messages */}
        <MessageAlert type="error" message={error} className="mb-6" />
        <MessageAlert type="success" message={success} className="mb-6" />

        {/* Agreement Document */}
        {agreement && (
          <div className="mb-6">
            <AgreementDocument agreement={agreement} />
          </div>
        )}

        {/* Signature Section */}
        {!isSigned ? (
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign Agreement</h2>

            <form onSubmit={handleSign} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                    signatureError ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your full legal name"
                  required
                />
                {signatureError && (
                  <p className="mt-1 text-sm text-red-600">{signatureError}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Option *
                </label>
                <select
                  value={paymentOption}
                  onChange={(e) => setPaymentOption(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                >
                  <option value="">Select a payment option...</option>
                  <option value="monthly">Monthly - due on 1st of each month</option>
                  <option value="monthly_to_quarterly">Monthly to quarterly - monthly payments (Jul/Aug/Sep) to quarterly (Oct/Jan/Apr)</option>
                  <option value="quarterly">Quarterly - July, October, January & April</option>
                  <option value="upfront">Upfront</option>
                </select>
                <p className="mt-2 text-sm text-gray-600">
                  Choose how you would like to pay your rent throughout the tenancy period.
                </p>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="agreed"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded mt-1"
                  required
                />
                <label htmlFor="agreed" className="ml-2 block text-sm text-gray-900">
                  I agree and confirm this is my electronic signature *
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {submitting ? 'Signing...' : 'Sign Agreement'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/${agencySlug}/tenancy`)}
                  className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-green-600 mb-4">Agreement Signed</h2>
            <p className="text-gray-700 mb-4">
              You signed this agreement on {new Date(memberData!.signed_at!).toLocaleString('en-GB')}.
            </p>
            <p className="text-gray-700 mb-4">
              <strong>Signature:</strong> {memberData?.signature_data}
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800 text-sm">
                Thank you for signing your tenancy agreement. Your letting agent will review everything and be in touch with the next steps, including move-in details and any further information you may need.
              </p>
            </div>
            <button
              onClick={() => router.push(`/${agencySlug}/tenancy`)}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
