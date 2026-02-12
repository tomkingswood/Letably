'use client';

import React from 'react';
import { TenancyMember } from '@/lib/types';
import Input from '@/components/ui/Input';

interface KeyTrackingProps {
  selectedMember: TenancyMember;
  editingKeyTracking: boolean;
  updatingKeyTracking: boolean;
  keyTrackingFormData: {
    key_status: 'not_collected' | 'collected' | 'returned';
    key_collection_date: string;
    key_return_date: string;
  };
  onEditKeyTracking: (status: 'not_collected' | 'collected' | 'returned') => void;
  onUpdateKeyTracking: (e: React.FormEvent) => void;
  onCancelEdit: () => void;
  onFormDataChange: (data: { key_status: 'not_collected' | 'collected' | 'returned'; key_collection_date: string; key_return_date: string }) => void;
}

export function KeyTracking({
  selectedMember,
  editingKeyTracking,
  updatingKeyTracking,
  keyTrackingFormData,
  onEditKeyTracking,
  onUpdateKeyTracking,
  onCancelEdit,
  onFormDataChange,
}: KeyTrackingProps) {
  return (
    <div className="py-6 border-t border-gray-200">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Key Tracking</h3>

      {editingKeyTracking ? (
        <form onSubmit={onUpdateKeyTracking} className="space-y-4">
          <div className={`border rounded-lg p-4 mb-4 ${
            keyTrackingFormData.key_status === 'collected' && selectedMember.key_status === 'returned'
              ? 'bg-orange-50 border-orange-200'
              : keyTrackingFormData.key_status === 'not_collected' && selectedMember.key_status === 'collected'
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <p className="text-sm font-medium mb-2" style={{
              color: keyTrackingFormData.key_status === 'collected' && selectedMember.key_status === 'returned'
                ? '#9a3412'
                : keyTrackingFormData.key_status === 'not_collected' && selectedMember.key_status === 'collected'
                ? '#991b1b'
                : '#1e3a8a'
            }}>
              {keyTrackingFormData.key_status === 'collected' && selectedMember.key_status === 'returned' && 'Remove return date'}
              {keyTrackingFormData.key_status === 'collected' && selectedMember.key_status !== 'returned' && 'Mark key as collected'}
              {keyTrackingFormData.key_status === 'returned' && 'Mark key as returned'}
              {keyTrackingFormData.key_status === 'not_collected' && selectedMember.key_status === 'collected' && 'Remove collection date'}
              {keyTrackingFormData.key_status === 'not_collected' && selectedMember.key_status !== 'collected' && 'Mark key as not collected'}
            </p>
            <p className="text-sm" style={{
              color: keyTrackingFormData.key_status === 'collected' && selectedMember.key_status === 'returned'
                ? '#9a3412'
                : keyTrackingFormData.key_status === 'not_collected' && selectedMember.key_status === 'collected'
                ? '#991b1b'
                : '#1e40af'
            }}>
              {keyTrackingFormData.key_status === 'collected' && selectedMember.key_status === 'returned' && 'This will remove the return date and set the key status back to "With Tenant"'}
              {keyTrackingFormData.key_status === 'collected' && selectedMember.key_status !== 'returned' && 'Enter the date the tenant collected their key'}
              {keyTrackingFormData.key_status === 'returned' && 'Enter the date the tenant returned their key'}
              {keyTrackingFormData.key_status === 'not_collected' && selectedMember.key_status === 'collected' && 'This will remove the collection date and set the key status to "Not Collected"'}
              {keyTrackingFormData.key_status === 'not_collected' && selectedMember.key_status !== 'collected' && 'This will clear all key tracking dates'}
            </p>
          </div>

          {keyTrackingFormData.key_status === 'collected' && selectedMember.key_status !== 'returned' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Collection Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={keyTrackingFormData.key_collection_date}
                onChange={(e) => onFormDataChange({...keyTrackingFormData, key_collection_date: e.target.value})}
                required
              />
            </div>
          )}

          {keyTrackingFormData.key_status === 'returned' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Collection Date
                </label>
                <Input
                  type="date"
                  value={keyTrackingFormData.key_collection_date}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">Collection date is already set and cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Return Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={keyTrackingFormData.key_return_date}
                  onChange={(e) => onFormDataChange({...keyTrackingFormData, key_return_date: e.target.value})}
                  required
                />
              </div>
            </>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={updatingKeyTracking}
              className={`px-4 py-2 text-white rounded disabled:opacity-50 ${
                keyTrackingFormData.key_status === 'collected' && selectedMember.key_status === 'returned'
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : keyTrackingFormData.key_status === 'not_collected' && selectedMember.key_status === 'collected'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {updatingKeyTracking ? 'Updating...' : (
                keyTrackingFormData.key_status === 'collected' && selectedMember.key_status === 'returned'
                  ? 'Remove Return Date'
                  : keyTrackingFormData.key_status === 'not_collected' && selectedMember.key_status === 'collected'
                  ? 'Remove Collection Date'
                  : 'Update Key Status'
              )}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={updatingKeyTracking}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Key Status</p>
              <p className="font-medium text-lg">
                {selectedMember.key_status === 'not_collected' && (
                  <span className="text-gray-500">Not Collected</span>
                )}
                {selectedMember.key_status === 'collected' && (
                  <span className="text-blue-600">✓ With Tenant</span>
                )}
                {selectedMember.key_status === 'returned' && (
                  <span className="text-green-600">✓ Returned</span>
                )}
              </p>
            </div>
            {selectedMember.key_collection_date && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Collection Date</p>
                <p className="font-medium">{new Date(selectedMember.key_collection_date).toLocaleDateString('en-GB')}</p>
              </div>
            )}
            {selectedMember.key_return_date && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Return Date</p>
                <p className="font-medium">{new Date(selectedMember.key_return_date).toLocaleDateString('en-GB')}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedMember.key_status === 'not_collected' && (
              <button
                onClick={() => onEditKeyTracking('collected')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Mark as Collected
              </button>
            )}
            {selectedMember.key_status === 'collected' && (
              <>
                <button
                  onClick={() => onEditKeyTracking('returned')}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Mark as Returned
                </button>
                <button
                  onClick={() => onEditKeyTracking('not_collected')}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Remove Collection Date
                </button>
              </>
            )}
            {selectedMember.key_status === 'returned' && (
              <button
                onClick={() => onEditKeyTracking('collected')}
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
              >
                Remove Return Date
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
