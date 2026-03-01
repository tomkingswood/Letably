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
import { MessageAlert } from '@/components/ui/MessageAlert';

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
  const [addressHistory, setAddressHistory] = useState<AddressHistoryEntry[]>([]);
  const [contactEmail, setContactEmail] = useState('');
  const [depositInfo, setDepositInfo] = useState<{
    deposit: { amount: number; status: string; property_address?: string; bedroom_name?: string; reservation_days?: number; reservation_expires_at?: string } | null;
    bank_details: { bank_name: string | null; sort_code: string | null; account_number: string | null };
  } | null>(null);

  // ID document upload (via shared hook)
  const {
    idDocumentUploaded, idDocumentInfo, idDocument, uploadingId,
    setIdDocument, checkStatus: checkIdDocumentStatus,
    handleFileChange: handleIdFileChange, handleView: handleIdView,
    handleDelete: handleIdDelete,
  } = useIdDocument({
    checkStatus: () => applications.getIdDocumentStatus(id, 'applicant_id'),
    upload: (file) => applications.uploadApplicantId(id, file),
    getViewUrl: () => applications.getIdDocumentUrl(id, 'applicant_id'),
    delete: () => applications.deleteApplicantId(id, 'applicant_id'),
    viewHeaders: () => ({ 'Authorization': `Bearer ${getAuthToken()}` }),
  }, setMessage);

  // Right to Rent modal state
  const [showRightToRentModal, setShowRightToRentModal] = useState(false);

  const [signatureError, setSignatureError] = useState('');

  const [formData, setFormData] = useState({
    // Applicant Information
    title: '',
    title_other: '',
    date_of_birth: '',
    first_name: '',
    middle_name: '',
    surname: '',
    email: '',
    phone: '',
    // Current Address
    residential_status: '',
    residential_status_other: '',
    period_years: 0,
    period_months: 0,
    current_address: '',
    // Landlord (if private tenant)
    landlord_name: '',
    landlord_address: '',
    landlord_email: '',
    landlord_phone: '',
    // Proof of Identity
    id_type: '',
    // Student fields
    payment_method: '',
    payment_plan: '',
    university: '',
    year_of_study: '',
    course: '',
    student_number: '',
    // Professional fields
    employment_type: '',
    company_name: '',
    employment_start_date: '',
    contact_name: '',
    contact_job_title: '',
    contact_email: '',
    contact_phone: '',
    company_address: '',
    // Guarantor
    guarantor_name: '',
    guarantor_dob: '',
    guarantor_email: '',
    guarantor_phone: '',
    guarantor_address: '',
    guarantor_relationship: '',
    // Declaration
    declaration_name: '',
    declaration_agreed: false,
  });

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
        // Keep default value on error
        console.error('Error fetching settings:', error);
      }
    };
    fetchSettings();
    fetchApplication();
    // Fetch holding deposit info for this application
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
    } catch (error: any) {
      // Check if unauthorized
      if (error.response?.status === 401 || error.response?.status === 403) {
        // If user has a token but got 403, they're logged in but accessing wrong application
        const token = getAuthToken();
        if (token) {
          // User is logged in but doesn't have access to this application
          setMessage({
            type: 'error',
            text: 'You do not have permission to access this application. This application may belong to a different user.'
          });
          setApplication(null); // Set to null to show the error state
        } else {
          // User is not logged in, redirect to login
          router.push(`/${agencySlug}`);
          return;
        }
      } else {
        setMessage({
          type: 'error',
          text: error.response?.data?.error || 'Failed to load application'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const validateSignature = (signature: string): boolean => {
    const expectedName = `${formData.first_name || ''} ${formData.surname || ''}`.trim();
    return validateSignatureAgainstName(signature, expectedName);
  };

  const handleDeclarationNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      declaration_name: value
    }));

    // Validate signature as user types
    if (value.trim() && formData.first_name && formData.surname) {
      const isValid = validateSignature(value);

      if (!isValid) {
        const expectedName = `${formData.first_name} ${formData.surname}`.trim();
        setSignatureError(`Signature name must match "${expectedName}"`);
      } else {
        setSignatureError('');
      }
    } else {
      setSignatureError('');
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

  const addAddressEntry = () => {
    setAddressHistory(prev => [
      ...prev,
      {
        residential_status: '',
        residential_status_other: '',
        period_years: 0,
        period_months: 0,
        address: '',
        postcode: ''
      }
    ]);
  };

  const removeAddressEntry = (index: number) => {
    setAddressHistory(prev => prev.filter((_, i) => i !== index));
  };

  const updateAddressEntry = (index: number, field: string, value: any) => {
    setAddressHistory(prev => prev.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await applications.update(id, {
        ...formData,
        address_history: addressHistory
      });

      setMessage({
        type: 'success',
        text: 'Application saved successfully'
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to save application'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Set submitting state immediately to show loading UI
    setSubmitting(true);
    setMessage(null);

    // Validate address history covers at least 3 years
    const currentAddressMonths = (formData.period_years * 12) + formData.period_months;
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
        text: `Address history must cover at least 3 years. You have provided ${yearsProvided} year${yearsProvided !== 1 ? 's' : ''} and ${monthsProvided} month${monthsProvided !== 1 ? 's' : ''}. Please add previous addresses to cover the full 3-year period.`
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Check if ID document is uploaded
    if (!idDocumentUploaded) {
      setSubmitting(false);
      setMessage({
        type: 'error',
        text: 'You must upload your ID document before submitting the application'
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Validate guarantor fields when guarantor is required
    if (application?.guarantor_required) {
      if (!formData.guarantor_name?.trim() || !formData.guarantor_email?.trim()) {
        setSubmitting(false);
        setMessage({
          type: 'error',
          text: 'Guarantor name and email are required. Please complete the guarantor details section.'
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (formData.guarantor_email.toLowerCase().trim() === formData.email.toLowerCase().trim()) {
        setSubmitting(false);
        setMessage({
          type: 'error',
          text: 'Guarantor email must be different from your email address. A guarantor must be a separate person who can provide financial backing.'
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // Validate signature matches expected name
    if (!validateSignature(formData.declaration_name)) {
      const expectedName = `${formData.first_name} ${formData.surname}`.trim();
      setSignatureError(`Signature name must match "${expectedName}"`);
      setSubmitting(false);
      // Scroll to the declaration name input field
      const declarationInput = document.querySelector('input[name="declaration_name"]') as HTMLElement;
      if (declarationInput) {
        declarationInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        declarationInput.focus();
      }
      return;
    }

    if (!formData.declaration_agreed) {
      setSubmitting(false);
      setMessage({
        type: 'error',
        text: 'You must agree to the declaration before submitting'
      });
      return;
    }

    try {
      await applications.submit(id, {
        ...formData,
        address_history: addressHistory
      });

      // Update local application state
      // If guarantor required, status becomes 'awaiting_guarantor', otherwise 'submitted' (awaiting admin review)
      const newStatus = application!.guarantor_required ? 'awaiting_guarantor' : 'submitted';
      setApplication({
        ...application!,
        status: newStatus,
        completed_at: application!.guarantor_required ? application!.completed_at : new Date().toISOString()
      });

      // Trigger event to update header banner
      window.dispatchEvent(new Event('headerStateChanged'));

      // Scroll to top to show status message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to submit application'
      });
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
  // Application is editable only when status is 'pending'
  // All other statuses (submitted, approved, awaiting_guarantor, converted_to_tenancy) are read-only
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

          {/* Holding Deposit Banner */}
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
                    {depositInfo.deposit.property_address && (
                      <> for <strong>{depositInfo.deposit.property_address}</strong></>
                    )}
                    {depositInfo.deposit.bedroom_name && (
                      <> ({depositInfo.deposit.bedroom_name})</>
                    )}
                    {depositInfo.deposit.reservation_days && (
                      <> &mdash; {depositInfo.deposit.reservation_days} day reservation</>
                    )}
                    .
                  </p>

                  {/* Bank details */}
                  {(depositInfo.bank_details.bank_name || depositInfo.bank_details.sort_code || depositInfo.bank_details.account_number) && (
                    <div className="mt-3 bg-white rounded-lg p-3 border border-amber-200">
                      <p className="text-sm font-medium text-gray-900 mb-2">Bank Transfer Details</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        {depositInfo.bank_details.bank_name && (
                          <div>
                            <span className="text-gray-500">Bank:</span>{' '}
                            <span className="font-medium text-gray-900">{depositInfo.bank_details.bank_name}</span>
                          </div>
                        )}
                        {depositInfo.bank_details.sort_code && (
                          <div>
                            <span className="text-gray-500">Sort Code:</span>{' '}
                            <span className="font-medium text-gray-900">{depositInfo.bank_details.sort_code}</span>
                          </div>
                        )}
                        {depositInfo.bank_details.account_number && (
                          <div>
                            <span className="text-gray-500">Account:</span>{' '}
                            <span className="font-medium text-gray-900">{depositInfo.bank_details.account_number}</span>
                          </div>
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
                    {depositInfo.deposit.property_address && (
                      <> for <strong>{depositInfo.deposit.property_address}</strong></>
                    )}
                    {depositInfo.deposit.bedroom_name && (
                      <> ({depositInfo.deposit.bedroom_name})</>
                    )}
                    {depositInfo.deposit.reservation_expires_at && (
                      <> and the room is reserved until <strong>{new Date(depositInfo.deposit.reservation_expires_at).toLocaleDateString('en-GB')}</strong></>
                    )}
                    .
                  </p>
                </div>
              </div>
            </div>
          )}

          {isCompleted && (
            <div className="mb-6">
              {/* Status Badge */}
              <div className="bg-white rounded-lg shadow-md p-6 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Application Status</h2>
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    application.status === 'awaiting_guarantor'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {application.status === 'awaiting_guarantor' ? 'Awaiting Guarantor' : 'Completed'}
                  </span>
                </div>

                {/* Awaiting Guarantor Message */}
                {application.status === 'awaiting_guarantor' && (
                  <div className="bg-orange-50 border-l-4 border-orange-500 p-4">
                    <p className="text-orange-900 font-semibold mb-2">
                      Awaiting Guarantor
                    </p>
                    <p className="text-orange-800 text-sm mb-3">
                      Your application has been submitted and is awaiting completion by your guarantor.
                      They will receive an email with instructions to complete their part of the application.
                    </p>
                    <p className="text-orange-800 text-sm">
                      <strong>Haven't received the email?</strong> Please ask your guarantor to check their junk/spam folder.
                      If they still haven't received it, please contact us at{' '}
                      <a href={`mailto:${contactEmail}`} className="underline hover:text-orange-900">
                        {contactEmail}
                      </a>
                    </p>
                  </div>
                )}

                {/* Submitted Message - Awaiting Admin Review */}
                {application.status === 'submitted' && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                    <p className="text-blue-900 font-semibold mb-2">
                      Application Submitted - Awaiting Review
                    </p>
                    <p className="text-blue-800 text-sm">
                      Thank you for submitting your application! It is now being reviewed by our team. We will be in touch soon.
                    </p>
                    <p className="text-blue-700 text-sm mt-3">
                      <strong>Note:</strong> This application was submitted on{' '}
                      {new Date(
                        application.guarantor_completed_at || application.completed_at || application.updated_at
                      ).toLocaleDateString('en-GB')}{' '}
                      and cannot be modified. If you need to make changes, please contact your letting agent.
                    </p>
                  </div>
                )}

                {/* Approved Message */}
                {application.status === 'approved' && (
                  <div className="bg-green-50 border-l-4 border-green-500 p-4">
                    <p className="text-green-900 font-semibold mb-2">
                      ✓ Application Approved
                    </p>
                    <p className="text-green-800 text-sm">
                      Your application has been reviewed and approved. You can now proceed to sign your tenancy agreement.
                    </p>
                  </div>
                )}

                {/* Converted to Tenancy Message */}
                {application.status === 'converted_to_tenancy' && (
                  <div className="bg-purple-50 border-l-4 border-purple-500 p-4">
                    <p className="text-purple-900 font-semibold mb-2">
                      ✓ Application Converted to Tenancy
                    </p>
                    <p className="text-purple-800 text-sm">
                      Congratulations! Your application has been approved and converted to a tenancy.
                      We will be in touch shortly with your tenancy agreement and next steps.
                    </p>
                    <p className="text-purple-700 text-sm mt-3">
                      <strong>Note:</strong> This application cannot be modified as it has been converted to a tenancy.
                      If you have any questions, please contact your letting agent.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {submitting ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mb-6"></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Submitting...</h2>
              <p className="text-gray-600">Please wait while we process your application</p>
            </div>
          ) : (
            <>
            <form onSubmit={handleSubmit} className="space-y-8">
            {/* Application Details */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Application Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Application Type:</span>{' '}
                  {application.application_type === 'student' ? 'Student' : 'Professional'}
                </div>
                <div>
                  <span className="font-medium">Guarantor Required:</span>{' '}
                  {application.guarantor_required ? 'Yes' : 'No'}
                </div>
              </div>
            </div>

            {/* Applicant Information */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Applicant Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <select
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    disabled={isCompleted}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="">Select</option>
                    <option value="Mr">Mr</option>
                    <option value="Miss">Miss</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {formData.title === 'Other' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Please Specify *
                    </label>
                    <input
                      type="text"
                      name="title_other"
                      value={formData.title_other}
                      onChange={handleChange}
                      required
                      disabled={isCompleted}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    required
                    disabled={isCompleted}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    disabled={isCompleted}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    name="middle_name"
                    value={formData.middle_name}
                    onChange={handleChange}
                    disabled={isCompleted}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Surname *
                  </label>
                  <input
                    type="text"
                    name="surname"
                    value={formData.surname}
                    onChange={handleChange}
                    required
                    disabled={isCompleted}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={isCompleted}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    disabled={isCompleted}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              </div>
            </div>

            {/* Current Address */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Current Address</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Residential Status *
                    </label>
                    <select
                      name="residential_status"
                      value={formData.residential_status}
                      onChange={handleChange}
                      required
                      disabled={isCompleted}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                    >
                      <option value="">Select</option>
                      <option value="Private Tenant">Private Tenant</option>
                      <option value="Living with Parents">Living with Parents</option>
                      <option value="Student Accommodation">Student Accommodation</option>
                      <option value="Owner Occupier">Owner Occupier</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {formData.residential_status === 'Other' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Please Specify *
                      </label>
                      <input
                        type="text"
                        name="residential_status_other"
                        value={formData.residential_status_other}
                        onChange={handleChange}
                        required
                        disabled={isCompleted}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Period at Current Address *
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Years
                      </label>
                      <input
                        type="number"
                        name="period_years"
                        value={formData.period_years}
                        onChange={handleChange}
                        min="0"
                        required
                        disabled={isCompleted}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Months
                      </label>
                      <input
                        type="number"
                        name="period_months"
                        value={formData.period_months}
                        onChange={handleChange}
                        min="0"
                        max="11"
                        required
                        disabled={isCompleted}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Address *
                  </label>
                  <textarea
                    name="current_address"
                    value={formData.current_address}
                    onChange={handleChange}
                    required
                    disabled={isCompleted}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              </div>
            </div>

            {/* Landlord Details (if Private Tenant) */}
            {formData.residential_status === 'Private Tenant' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Current Landlord Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Landlord Name *
                    </label>
                    <input
                      type="text"
                      name="landlord_name"
                      value={formData.landlord_name}
                      onChange={handleChange}
                      required
                      disabled={isCompleted}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Landlord Address *
                    </label>
                    <textarea
                      name="landlord_address"
                      value={formData.landlord_address}
                      onChange={handleChange}
                      required
                      disabled={isCompleted}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Landlord Email
                      </label>
                      <input
                        type="email"
                        name="landlord_email"
                        value={formData.landlord_email}
                        onChange={handleChange}
                        disabled={isCompleted}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Landlord Phone *
                      </label>
                      <input
                        type="tel"
                        name="landlord_phone"
                        value={formData.landlord_phone}
                        onChange={handleChange}
                        required
                        disabled={isCompleted}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Address History (3 years) */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Address History (Previous 3 Years)</h2>
                {!isCompleted && (
                  <button
                    type="button"
                    onClick={addAddressEntry}
                    className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Add Address
                  </button>
                )}
              </div>

              {addressHistory.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  If you have lived at other addresses in the past 3 years, click "Add Address" to add them.
                </p>
              ) : (
                <div className="space-y-6">
                  {addressHistory.map((entry, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-semibold text-gray-900">Previous Address {index + 1}</h3>
                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={() => removeAddressEntry(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Residential Status *
                            </label>
                            <select
                              value={entry.residential_status}
                              onChange={(e) => updateAddressEntry(index, 'residential_status', e.target.value)}
                              required
                              disabled={isCompleted}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                            >
                              <option value="">Select</option>
                              <option value="Private Tenant">Private Tenant</option>
                              <option value="Living with Parents">Living with Parents</option>
                              <option value="Student Accommodation">Student Accommodation</option>
                              <option value="Owner Occupier">Owner Occupier</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          {entry.residential_status === 'Other' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Please Specify *
                              </label>
                              <input
                                type="text"
                                value={entry.residential_status_other || ''}
                                onChange={(e) => updateAddressEntry(index, 'residential_status_other', e.target.value)}
                                required
                                disabled={isCompleted}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                              />
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Period at Address *
                          </label>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Years
                              </label>
                              <input
                                type="number"
                                value={entry.period_years}
                                onChange={(e) => updateAddressEntry(index, 'period_years', parseInt(e.target.value) || 0)}
                                min="0"
                                required
                                disabled={isCompleted}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Months
                              </label>
                              <input
                                type="number"
                                value={entry.period_months}
                                onChange={(e) => updateAddressEntry(index, 'period_months', parseInt(e.target.value) || 0)}
                                min="0"
                                max="11"
                                required
                                disabled={isCompleted}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Full Address *
                          </label>
                          <textarea
                            value={entry.address}
                            onChange={(e) => updateAddressEntry(index, 'address', e.target.value)}
                            required
                            disabled={isCompleted}
                            rows={2}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Proof of Identity */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Proof of Identity</h2>
                <button
                  type="button"
                  onClick={() => setShowRightToRentModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Right to Rent Checks
                </button>
              </div>
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-4">
                  Please select which form of identification you will provide for Right to Rent checks *
                </p>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="id_type"
                    value="Driving Licence"
                    checked={formData.id_type === 'Driving Licence'}
                    onChange={handleChange}
                    disabled={isCompleted}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-900">UK Driving Licence</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="id_type"
                    value="Passport"
                    checked={formData.id_type === 'Passport'}
                    onChange={handleChange}
                    disabled={isCompleted}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-900">Valid Passport</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="id_type"
                    value={isStudent ? 'Student ID' : 'Work ID'}
                    checked={formData.id_type === (isStudent ? 'Student ID' : 'Work ID')}
                    onChange={handleChange}
                    disabled={isCompleted}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-900">
                    {isStudent ? 'Student ID Card' : 'Work ID / Employee Badge'}
                  </span>
                </label>
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

                        {/* View and Delete buttons - only shown if application status is pending */}
                        {application?.status === 'pending' && (
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
                          disabled={isCompleted || uploadingId}
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

                    {!isCompleted && !uploadingId && (
                      <p className="text-xs text-gray-500">
                        Note: File will upload automatically after selection. Accepted formats: JPEG, PNG, PDF (max 10MB)
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Student-Specific Fields */}
            {isStudent && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Student Information</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        How will you pay rent? *
                      </label>
                      <select
                        name="payment_method"
                        value={formData.payment_method}
                        onChange={handleChange}
                        required
                        disabled={isCompleted}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                      >
                        <option value="">Select</option>
                        <option value="Student Loan">Student Loan</option>
                        <option value="Parent / Family">Parent / Family</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Plan *
                      </label>
                      <select
                        name="payment_plan"
                        value={formData.payment_plan}
                        onChange={handleChange}
                        required
                        disabled={isCompleted}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                      >
                        <option value="">Select</option>
                        <option value="Pay Upfront">Pay Upfront</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Quarterly">Quarterly</option>
                        <option value="Monthly to Quarterly">Monthly to Quarterly</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      University *
                    </label>
                    <input
                      type="text"
                      name="university"
                      value={formData.university}
                      onChange={handleChange}
                      required
                      disabled={isCompleted}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Year of Study *
                      </label>
                      <select
                        name="year_of_study"
                        value={formData.year_of_study}
                        onChange={handleChange}
                        required
                        disabled={isCompleted}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                      >
                        <option value="">Select</option>
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                        <option value="Postgraduate">Postgraduate</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Student Number *
                      </label>
                      <input
                        type="text"
                        name="student_number"
                        value={formData.student_number}
                        onChange={handleChange}
                        required
                        disabled={isCompleted}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Course *
                    </label>
                    <input
                      type="text"
                      name="course"
                      value={formData.course}
                      onChange={handleChange}
                      required
                      disabled={isCompleted}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Professional-Specific Fields */}
            {!isStudent && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Employment Information</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Employment Type *
                      </label>
                      <select
                        name="employment_type"
                        value={formData.employment_type}
                        onChange={handleChange}
                        required
                        disabled={isCompleted}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                      >
                        <option value="">Select</option>
                        <option value="Full Time">Full Time</option>
                        <option value="Part Time">Part Time</option>
                        <option value="Self Employed">Self Employed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Employment Start Date *
                      </label>
                      <input
                        type="date"
                        name="employment_start_date"
                        value={formData.employment_start_date}
                        onChange={handleChange}
                        required
                        disabled={isCompleted}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      name="company_name"
                      value={formData.company_name}
                      onChange={handleChange}
                      required
                      disabled={isCompleted}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Company Address *
                      </label>
                      <textarea
                        name="company_address"
                        value={formData.company_address}
                        onChange={handleChange}
                        required
                        disabled={isCompleted}
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Employment Reference Contact</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contact Name *
                        </label>
                        <input
                          type="text"
                          name="contact_name"
                          value={formData.contact_name}
                          onChange={handleChange}
                          required
                          disabled={isCompleted}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contact Job Title *
                        </label>
                        <input
                          type="text"
                          name="contact_job_title"
                          value={formData.contact_job_title}
                          onChange={handleChange}
                          required
                          disabled={isCompleted}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contact Email *
                        </label>
                        <input
                          type="email"
                          name="contact_email"
                          value={formData.contact_email}
                          onChange={handleChange}
                          required
                          disabled={isCompleted}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contact Phone *
                        </label>
                        <input
                          type="tel"
                          name="contact_phone"
                          value={formData.contact_phone}
                          onChange={handleChange}
                          required
                          disabled={isCompleted}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Guarantor Information */}
            {application.guarantor_required && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Guarantor Information</h2>
                <p className="text-sm text-gray-600 mb-4">
                  A guarantor is required for this tenancy. This should be a UK homeowner who can provide financial backing.
                </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Guarantor Full Name *
                  </label>
                  <input
                    type="text"
                    name="guarantor_name"
                    value={formData.guarantor_name}
                    onChange={handleChange}
                    required
                    disabled={isCompleted}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Guarantor Date of Birth *
                    </label>
                    <input
                      type="date"
                      name="guarantor_dob"
                      value={formData.guarantor_dob}
                      onChange={handleChange}
                      required
                      disabled={isCompleted}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Relationship to You *
                    </label>
                    <input
                      type="text"
                      name="guarantor_relationship"
                      value={formData.guarantor_relationship}
                      onChange={handleChange}
                      required
                      disabled={isCompleted}
                      placeholder="e.g., Parent, Guardian, Sibling"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Guarantor Email *
                    </label>
                    <input
                      type="email"
                      name="guarantor_email"
                      value={formData.guarantor_email}
                      onChange={handleChange}
                      required
                      disabled={isCompleted}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      This email will be used to send the guarantor application form, where they can validate details, upload ID, and provide a digital signature.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Guarantor Phone *
                    </label>
                    <input
                      type="tel"
                      name="guarantor_phone"
                      value={formData.guarantor_phone}
                      onChange={handleChange}
                      required
                      disabled={isCompleted}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Guarantor Address *
                  </label>
                  <textarea
                    name="guarantor_address"
                    value={formData.guarantor_address}
                    onChange={handleChange}
                    required
                    disabled={isCompleted}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              </div>
              </div>
            )}

            {/* Declaration */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Declaration</h2>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-gray-700 mb-4">
                  I confirm that I am over 18 years of age and the information given above is true and accurate.
                  I confirm that no one will be living in the property except anyone who is named above provided
                  in the application information. I agree to allow the letting agent to make whatever enquires
                  required, including a credit check, as deemed necessary regarding this application for tenancy.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Print Name *
                  </label>
                  <input
                    type="text"
                    name="declaration_name"
                    value={formData.declaration_name}
                    onChange={(e) => handleDeclarationNameChange(e.target.value)}
                    required
                    disabled={isCompleted}
                    placeholder="Type your full name"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 ${
                      signatureError ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {signatureError && (
                    <p className="mt-1 text-sm text-red-600">{signatureError}</p>
                  )}
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="declaration_agreed"
                    name="declaration_agreed"
                    checked={formData.declaration_agreed}
                    onChange={handleChange}
                    disabled={isCompleted}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <label htmlFor="declaration_agreed" className="ml-2 block text-sm text-gray-900">
                    I agree and confirm this is my electronic signature *
                  </label>
                </div>
              </div>
            </div>

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
            </>
          )}
        </div>
      </div>

      {/* Right to Rent Modal */}
      {showRightToRentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-2xl font-bold text-gray-900">Right to Rent Checks</h3>
                <button
                  onClick={() => setShowRightToRentModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-700 leading-relaxed mb-4">
                  From 1st February 2016, landlords and letting agents in England are required to check the immigration status of all adult tenants before they agree to enter into a tenancy agreement. This is to establish you have a 'right to rent' legally in the UK.
                </p>
                <p className="text-gray-700 leading-relaxed mb-4">
                  We will contact you to arrange a suitable time and location to perform this check. A tenancy agreement cannot be granted if all adult occupiers cannot prove they have a right to rent in the UK.
                </p>
                <p className="text-gray-700 leading-relaxed mb-4">
                  To establish whether you have permanent right to rent we will need you to provide sufficient evidence of a permanent or temporary right to rent in the UK.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  Further information on supporting documents and proving your right to rent status is available at{' '}
                  <a
                    href="https://www.gov.uk/government/publications/right-to-rent-document-checks-a-user-guide"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    gov.uk/right-to-rent-document-checks
                  </a>
                </p>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowRightToRentModal(false)}
                  className="px-6 py-2 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
