'use client';

import { useState, useEffect, use } from 'react';
import { applications } from '@/lib/api';
import { getErrorMessage, ApplicationFormData } from '@/lib/types';
import { useIdDocument } from '@/hooks/useIdDocument';
import { validateSignatureAgainstName } from '@/lib/validation';
import Link from 'next/link';
import { MessageAlert } from '@/components/ui/MessageAlert';

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export default function GuarantorFormPage({ params }: PageProps) {
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<ApplicationFormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [signatureError, setSignatureError] = useState<string>('');

  // ID document upload (via shared hook)
  const {
    idDocumentUploaded, idDocumentInfo, idDocument, uploadingId,
    setIdDocument, checkStatus: checkIdDocumentStatus,
    handleFileChange: handleIdFileChange, handleView: handleIdView,
    handleDelete: handleIdDelete,
  } = useIdDocument({
    checkStatus: () => applications.getGuarantorIdDocumentStatus(token),
    upload: (file) => applications.uploadGuarantorId(token, file),
    getViewUrl: () => applications.getGuarantorIdDocumentUrl(token),
    delete: () => applications.deleteGuarantorId(token),
  }, setMessage);

  const [formData, setFormData] = useState({
    guarantor_name: '',
    guarantor_dob: '',
    guarantor_relationship: '',
    guarantor_email: '',
    guarantor_phone: '',
    guarantor_address: '',
    guarantor_id_type: '',
    guarantor_signature_name: '',
    guarantor_signature_agreed: false,
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchApplication();
  }, [token]);

  const fetchApplication = async () => {
    try {
      const response = await applications.getByGuarantorToken(token);
      const data = response.data;

      setApplication(data);

      // Pre-fill form with existing guarantor data
      // Format date to YYYY-MM-DD for input field
      const formattedDob = data.guarantor_dob
        ? new Date(data.guarantor_dob).toISOString().split('T')[0]
        : '';

      setFormData({
        guarantor_name: data.guarantor_name || '',
        guarantor_dob: formattedDob,
        guarantor_relationship: data.guarantor_relationship || '',
        guarantor_email: data.guarantor_email || '',
        guarantor_phone: data.guarantor_phone || '',
        guarantor_address: data.guarantor_address || '',
        guarantor_id_type: data.guarantor_id_type || '',
        guarantor_signature_name: '',
        guarantor_signature_agreed: false,
      });

      // Check if ID document is uploaded
      await checkIdDocumentStatus();
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { error?: string } } };
      if (axiosError.response?.status === 404) {
        setError('Invalid or expired link. Please contact your letting agent for assistance.');
      } else if (axiosError.response?.data?.error) {
        setError(axiosError.response.data.error);
      } else {
        setError('Failed to load application. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const validateSignature = (signature: string): boolean => {
    return validateSignatureAgainstName(signature, formData.guarantor_name || '');
  };

  const handleSignatureNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      guarantor_signature_name: value
    }));

    // Validate signature as user types
    if (value.trim() && formData.guarantor_name) {
      const isValid = validateSignature(value);
      if (!isValid) {
        const expectedName = formData.guarantor_name.trim();
        setSignatureError(`Signature name must match "${expectedName}"`);
      } else {
        setSignatureError('');
      }
    } else {
      setSignatureError('');
    }
  };

  const handleGuarantorNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      guarantor_name: value
    }));

    // Re-validate signature if one is typed
    if (formData.guarantor_signature_name.trim()) {
      if (value.trim()) {
        const isValid = validateSignatureAgainstName(formData.guarantor_signature_name, value);
        if (!isValid) {
          setSignatureError(`Signature name must match "${value.trim()}"`);
        } else {
          setSignatureError('');
        }
      } else {
        setSignatureError('');
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if ID document is uploaded
    if (!idDocumentUploaded) {
      setMessage({
        type: 'error',
        text: 'You must upload your ID document before submitting the guarantor form'
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Validation
    if (!formData.guarantor_signature_name.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter your name to sign the declaration'
      });
      return;
    }

    // Validate signature matches expected name
    if (!validateSignature(formData.guarantor_signature_name)) {
      const expectedName = formData.guarantor_name.trim();
      setSignatureError(`Signature name must match "${expectedName}"`);
      setMessage({
        type: 'error',
        text: `Signature name must match "${expectedName}"`
      });
      // Scroll to the signature input field
      const signatureInput = document.querySelector('input[name="guarantor_signature_name"]') as HTMLElement;
      if (signatureInput) {
        signatureInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        signatureInput.focus();
      }
      return;
    }

    if (!formData.guarantor_signature_agreed) {
      setMessage({
        type: 'error',
        text: 'Please confirm your agreement to proceed'
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await applications.submitGuarantorForm(token, formData);
      setSuccess(true);
      setMessage({
        type: 'success',
        text: 'Thank you! Your guarantor information has been submitted successfully.'
      });
      window.scrollTo(0, 0);
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: getErrorMessage(err, 'Failed to submit form. Please try again.')
      });
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
            <h2 className="text-xl font-bold text-red-800 mb-2">Unable to Access Form</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <Link
              href="/"
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
            <h2 className="text-2xl font-bold text-green-800 mb-2">Submission Successful</h2>
            <p className="text-green-700 mb-4">
              Thank you for completing the guarantor form. The letting agent will be in touch soon.
            </p>
            <Link
              href="/"
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
          <h1 className="text-4xl font-bold mb-2">Guarantor Form</h1>
          <p className="text-xl text-white/90">Complete your guarantor information</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Message */}
          {message && <MessageAlert type={message.type} message={message.text} className="mb-6" />}

          {/* Application Info */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Application Information</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Applicant:</span>
                <p className="text-gray-900">{application?.applicant_name}</p>
              </div>
            </div>
          </div>

          {/* Guarantor Form */}
          {submitting ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mb-6"></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Submitting...</h2>
              <p className="text-gray-600">Please wait while we process your information</p>
            </div>
          ) : (
            <>
            <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Information</h2>
              <p className="text-sm text-gray-600 mb-6">
                Please review and update your guarantor information below. All fields are required.
              </p>

              <div className="space-y-4">
                {/* Guarantor Name */}
                <div>
                  <label htmlFor="guarantor_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="guarantor_name"
                    name="guarantor_name"
                    value={formData.guarantor_name}
                    onChange={(e) => handleGuarantorNameChange(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Date of Birth */}
                <div>
                  <label htmlFor="guarantor_dob" className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    id="guarantor_dob"
                    name="guarantor_dob"
                    value={formData.guarantor_dob}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Relationship */}
                <div>
                  <label htmlFor="guarantor_relationship" className="block text-sm font-medium text-gray-700 mb-2">
                    Relationship to Applicant *
                  </label>
                  <input
                    type="text"
                    id="guarantor_relationship"
                    name="guarantor_relationship"
                    value={formData.guarantor_relationship}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Parent, Guardian, Sibling"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="guarantor_email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="guarantor_email"
                    name="guarantor_email"
                    value={formData.guarantor_email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="guarantor_phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    id="guarantor_phone"
                    name="guarantor_phone"
                    value={formData.guarantor_phone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Address */}
                <div>
                  <label htmlFor="guarantor_address" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Address *
                  </label>
                  <textarea
                    id="guarantor_address"
                    name="guarantor_address"
                    value={formData.guarantor_address}
                    onChange={handleChange}
                    required
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Include full address with postcode"
                  />
                </div>

                {/* Proof of Identity */}
                <div>
                  <label htmlFor="guarantor_id_type" className="block text-sm font-medium text-gray-700 mb-2">
                    Proof of Identity *
                  </label>
                  <select
                    id="guarantor_id_type"
                    name="guarantor_id_type"
                    value={formData.guarantor_id_type}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">-- Select ID Type --</option>
                    <option value="Driving Licence">Driving Licence</option>
                    <option value="Passport">Passport</option>
                    <option value="National ID Card">National ID Card</option>
                    <option value="Other">Other</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Please select the type of identification you will be providing.
                  </p>
                </div>

                {/* ID Document Upload */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Upload ID Document <span className="text-red-600">*</span>
                  </h3>

                  {idDocumentUploaded ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <svg className="h-5 w-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div className="ml-3 flex-1">
                          <p className="text-sm font-medium text-green-800">ID Document Uploaded</p>
                          <p className="text-sm text-green-700 mt-1">
                            {idDocumentInfo?.filename} ({((idDocumentInfo?.size ?? 0) / 1024).toFixed(0)} KB)
                          </p>
                          <p className="text-xs text-green-600 mt-1">
                            Uploaded: {idDocumentInfo?.uploadedAt ? new Date(idDocumentInfo.uploadedAt).toLocaleString('en-GB') : ''}
                          </p>

                          {/* View and Delete buttons - only shown if guarantor hasn't completed submission */}
                          {!application?.guarantor_completed_at && (
                            <div className="flex gap-2 mt-3">
                              <button
                                type="button"
                                onClick={handleIdView}
                                className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                              >
                                <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View
                              </button>
                              <button
                                type="button"
                                onClick={handleIdDelete}
                                disabled={uploadingId}
                                className="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        Please upload a clear photo or scan of your ID document. Accepted formats: JPEG, PNG, PDF (max 10MB)
                      </p>

                      <div className="flex items-center gap-3">
                        <label className="flex-1">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            capture="environment"
                            onChange={handleIdFileChange}
                            disabled={uploadingId}
                            className="block w-full text-sm text-gray-500
                              file:mr-4 file:py-2 file:px-4
                              file:rounded-lg file:border-0
                              file:text-sm file:font-semibold
                              file:bg-primary file:text-white
                              hover:file:bg-primary-dark
                              file:cursor-pointer
                              disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </label>
                      </div>

                      {uploadingId && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-sm text-blue-900 font-medium">Uploading document...</p>
                          </div>
                        </div>
                      )}

                      {!uploadingId && (
                        <p className="text-xs text-gray-500">
                          Note: File will upload automatically after selection. Accepted formats: JPEG, PNG, PDF (max 10MB)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Declaration */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Declaration</h2>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700 mb-3">
                  I confirm that the information provided above is true and accurate to the best of my knowledge.
                  I understand that I am acting as a guarantor for the applicant and accept the responsibilities
                  that come with this role.
                </p>
              </div>

              <div className="space-y-4">
                {/* Signature Name */}
                <div>
                  <label htmlFor="guarantor_signature_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Type Your Full Name to Sign *
                  </label>
                  <input
                    type="text"
                    id="guarantor_signature_name"
                    name="guarantor_signature_name"
                    value={formData.guarantor_signature_name}
                    onChange={(e) => handleSignatureNameChange(e.target.value)}
                    required
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                      signatureError ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your full name"
                  />
                  {signatureError && (
                    <p className="mt-1 text-sm text-red-600">{signatureError}</p>
                  )}
                </div>

                {/* Agreement Checkbox */}
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="guarantor_signature_agreed"
                    name="guarantor_signature_agreed"
                    checked={formData.guarantor_signature_agreed}
                    onChange={handleChange}
                    required
                    className="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <label htmlFor="guarantor_signature_agreed" className="ml-3 text-sm text-gray-700">
                    I agree that typing my name above constitutes my legal signature and I confirm that all
                    information provided is accurate. *
                  </label>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Guarantor Form'}
            </button>
          </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
