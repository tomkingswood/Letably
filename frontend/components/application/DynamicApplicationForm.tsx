'use client';

import { useState, useEffect, useMemo } from 'react';
import { applications } from '@/lib/api';
import { QuestionDefinition, ApplicationFormData, IdDocumentStatus } from '@/lib/types';
import { getErrorMessage } from '@/lib/types';
import FormSection from './FormSection';
import AddressHistorySection from './AddressHistorySection';
import IdDocumentSection from './IdDocumentSection';
import GuarantorSection from './GuarantorSection';
import DeclarationSection from './DeclarationSection';

interface AddressHistoryEntry {
  residential_status: string;
  residential_status_other?: string;
  period_years: number;
  period_months: number;
  address: string;
}

interface DynamicApplicationFormProps {
  applicationId: string;
  applicationType: 'student' | 'professional';
  guarantorRequired: boolean;
  initialFormData: Record<string, unknown>;
  initialAddressHistory: AddressHistoryEntry[];
  disabled: boolean;
  // ID document props
  idDocumentUploaded: boolean;
  idDocumentInfo: IdDocumentStatus | null;
  uploadingId: boolean;
  onIdFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onIdView: () => void;
  onIdDelete: () => void;
  isPending: boolean;
  // Callbacks
  onFormDataChange: (data: Record<string, unknown>) => void;
  onAddressHistoryChange: (history: AddressHistoryEntry[]) => void;
  onSignatureErrorChange: (error: string) => void;
  signatureError: string;
  // Signature validation
  validateSignature: (signature: string) => boolean;
}

/**
 * Groups an ordered array of questions into sections, preserving order.
 */
function groupIntoSections(questions: QuestionDefinition[]) {
  const sections: { sectionKey: string; sectionLabel: string; questions: QuestionDefinition[] }[] = [];
  let current: (typeof sections)[0] | null = null;

  for (const q of questions) {
    if (!current || current.sectionKey !== q.section) {
      current = { sectionKey: q.section, sectionLabel: q.sectionLabel, questions: [] };
      sections.push(current);
    }
    current.questions.push(q);
  }

  return sections;
}

