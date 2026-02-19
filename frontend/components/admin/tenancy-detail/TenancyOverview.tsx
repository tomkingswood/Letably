'use client';

import React from 'react';
import { Tenancy } from '@/lib/types';
import Input from '@/components/ui/Input';
import { getStatusBadge, getStatusLabel } from '@/lib/statusBadges';

type TenancyFormData = {
  start_date: string;
  end_date: string | null;
  status: 'pending' | 'awaiting_signatures' | 'approval' | 'active' | 'expired';
  auto_generate_payments: boolean;
};

export interface TenancyEditHandlers {
  onEdit: () => void;
  onUpdate: (e: React.FormEvent) => void;
  onCancel: () => void;
  onFormDataChange: (data: TenancyFormData) => void;
}

export interface StatusHandlers {
  onMarkAsAwaitingSignatures: () => void;
  onMarkAsActive: () => void;
  onShowExpireModal: () => void;
  onUpdateStatus: (newStatus: 'approval' | 'active' | 'awaiting_signatures') => void;
}

export interface LifecycleHandlers {
  onDelete: () => void;
  onOpenCreateRollingModal: () => void;
}

interface TenancyOverviewProps {
  tenancy: Tenancy;
  editingTenancy: boolean;
  tenancyFormData: TenancyFormData;
  canMarkAsExpired: boolean;
  deleting: boolean;
  guarantorAgreements: { is_signed: boolean }[];
  tenancyEditHandlers: TenancyEditHandlers;
  statusHandlers: StatusHandlers;
  lifecycleHandlers: LifecycleHandlers;
}

