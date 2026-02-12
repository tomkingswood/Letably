'use client';

import React from 'react';
import { Tenancy, Bedroom } from '@/lib/types';
import Input from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface RollingFormData {
  start_date: string;
  end_date: string;
  selectedMembers: { [key: number]: boolean };
  memberDetails: { [key: number]: { rent_pppw: number; deposit_amount: number; bedroom_id: number | null } };
}

interface CreateRollingTenancyModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenancy: Tenancy;
  rooms: Bedroom[];
  rollingFormData: RollingFormData;
  setRollingFormData: (data: RollingFormData) => void;
  rollingError: string;
  creatingRolling: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function CreateRollingTenancyModal({
  isOpen,
  onClose,
  tenancy,
  rooms,
  rollingFormData,
  setRollingFormData,
  rollingError,
  creatingRolling,
  onSubmit,
}: CreateRollingTenancyModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Rolling Tenancy"
      size="2xl"
    >
      <form onSubmit={onSubmit} className="space-y-6">
        {/* Error Display */}
        {rollingError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-red-700 whitespace-pre-wrap">{rollingError}</div>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            This will create a new rolling (periodic) tenancy with the selected tenants from this tenancy.
            The new tenancy will start in <strong>pending</strong> status and go through the normal agreement signing process.
          </p>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={rollingFormData.start_date}
              onChange={(e) => setRollingFormData({ ...rollingFormData, start_date: e.target.value })}
              required
            />
            {tenancy?.end_date && (
              <p className="text-xs text-gray-500 mt-1">
                Current tenancy ends: {new Date(tenancy.end_date).toLocaleDateString('en-GB')}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date <span className="text-gray-400">(optional)</span>
            </label>
            <Input
              type="date"
              value={rollingFormData.end_date}
              onChange={(e) => setRollingFormData({ ...rollingFormData, end_date: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty for no fixed end date (rolling)
            </p>
          </div>
        </div>

        {/* Tenant Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Tenants
          </label>
          <div className="space-y-4 max-h-80 overflow-y-auto border border-gray-200 rounded-lg p-4">
            {tenancy?.members?.map(member => (
              <div key={member.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rollingFormData.selectedMembers[member.id] || false}
                    onChange={(e) => setRollingFormData({
                      ...rollingFormData,
                      selectedMembers: {
                        ...rollingFormData.selectedMembers,
                        [member.id]: e.target.checked,
                      },
                    })}
                    className="w-5 h-5 text-purple-600 rounded"
                  />
                  <span className="font-medium text-gray-900">
                    {member.first_name} {member.last_name}
                    {member.bedroom_name && <span className="text-gray-500 ml-2">({member.bedroom_name})</span>}
                  </span>
                </label>

                {/* Editable details when selected */}
                {rollingFormData.selectedMembers[member.id] && (
                  <div className="mt-3 ml-8 grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Bedroom</label>
                      <select
                        value={rollingFormData.memberDetails[member.id]?.bedroom_id || ''}
                        onChange={(e) => setRollingFormData({
                          ...rollingFormData,
                          memberDetails: {
                            ...rollingFormData.memberDetails,
                            [member.id]: {
                              ...rollingFormData.memberDetails[member.id],
                              bedroom_id: e.target.value ? parseInt(e.target.value) : null,
                            },
                          },
                        })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      >
                        <option value="">No specific bedroom</option>
                        {rooms.map(room => (
                          <option key={room.id} value={room.id}>{room.bedroom_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Rent (PPPW)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={rollingFormData.memberDetails[member.id]?.rent_pppw || 0}
                        onChange={(e) => setRollingFormData({
                          ...rollingFormData,
                          memberDetails: {
                            ...rollingFormData.memberDetails,
                            [member.id]: {
                              ...rollingFormData.memberDetails[member.id],
                              rent_pppw: parseFloat(e.target.value) || 0,
                            },
                          },
                        })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Deposit</label>
                      <input
                        type="number"
                        step="0.01"
                        value={rollingFormData.memberDetails[member.id]?.deposit_amount || 0}
                        onChange={(e) => setRollingFormData({
                          ...rollingFormData,
                          memberDetails: {
                            ...rollingFormData.memberDetails,
                            [member.id]: {
                              ...rollingFormData.memberDetails[member.id],
                              deposit_amount: parseFloat(e.target.value) || 0,
                            },
                          },
                        })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={creatingRolling}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 font-medium"
          >
            {creatingRolling ? 'Creating...' : 'Create Rolling Tenancy'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
