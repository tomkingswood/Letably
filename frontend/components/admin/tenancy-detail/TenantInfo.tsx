'use client';

import React from 'react';
import Link from 'next/link';
import { useAgency } from '@/lib/agency-context';
import { TenancyMember, Tenancy, Bedroom, GuarantorAgreement } from '@/lib/types';
import Input from '@/components/ui/Input';

export interface MemberEditHandlers {
  onEdit: () => void;
  onUpdate: (e: React.FormEvent) => void;
  onCancel: () => void;
  onFormDataChange: (data: { bedroom_id: number | null; rent_pppw: number; deposit_amount: number }) => void;
}

export interface AgreementHandlers {
  onOpenSigned: (member: TenancyMember) => void;
  onOpenPreview: (member: TenancyMember) => void;
  onRevertSignature: (member: TenancyMember) => void;
}

export interface GuarantorHandlers {
  onOpenSigned?: (agreement: GuarantorAgreement) => void;
  onCopyLink?: (token: string, guarantorName: string) => void;
  onRegenerateToken?: (agreementId: number, guarantorName: string) => void;
}

interface TenantInfoProps {
  tenancy: Tenancy;
  selectedMember: TenancyMember;
  editingMember: boolean;
  memberFormData: {
    bedroom_id: number | null;
    rent_pppw: number;
    deposit_amount: number;
  };
  rooms: Bedroom[];
  guarantorAgreement?: GuarantorAgreement | null;
  memberEditHandlers: MemberEditHandlers;
  agreementHandlers: AgreementHandlers;
  guarantorHandlers: GuarantorHandlers;
}

export function TenantInfo({
  tenancy,
  selectedMember,
  editingMember,
  memberFormData,
  rooms,
  guarantorAgreement,
  memberEditHandlers: {
    onEdit: onEditMember,
    onUpdate: onUpdateMember,
    onCancel: onCancelEdit,
    onFormDataChange,
  },
  agreementHandlers: {
    onOpenSigned: onOpenSignedAgreement,
    onOpenPreview: onOpenPreviewAgreement,
    onRevertSignature,
  },
  guarantorHandlers: {
    onOpenSigned: onOpenSignedGuarantorAgreement,
    onCopyLink: onCopyGuarantorLink,
    onRegenerateToken: onRegenerateGuarantorToken,
  },
}: TenantInfoProps) {
  const { agencySlug } = useAgency();
  return (
    <div className="pt-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Tenant Information</h3>

      {editingMember ? (
        <form onSubmit={onUpdateMember} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bedroom</label>
              <select
                value={memberFormData.bedroom_id || ''}
                onChange={(e) => onFormDataChange({...memberFormData, bedroom_id: e.target.value ? parseInt(e.target.value) : null})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">No specific bedroom</option>
                {rooms.map(room => (
                  <option key={room.id} value={room.id}>
                    {room.bedroom_name} - £{room.price_pppw}/week
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rent (PPPW)</label>
              <Input
                type="number"
                step="0.01"
                value={memberFormData.rent_pppw}
                onChange={(e) => onFormDataChange({...memberFormData, rent_pppw: parseFloat(e.target.value)})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Amount</label>
              <Input
                type="number"
                step="0.01"
                value={memberFormData.deposit_amount}
                onChange={(e) => onFormDataChange({...memberFormData, deposit_amount: parseFloat(e.target.value)})}
                required
              />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-medium">{selectedMember.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-medium">{selectedMember.phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Bedroom</p>
              <p className="font-medium">{selectedMember.bedroom_name || 'No specific bedroom'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Rent (PPPW)</p>
              <p className="font-medium">£{Number(selectedMember.rent_pppw || 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Deposit Amount</p>
              <p className="font-medium">£{Number(selectedMember.deposit_amount || 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Payment Option</p>
              <p className="font-medium">{selectedMember.payment_option || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Agreement Status</p>
              <p className="font-medium">
                {selectedMember.is_signed ? (
                  <span className="text-green-600">✓ Signed</span>
                ) : (
                  <span className="text-gray-600">Not signed</span>
                )}
              </p>
            </div>
            {Boolean(selectedMember.is_signed) && selectedMember.signed_at && (
              <div>
                <p className="text-sm text-gray-600">Signed At</p>
                <p className="font-medium">{new Date(selectedMember.signed_at).toLocaleDateString('en-GB')}</p>
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* View Application - only if application exists */}
            {selectedMember.application_id ? (
              <Link
                href={`/${agencySlug}/admin?section=applications&action=view&id=${selectedMember.application_id}`}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Application
              </Link>
            ) : (
              <span className="px-4 py-2 bg-amber-100 text-amber-800 rounded flex items-center gap-2 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Migrated tenant (no application or signed agreement)
              </span>
            )}
            {tenancy.status === 'pending' && (
              <button
                onClick={onEditMember}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Edit Tenant
              </button>
            )}
            {/* Preview Agreement during pending status only */}
            {tenancy.status === 'pending' && (
              <button
                onClick={() => onOpenPreviewAgreement(selectedMember)}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Preview Agreement
              </button>
            )}
            {/* View Signed Agreement after tenant has signed */}
            {Boolean(selectedMember.is_signed) && selectedMember.signed_agreement_html && (
              <>
                <button
                  onClick={() => onOpenSignedAgreement(selectedMember)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  View Signed Agreement - Tenant
                </button>
                {/* View Signed Guarantor Agreement if available */}
                {guarantorAgreement?.is_signed && guarantorAgreement?.signed_agreement_html && onOpenSignedGuarantorAgreement && (
                  <button
                    onClick={() => onOpenSignedGuarantorAgreement(guarantorAgreement)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    View Signed Agreement - Guarantor
                  </button>
                )}
                {/* Only show revert signature button before approval */}
                {tenancy.status === 'awaiting_signatures' && (
                  <button
                    onClick={() => onRevertSignature(selectedMember)}
                    className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                  >
                    Revert Signature
                  </button>
                )}
              </>
            )}
          </div>

          {/* Guarantor Agreement Section - Show when member has signed (during awaiting_signatures) or post-approval */}
          {((tenancy.status === 'awaiting_signatures' && selectedMember.is_signed) || tenancy.status === 'approval' || tenancy.status === 'active') && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Guarantor Agreement</h4>

              {guarantorAgreement ? (
                <div className={`p-4 border rounded-lg ${
                  guarantorAgreement.is_signed
                    ? 'border-green-200 bg-green-50'
                    : 'border-yellow-200 bg-yellow-50'
                }`}>
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {guarantorAgreement.guarantor_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {guarantorAgreement.guarantor_email}
                        </div>
                      </div>
                      <div className="text-right">
                        {guarantorAgreement.is_signed ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            ✓ Signed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                            ⏳ Pending Signature
                          </span>
                        )}
                        {guarantorAgreement.signed_at && (
                          <div className="text-xs text-gray-500 mt-1">
                            Signed: {new Date(guarantorAgreement.signed_at).toLocaleDateString('en-GB')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons for unsigned agreements */}
                    {!guarantorAgreement.is_signed && onCopyGuarantorLink && onRegenerateGuarantorToken && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                        <button
                          onClick={() => onCopyGuarantorLink(guarantorAgreement.guarantor_token, guarantorAgreement.guarantor_name || 'Guarantor')}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Link
                        </button>
                        <button
                          onClick={() => onRegenerateGuarantorToken(guarantorAgreement.id, guarantorAgreement.guarantor_name || 'Guarantor')}
                          className="flex-1 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          Resend Email
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-gray-200 bg-gray-50 rounded-lg">
                  <p className="text-gray-600 text-sm">Not Required</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
