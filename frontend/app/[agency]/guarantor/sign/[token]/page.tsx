'use client';

import { useState, useEffect, use } from 'react';
import { guarantor as guarantorApi } from '@/lib/api';
import { getErrorMessage, Agreement } from '@/lib/types';
import Link from 'next/link';
import GuarantorAgreementDocument from '@/components/GuarantorAgreementDocument';
import { sanitizeHtml } from '@/lib/sanitize';
import { MessageAlert } from '@/components/ui/MessageAlert';
import { useAgency } from '@/lib/agency-context';

interface PageProps {
  params: Promise<{
    agency: string;
    token: string;
  }>;
}

export default function GuarantorAgreementSigningPage({ params }: PageProps) {
  const { token } = use(params);
  const { agencySlug } = useAgency();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [signatureData, setSignatureData] = useState('');
  const [signatureError, setSignatureError] = useState('');
  const [showTenantAgreementModal, setShowTenantAgreementModal] = useState(false);

  useEffect(() => {
    fetchAgreement();
  }, [token]);

  const fetchAgreement = async () => {
    try {
      const response = await guarantorApi.getAgreementByToken(token);
      setAgreement(response.data.agreement);

      // Check if already signed
      if (response.data.agreement.is_signed) {
        setSuccess(true);
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { error?: string } } };
      if (axiosError.response?.status === 404) {
        setError('Invalid or expired link. Please contact your letting agent for assistance.');
      } else if (axiosError.response?.data?.error) {
        setError(axiosError.response.data.error);
      } else {
        setError('Failed to load agreement. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Validate signature name
  const validateSignature = (signature: string): boolean => {
    if (!agreement || !agreement.guarantor_name) return true;

    const expectedName = agreement.guarantor_name.trim().toLowerCase();

    // Remove common titles and normalize
    const titles = ['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'rev', 'sir', 'dame', 'lord', 'lady'];
    let normalizedSignature = signature.trim().toLowerCase();

    // Check if signature starts with a title and remove it
    for (const title of titles) {
      const titleWithDot = title + '.';
      const titleWithSpace = title + ' ';

      if (normalizedSignature.startsWith(titleWithDot)) {
        normalizedSignature = normalizedSignature.substring(titleWithDot.length).trim();
        break;
      } else if (normalizedSignature.startsWith(titleWithSpace)) {
        normalizedSignature = normalizedSignature.substring(titleWithSpace.length).trim();
        break;
      }
    }

    return normalizedSignature === expectedName;
  };

  const handleNameChange = (value: string) => {
    setSignatureData(value);

    // Validate signature as user types
    if (value.trim() && agreement) {
      const isValid = validateSignature(value);

      if (!isValid) {
        setSignatureError(`Signature name must match "${agreement.guarantor_name}"`);
      } else {
        setSignatureError('');
      }
    } else {
      setSignatureError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signatureData.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter your full name to sign the agreement'
      });
      return;
    }

    // Validate signature matches expected name
    if (!validateSignature(signatureData)) {
      setSignatureError(`Signature name must match "${agreement!.guarantor_name}"`);
      // Scroll to the signature input field
      const signatureInput = document.querySelector('input[name="signature_data"]') as HTMLElement;
      if (signatureInput) {
        signatureInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        signatureInput.focus();
      }
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setSignatureError('');

    try {
      await guarantorApi.signAgreement(token, signatureData.trim());
      setSuccess(true);
      setMessage({
        type: 'success',
        text: 'Thank you! Your guarantor agreement has been signed successfully.'
      });
      window.scrollTo(0, 0);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to sign agreement. Please try again.');

      // Check if it's a signature validation error from the backend
      if (errorMessage.includes('Signature name must match')) {
        setSignatureError(errorMessage);
        // Scroll to the signature input field
        const signatureInput = document.querySelector('input[name="signature_data"]') as HTMLElement;
        if (signatureInput) {
          signatureInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          signatureInput.focus();
        }
      } else {
        setMessage({
          type: 'error',
          text: errorMessage
        });
      }
      window.scrollTo(0, 0);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">Unable to Access Agreement</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <Link
              href={`/${agencySlug}`}
              className="inline-block bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="text-6xl mb-4">✓</div>
            <h2 className="text-2xl font-bold text-green-800 mb-2">Agreement Signed Successfully</h2>
            <p className="text-green-700 mb-4">
              Thank you for signing the guarantor agreement. The letting agent has been notified.
            </p>
            <Link
              href={`/${agencySlug}`}
              className="inline-block bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-2">Guarantor Agreement</h1>
          <p className="text-xl text-white/90">Review and sign your guarantor agreement</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* View Tenant Agreement Button - Top */}
        {agreement?.tenant_signed_agreement_html && (
          <div className="mb-6">
            <button
              onClick={() => setShowTenantAgreementModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Tenant Agreement
            </button>
          </div>
        )}

        {/* Messages */}
        {message && <MessageAlert type={message.type} message={message.text} className="mb-6" />}

        {/* Agreement Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="font-bold text-blue-900 mb-2">Agreement Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-blue-700 font-medium">Guarantor</p>
              <p className="text-blue-900">{agreement?.guarantor_name}</p>
            </div>
            <div>
              <p className="text-blue-700 font-medium">Tenant</p>
              <p className="text-blue-900">{agreement?.tenant_name}</p>
            </div>
            <div>
              <p className="text-blue-700 font-medium">Property</p>
              <p className="text-blue-900">{agreement?.property_address}</p>
            </div>
            <div>
              <p className="text-blue-700 font-medium">Tenancy Period</p>
              <p className="text-blue-900">
                {agreement?.tenancy_start_date && new Date(agreement.tenancy_start_date).toLocaleDateString('en-GB')} -{' '}
                {agreement?.tenancy_end_date && new Date(agreement.tenancy_end_date).toLocaleDateString('en-GB')}
              </p>
            </div>
          </div>
        </div>

        {/* Agreement Document */}
        <GuarantorAgreementDocument
          agreement={agreement as any}
          onViewTenantAgreement={() => setShowTenantAgreementModal(true)}
        />

        {/* Signature Section */}
        {!submitting ? (
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign Agreement</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700">
                  By signing this agreement, you confirm that you have read and understood the terms above,
                  and agree to act as guarantor for the tenant named in this agreement.
                </p>
              </div>

              <div>
                <label htmlFor="signature_data" className="block text-sm font-medium text-gray-700 mb-2">
                  Type Your Full Name to Sign *
                </label>
                <input
                  type="text"
                  id="signature_data"
                  name="signature_data"
                  value={signatureData}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                    signatureError ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your full name"
                />
                {signatureError && (
                  <p className="mt-1 text-sm text-red-600">{signatureError}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Typing your name constitutes your legal signature
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="agreed"
                  required
                  className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label htmlFor="agreed" className="text-sm text-gray-700">
                  I confirm that I have read and agree to the terms of this guarantor agreement *
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Sign Guarantor Agreement
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Signing Agreement...</h2>
            <p className="text-gray-600">Please wait while we process your signature</p>
          </div>
        )}

        {/* Tenant Agreement Modal */}
        {showTenantAgreementModal && agreement?.tenant_signed_agreement_html && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-2xl font-bold text-gray-900">
                  Tenant Agreement - {agreement?.tenant_name}
                </h2>
                <button
                  onClick={() => setShowTenantAgreementModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(agreement?.tenant_signed_agreement_html || '') }} />
              </div>
              <div className="p-6 border-t">
                <button
                  onClick={() => setShowTenantAgreementModal(false)}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
