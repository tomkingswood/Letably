'use client';

import React from 'react';
import { Tenancy, GuarantorAgreement } from '@/lib/types';

interface SigningProgressProps {
  tenancy: Tenancy;
  guarantorAgreements: GuarantorAgreement[];
  onCopyGuarantorLink: (token: string, name: string) => void;
  onRegenerateGuarantorToken: (id: number, name: string) => void;
}

export function SigningProgress({
  tenancy,
  guarantorAgreements,
  onCopyGuarantorLink,
  onRegenerateGuarantorToken,
}: SigningProgressProps) {
  const members = tenancy.members || [];

  // Calculate totals
  let totalNeeded = 0;
  let totalSigned = 0;

  members.forEach(member => {
    totalNeeded++; // tenant signature
    if (member.is_signed) totalSigned++;

    if (member.guarantor_required) {
      totalNeeded++; // guarantor signature
      const agreement = guarantorAgreements.find(g => g.tenancy_member_id === member.id);
      if (agreement?.is_signed) totalSigned++;
    }
  });

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Signing Progress</h2>
      <p className="text-sm text-gray-600 mb-4">
        {totalSigned} of {totalNeeded} signature{totalNeeded !== 1 ? 's' : ''} complete
      </p>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
        <div
          className="bg-green-500 h-2 rounded-full transition-all duration-300"
          style={{ width: totalNeeded > 0 ? `${(totalSigned / totalNeeded) * 100}%` : '0%' }}
        />
      </div>

      {/* Member rows */}
      <div className="space-y-4">
        {members.map(member => {
          const agreement = guarantorAgreements.find(g => g.tenancy_member_id === member.id);

          return (
            <div key={member.id} className="bg-gray-50 rounded-lg p-4">
              {/* Tenant row */}
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 uppercase tracking-wide">
                  Tenant
                </span>
                <span className="font-medium text-gray-900">
                  {member.first_name} {member.last_name}
                </span>
                <div className="ml-auto">
                  {member.is_signed ? (
                    <span className="inline-flex items-center gap-1 text-sm text-green-700">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Signed
                      {member.signed_at && (
                        <span className="text-gray-500 text-xs ml-1">
                          ({new Date(member.signed_at).toLocaleDateString('en-GB')})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-yellow-700">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      Awaiting signature
                    </span>
                  )}
                </div>
              </div>

              {/* Guarantor row */}
              {member.guarantor_required && (
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-200">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 uppercase tracking-wide">
                    Guarantor
                  </span>
                  {!member.is_signed ? (
                    <span className="text-sm text-gray-400">Waiting for tenant to sign first</span>
                  ) : agreement ? (
                    <>
                      <span className="text-sm text-gray-700">{agreement.guarantor_name}</span>
                      <div className="ml-auto flex items-center gap-2">
                        {agreement.is_signed ? (
                          <span className="inline-flex items-center gap-1 text-sm text-green-700">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Signed
                          </span>
                        ) : (
                          <>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Pending
                            </span>
                            <button
                              onClick={() => onCopyGuarantorLink(agreement.guarantor_token, agreement.guarantor_name || 'Guarantor')}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                              title="Copy signing link"
                            >
                              Copy Link
                            </button>
                            <button
                              onClick={() => onRegenerateGuarantorToken(agreement.id, agreement.guarantor_name || 'Guarantor')}
                              className="text-xs text-orange-600 hover:text-orange-800 underline"
                              title="Resend email to guarantor"
                            >
                              Resend
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-sm text-gray-400">Agreement pending creation</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
