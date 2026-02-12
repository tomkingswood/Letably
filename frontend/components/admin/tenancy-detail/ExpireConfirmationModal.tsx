'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';

interface ExpireWarnings {
  uncollectedKeys: { name: string; status: string }[];
  unpaidPayments: { memberName: string; dueDate: string; amount: number }[];
}

interface ExpireConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  markingExpired: boolean;
  expireWarnings: ExpireWarnings;
}

export function ExpireConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  markingExpired,
  expireWarnings,
}: ExpireConfirmationModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mark Tenancy as Expired"
      size="lg"
    >
      <div className="space-y-4">
        {/* Show warnings if there are any */}
        {(expireWarnings.uncollectedKeys.length > 0 || expireWarnings.unpaidPayments.length > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h4 className="font-semibold text-amber-800 mb-2">Outstanding Items</h4>

                {/* Uncollected Keys Warning */}
                {expireWarnings.uncollectedKeys.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-amber-800 mb-1">Keys not returned:</p>
                    <ul className="text-sm text-amber-700 ml-4 list-disc">
                      {expireWarnings.uncollectedKeys.map((key, idx) => (
                        <li key={idx}>
                          {key.name} - {key.status === 'not_collected' ? 'Not collected' : 'Collected but not returned'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Unpaid Payments Warning */}
                {expireWarnings.unpaidPayments.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-amber-800 mb-1">Unpaid payments:</p>
                    <ul className="text-sm text-amber-700 ml-4 list-disc">
                      {expireWarnings.unpaidPayments.slice(0, 5).map((payment, idx) => (
                        <li key={idx}>
                          {payment.memberName} - £{payment.amount.toFixed(2)} due {new Date(payment.dueDate).toLocaleDateString('en-GB')}
                        </li>
                      ))}
                      {expireWarnings.unpaidPayments.length > 5 && (
                        <li>...and {expireWarnings.unpaidPayments.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            {expireWarnings.uncollectedKeys.length > 0 || expireWarnings.unpaidPayments.length > 0 ? (
              <>
                Are you sure you want to mark this tenancy as expired? The items listed above are still outstanding.
                <br /><br />
                <strong>Note:</strong> Tenants will still be able to view their payment history and documents after the tenancy is marked as expired.
              </>
            ) : (
              <>
                Are you sure you want to mark this tenancy as expired?
                <br /><br />
                <strong>Note:</strong> Tenants will still be able to view their payment history and documents after the tenancy is marked as expired.
              </>
            )}
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            disabled={markingExpired}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
            disabled={markingExpired}
          >
            {markingExpired ? 'Marking...' : 'Confirm - Mark as Expired'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