export function TenancyOverview({
  tenancy,
  editingTenancy,
  tenancyFormData,
  canMarkAsExpired,
  deleting,
  guarantorAgreements,
  tenancyEditHandlers: {
    onEdit: onEditTenancy,
    onUpdate: onUpdateTenancy,
    onCancel: onCancelEdit,
    onFormDataChange,
  },
  statusHandlers: {
    onMarkAsAwaitingSignatures,
    onMarkAsActive,
    onShowExpireModal,
    onUpdateStatus: onUpdateTenancyStatus,
  },
  lifecycleHandlers: {
    onDelete,
    onOpenCreateRollingModal,
  },
}: TenancyOverviewProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Tenancy Information</h2>
        <div className="flex gap-2">
          {!!tenancy.is_rolling_monthly && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge('tenancyType', 'rolling_monthly')}`}>
              {getStatusLabel('tenancyType', 'rolling_monthly')}
            </span>
          )}
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge('tenancy', tenancy.status)}`}>
            {getStatusLabel('tenancy', tenancy.status)}
          </span>
        </div>
      </div>

      {editingTenancy ? (
        <form onSubmit={onUpdateTenancy} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
                {tenancy?.status !== 'pending' && (
                  <span className="ml-2 text-xs text-orange-600">(Locked after checking)</span>
                )}
              </label>
              <Input
                type="date"
                value={tenancyFormData.start_date}
                onChange={(e) => onFormDataChange({...tenancyFormData, start_date: e.target.value})}
                required
                disabled={tenancy?.status !== 'pending'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
                {tenancy?.is_rolling_monthly ? (
                  <span className="ml-2 text-xs text-blue-600">(Set to terminate rolling tenancy)</span>
                ) : tenancy?.status === 'active' ? (
                  <span className="ml-2 text-xs text-blue-600">(Adjust for early termination)</span>
                ) : tenancy?.status !== 'pending' ? (
                  <span className="ml-2 text-xs text-orange-600">(Locked until active)</span>
                ) : null}
              </label>
              <Input
                type="date"
                value={tenancyFormData.end_date || ''}
                onChange={(e) => onFormDataChange({...tenancyFormData, end_date: e.target.value || null})}
                required={!tenancy?.is_rolling_monthly}
                disabled={!tenancy?.is_rolling_monthly && tenancy?.status !== 'pending' && tenancy?.status !== 'active'}
              />
              {!!tenancy?.is_rolling_monthly && !tenancyFormData.end_date && (
                <p className="text-xs text-gray-500 mt-1">Leave empty for indefinite rolling tenancy</p>
              )}
              {tenancy?.status === 'active' && !tenancy?.is_rolling_monthly && (
                <p className="text-xs text-gray-500 mt-1">Adjust to support early termination of this tenancy</p>
              )}
            </div>
            {/* Auto-generate payments toggle for rolling tenancies */}
            {!!tenancy?.is_rolling_monthly && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoGeneratePayments"
                  checked={tenancyFormData.auto_generate_payments ?? true}
                  onChange={(e) => onFormDataChange({...tenancyFormData, auto_generate_payments: e.target.checked})}
                  className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <label htmlFor="autoGeneratePayments" className="ml-2 text-sm text-gray-700">
                  Auto-generate monthly payments
                </label>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={tenancyFormData.status}
                onChange={(e) => onFormDataChange({...tenancyFormData, status: e.target.value as any})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={tenancy?.status === 'active' || tenancy?.status === 'expired'}
              >
                {/* Current status */}
                <option value={tenancy?.status}>
                  {tenancy?.status.charAt(0).toUpperCase() + tenancy?.status.slice(1)} (Current)
                </option>

                {/* Only show next valid step */}
                {tenancy?.status === 'pending' && (
                  <option value="awaiting_signatures">Awaiting Signatures</option>
                )}

                {/* Info about restricted transitions */}
                {tenancy?.status === 'awaiting_signatures' && (
                  <option disabled>Approval (auto when all tenants + guarantors sign)</option>
                )}
                {(tenancy?.status === 'active' || tenancy?.status === 'expired') && (
                  <option disabled>Status cannot be changed</option>
                )}
              </select>
              {(tenancy?.status === 'active' || tenancy?.status === 'expired') && (
                <p className="text-xs text-gray-500 mt-1">Status cannot be changed once tenancy is {tenancy?.status}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-600">Property</p>
              <p className="font-medium">{tenancy.property_address}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Location</p>
              <p className="font-medium">{tenancy.location}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Start Date</p>
              <p className="font-medium">{new Date(tenancy.start_date).toLocaleDateString('en-GB')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">End Date</p>
              <p className="font-medium">
                {tenancy.end_date
                  ? new Date(tenancy.end_date).toLocaleDateString('en-GB')
                  : <span className="text-blue-600">No fixed end date</span>
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tenancy Type</p>
              <p className="font-medium">{tenancy.tenancy_type === 'room_only' ? 'Room Only' : 'Whole House'}</p>
            </div>
            {!!tenancy.is_rolling_monthly && (
              <div>
                <p className="text-sm text-gray-600">Auto-generate Payments</p>
                <p className="font-medium">
                  {!!tenancy.auto_generate_payments ? (
                    <span className="text-green-600">Enabled</span>
                  ) : (
                    <span className="text-gray-500">Disabled</span>
                  )}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-600">Total Tenants</p>
              <p className="font-medium">{tenancy.members?.length || 0}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {tenancy.status === 'pending' && (
              <>
                <button
                  onClick={onEditTenancy}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Edit Tenancy
                </button>
                <button
                  onClick={onMarkAsAwaitingSignatures}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Mark as Awaiting Signatures
                </button>
              </>
            )}
            {/* Allow editing rolling tenancies after pending to set termination date */}
            {!!tenancy.is_rolling_monthly && tenancy.status !== 'pending' && tenancy.status !== 'expired' && (
              <button
                onClick={onEditTenancy}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Edit Rolling Settings
              </button>
            )}
            {/* Allow editing end date for active non-rolling tenancies (early termination) */}
            {!tenancy.is_rolling_monthly && tenancy.status === 'active' && (
              <button
                onClick={onEditTenancy}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Edit End Date
              </button>
            )}
            {tenancy.status === 'approval' && (
              <button
                onClick={onMarkAsActive}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Mark as Active
              </button>
            )}
            {/* Mark as Expired - only for active tenancies on/after end date */}
            {canMarkAsExpired && (
              <button
                onClick={onShowExpireModal}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mark as Expired
              </button>
            )}
            {/* Create Rolling Tenancy - only for non-rolling active tenancies */}
            {!tenancy.is_rolling_monthly && tenancy.status === 'active' && (
              <button
                onClick={onOpenCreateRollingModal}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Create Rolling Tenancy
              </button>
            )}
            <button
              onClick={onDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete Tenancy'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
