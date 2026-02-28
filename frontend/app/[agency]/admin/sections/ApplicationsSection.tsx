'use client';

import { useState, useEffect, useRef } from 'react';
import { applications as applicationsApi, agencies, properties as propertiesApi, bedrooms as bedroomsApi } from '@/lib/api';
import { Application, getErrorMessage } from '@/lib/types';
import { getStatusBadge, getStatusLabel } from '@/lib/statusBadges';
import ApplicationDetailView from '../applications/ApplicationDetailView';
import { SectionProps } from './index';
import Button from '@/components/ui/Button';
import UserEmailLookup from '@/components/admin/UserEmailLookup';
import { MessageAlert } from '@/components/ui/MessageAlert';

interface UserData {
  userId: number | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  isNewUser: boolean;
}

interface SuccessData {
  applicationId: number;
  isNewUser: boolean;
  userEmail: string;
  userName: string;
  holdingDeposit?: { amount: number };
}

interface PropertyOption {
  id: number;
  address_line1: string;
  city?: string;
}

interface BedroomOption {
  id: number;
  bedroom_name: string;
  price_pppw?: number;
}

export default function ApplicationsSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [listMessage, setListMessage] = useState<string | null>(null);

  // Create form state
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [createFormData, setCreateFormData] = useState({
    application_type: 'student' as 'student' | 'professional',
    guarantor_required: true,
  });
  const [showConverted, setShowConverted] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Holding deposit state for create form
  const [holdingDepositEnabled, setHoldingDepositEnabled] = useState(false);
  const [depositType, setDepositType] = useState<string>('1_week_pppw');
  const [fixedAmount, setFixedAmount] = useState<number>(100);
  const [propertyOptions, setPropertyOptions] = useState<PropertyOption[]>([]);
  const [bedroomOptions, setBedroomOptions] = useState<BedroomOption[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | ''>('');
  const [selectedBedroomId, setSelectedBedroomId] = useState<number | ''>('');
  const [reservationDays, setReservationDays] = useState('');
  const [calculatedAmount, setCalculatedAmount] = useState<number | null>(null);

  const isCreateMode = action === 'new';
  const isViewMode = action === 'view' && !!itemId;

  useEffect(() => {
    fetchData();
  }, []);

  // Load settings and properties when entering create mode
  useEffect(() => {
    if (!isCreateMode) return;
    const loadCreateData = async () => {
      try {
        const [settingsRes, propsRes] = await Promise.all([
          agencies.getSettings(),
          propertiesApi.getAll(),
        ]);
        const s = settingsRes.data.settings || settingsRes.data;
        const enabled = s.holding_deposit_enabled === true || s.holding_deposit_enabled === 'true';
        setHoldingDepositEnabled(enabled);
        setDepositType(s.holding_deposit_type || '1_week_pppw');
        setFixedAmount(parseFloat(s.holding_deposit_amount) || 100);
        setPropertyOptions(propsRes.data.properties || []);
      } catch {
        // Non-critical, deposit section just won't show
      }
    };
    loadCreateData();
  }, [isCreateMode]);

  // Load bedrooms when property changes
  useEffect(() => {
    if (!selectedPropertyId) {
      setBedroomOptions([]);
      setSelectedBedroomId('');
      setCalculatedAmount(null);
      return;
    }
    const loadBedrooms = async () => {
      try {
        const res = await bedroomsApi.getByProperty(selectedPropertyId);
        setBedroomOptions(res.data.bedrooms || []);
      } catch {
        setBedroomOptions([]);
      }
    };
    loadBedrooms();
  }, [selectedPropertyId]);

  // Auto-calculate amount when bedroom changes
  useEffect(() => {
    if (depositType === '1_week_pppw' && selectedBedroomId) {
      const bed = bedroomOptions.find(b => b.id === selectedBedroomId);
      if (bed?.price_pppw) {
        setCalculatedAmount(parseFloat(String(bed.price_pppw)));
        return;
      }
    }
    if (depositType === 'fixed_amount') {
      setCalculatedAmount(parseFloat(String(fixedAmount)));
      return;
    }
    setCalculatedAmount(null);
  }, [selectedBedroomId, depositType, bedroomOptions, fixedAmount]);

  // Re-fetch when navigating back from detail view or create mode
  const wasViewMode = useRef(false);
  const wasCreateMode = useRef(false);
  useEffect(() => {
    if ((wasViewMode.current && !isViewMode) || (wasCreateMode.current && !isCreateMode)) {
      fetchData();
    }
    wasViewMode.current = isViewMode;
    wasCreateMode.current = isCreateMode;
  }, [isViewMode, isCreateMode]);

  const fetchData = async () => {
    try {
      const appsResponse = await applicationsApi.getAll();
      setApplications(appsResponse.data.applications || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create form handlers
  const handleCreateFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setCreateFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const resetCreateForm = () => {
    setUserData(null);
    setCreateFormData({ application_type: 'student', guarantor_required: true });
    setCreateError(null);
    setSuccessData(null);
    setCreating(false);
    setSelectedPropertyId('');
    setSelectedBedroomId('');
    setReservationDays('');
    setCalculatedAmount(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      if (!userData || !userData.email) {
        setCreateError('Please enter a valid email address');
        setCreating(false);
        return;
      }

      if (userData.isNewUser && (!userData.firstName || !userData.lastName)) {
        setCreateError('Please enter first name and last name for the new user');
        setCreating(false);
        return;
      }

      const data: Parameters<typeof applicationsApi.create>[0] = {
        user_id: userData.userId,
        email: userData.email,
        first_name: userData.firstName,
        last_name: userData.lastName,
        phone: userData.phone || undefined,
        is_new_user: userData.isNewUser,
        application_type: createFormData.application_type,
        guarantor_required: createFormData.guarantor_required,
      };

      // Add holding deposit fields if enabled
      if (holdingDepositEnabled && selectedPropertyId) {
        data.property_id = selectedPropertyId as number;
        if (selectedBedroomId) data.bedroom_id = selectedBedroomId as number;
        if (reservationDays && parseInt(reservationDays) > 0) {
          data.reservation_days = parseInt(reservationDays);
        }
      }

      const response = await applicationsApi.create(data);

      setSuccessData({
        applicationId: response.data.application_id,
        isNewUser: userData.isNewUser,
        userEmail: userData.email,
        userName: `${userData.firstName} ${userData.lastName}`,
        holdingDeposit: response.data.holding_deposit ? { amount: response.data.holding_deposit.amount } : undefined,
      });
    } catch (err: unknown) {
      setCreateError(getErrorMessage(err, 'Failed to create application'));
      setCreating(false);
    }
  };

  // View mode - render application detail inline
  if (isViewMode) {
    return (
      <ApplicationDetailView
        id={itemId}
        onBack={() => onNavigate?.('applications')}
        onDeleted={() => {
          setListMessage('Application deleted successfully');
          onNavigate?.('applications');
        }}
      />
    );
  }

  // Create mode - render inline form
  if (isCreateMode) {
    return (
      <div>
        {/* Success Modal */}
        {successData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Created</h2>
                <p className="text-gray-600 mb-4">
                  {successData.isNewUser ? (
                    <>
                      A new account has been created for <strong>{successData.userName}</strong>. They will receive an email at <strong>{successData.userEmail}</strong> with instructions to set up their password and complete their application.
                    </>
                  ) : (
                    <>
                      An application has been created for <strong>{successData.userName}</strong>. They will receive an email notification.
                    </>
                  )}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-6 text-center">
                <p className="text-sm text-gray-500">Application ID</p>
                <p className="text-lg font-semibold text-gray-900">#{successData.applicationId}</p>
              </div>

              {successData.holdingDeposit && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                  <p className="text-sm text-amber-800">
                    A holding deposit of <strong>&pound;{Number(successData.holdingDeposit.amount).toFixed(2)}</strong> has been created as &quot;awaiting payment&quot;. The tenant will see payment instructions on their application page.
                  </p>
                </div>
              )}

              <Button
                onClick={() => {
                  resetCreateForm();
                  onNavigate?.('applications');
                }}
                size="lg"
                className="w-full"
              >
                Back to List
              </Button>
            </div>
          </div>
        )}

        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create Application</h2>
            <p className="text-gray-600">Create a new application for a user</p>
          </div>
          <button
            onClick={() => {
              resetCreateForm();
              onNavigate?.('applications');
            }}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <MessageAlert type="error" message={createError} className="mb-6" />

          <form onSubmit={handleCreateSubmit} className="space-y-6">
            {/* Tenant Email Lookup */}
            <UserEmailLookup
              onUserChange={(data: UserData) => setUserData(data)}
              phoneRequired={false}
              label="Tenant"
              disabled={creating}
            />

            {/* Application Type */}
            <div>
              <label htmlFor="application_type" className="block text-sm font-medium text-gray-700 mb-2">
                Application Type *
              </label>
              <select
                id="application_type"
                name="application_type"
                value={createFormData.application_type}
                onChange={handleCreateFormChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="student">Student</option>
                <option value="professional">Professional</option>
              </select>
            </div>

            {/* Guarantor Required */}
            <div className="flex items-start">
              <input
                type="checkbox"
                id="guarantor_required"
                name="guarantor_required"
                checked={createFormData.guarantor_required}
                onChange={handleCreateFormChange}
                className="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="guarantor_required" className="ml-2 block text-sm text-gray-900">
                Guarantor Required
                <span className="block text-xs text-gray-500 mt-1">
                  If unchecked, guarantor information will not be required in the application
                </span>
                <span className="block text-xs text-amber-600 font-medium mt-1">
                  Warning: This also means no guarantor will be required for the tenancy
                </span>
              </label>
            </div>

            {/* Holding Deposit Section */}
            {holdingDepositEnabled && (
              <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-amber-900 mb-1">Holding Deposit</h3>
                  <p className="text-xs text-amber-700">
                    Select a property and bedroom to create a holding deposit. The tenant will see payment details on their application page.
                  </p>
                </div>

                {/* Property */}
                <div>
                  <label htmlFor="create-property" className="block text-sm font-medium text-gray-700 mb-1">
                    Property
                  </label>
                  <select
                    id="create-property"
                    value={selectedPropertyId}
                    onChange={(e) => {
                      setSelectedPropertyId(e.target.value ? parseInt(e.target.value) : '');
                      setSelectedBedroomId('');
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select property...</option>
                    {propertyOptions.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.address_line1}{p.city ? `, ${p.city}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bedroom */}
                {selectedPropertyId && (
                  <div>
                    <label htmlFor="create-bedroom" className="block text-sm font-medium text-gray-700 mb-1">
                      Bedroom
                    </label>
                    <select
                      id="create-bedroom"
                      value={selectedBedroomId}
                      onChange={(e) => setSelectedBedroomId(e.target.value ? parseInt(e.target.value) : '')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Select bedroom...</option>
                      {bedroomOptions.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.bedroom_name}{b.price_pppw ? ` - \u00A3${b.price_pppw}/pw` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Calculated Amount */}
                {calculatedAmount !== null && (
                  <div className="bg-white rounded-lg p-3 border border-amber-300">
                    <p className="text-sm text-gray-600">Deposit Amount</p>
                    <p className="text-xl font-bold text-gray-900">&pound;{Number(calculatedAmount).toFixed(2)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {depositType === '1_week_pppw' ? 'Based on 1 week PPPW' : 'Fixed amount'}
                    </p>
                  </div>
                )}

                {/* Reservation Days */}
                <div>
                  <label htmlFor="create-reservation-days" className="block text-sm font-medium text-gray-700 mb-1">
                    Reservation Duration (days)
                  </label>
                  <input
                    type="number"
                    id="create-reservation-days"
                    value={reservationDays}
                    onChange={(e) => setReservationDays(e.target.value)}
                    min="1"
                    placeholder="e.g. 14"
                    className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    How many days to reserve the room from when the deposit is paid
                  </p>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> The user will receive an email notification with a link to complete their application.
                They will be able to fill in all required details including personal information, address history{createFormData.guarantor_required ? ', and guarantor details' : ''}.
                Property assignment happens when creating the tenancy.
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={creating}
              fullWidth
              size="lg"
            >
              {creating ? 'Creating...' : 'Create Application'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const convertedCount = applications.filter(a => a.status === 'converted_to_tenancy').length;
  const activeApplications = applications.filter(a => a.status !== 'converted_to_tenancy');

  const filteredApplications = (showConverted ? applications : activeApplications).filter(app => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      (app.user_name?.toLowerCase().includes(searchLower)) ||
      (app.user_email?.toLowerCase().includes(searchLower));
    const matchesStatus = filterStatus === 'all' || app.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Stats based on active (non-converted) applications
  const stats = {
    total: activeApplications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    inProgress: applications.filter(a => a.status === 'submitted' || a.status === 'awaiting_guarantor').length,
    approved: applications.filter(a => a.status === 'approved').length,
  };

  const handleDeleteFromList = async (appId: number) => {
    if (!window.confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
      return;
    }
    setDeletingId(appId);
    try {
      await applicationsApi.delete(appId.toString());
      setApplications(prev => prev.filter(a => a.id !== appId));
      setListMessage('Application deleted successfully');
    } catch (err: unknown) {
      setListMessage(null);
      alert(getErrorMessage(err, 'Failed to delete application'));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <MessageAlert type="success" message={listMessage} className="mb-6" />

      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Applications</h2>
          <p className="text-gray-600">Review and manage tenant applications</p>
        </div>
        <button
          onClick={() => onNavigate?.('applications', { action: 'new' })}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Application
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">In Progress</p>
          <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Approved</p>
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="awaiting_guarantor">Awaiting Guarantor</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            {showConverted && <option value="converted_to_tenancy">Converted to Tenancy</option>}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showConverted}
              onChange={(e) => {
                setShowConverted(e.target.checked);
                if (!e.target.checked && filterStatus === 'converted_to_tenancy') {
                  setFilterStatus('all');
                }
              }}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            Show converted to tenancy ({convertedCount})
          </label>
        </div>
      </div>

      {/* Applications List */}
      <div className="bg-white rounded-lg shadow-md">
        {filteredApplications.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">No applications found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Applicant</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map(app => (
                  <tr key={app.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium">{app.user_name}</div>
                      <div className="text-sm text-gray-500">{app.user_email}</div>
                    </td>
                    <td className="py-3 px-4 capitalize">{app.application_type?.replace('_', ' ')}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge('application', app.status)}`}>
                        {getStatusLabel('application', app.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {new Date(app.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onNavigate?.('applications', { action: 'view', id: app.id.toString() })}
                          className="px-3 py-1.5 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                        >
                          View
                        </button>
                        {/* Intentionally stricter than detail view: exclude submitted/awaiting_guarantor from list delete to prevent accidental deletion of in-progress applications */}
                        {['pending', 'approved', 'rejected'].includes(app.status) && (
                          <button
                            onClick={() => handleDeleteFromList(app.id)}
                            disabled={deletingId === app.id}
                            className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingId === app.id ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