export default function DynamicApplicationForm({
  applicationId,
  applicationType,
  guarantorRequired,
  initialFormData,
  initialAddressHistory,
  disabled,
  idDocumentUploaded,
  idDocumentInfo,
  uploadingId,
  onIdFileChange,
  onIdView,
  onIdDelete,
  isPending,
  onFormDataChange,
  onAddressHistoryChange,
  onSignatureErrorChange,
  signatureError,
  validateSignature,
}: DynamicApplicationFormProps) {
  const [schema, setSchema] = useState<QuestionDefinition[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, unknown>>(initialFormData);
  const [addressHistory, setAddressHistory] = useState<AddressHistoryEntry[]>(initialAddressHistory);
  const [showRightToRentModal, setShowRightToRentModal] = useState(false);

  // Fetch the resolved form schema
  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const response = await applications.getFormConfig(applicationType);
        setSchema(response.data.schema);
      } catch (err: unknown) {
        console.error('Failed to load form config:', getErrorMessage(err));
        // On error, schema stays empty — sections won't render
      } finally {
        setSchemaLoading(false);
      }
    };
    fetchSchema();
  }, [applicationType]);

  // Propagate form data changes up
  const handleFieldChange = (key: string, value: string | number | boolean) => {
    const updated = { ...formData, [key]: value };
    setFormData(updated);
    onFormDataChange(updated);

    // Handle declaration name signature validation
    if (key === 'declaration_name') {
      const strVal = String(value).trim();
      if (strVal && formData.first_name && formData.surname) {
        if (!validateSignature(strVal)) {
          const expectedName = `${formData.first_name} ${formData.surname}`.toString().trim();
          onSignatureErrorChange(`Signature name must match "${expectedName}"`);
        } else {
          onSignatureErrorChange('');
        }
      } else {
        onSignatureErrorChange('');
      }
    }
  };

  // Handle native onChange events (for complex sections that use traditional onChange)
  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    handleFieldChange(name, type === 'checkbox' ? checked : value);
  };

  // Address history handlers
  const addAddressEntry = () => {
    const updated = [
      ...addressHistory,
      { residential_status: '', residential_status_other: '', period_years: 0, period_months: 0, address: '' },
    ];
    setAddressHistory(updated);
    onAddressHistoryChange(updated);
  };

  const removeAddressEntry = (index: number) => {
    const updated = addressHistory.filter((_, i) => i !== index);
    setAddressHistory(updated);
    onAddressHistoryChange(updated);
  };

  const updateAddressEntry = (index: number, field: string, value: string | number) => {
    const updated = addressHistory.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    );
    setAddressHistory(updated);
    onAddressHistoryChange(updated);
  };

  // Build the extended formData that includes guarantor_required (for dependsOn checks)
  const extendedFormData = useMemo(
    () => ({ ...formData, guarantor_required: guarantorRequired }),
    [formData, guarantorRequired]
  );

  // Group schema into sections
  const sections = useMemo(() => groupIntoSections(schema), [schema]);

  // Complex component registry
  const complexComponents: Record<string, React.ReactNode> = {
    AddressHistory: (
      <AddressHistorySection
        addressHistory={addressHistory}
        onAdd={addAddressEntry}
        onRemove={removeAddressEntry}
        onUpdate={updateAddressEntry}
        disabled={disabled}
      />
    ),
    IdDocument: (
      <IdDocumentSection
        isStudent={applicationType === 'student'}
        idType={String(formData.id_type ?? '')}
        onIdTypeChange={(val) => handleFieldChange('id_type', val)}
        idDocumentUploaded={idDocumentUploaded}
        idDocumentInfo={idDocumentInfo}
        uploadingId={uploadingId}
        onFileChange={onIdFileChange}
        onView={onIdView}
        onDelete={onIdDelete}
        isPending={isPending}
        disabled={disabled}
        onShowRightToRent={() => setShowRightToRentModal(true)}
      />
    ),
    GuarantorInfo: (
      <GuarantorSection
        formData={{
          guarantor_name: String(formData.guarantor_name ?? ''),
          guarantor_dob: String(formData.guarantor_dob ?? ''),
          guarantor_email: String(formData.guarantor_email ?? ''),
          guarantor_phone: String(formData.guarantor_phone ?? ''),
          guarantor_address: String(formData.guarantor_address ?? ''),
          guarantor_relationship: String(formData.guarantor_relationship ?? ''),
        }}
        onChange={handleNativeChange}
        disabled={disabled}
      />
    ),
    Declaration: (
      <DeclarationSection
        declarationName={String(formData.declaration_name ?? '')}
        declarationAgreed={Boolean(formData.declaration_agreed)}
        signatureError={signatureError}
        onDeclarationNameChange={(val) => handleFieldChange('declaration_name', val)}
        onDeclarationAgreedChange={(val) => handleFieldChange('declaration_agreed', val)}
        disabled={disabled}
      />
    ),
  };

  if (schemaLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <p className="text-gray-600">Loading form...</p>
      </div>
    );
  }

  return (
    <>
      {/* Application Details (always shown, read-only) */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Application Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Application Type:</span>{' '}
            {applicationType === 'student' ? 'Student' : 'Professional'}
          </div>
          <div>
            <span className="font-medium">Guarantor Required:</span>{' '}
            {guarantorRequired ? 'Yes' : 'No'}
          </div>
        </div>
      </div>

      {/* Render each section dynamically */}
      {sections.map((section) => (
        <FormSection
          key={section.sectionKey}
          sectionLabel={section.sectionLabel}
          questions={section.questions}
          formData={extendedFormData}
          onChange={handleFieldChange}
          disabled={disabled}
          complexComponents={complexComponents}
        />
      ))}

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
                  From 1st February 2016, landlords and letting agents in England are required to check the immigration status of all adult tenants before they agree to enter into a tenancy agreement. This is to establish you have a &apos;right to rent&apos; legally in the UK.
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
    </>
  );
}
