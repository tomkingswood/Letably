'use client';

import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';

interface ApprovalChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  guarantorRequired: boolean;
}

const CHECKLIST_ITEMS = [
  { id: 'right_to_rent', label: 'Right to Rent (Immigration Check)' },
  { id: 'identity', label: 'Identity Verification (Anti-Money Laundering)' },
  { id: 'affordability', label: 'Affordability Check (Income Verification)' },
  { id: 'employment', label: 'Employment Verification' },
  { id: 'landlord_ref', label: 'Previous Landlord Reference' },
  { id: 'credit', label: 'Credit Check' },
] as const;

const GUARANTOR_ITEM = { id: 'guarantor', label: 'Guarantor Check' } as const;

export default function ApprovalChecklistModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  guarantorRequired,
}: ApprovalChecklistModalProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Reset checklist when modal opens
  useEffect(() => {
    if (isOpen) {
      setChecked(new Set());
    }
  }, [isOpen]);

  const items = guarantorRequired
    ? [...CHECKLIST_ITEMS, GUARANTOR_ITEM]
    : CHECKLIST_ITEMS;

  const totalItems = items.length;
  const checkedCount = checked.size;
  const allChecked = checkedCount === totalItems;

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Pre-Approval Checklist"
      onClose={onClose}
      size="lg"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={onConfirm}
          confirmText="Approve Application"
          confirmColor="green"
          isLoading={isLoading}
          confirmDisabled={!allChecked}
        />
      }
    >
      {/* Warning banner */}
      <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-amber-800 font-medium">
            It is your agency&apos;s legal responsibility to complete all applicable checks before approving this application.
          </p>
        </div>
      </div>

      {/* Progress counter */}
      <p className="text-sm text-gray-600 mb-4">
        {checkedCount}/{totalItems} checks confirmed
      </p>

      {/* Checklist */}
      <div className="space-y-2">
        {items.map(item => {
          const isChecked = checked.has(item.id);
          return (
            <label
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                isChecked
                  ? 'bg-green-50 border-green-300'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(item.id)}
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className={`text-sm ${isChecked ? 'text-green-800 font-medium' : 'text-gray-700'}`}>
                {item.label}
              </span>
            </label>
          );
        })}
      </div>
    </Modal>
  );
}
