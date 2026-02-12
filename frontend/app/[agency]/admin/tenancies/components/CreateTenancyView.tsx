'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { tenancies as tenanciesApi, bedrooms as bedroomsApi, properties as propertiesApi } from '@/lib/api';
import type { Bedroom, Property, ApprovedApplicant } from '@/lib/types';
import { getErrorMessage } from '@/lib/types';

interface MemberForm {
  application_id: number;
  applicant_name: string;
  email: string;
  application_type: 'student' | 'professional';
  bedroom_id: string;
  rent_pppw: string;
  deposit_amount: string;
}

interface CreateTenancyViewProps {
  onBack: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

type Step = 'property' | 'applicants' | 'configure';

export default function CreateTenancyView({ onBack, onSuccess, onError }: CreateTenancyViewProps) {
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
  const [isRollingMonthly, setIsRollingMonthly] = useState(false);
  const [autoGeneratePayments, setAutoGeneratePayments] = useState(true);
  const [memberForms, setMemberForms] = useState<MemberForm[]>([]);

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

  const handlePropertySelect = async (propertyId: number) => {
    setSelectedPropertyId(propertyId);
    const property = properties.find(p => p.id === propertyId);
    setSelectedProperty(property || null);

    // Fetch bedrooms for the selected property
    try {
      const bedroomsRes = await bedroomsApi.getByProperty(propertyId);
      setPropertyRooms(bedroomsRes.data.bedrooms || []);
    } catch (err: unknown) {
      console.error('Error fetching bedrooms:', err);
      setPropertyRooms([]);
    }

    setCurrentStep('applicants');
  };

  const handleApplicantToggle = (applicantId: number) => {
    if (selectedApplicantIds.includes(applicantId)) {
      setSelectedApplicantIds(selectedApplicantIds.filter(id => id !== applicantId));
    } else {
      setSelectedApplicantIds([...selectedApplicantIds, applicantId]);
    }
  };

  const handleProceedToConfigure = () => {
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
      deposit_amount: '200'
    }));

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

    if (!isRollingMonthly && !endDate) {
      onError('Please fill in end date for fixed-term tenancies');
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

    if (!isRollingMonthly && endDate) {
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
        end_date: isRollingMonthly ? '' : endDate,
        status: 'pending',
        is_rolling_monthly: isRollingMonthly,
        auto_generate_payments: autoGeneratePayments,
        members: memberForms.map(form => ({
          application_id: form.application_id,
          bedroom_id: form.bedroom_id ? parseInt(form.bedroom_id) : undefined,
          rent_pppw: parseFloat(form.rent_pppw),
          deposit_amount: parseFloat(form.deposit_amount)
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
    setIsRollingMonthly(false);
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
            {/* Rolling Monthly Toggle */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="isRollingMonthly"
                  checked={isRollingMonthly}
                  onChange={(e) => {
                    setIsRollingMonthly(e.target.checked);
                    if (e.target.checked) setEndDate('');
                  }}
                  className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <div className="ml-3">
                  <label htmlFor="isRollingMonthly" className="font-medium text-gray-900 cursor-pointer">
                    Rolling Monthly Tenancy
                  </label>
                  <p className="text-sm text-gray-600 mt-1">
                    Enable for professional lets that continue indefinitely until manually terminated.
                  </p>
                </div>
              </div>

              {isRollingMonthly && (
                <div className="mt-3 ml-7 pt-3 border-t border-blue-200">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="autoGeneratePayments"
                      checked={autoGeneratePayments}
                      onChange={(e) => setAutoGeneratePayments(e.target.checked)}
                      className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <label htmlFor="autoGeneratePayments" className="ml-2 text-sm text-gray-700 cursor-pointer">
                      Auto-generate monthly payments
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
              {isRollingMonthly ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-500">
                    No fixed end date (Rolling)
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Set an end date later to terminate.</p>
                </div>
              ) : (
                <Input
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              )}
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
