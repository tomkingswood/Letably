'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { tenancies as tenanciesApi, bedrooms as bedroomsApi, properties as propertiesApi, holdingDeposits, certificates as certificatesApi } from '@/lib/api';
import type { Bedroom, Property, ApprovedApplicant, HoldingDeposit } from '@/lib/types';
import { getErrorMessage } from '@/lib/types';

interface MemberForm {
  application_id: number;
  applicant_name: string;
  email: string;
  application_type: 'student' | 'professional';
  bedroom_id: string;
  rent_pppw: string;
  deposit_amount: string;
  holding_deposit?: HoldingDeposit | null;
  holding_deposit_apply_to?: 'first_rent' | 'tenancy_deposit' | 'none';
}

interface CreateTenancyViewProps {
  onBack: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
  preSelectedApplicationId?: number;
}

type Step = 'property' | 'applicants' | 'configure';

export default function CreateTenancyView({ onBack, onSuccess, onError, preSelectedApplicationId }: CreateTenancyViewProps) {
  // Step state
  const [currentStep, setCurrentStep] = useState<Step>('property');

  // Data state
  const [properties, setProperties] = useState<Property[]>([]);
  const [approvedApplicants, setApprovedApplicants] = useState<ApprovedApplicant[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedApplicantIds, setSelectedApplicantIds] = useState<number[]>([]);
  const [propertyRooms, setPropertyRooms] = useState<Bedroom[]>([]);

  // Form state
  const [tenancyType, setTenancyType] = useState<'room_only' | 'whole_house'>('room_only');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [autoGeneratePayments, setAutoGeneratePayments] = useState(true);
  const [memberForms, setMemberForms] = useState<MemberForm[]>([]);

  // Compliance state
  const [complianceIssues, setComplianceIssues] = useState<{ type_name: string; reason: string; scope?: string }[]>([]);
  const [checkingCompliance, setCheckingCompliance] = useState(false);

  // Search/filter state
  const [propertySearch, setPropertySearch] = useState('');
  const [applicantSearch, setApplicantSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [propertiesRes, applicantsRes] = await Promise.all([
        propertiesApi.getAll(),
        tenanciesApi.getApprovedApplicants()
      ]);
      setProperties(propertiesRes.data.properties || []);
      setApprovedApplicants(applicantsRes.data.applicants || []);
    } catch (err: unknown) {
      onError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Pre-populate property and applicant when coming from an approved application
  useEffect(() => {
    if (loading || !preSelectedApplicationId) return;
    if (selectedApplicantIds.includes(preSelectedApplicationId) || selectedPropertyId) return;

    const applicant = approvedApplicants.find(a => a.id === preSelectedApplicationId);
    if (!applicant) return;

    // Pre-select the applicant
    setSelectedApplicantIds([preSelectedApplicationId]);

    // Try to find a property from the holding deposit
    const prePopulate = async () => {
      try {
        const res = await holdingDeposits.getByApplication(preSelectedApplicationId);
        const deposit = res.data?.deposit;
        if (deposit?.property_id) {
          const property = properties.find(p => p.id === deposit.property_id);
          if (property) {
            setSelectedPropertyId(deposit.property_id);
            setSelectedProperty(property);
            try {
              const bedroomsRes = await bedroomsApi.getByProperty(deposit.property_id);
              setPropertyRooms(bedroomsRes.data.bedrooms || []);
            } catch {
              setPropertyRooms([]);
            }
            // Land on applicants step so user can add more applicants
            setCurrentStep('applicants');
            return;
          }
        }
      } catch {
        // No deposit, that's fine
      }
      // No property from deposit — still land on property step with applicant pre-selected
    };

    prePopulate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, preSelectedApplicationId, approvedApplicants, properties]);

  const handlePropertySelect = async (propertyId: number) => {
    setSelectedPropertyId(propertyId);
    const property = properties.find(p => p.id === propertyId);
    setSelectedProperty(property || null);
    setComplianceIssues([]);
    setCheckingCompliance(true);

    try {
      // Fetch bedrooms and check compliance in parallel
      const [bedroomsRes, complianceRes] = await Promise.all([
        bedroomsApi.getByProperty(propertyId),
        certificatesApi.checkPropertyCompliance(propertyId),
      ]);

      setPropertyRooms(bedroomsRes.data.bedrooms || []);

      const issues = complianceRes.data.issues || [];
      setComplianceIssues(issues);

      if (issues.length === 0) {
        setCurrentStep('applicants');
      }
      // If issues exist, stay on property step — warning will show
    } catch (err: unknown) {
      console.error('Error during property selection:', err);
      setPropertyRooms([]);
      // Don't block on compliance check failure — proceed
      setCurrentStep('applicants');
    } finally {
      setCheckingCompliance(false);
    }
  };

  const handleApplicantToggle = (applicantId: number) => {
    if (selectedApplicantIds.includes(applicantId)) {
      setSelectedApplicantIds(selectedApplicantIds.filter(id => id !== applicantId));
    } else {
      setSelectedApplicantIds([...selectedApplicantIds, applicantId]);
    }
  };

  const handleProceedToConfigure = async () => {
    if (selectedApplicantIds.length === 0) {
      onError('Please select at least one applicant');
      return;
    }

    // Determine tenancy type based on number of applicants
    const type = selectedApplicantIds.length === 1 ? 'room_only' : 'whole_house';
    setTenancyType(type);

    // Initialize member forms
    const selectedApps = approvedApplicants.filter(app =>
      selectedApplicantIds.includes(app.id)
    );

    const initializedForms: MemberForm[] = selectedApps.map(app => ({
      application_id: app.id,
      applicant_name: `${app.first_name} ${app.last_name}`,
      email: app.email,
      application_type: app.application_type,
      bedroom_id: '',
      rent_pppw: '',
      deposit_amount: '200',
      holding_deposit: null,
      holding_deposit_apply_to: 'none',
    }));

    // Fetch holding deposit info for each applicant
    for (let i = 0; i < initializedForms.length; i++) {
      try {
        const res = await holdingDeposits.getByApplication(initializedForms[i].application_id);
        if (res.data?.deposit && res.data.deposit.status === 'held') {
          initializedForms[i].holding_deposit = res.data.deposit;
          initializedForms[i].holding_deposit_apply_to = 'tenancy_deposit';
        }
      } catch {
        // No deposit found, that's fine
      }
    }

    setMemberForms(initializedForms);
    setCurrentStep('configure');
  };

  const handleMemberFormChange = (index: number, field: string, value: string) => {
    const newForms = [...memberForms];
    newForms[index] = { ...newForms[index], [field]: value };

    // Auto-fill rent when bedroom is selected
    if (field === 'bedroom_id' && value) {
      const selectedRoom = propertyRooms.find(room => room.id.toString() === value);
      if (selectedRoom && selectedRoom.price_pppw) {
        newForms[index].rent_pppw = selectedRoom.price_pppw.toString();
      }
    }

    setMemberForms(newForms);
  };

  const handleSubmitTenancy = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPropertyId || !startDate) {
      onError('Please fill in all required fields');
      return;
    }

    for (const form of memberForms) {
      if (!form.rent_pppw || !form.deposit_amount) {
        onError('Please fill in rent and deposit for all tenants');
        return;
      }
    }

    // Check for duplicate bedroom assignments
    const assignedBedroomIds = memberForms
      .map(form => form.bedroom_id)
      .filter(bedroomId => bedroomId && bedroomId !== '');

    if (assignedBedroomIds.length > 0) {
      const uniqueBedroomIds = new Set(assignedBedroomIds);
      if (uniqueBedroomIds.size !== assignedBedroomIds.length) {
        onError('Multiple tenants cannot be assigned to the same bedroom');
        return;
      }
    }

    if (endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end <= start) {
        onError('End date must be after start date');
        return;
      }
    }

    try {
      await tenanciesApi.create({
        property_id: selectedPropertyId,
        tenancy_type: tenancyType,
        start_date: startDate,
        end_date: endDate,
        status: 'pending',
        auto_generate_payments: autoGeneratePayments,
        members: memberForms.map(form => ({
          application_id: form.application_id,
          bedroom_id: form.bedroom_id ? parseInt(form.bedroom_id) : undefined,
          rent_pppw: parseFloat(form.rent_pppw),
          deposit_amount: parseFloat(form.deposit_amount),
          ...(form.holding_deposit && form.holding_deposit_apply_to !== 'none' ? {
            holding_deposit_id: form.holding_deposit.id,
            holding_deposit_apply_to: form.holding_deposit_apply_to,
          } : {}),
        }))
      });

      onSuccess();
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to create tenancy');
      onError(errorMessage);
    }
  };

  const handleBackToStep = (step: Step) => {
    setCurrentStep(step);
    if (step === 'property') {
      setSelectedPropertyId(null);
      setSelectedProperty(null);
      setSelectedApplicantIds([]);
      setPropertyRooms([]);
      setMemberForms([]);
    } else if (step === 'applicants') {
      setMemberForms([]);
    }
  };

  const handleCancel = () => {
    setSelectedPropertyId(null);
    setSelectedProperty(null);
    setSelectedApplicantIds([]);
    setPropertyRooms([]);
    setMemberForms([]);
    setStartDate('');
    setEndDate('');
    setAutoGeneratePayments(true);
    setCurrentStep('property');
    onBack();
  };

  // Filter properties by search
  const filteredProperties = properties.filter(p =>
    p.address_line1.toLowerCase().includes(propertySearch.toLowerCase()) ||
    p.location?.toLowerCase().includes(propertySearch.toLowerCase())
  );

  // Filter applicants by search
  const filteredApplicants = approvedApplicants.filter(app =>
    `${app.first_name} ${app.last_name}`.toLowerCase().includes(applicantSearch.toLowerCase()) ||
    app.email.toLowerCase().includes(applicantSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-gray-600 mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleCancel}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to List
        </button>
        <h2 className="text-2xl font-bold text-gray-900">Create New Tenancy</h2>
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center">
          {/* Step 1 */}
          <div className={`flex items-center ${currentStep === 'property' ? 'text-primary' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              currentStep === 'property' ? 'bg-primary text-white' :
              selectedPropertyId ? 'bg-green-500 text-white' : 'bg-gray-200'
            }`}>
              {selectedPropertyId && currentStep !== 'property' ? '✓' : '1'}
            </div>
            <span className="ml-2 font-medium">Select Property</span>
          </div>

          <div className="flex-1 h-1 mx-4 bg-gray-200">
            <div className={`h-full transition-all ${selectedPropertyId ? 'bg-green-500' : 'bg-gray-200'}`} style={{ width: selectedPropertyId ? '100%' : '0%' }}></div>
          </div>

          {/* Step 2 */}
          <div className={`flex items-center ${currentStep === 'applicants' ? 'text-primary' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              currentStep === 'applicants' ? 'bg-primary text-white' :
              selectedApplicantIds.length > 0 && currentStep === 'configure' ? 'bg-green-500 text-white' : 'bg-gray-200'
            }`}>
              {selectedApplicantIds.length > 0 && currentStep === 'configure' ? '✓' : '2'}
            </div>
            <span className="ml-2 font-medium">Select Applicants</span>
          </div>

          <div className="flex-1 h-1 mx-4 bg-gray-200">
            <div className={`h-full transition-all ${selectedApplicantIds.length > 0 && currentStep === 'configure' ? 'bg-green-500' : 'bg-gray-200'}`} style={{ width: currentStep === 'configure' ? '100%' : '0%' }}></div>
          </div>

          {/* Step 3 */}
          <div className={`flex items-center ${currentStep === 'configure' ? 'text-primary' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              currentStep === 'configure' ? 'bg-primary text-white' : 'bg-gray-200'
            }`}>
              3
            </div>
            <span className="ml-2 font-medium">Configure</span>
          </div>
        </div>
      </div>

      {/* Step 1: Property Selection */}
      {currentStep === 'property' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-4">Select a Property</h3>
          <p className="text-gray-600 mb-4">Choose the property for this tenancy:</p>

          {/* Search */}
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Search properties by address or location..."
              value={propertySearch}
              onChange={(e) => setPropertySearch(e.target.value)}
            />
          </div>

          {filteredProperties.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {properties.length === 0 ? 'No properties available' : 'No properties match your search'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto">
              {filteredProperties.map((property) => (
                <button
                  key={property.id}
                  onClick={() => handlePropertySelect(property.id)}
                  className="text-left p-4 border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <h4 className="font-semibold text-gray-900">{property.address_line1}</h4>
                  <p className="text-sm text-gray-600">{property.location}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {property.bedrooms?.length || 0} bedroom{(property.bedrooms?.length || 0) !== 1 ? 's' : ''}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Compliance Warning */}
          {checkingCompliance && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
              Checking property compliance...
            </div>
          )}

          {complianceIssues.length > 0 && !checkingCompliance && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="font-semibold text-red-800 mb-1">
                    Cannot create tenancy — compliance issues found
                  </h4>
                  <p className="text-sm text-red-700 mb-2">
                    The following compliance certificates must be resolved before a tenancy can be created:
                  </p>
                  {complianceIssues.some(i => i.scope === 'property') && (
                    <div className="mb-2">
                      <p className="text-sm font-medium text-red-800">Property — {selectedProperty?.address_line1}</p>
                      <ul className="list-disc list-inside text-sm text-red-700 space-y-1 ml-2">
                        {complianceIssues.filter(i => i.scope === 'property').map((issue, idx) => (
                          <li key={idx}>
                            <strong>{issue.type_name}</strong> — {issue.reason === 'missing' ? 'not uploaded' : 'expired'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {complianceIssues.some(i => i.scope === 'agency') && (
                    <div className="mb-2">
                      <p className="text-sm font-medium text-red-800">Agency Documents</p>
                      <ul className="list-disc list-inside text-sm text-red-700 space-y-1 ml-2">
                        {complianceIssues.filter(i => i.scope === 'agency').map((issue, idx) => (
                          <li key={idx}>
                            <strong>{issue.type_name}</strong> — {issue.reason === 'missing' ? 'not uploaded' : 'expired'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-sm text-red-600 mt-3">
                    Please upload the required certificates before creating a tenancy.
                  </p>
                  <button
                    onClick={() => { setComplianceIssues([]); setSelectedPropertyId(null); setSelectedProperty(null); }}
                    className="mt-3 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                  >
                    Select a different property
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Applicant Selection */}
      {currentStep === 'applicants' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold">Select Applicants</h3>
              <p className="text-gray-600">
                Property: <span className="font-medium text-gray-900">{selectedProperty?.address_line1}</span>
              </p>
            </div>
            <button
              onClick={() => handleBackToStep('property')}
              className="text-primary hover:text-primary-dark text-sm font-medium"
            >
              Change Property
            </button>
          </div>

          <p className="text-gray-600 mb-4">Select the approved applicants to include in this tenancy:</p>

          {/* Search */}
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Search applicants by name or email..."
              value={applicantSearch}
              onChange={(e) => setApplicantSearch(e.target.value)}
            />
          </div>

          {approvedApplicants.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-5xl mb-4">📝</div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Approved Applications</h4>
              <p className="text-gray-600">
                Applications must be approved before creating a tenancy. Go to Applications to review and approve submitted applications.
              </p>
            </div>
          ) : filteredApplicants.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No applicants match your search
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-[400px] overflow-y-auto mb-4">
                {filteredApplicants.map((app) => (
                  <label
                    key={app.id}
                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedApplicantIds.includes(app.id)
                        ? 'bg-primary/5 border-primary'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedApplicantIds.includes(app.id)}
                      onChange={() => handleApplicantToggle(app.id)}
                      className="mr-3 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">
                          {app.first_name} {app.last_name}
                        </p>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          app.application_type === 'student'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {app.application_type}
                        </span>
                        {app.guarantor_required && (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                            Guarantor
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{app.email}</p>
                    </div>
                  </label>
                ))}
              </div>

              {selectedApplicantIds.length > 0 && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold text-primary">{selectedApplicantIds.length}</span> applicant{selectedApplicantIds.length !== 1 ? 's' : ''} selected
                      {selectedApplicantIds.length === 1 && ' (Room Only Tenancy)'}
                      {selectedApplicantIds.length >= 2 && ' (Whole House Tenancy)'}
                    </p>
                    <Button onClick={handleProceedToConfigure}>
                      Continue to Configure
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 3: Configure Tenancy */}
      {currentStep === 'configure' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold">
                Configure {tenancyType === 'room_only' ? 'Room Only' : 'Whole House'} Tenancy
              </h3>
              <p className="text-gray-600">
                Property: <span className="font-medium text-gray-900">{selectedProperty?.address_line1}</span>
              </p>
            </div>
            <button
              onClick={() => handleBackToStep('applicants')}
              className="text-primary hover:text-primary-dark text-sm font-medium"
            >
              Change Applicants
            </button>
          </div>

          <form onSubmit={handleSubmitTenancy} className="space-y-6">
            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
              <div>
                <Input
                  label="End Date (Optional)"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty if no termination date has been set.</p>
              </div>
            </div>

            {/* Member Forms */}
            <div>
              <h4 className="text-lg font-bold mb-3">Tenant Details</h4>
              <div className="space-y-4">
                {memberForms.map((form, index) => (
                  <div key={form.application_id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h5 className="font-medium">{form.applicant_name}</h5>
                        <p className="text-sm text-gray-500">{form.email}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        form.application_type === 'student'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {form.application_type}
                      </span>
                    </div>
                    {/* Holding Deposit Banner */}
                    {form.holding_deposit && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-blue-800">
                              Holding deposit of &pound;{Number(form.holding_deposit.amount).toFixed(2)}{form.holding_deposit.status === 'held' && form.holding_deposit.date_received ? ` recorded on ${new Date(form.holding_deposit.date_received).toLocaleDateString('en-GB')}` : form.holding_deposit.status === 'awaiting_payment' ? ' (awaiting payment)' : ` (${form.holding_deposit.status.replace(/_/g, ' ')})`}
                            </p>
                            {form.holding_deposit.payment_reference && (
                              <p className="text-xs text-blue-600 mt-0.5">Ref: {form.holding_deposit.payment_reference}</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-blue-700 mb-1">Apply holding deposit to:</label>
                          <select
                            value={form.holding_deposit_apply_to || 'none'}
                            onChange={(e) => handleMemberFormChange(index, 'holding_deposit_apply_to', e.target.value)}
                            className="text-sm px-3 py-1.5 border border-blue-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                          >
                            <option value="tenancy_deposit">Tenancy deposit</option>
                            <option value="first_rent">First month&apos;s rent</option>
                            <option value="none">Don&apos;t apply</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bedroom (Optional)</label>
                        <select
                          value={form.bedroom_id}
                          onChange={(e) => handleMemberFormChange(index, 'bedroom_id', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          <option value="">No bedroom assigned</option>
                          {propertyRooms.map((room) => (
                            <option key={room.id} value={room.id}>{room.bedroom_name}</option>
                          ))}
                        </select>
                      </div>
                      <Input
                        label="Rent (£ PPPW)"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.rent_pppw}
                        onChange={(e) => handleMemberFormChange(index, 'rent_pppw', e.target.value)}
                        required
                      />
                      <Input
                        label="Deposit (£)"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.deposit_amount}
                        onChange={(e) => handleMemberFormChange(index, 'deposit_amount', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button type="submit">Create Tenancy</Button>
              <Button type="button" variant="outline" onClick={() => handleBackToStep('applicants')}>
                Back
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
