'use client';

import { useState, useEffect } from 'react';
import { applications, agencies, holdingDeposits, getAuthToken } from '@/lib/api';
import type { ApplicationFormData, HoldingDeposit } from '@/lib/types';
import { useAgency } from '@/lib/agency-context';
import { MessageAlert } from '@/components/ui/MessageAlert';
import HoldingDepositApprovalModal from '@/components/admin/HoldingDepositApprovalModal';
import ApprovalChecklistModal from '@/components/admin/ApprovalChecklistModal';

interface ApplicationDetailViewProps {
  id: string;
  onBack: () => void;
  onDeleted?: () => void;
  onNavigate?: (section: string | null, params?: { action?: 'new' | 'edit' | 'view' | null; id?: string | null }) => void;
}

export default function ApplicationDetailView({ id, onBack, onDeleted, onNavigate }: ApplicationDetailViewProps) {
  const { agencySlug } = useAgency();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<ApplicationFormData | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [applicantIdUploaded, setApplicantIdUploaded] = useState(false);
  const [guarantorIdUploaded, setGuarantorIdUploaded] = useState(false);
  const [holdingDepositEnabled, setHoldingDepositEnabled] = useState(false);
  const [showHoldingDepositModal, setShowHoldingDepositModal] = useState(false);
  const [showApprovalChecklist, setShowApprovalChecklist] = useState(false);
  const [existingDeposit, setExistingDeposit] = useState<HoldingDeposit | null>(null);
  const [depositLoadFailed, setDepositLoadFailed] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  useEffect(() => {
    fetchApplication();
    // Check if holding deposit is enabled
    agencies.getSettings().then(res => {
      const settings = res.data.settings || res.data;
      setHoldingDepositEnabled(settings.holding_deposit_enabled === true || settings.holding_deposit_enabled === 'true');
    }).catch(() => {});
    // Fetch existing holding deposit for this application
    setDepositLoadFailed(false);
    holdingDeposits.getByApplication(id).then(res => {
      setExistingDeposit(res.data.deposit || null);
    }).catch(() => {
      setDepositLoadFailed(true);
    });
  }, [id]);

  const checkIdDocumentStatus = async (appData: any) => {
    try {
      // Check applicant ID
      const applicantResponse = await applications.getIdDocumentStatus(id, 'applicant_id');
      setApplicantIdUploaded(applicantResponse.data.uploaded || false);

      // Check guarantor ID if guarantor is required
      if (appData?.guarantor_required) {
        const guarantorResponse = await applications.getIdDocumentStatus(id, 'guarantor_id');
        setGuarantorIdUploaded(guarantorResponse.data.uploaded || false);
      }
    } catch (error) {
      // Documents not uploaded yet
      setApplicantIdUploaded(false);
      setGuarantorIdUploaded(false);
    }
  };

  const fetchApplication = async () => {
    try {
      const response = await applications.getByIdAdmin(id);
      setApplication(response.data);
      // Check ID document status after application is loaded, pass the application data
      await checkIdDocumentStatus(response.data);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to load application'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      await applications.delete(id);
      if (onDeleted) {
        onDeleted();
      } else {
        onBack();
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to delete application'
      });
      setDeleting(false);
    }
  };

  const handleApproveClick = () => {
    setShowApprovalChecklist(true);
  };

  const handleApproveConfirm = async () => {
    setApproving(true);
    setMessage(null);
    try {
      await applications.approve(id);
      setShowApprovalChecklist(false);
      setMessage({
        type: 'success',
        text: 'Application approved successfully! This application can now be used to create a tenancy.'
      });
      await fetchApplication();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { holding_deposit_required?: boolean; deposit_awaiting_payment?: boolean; error?: string } } };
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to approve application'
      });
    } finally {
      setApproving(false);
    }
  };

  const handleRecordPayment = () => {
    setShowHoldingDepositModal(true);
  };

  const handleUndoPayment = async () => {
    if (isUndoing || !existingDeposit || !confirm('Are you sure you want to undo this deposit payment? The deposit will revert to "awaiting payment".')) {
      return;
    }
    setIsUndoing(true);
    setMessage(null);
    try {
      await holdingDeposits.undoPayment(existingDeposit.id);
      setMessage({ type: 'success', text: 'Deposit payment undone successfully.' });
      const depositRes = await holdingDeposits.getByApplication(id);
      setExistingDeposit(depositRes.data.deposit || null);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to undo payment' });
    } finally {
      setIsUndoing(false);
    }
  };

  const handleHoldingDepositSuccess = async () => {
    setShowHoldingDepositModal(false);
    setMessage({
      type: 'success',
      text: 'Holding deposit payment recorded successfully.'
    });
    await fetchApplication();
    // Refresh deposit data
    try {
      const depositRes = await holdingDeposits.getByApplication(id);
      setExistingDeposit(depositRes.data.deposit || null);
    } catch { /* ignore */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRegenerateToken = async () => {
    if (!confirm('Are you sure you want to regenerate the guarantor link? The old link will no longer work.')) {
      return;
    }

    setRegenerating(true);
    setMessage(null);
    try {
      await applications.regenerateGuarantorToken(id);
      setMessage({
        type: 'success',
        text: 'Guarantor link regenerated successfully! A new email has been sent to the guarantor.'
      });
      // Refresh application data to get new token
      await fetchApplication();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to regenerate guarantor link'
      });
    } finally {
      setRegenerating(false);
    }
  };

  // View ID document (with authentication)
  const handleViewIdDocument = async (documentType: 'applicant_id' | 'guarantor_id') => {
    try {
      const token = getAuthToken();
      const url = applications.getIdDocumentUrl(id, documentType);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load document');
      }

      // Get the blob and create object URL
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Open in new tab
      window.open(blobUrl, '_blank');

      // Clean up the blob URL after a delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to view ID document. The document may not have been uploaded yet.'
      });
    }
  };

  // Generate PDF (with authentication)
  const handleGeneratePDF = async () => {
    try {
      const token = getAuthToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const url = `${apiUrl}/applications/${id}/generate-pdf`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Get the blob and create download
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Create a temporary link element and trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Application_${id}_${application?.surname || 'Unknown'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL after download starts
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

      setMessage({
        type: 'success',
        text: 'PDF downloaded successfully!'
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to generate PDF. Please try again.'
      });
    }
  };

  const handleCopyLink = () => {
    const guarantorLink = `${window.location.origin}/${agencySlug}/guarantor/${application?.guarantor_token}`;
    navigator.clipboard.writeText(guarantorLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading application...</div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-red-600 mb-4">Application not found</p>
          <button onClick={onBack} className="text-primary hover:underline">
            Back to Applications
          </button>
        </div>
      </div>
    );
  }

  const isStudent = application.application_type === 'student';
  const isSubmitted = application.status === 'submitted';
  const isApproved = application.status === 'approved';
  const addressHistory = application.address_history || [];

  // Get status display info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'submitted':
        return { label: 'Submitted - Awaiting Review', color: 'bg-blue-100 text-blue-800' };
      case 'approved':
        return { label: 'Approved', color: 'bg-green-100 text-green-800' };
      case 'converted_to_tenancy':
        return { label: 'Converted to Tenancy', color: 'bg-purple-100 text-purple-800' };
      case 'awaiting_guarantor':
        return { label: 'Awaiting Guarantor', color: 'bg-orange-100 text-orange-800' };
      case 'pending':
      default:
        return { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' };
    }
  };

  const statusInfo = getStatusInfo(application.status);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Status Message */}
      {message && (
        <MessageAlert type={message.type} message={message.text} className="mb-6" />
      )}

      {/* Status Badge */}
      <div className="mb-6">
        <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
        {(isSubmitted || isApproved || application.status === 'converted_to_tenancy') && application.completed_at && (
          <span className="ml-4 text-sm text-gray-600">
            Submitted: {new Date(application.completed_at).toLocaleDateString('en-GB')}
          </span>
        )}
      </div>

      {/* Holding Deposit Info */}
      {existingDeposit && (
        <div className={`rounded-lg p-4 mb-6 ${
          existingDeposit.status === 'awaiting_payment'
            ? 'bg-amber-50 border border-amber-200'
            : existingDeposit.status === 'held'
            ? 'bg-blue-50 border border-blue-200'
            : 'bg-gray-50 border border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Holding Deposit</h3>
              <p className="text-sm text-gray-700 mt-1">
                &pound;{Number(existingDeposit.amount).toFixed(2)}
                {existingDeposit.property_address && ` \u2022 ${existingDeposit.property_address}`}
                {existingDeposit.bedroom_name && ` \u2022 ${existingDeposit.bedroom_name}`}
              </p>
              {existingDeposit.status === 'held' && existingDeposit.reservation_expires_at && (
                <p className="text-xs text-blue-700 mt-1">
                  Room reserved until {new Date(existingDeposit.reservation_expires_at).toLocaleDateString('en-GB')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {existingDeposit.status === 'awaiting_payment' && (
                <button
                  onClick={handleRecordPayment}
                  className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  Record Payment
                </button>
              )}
              {existingDeposit.status === 'held' && (
                <button
                  onClick={handleUndoPayment}
                  disabled={isUndoing}
                  className={`text-xs underline ${isUndoing ? 'text-gray-400 cursor-not-allowed' : 'text-gray-500 hover:text-red-600'}`}
                >
                  {isUndoing ? 'Undoing...' : 'Undo Payment'}
                </button>
              )}
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                existingDeposit.status === 'awaiting_payment'
                  ? 'bg-amber-500 text-white'
                  : existingDeposit.status === 'held'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-500 text-white'
              }`}>
                {existingDeposit.status === 'awaiting_payment' ? 'Awaiting Payment' : existingDeposit.status === 'held' ? 'Held' : existingDeposit.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Application Details */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Application Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoItem
            label="Application Type"
            value={application.application_type === 'student' ? 'Student' : 'Professional'}
          />
          <InfoItem
            label="Guarantor Required"
            value={application.guarantor_required ? 'Yes' : 'No'}
          />
        </div>
      </div>

      {/* Applicant Information */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Applicant Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoItem label="Title" value={application.title === 'Other' ? application.title_other : application.title} />
          <InfoItem label="Date of Birth" value={application.date_of_birth ? new Date(application.date_of_birth).toLocaleDateString('en-GB') : '-'} />
          <InfoItem label="First Name" value={application.first_name} />
          <InfoItem label="Middle Name" value={application.middle_name || '-'} />
          <InfoItem label="Surname" value={application.surname} />
          <InfoItem label="Email" value={application.email} />
          <InfoItem label="Phone" value={application.phone} />
        </div>
      </div>

      {/* Current Address */}
      {application.current_address && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Current Address</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem
              label="Residential Status"
              value={application.residential_status === 'Other' ? application.residential_status_other : application.residential_status}
            />
            <InfoItem
              label="Period at Address"
              value={`${application.period_years || 0} years, ${application.period_months || 0} months`}
            />
            <div className="md:col-span-2">
              <AddressItem label="Address" value={application.current_address} />
            </div>
          </div>
        </div>
      )}

      {/* Landlord Details */}
      {application.landlord_name && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Current Landlord Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem label="Landlord Name" value={application.landlord_name} />
            <InfoItem label="Landlord Phone" value={application.landlord_phone} />
            <div className="md:col-span-2">
              <AddressItem label="Landlord Address" value={application.landlord_address} />
            </div>
            {application.landlord_email && (
              <InfoItem label="Landlord Email" value={application.landlord_email} />
            )}
          </div>
        </div>
      )}

      {/* Address History */}
      {addressHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Address History (Previous 3 Years)</h2>
          <div className="space-y-4">
            {addressHistory.map((entry: any, index: number) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Previous Address {index + 1}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <InfoItem
                    label="Residential Status"
                    value={entry.residential_status === 'Other' ? entry.residential_status_other : entry.residential_status}
                  />
                  <InfoItem
                    label="Period"
                    value={`${entry.period_years || 0} years, ${entry.period_months || 0} months`}
                  />
                  <div className="md:col-span-2">
                    <AddressItem label="Address" value={entry.address} />
                  </div>
                  <InfoItem label="Postcode" value={entry.postcode} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proof of Identity */}
      {application.id_type && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Proof of Identity</h2>
          <InfoItem label="ID Type" value={application.id_type} />
        </div>
      )}

      {/* Student Information */}
      {isStudent && application.university && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Student Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem label="Payment Method" value={application.payment_method} />
            <InfoItem label="Payment Plan" value={application.payment_plan} />
            <InfoItem label="University" value={application.university} />
            <InfoItem label="Year of Study" value={application.year_of_study} />
            <InfoItem label="Course" value={application.course} />
            <InfoItem label="Student Number" value={application.student_number} />
          </div>
        </div>
      )}

      {/* Professional Information */}
      {!isStudent && application.company_name && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Employment Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem label="Employment Type" value={application.employment_type} />
            <InfoItem
              label="Employment Start Date"
              value={application.employment_start_date ? new Date(application.employment_start_date).toLocaleDateString('en-GB') : '-'}
            />
            <InfoItem label="Company Name" value={application.company_name} />
            <div className="md:col-span-2">
              <AddressItem label="Company Address" value={application.company_address} />
            </div>
          </div>

          <div className="border-t border-gray-200 mt-4 pt-4">
            <h3 className="font-semibold text-gray-900 mb-3">Employment Reference Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoItem label="Contact Name" value={application.contact_name} />
              <InfoItem label="Contact Job Title" value={application.contact_job_title} />
              <InfoItem label="Contact Email" value={application.contact_email} />
              <InfoItem label="Contact Phone" value={application.contact_phone} />
            </div>
          </div>
        </div>
      )}

      {/* Guarantor Information */}
      {application.guarantor_name && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Guarantor Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem label="Guarantor Name" value={application.guarantor_name} />
            <InfoItem
              label="Date of Birth"
              value={application.guarantor_dob ? new Date(application.guarantor_dob).toLocaleDateString('en-GB') : '-'}
            />
            <InfoItem label="Relationship" value={application.guarantor_relationship} />
            <InfoItem label="Email" value={application.guarantor_email} />
            <InfoItem label="Phone" value={application.guarantor_phone} />
            <div className="md:col-span-2">
              <AddressItem label="Address" value={application.guarantor_address} />
            </div>
            {application.guarantor_id_type && (
              <InfoItem
                label="ID Type"
                value={application.guarantor_id_type}
              />
            )}
          </div>
        </div>
      )}

      {/* Guarantor Workflow */}
      {application.guarantor_required && application.guarantor_token && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Guarantor Workflow</h2>

          {/* Guarantor Status */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-500">Status:</span>
              {application.guarantor_completed_at ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                  Completed
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-800">
                  Awaiting Guarantor
                </span>
              )}
            </div>

            {application.guarantor_completed_at && (
              <div className="mb-2">
                <span className="text-sm font-medium text-gray-500">Completed: </span>
                <span className="text-sm text-gray-900">
                  {new Date(application.guarantor_completed_at).toLocaleDateString('en-GB')} at{' '}
                  {new Date(application.guarantor_completed_at).toLocaleTimeString('en-GB')}
                </span>
              </div>
            )}

            {application.guarantor_signature_name && (
              <div className="mb-2">
                <span className="text-sm font-medium text-gray-500">Signature: </span>
                <span className="text-sm text-gray-900">{application.guarantor_signature_name}</span>
              </div>
            )}
          </div>

          {/* Guarantor Link */}
          {!application.guarantor_completed_at && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Guarantor Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/${agencySlug}/guarantor/${application.guarantor_token}`}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap"
                  >
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500">Token Expires: </span>
                <span className="text-sm text-gray-900">
                  {application.guarantor_token_expires_at
                    ? new Date(application.guarantor_token_expires_at).toLocaleDateString('en-GB')
                    : '-'}
                </span>
                {application.guarantor_token_expires_at &&
                 new Date(application.guarantor_token_expires_at) < new Date() && (
                  <span className="ml-2 text-sm text-red-600 font-semibold">
                    (Expired)
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleRegenerateToken}
                  disabled={regenerating}
                  className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {regenerating ? 'Regenerating...' : 'Regenerate Link & Resend Email'}
                </button>
              </div>

              <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-3">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> The guarantor will receive an email with the link above.
                  You can copy this link to send via other means if needed. Regenerating will
                  invalidate the old link and send a new email.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Declaration */}
      {application.declaration_name && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Declaration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem label="Signed Name" value={application.declaration_name} />
            <InfoItem
              label="Agreement"
              value={application.declaration_agreed ? 'Agreed' : 'Not Agreed'}
            />
          </div>
        </div>
      )}

      {/* ID Documents */}
      {(applicantIdUploaded || (application.guarantor_required && guarantorIdUploaded)) && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">ID Documents</h2>

          <div className="space-y-4">
            {/* Applicant ID */}
            {applicantIdUploaded && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Applicant ID Document</h3>
                <button
                  onClick={() => handleViewIdDocument('applicant_id')}
                  className="inline-flex items-center gap-2 text-primary hover:text-primary-dark font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View/Download Applicant ID
                </button>
              </div>
            )}

            {/* Guarantor ID */}
            {application.guarantor_required && guarantorIdUploaded && (
              <div className={applicantIdUploaded ? "pt-4 border-t border-gray-200" : ""}>
                <h3 className="font-semibold text-gray-900 mb-2">Guarantor ID Document</h3>
                <button
                  onClick={() => handleViewIdDocument('guarantor_id')}
                  className="inline-flex items-center gap-2 text-primary hover:text-primary-dark font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View/Download Guarantor ID
                </button>
              </div>
            )}

            <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-3">
              <p className="text-sm text-blue-900">
                <strong>Security:</strong> ID documents are encrypted at rest using AES-256-GCM encryption.
                Files are decrypted on-the-fly when accessed. Only authorized users can view these documents.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Admin Actions</h2>

        {/* Approval Notice for Submitted Applications */}
        {application.status === 'submitted' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-800 text-sm">
              <strong>Review Required:</strong> This application has been submitted by the applicant and is awaiting your review.
              {holdingDepositEnabled && existingDeposit?.status === 'awaiting_payment'
                ? ' The holding deposit must be recorded as paid before you can approve.'
                : ' Once you have reviewed it, click "Approve Application" to allow them to sign their tenancy agreement.'}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          {/* Record Payment Button — when deposit exists and is awaiting payment (any application status) */}
          {existingDeposit?.status === 'awaiting_payment' && (
            <button
              onClick={handleRecordPayment}
              className="inline-flex items-center bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Record Deposit Payment
            </button>
          )}

          {/* Approve Button - Only for submitted applications */}
          {application.status === 'submitted' && (
            <button
              onClick={handleApproveClick}
              disabled={approving || (holdingDepositEnabled && (existingDeposit?.status === 'awaiting_payment' || depositLoadFailed))}
              title={holdingDepositEnabled && depositLoadFailed ? 'Failed to load deposit info — please refresh' : holdingDepositEnabled && existingDeposit?.status === 'awaiting_payment' ? 'Record the holding deposit payment first' : undefined}
              className="inline-flex items-center bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {approving ? 'Approving...' : 'Approve Application'}
            </button>
          )}

          {/* Create Tenancy - Only for approved applications */}
          {application.status === 'approved' && onNavigate && (
            <button
              onClick={() => onNavigate('tenancies', { action: 'new', id: id })}
              className="inline-flex items-center bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Tenancy
            </button>
          )}

          {/* PDF Generation - For submitted, approved, or converted applications */}
          {['submitted', 'approved', 'converted_to_tenancy'].includes(application.status) && (
            <button
              onClick={handleGeneratePDF}
              className="inline-flex items-center bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Generate PDF
            </button>
          )}

          {application.status !== 'converted_to_tenancy' && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {deleting ? 'Deleting...' : 'Delete Application'}
            </button>
          )}
        </div>
      </div>

      {/* Approval Checklist Modal */}
      <ApprovalChecklistModal
        isOpen={showApprovalChecklist}
        onClose={() => setShowApprovalChecklist(false)}
        onConfirm={handleApproveConfirm}
        isLoading={approving}
        guarantorRequired={application?.guarantor_required ?? false}
      />

      {/* Holding Deposit Modal */}
      {showHoldingDepositModal && application && (
        <HoldingDepositApprovalModal
          applicationId={parseInt(id)}
          existingDeposit={existingDeposit}
          onClose={() => setShowHoldingDepositModal(false)}
          onSuccess={handleHoldingDepositSuccess}
        />
      )}
    </div>
  );
}

// Helper component for displaying info items
function InfoItem({ label, value }: { label: string; value: string | number | undefined | null }) {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-500 mb-1">{label}</dt>
      <dd className="text-sm text-gray-900">{value || '-'}</dd>
    </div>
  );
}

// Helper component for displaying multi-line addresses
function AddressItem({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-500 mb-1">{label}</dt>
      <dd className="text-sm text-gray-900 whitespace-pre-line">{value || '-'}</dd>
    </div>
  );
}
