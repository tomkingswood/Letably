'use client';

import { useState, useEffect, use } from 'react';
import { applications, settings, holdingDeposits, getAuthToken } from '@/lib/api';
import { validateSignatureAgainstName } from '@/lib/validation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useAgency } from '@/lib/agency-context';
import { useIdDocument } from '@/hooks/useIdDocument';
import { ApplicationFormData } from '@/lib/types';
import { getErrorMessage } from '@/lib/types';
import { MessageAlert } from '@/components/ui/MessageAlert';
import DynamicApplicationForm from '@/components/application/DynamicApplicationForm';

interface AddressHistoryEntry {
  residential_status: string;
  residential_status_other?: string;
  period_years: number;
  period_months: number;
  address: string;
}

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ApplicationFormPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { agencySlug } = useAgency();
  const isAuthenticated = !!user;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [application, setApplication] = useState<ApplicationFormData | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [addressHistory, setAddressHistory] = useState<AddressHistoryEntry[]>([]);
  const [contactEmail, setContactEmail] = useState('');
  const [depositInfo, setDepositInfo] = useState<{
    deposit: { amount: number; status: string; property_address?: string; bedroom_name?: string; reservation_days?: number; reservation_expires_at?: string } | null;
    bank_details: { bank_name: string | null; sort_code: string | null; account_number: string | null };
  } | null>(null);
  const [signatureError, setSignatureError] = useState('');

  // ID document upload (via shared hook)
  const {
    idDocumentUploaded, idDocumentInfo, uploadingId,
    checkStatus: checkIdDocumentStatus,
    handleFileChange: handleIdFileChange, handleView: handleIdView,
    handleDelete: handleIdDelete,
  } = useIdDocument({
    checkStatus: () => applications.getIdDocumentStatus(id, 'applicant_id'),
    upload: (file) => applications.uploadApplicantId(id, file),
    getViewUrl: () => applications.getIdDocumentUrl(id, 'applicant_id'),
    delete: () => applications.deleteApplicantId(id, 'applicant_id'),
    viewHeaders: () => ({ 'Authorization': `Bearer ${getAuthToken()}` }),
  }, setMessage);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push(`/${agencySlug}`);
      return;
    }

    window.scrollTo(0, 0);

    // Fetch contact email from settings
    const fetchSettings = async () => {
      try {
        const response = await settings.getAll();
        setContactEmail(response.data.email_address || '');
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    fetchSettings();
    fetchApplication();
    // Fetch holding deposit info
    holdingDeposits.getByApplicationForTenant(id).then(res => {
      setDepositInfo(res.data);
    }).catch(() => {});
  }, [authLoading, isAuthenticated, id, agencySlug, router]);

  const fetchApplication = async () => {
    try {
      const response = await applications.getById(id);
      const app = response.data;
      setApplication(app);

      // Pre-fill form with existing data
      setFormData({
        title: app.title || '',
        title_other: app.title_other || '',
        date_of_birth: app.date_of_birth || '',
        first_name: app.first_name || app.user_name?.split(' ')[0] || '',
        middle_name: app.middle_name || '',
        surname: app.surname || app.user_name?.split(' ').slice(1).join(' ') || '',
        email: app.email || app.user_email || '',
        phone: app.phone || app.user_phone || '',
        residential_status: app.residential_status || '',
        residential_status_other: app.residential_status_other || '',
        period_years: app.period_years || 0,
        period_months: app.period_months || 0,
        current_address: app.current_address || '',
        landlord_name: app.landlord_name || '',
        landlord_address: app.landlord_address || '',
        landlord_email: app.landlord_email || '',
        landlord_phone: app.landlord_phone || '',
        id_type: app.id_type || '',
        payment_method: app.payment_method || '',
        payment_plan: app.payment_plan || '',
        university: app.university || '',
        year_of_study: app.year_of_study || '',
        course: app.course || '',
        student_number: app.student_number || '',
        employment_type: app.employment_type || '',
        company_name: app.company_name || '',
        employment_start_date: app.employment_start_date || '',
        contact_name: app.contact_name || '',
        contact_job_title: app.contact_job_title || '',
        contact_email: app.contact_email || '',
        contact_phone: app.contact_phone || '',
        company_address: app.company_address || '',
        guarantor_name: app.guarantor_name || '',
        guarantor_dob: app.guarantor_dob || '',
        guarantor_email: app.guarantor_email || '',
        guarantor_phone: app.guarantor_phone || '',
        guarantor_address: app.guarantor_address || '',
        guarantor_relationship: app.guarantor_relationship || '',
        declaration_name: app.declaration_name || '',
        declaration_agreed: app.declaration_agreed === 1,
      });

      // Load address history
      if (app.address_history && Array.isArray(app.address_history)) {
        setAddressHistory(app.address_history);
      }

      // Check if ID document is uploaded
      await checkIdDocumentStatus();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
        if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
          const token = getAuthToken();
          if (token) {
            setMessage({ type: 'error', text: 'You do not have permission to access this application. This application may belong to a different user.' });
            setApplication(null);
          } else {
            router.push(`/${agencySlug}`);
            return;
          }
        } else {
          setMessage({ type: 'error', text: axiosError.response?.data?.error || 'Failed to load application' });
        }
      } else {
        setMessage({ type: 'error', text: getErrorMessage(error, 'Failed to load application') });
      }
    } finally {
      setLoading(false);
    }
  };

  const validateSignature = (signature: string): boolean => {
    const expectedName = `${formData.first_name || ''} ${formData.surname || ''}`.trim();
    return validateSignatureAgainstName(signature, expectedName);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await applications.update(id, {
        ...formData,
        address_history: addressHistory,
      } as ApplicationFormData);
      setMessage({ type: 'success', text: 'Application saved successfully' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Failed to save application') });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    // Validate address history covers at least 3 years
    const currentAddressMonths = (Number(formData.period_years) * 12) + Number(formData.period_months);
    const previousAddressMonths = addressHistory.reduce((total, entry) => {
      return total + (entry.period_years * 12) + entry.period_months;
    }, 0);
    const totalMonths = currentAddressMonths + previousAddressMonths;

    if (totalMonths < 36) {
      setSubmitting(false);
      const yearsProvided = Math.floor(totalMonths / 12);
      const monthsProvided = totalMonths % 12;
      setMessage({
        type: 'error',
        text: `Address history must cover at least 3 years. You have provided ${yearsProvided} year${yearsProvided !== 1 ? 's' : ''} and ${monthsProvided} month${monthsProvided !== 1 ? 's' : ''}. Please add previous addresses to cover the full 3-year period.`,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Check if ID document is uploaded
    if (!idDocumentUploaded) {
      setSubmitting(false);
      setMessage({ type: 'error', text: 'You must upload your ID document before submitting the application' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Validate guarantor fields when required
    if (application?.guarantor_required) {
      if (!String(formData.guarantor_name ?? '').trim() || !String(formData.guarantor_email ?? '').trim()) {
        setSubmitting(false);
        setMessage({ type: 'error', text: 'Guarantor name and email are required. Please complete the guarantor details section.' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (String(formData.guarantor_email).toLowerCase().trim() === String(formData.email).toLowerCase().trim()) {
        setSubmitting(false);
        setMessage({ type: 'error', text: 'Guarantor email must be different from your email address. A guarantor must be a separate person who can provide financial backing.' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // Validate signature
    if (!validateSignature(String(formData.declaration_name ?? ''))) {
      const expectedName = `${formData.first_name} ${formData.surname}`.trim();
      setSignatureError(`Signature name must match "${expectedName}"`);
      setSubmitting(false);
      const declarationInput = document.querySelector('input[name="declaration_name"]') as HTMLElement;
      if (declarationInput) {
        declarationInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        declarationInput.focus();
      }
      return;
    }

    if (!formData.declaration_agreed) {
      setSubmitting(false);
      setMessage({ type: 'error', text: 'You must agree to the declaration before submitting' });
      return;
    }

    try {
      await applications.submit(id, {
        ...formData,
        address_history: addressHistory,
      } as ApplicationFormData);

      const newStatus = application!.guarantor_required ? 'awaiting_guarantor' : 'submitted';
      setApplication({
        ...application!,
        status: newStatus,
        completed_at: application!.guarantor_required ? application!.completed_at : new Date().toISOString(),
      });

      window.dispatchEvent(new Event('headerStateChanged'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Failed to submit application') });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading application...</div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center px-4">
          {message ? (
            <MessageAlert type={message.type} message={message.text} className="mb-6 text-left" />
          ) : (
            <p className="text-red-600 mb-4">Application not found</p>
          )}
          <Link href={`/${agencySlug}`} className="text-primary hover:underline font-semibold">
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  const isStudent = application.application_type === 'student';
  const isCompleted = application.status !== 'pending';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-2">
            {isStudent ? 'Student' : 'Professional'} Application Form
          </h1>
          <p className="text-xl text-white/90">Complete your tenant application</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Status Message */}
          {message && <MessageAlert type={message.type} message={message.text} className="mb-6" />}

          {/* Holding Deposit Banners */}
          {depositInfo?.deposit && depositInfo.deposit.status === 'awaiting_payment' && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-amber-900">Holding Deposit Required</h3>
                  <p className="text-sm text-amber-800 mt-1">
                    A holding deposit of <strong>&pound;{Number(depositInfo.deposit.amount).toFixed(2)}</strong> is required
                    {depositInfo.deposit.property_address && <> for <strong>{depositInfo.deposit.property_address}</strong></>}
                    {depositInfo.deposit.bedroom_name && <> ({depositInfo.deposit.bedroom_name})</>}
                    {depositInfo.deposit.reservation_days && <> &mdash; {depositInfo.deposit.reservation_days} day reservation</>}
                    .
                  </p>
                  {(depositInfo.bank_details.bank_name || depositInfo.bank_details.sort_code || depositInfo.bank_details.account_number) && (
                    <div className="mt-3 bg-white rounded-lg p-3 border border-amber-200">
                      <p className="text-sm font-medium text-gray-900 mb-2">Bank Transfer Details</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        {depositInfo.bank_details.bank_name && (
                          <div><span className="text-gray-500">Bank:</span> <span className="font-medium text-gray-900">{depositInfo.bank_details.bank_name}</span></div>
                        )}
                        {depositInfo.bank_details.sort_code && (
                          <div><span className="text-gray-500">Sort Code:</span> <span className="font-medium text-gray-900">{depositInfo.bank_details.sort_code}</span></div>
                        )}
                        {depositInfo.bank_details.account_number && (
                          <div><span className="text-gray-500">Account:</span> <span className="font-medium text-gray-900">{depositInfo.bank_details.account_number}</span></div>
                        )}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-amber-700 mt-2">
                    You can still complete and submit your application while the deposit is being processed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {depositInfo?.deposit && depositInfo.deposit.status === 'held' && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-5 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-sm text-green-800">
                    A holding deposit of <strong>&pound;{Number(depositInfo.deposit.amount).toFixed(2)}</strong> has already been paid
                    {depositInfo.deposit.property_address && <> for <strong>{depositInfo.deposit.property_address}</strong></>}
                    {depositInfo.deposit.bedroom_name && <> ({depositInfo.deposit.bedroom_name})</>}
                    {depositInfo.deposit.reservation_expires_at && <> and the room is reserved until <strong>{new Date(depositInfo.deposit.reservation_expires_at).toLocaleDateString('en-GB')}</strong></>}
                    .
                  </p>
                </div>
              </div>
            </div>
          )}

          {isCompleted ? (
            <>
              {/* Application Status */}
              <div className="bg-white rounded-lg shadow-md p-6 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Application Status</h2>
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    application.status === 'awaiting_guarantor' ? 'bg-orange-100 text-orange-800'
                      : application.status === 'submitted' ? 'bg-blue-100 text-blue-800'
                      : application.status === 'approved' ? 'bg-green-100 text-green-800'
                      : application.status === 'rejected' ? 'bg-red-100 text-red-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {application.status === 'awaiting_guarantor' ? 'Awaiting Guarantor'
                      : application.status === 'submitted' ? 'Submitted'
                      : application.status === 'approved' ? 'Approved'
                      : application.status === 'rejected' ? 'Rejected'
                      : application.status === 'converted_to_tenancy' ? 'Tenancy Created'
                      : 'Completed'}
                  </span>
                </div>

                {application.status === 'awaiting_guarantor' && (
                  <div className="bg-orange-50 border-l-4 border-orange-500 p-4">
                    <p className="text-orange-900 font-semibold mb-2">Awaiting Guarantor</p>
                    <p className="text-orange-800 text-sm mb-3">
                      Your application has been submitted and is awaiting completion by your guarantor.
                      They will receive an email with instructions to complete their part of the application.
                    </p>
                    <p className="text-orange-800 text-sm">
                      <strong>Haven&apos;t received the email?</strong> Please ask your guarantor to check their junk/spam folder.
                      If they still haven&apos;t received it, please contact us at{' '}
                      <a href={`mailto:${contactEmail}`} className="underline hover:text-orange-900">{contactEmail}</a>
                    </p>
                  </div>
                )}

                {application.status === 'submitted' && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                    <p className="text-blue-900 font-semibold mb-2">Application Submitted - Awaiting Review</p>
                    <p className="text-blue-800 text-sm">
                      Thank you for submitting your application! It is now being reviewed by our team. We will be in touch soon.
                    </p>
                    <p className="text-blue-700 text-sm mt-3">
                      <strong>Note:</strong> This application was submitted on{' '}
                      {new Date(application.guarantor_completed_at || application.completed_at || application.updated_at).toLocaleDateString('en-GB')}{' '}
                      and cannot be modified. If you need to make changes, please contact your letting agent.
                    </p>
                  </div>
                )}

                {application.status === 'approved' && (
                  <div className="bg-green-50 border-l-4 border-green-500 p-4">
                    <p className="text-green-900 font-semibold mb-2">Application Approved</p>
                    <p className="text-green-800 text-sm">
                      Your application has been reviewed and approved. You can now proceed to sign your tenancy agreement.
                    </p>
                  </div>
                )}

                {application.status === 'rejected' && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4">
                    <p className="text-red-900 font-semibold mb-2">Application Rejected</p>
                    <p className="text-red-800 text-sm">
                      Unfortunately, your application has not been successful. If you have any questions, please contact us at{' '}
                      <a href={`mailto:${contactEmail}`} className="underline hover:text-red-900">{contactEmail}</a>
                    </p>
                  </div>
                )}

                {application.status === 'converted_to_tenancy' && (
                  <div className="bg-purple-50 border-l-4 border-purple-500 p-4">
                    <p className="text-purple-900 font-semibold mb-2">Application Converted to Tenancy</p>
                    <p className="text-purple-800 text-sm">
                      Congratulations! Your application has been approved and converted to a tenancy.
                      We will be in touch shortly with your tenancy agreement and next steps.
                    </p>
                    <p className="text-purple-700 text-sm mt-3">
                      <strong>Note:</strong> If you have any questions, please contact your letting agent.
                    </p>
                  </div>
                )}
              </div>

              <div className="text-center mt-6">
                <Link href={`/${agencySlug}`} className="text-primary hover:underline font-semibold">
                  Return to Homepage
                </Link>
              </div>
            </>
          ) : submitting ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mb-6"></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Submitting...</h2>
              <p className="text-gray-600">Please wait while we process your application</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <DynamicApplicationForm
                applicationId={id}
                applicationType={application.application_type}
                guarantorRequired={application.guarantor_required}
                initialFormData={formData}
                initialAddressHistory={addressHistory}
                disabled={isCompleted}
                idDocumentUploaded={idDocumentUploaded}
                idDocumentInfo={idDocumentInfo}
                uploadingId={uploadingId}
                onIdFileChange={handleIdFileChange}
                onIdView={handleIdView}
                onIdDelete={handleIdDelete}
                isPending={application.status === 'pending'}
                onFormDataChange={setFormData}
                onAddressHistoryChange={setAddressHistory}
                onSignatureErrorChange={setSignatureError}
                signatureError={signatureError}
                validateSignature={validateSignature}
              />

              {/* Action Buttons */}
              {!isCompleted && (
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || submitting}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save Progress'}
                  </button>
                  <button
                    type="submit"
                    disabled={saving || submitting}
                    className="flex-1 bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
