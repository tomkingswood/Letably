'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import UserEmailLookup from '@/components/admin/UserEmailLookup';
import { tenancies as tenanciesApi, properties as propertiesApi, bedrooms as bedroomsApi, auth } from '@/lib/api';
import { getErrorMessage } from '@/lib/types';

interface Property {
  id: number;
  address_line1: string;
  location: string;
}

interface Bedroom {
  id: number;
  bedroom_name: string;
  price_pppw: number | null;
}

interface UserData {
  userId: number | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  isNewUser: boolean;
  sendWelcomeEmail: boolean;
}

interface MemberForm {
  userData: UserData | null;
  bedroom_id: string;
  rent_pppw: string;
  deposit_amount: string;
}

interface CreateMigrationTenancyViewProps {
  onBack: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export default function CreateMigrationTenancyView({ onBack, onSuccess, onError }: CreateMigrationTenancyViewProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyRooms, setPropertyRooms] = useState<Bedroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);
  const [tenancyType, setTenancyType] = useState<'room_only' | 'whole_house'>('room_only');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isRollingMonthly, setIsRollingMonthly] = useState(false);
  const [autoGeneratePayments, setAutoGeneratePayments] = useState(true);
  const [sendPortalAccessEmail, setSendPortalAccessEmail] = useState(false);
  const [memberForms, setMemberForms] = useState<MemberForm[]>([{
    userData: null,
    bedroom_id: '',
    rent_pppw: '',
    deposit_amount: '200',
  }]);

  // Under-occupancy warning state
  const [showUnderOccupancyWarning, setShowUnderOccupancyWarning] = useState(false);
  const [underOccupancyConfirmed, setUnderOccupancyConfirmed] = useState(false);

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      fetchRooms(selectedProperty);
    } else {
      setPropertyRooms([]);
    }
  }, [selectedProperty]);

  const fetchProperties = async () => {
    try {
      const res = await propertiesApi.getAll();
      setProperties(res.data.properties || []);
    } catch (err: unknown) {
      onError('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async (propertyId: number) => {
    try {
      const res = await bedroomsApi.getByProperty(propertyId);
      setPropertyRooms(res.data.bedrooms || []);
    } catch (err: unknown) {
      console.error('Failed to load bedrooms:', err);
      setPropertyRooms([]);
    }
  };

  // Handle user data changes from UserEmailLookup for each member
  const handleUserChange = useCallback((index: number, userData: UserData) => {
    setMemberForms(prevForms => {
      const newForms = [...prevForms];
      newForms[index] = { ...newForms[index], userData };
      return newForms;
    });
  }, []);

  const handleMemberFormChange = (index: number, field: string, value: string | boolean) => {
    const newForms = [...memberForms];
    newForms[index] = { ...newForms[index], [field]: value };

    if (field === 'bedroom_id' && value) {
      const selectedRoom = propertyRooms.find(room => room.id.toString() === value);
      if (selectedRoom && selectedRoom.price_pppw) {
        newForms[index].rent_pppw = selectedRoom.price_pppw.toString();
      }
    }

    setMemberForms(newForms);
  };

  const addMember = () => {
    setMemberForms([...memberForms, {
      userData: null,
      bedroom_id: '',
      rent_pppw: '',
      deposit_amount: '200',
    }]);
    setUnderOccupancyConfirmed(false); // Reset confirmation when tenant count changes
  };

  const removeMember = (index: number) => {
    if (memberForms.length === 1) return;
    setMemberForms(memberForms.filter((_, i) => i !== index));
    setUnderOccupancyConfirmed(false); // Reset confirmation when tenant count changes
  };

  const handleConfirmUnderOccupancy = () => {
    setUnderOccupancyConfirmed(true);
    setShowUnderOccupancyWarning(false);
    // Re-trigger form submission after state update
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        form.requestSubmit();
      }
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProperty) {
      onError('Please select a property');
      return;
    }

    if (!startDate) {
      onError('Please enter a start date');
      return;
    }

    if (!isRollingMonthly && !endDate) {
      onError('Please enter an end date for fixed-term tenancies');
      return;
    }

    // Validate all members
    for (let i = 0; i < memberForms.length; i++) {
      const member = memberForms[i];
      if (!member.userData || !member.userData.email) {
        onError(`Tenant ${i + 1}: Please enter an email address`);
        return;
      }
      if (member.userData.isNewUser && (!member.userData.firstName || !member.userData.lastName)) {
        onError(`Tenant ${i + 1}: First name and last name are required for new users`);
        return;
      }
      if (!member.rent_pppw || !member.deposit_amount) {
        onError(`Tenant ${i + 1}: Rent and deposit are required`);
        return;
      }
    }

    // Validate no duplicate bedrooms
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

    // Validate tenant count vs room count for whole house tenancies
    if (tenancyType === 'whole_house' && propertyRooms.length > 0) {
      const tenantCount = memberForms.length;
      const roomCount = propertyRooms.length;

      // Block if more tenants than rooms
      if (tenantCount > roomCount) {
        onError(`Cannot add ${tenantCount} tenants - this property only has ${roomCount} bedroom${roomCount !== 1 ? 's' : ''}. Please remove ${tenantCount - roomCount} tenant${tenantCount - roomCount !== 1 ? 's' : ''}.`);
        return;
      }

      // Warn if fewer tenants than rooms (but allow with confirmation)
      if (tenantCount < roomCount && !underOccupancyConfirmed) {
        setShowUnderOccupancyWarning(true);
        return;
      }
    }

    setSubmitting(true);

    try {
      // Step 1: Create user accounts for new users
      const memberUserIds: { index: number; user_id: number }[] = [];

      for (let i = 0; i < memberForms.length; i++) {
        const member = memberForms[i];
        const userData = member.userData!;

        if (userData.isNewUser) {
          // Create new user account
          const userRes = await auth.adminCreateUser({
            email: userData.email,
            first_name: userData.firstName,
            last_name: userData.lastName,
            phone: userData.phone || undefined,
          });
          memberUserIds.push({ index: i, user_id: userRes.data.user.id });
        } else {
          memberUserIds.push({ index: i, user_id: userData.userId! });
        }
      }

      // Step 2: Create the migration tenancy
      const membersPayload = memberForms.map((member, index) => {
        const userIdEntry = memberUserIds.find(m => m.index === index);
        const userData = member.userData!;
        return {
          user_id: userIdEntry!.user_id,
          first_name: userData.firstName,
          surname: userData.lastName,
          bedroom_id: member.bedroom_id ? parseInt(member.bedroom_id) : undefined,
          rent_pppw: parseFloat(member.rent_pppw),
          deposit_amount: parseFloat(member.deposit_amount),
        };
      });

      await tenanciesApi.createMigration({
        property_id: selectedProperty,
        tenancy_type: tenancyType,
        start_date: startDate,
        end_date: isRollingMonthly ? undefined : endDate,
        is_rolling_monthly: isRollingMonthly,
        auto_generate_payments: autoGeneratePayments,
        send_portal_email: sendPortalAccessEmail,
        members: membersPayload,
      });

      onSuccess();
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to create migration tenancy');
      onError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

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
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to List
        </button>
        <h2 className="text-2xl font-bold text-gray-900">Migration Tenancy</h2>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">⚠️</div>
          <div>
            <h3 className="text-lg font-bold text-amber-800 mb-2">Migration Mode</h3>
            <p className="text-amber-700 mb-2">
              This creates a tenancy <strong>without</strong> requiring an application or digital signatures.
              Use this only for migrating existing tenancies where paperwork was completed manually.
            </p>
            <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
              <li>Tenancy will start directly as <strong>Active</strong></li>
              <li>No application record will be linked</li>
              <li>No digital agreement signatures will be collected</li>
              <li>Payment schedules will be generated immediately</li>
              <li>New user accounts will be created for tenants (if needed)</li>
            </ul>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Property Selection */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4">Property</h3>
          <select
            value={selectedProperty || ''}
            onChange={(e) => setSelectedProperty(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            required
          >
            <option value="">Select a property...</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.address_line1} - {property.location}
              </option>
            ))}
          </select>
        </div>

        {/* Tenancy Type */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4">Tenancy Type</h3>
          <div className="flex gap-4">
            <label className={`flex-1 p-4 border-2 rounded-lg cursor-pointer transition-colors ${tenancyType === 'room_only' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
              <input
                type="radio"
                name="tenancyType"
                value="room_only"
                checked={tenancyType === 'room_only'}
                onChange={(e) => {
                  setTenancyType('room_only');
                  // Reset to single member if selecting room_only
                  if (memberForms.length > 1) {
                    setMemberForms([memberForms[0]]);
                  }
                }}
                className="sr-only"
              />
              <div className="font-medium">Room Only</div>
              <div className="text-sm text-gray-600">Single tenant in a shared house</div>
            </label>
            <label className={`flex-1 p-4 border-2 rounded-lg cursor-pointer transition-colors ${tenancyType === 'whole_house' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
              <input
                type="radio"
                name="tenancyType"
                value="whole_house"
                checked={tenancyType === 'whole_house'}
                onChange={(e) => setTenancyType('whole_house')}
                className="sr-only"
              />
              <div className="font-medium">Whole House</div>
              <div className="text-sm text-gray-600">Multiple tenants sharing the property</div>
            </label>
          </div>

          {/* Rolling Monthly Toggle */}
          <div className="mt-4 pt-4 border-t">
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
                <p className="text-sm text-gray-600">
                  No fixed end date - continues indefinitely until terminated.
                </p>
              </div>
            </div>

            {isRollingMonthly && (
              <div className="mt-3 ml-7">
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
        </div>

        {/* Dates */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4">Tenancy Dates</h3>
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
        </div>

        {/* Tenants */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Tenants</h3>
            {tenancyType === 'whole_house' && (
              <button
                type="button"
                onClick={addMember}
                className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary/90"
              >
                + Add Tenant
              </button>
            )}
          </div>

          <div className="space-y-6">
            {memberForms.map((member, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">Tenant {index + 1}</h4>
                  {memberForms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMember(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* User Selection with Email Lookup */}
                <div className="mb-4">
                  <UserEmailLookup
                    onUserChange={(userData) => handleUserChange(index, userData)}
                    phoneRequired={false}
                    label="Tenant"
                    disabled={submitting}
                  />
                </div>

                {/* Room and Financial Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bedroom (Optional)</label>
                    <select
                      value={member.bedroom_id}
                      onChange={(e) => handleMemberFormChange(index, 'bedroom_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      disabled={!selectedProperty}
                    >
                      <option value="">No bedroom assigned</option>
                      {propertyRooms.map((room) => (
                        <option key={room.id} value={room.id.toString()}>{room.bedroom_name}</option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Rent (£ PPPW)"
                    type="number"
                    step="0.01"
                    min="0"
                    value={member.rent_pppw}
                    onChange={(e) => handleMemberFormChange(index, 'rent_pppw', e.target.value)}
                    required
                  />
                  <Input
                    label="Deposit (£)"
                    type="number"
                    step="0.01"
                    min="0"
                    value={member.deposit_amount}
                    onChange={(e) => handleMemberFormChange(index, 'deposit_amount', e.target.value)}
                    required
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notification Options */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4">Notifications</h3>
          <div className="flex items-start">
            <input
              type="checkbox"
              id="sendPortalAccessEmail"
              checked={sendPortalAccessEmail}
              onChange={(e) => setSendPortalAccessEmail(e.target.checked)}
              className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <div className="ml-3">
              <label htmlFor="sendPortalAccessEmail" className="font-medium text-gray-900 cursor-pointer">
                Send portal access email to all tenants
              </label>
              <p className="text-sm text-gray-600">
                Notify tenants that their tenancy has been set up in our system. Tenants without a password will be
                reminded to complete their account setup before accessing the portal.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Migration Tenancy'}
          </Button>
          <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </form>

      {/* Under-Occupancy Warning Dialog */}
      {showUnderOccupancyWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Under-Occupancy Warning</h3>
                <p className="text-gray-600 mt-1">
                  You are adding <strong>{memberForms.length} tenant{memberForms.length !== 1 ? 's' : ''}</strong> to a property with <strong>{propertyRooms.length} bedrooms</strong>.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-amber-800">
                This means {propertyRooms.length - memberForms.length} bedroom{propertyRooms.length - memberForms.length !== 1 ? 's' : ''} will be unoccupied.
                Are you sure you want to proceed with this configuration?
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowUnderOccupancyWarning(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmUnderOccupancy}
                className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
              >
                Yes, Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
