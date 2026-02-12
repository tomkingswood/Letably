'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { sanitizeHtml } from '@/lib/sanitize';

interface SignedAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAgreementHTML: string;
  selectedMemberName: string;
}

export function SignedAgreementModal({
  isOpen,
  onClose,
  selectedAgreementHTML,
  selectedMemberName,
}: SignedAgreementModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Signed Agreement - ${selectedMemberName}`}
      size="6xl"
    >
      <div className="flex flex-col" style={{ height: '70vh' }}>
        <div className="flex-1 overflow-y-auto mb-4">
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedAgreementHTML || '') }}
          />
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 mt-4">
          <button
            onClick={() => {
              const printWindow = window.open('', '_blank');
              if (printWindow) {
                printWindow.document.write(selectedAgreementHTML);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                  printWindow.print();
                }, 250);
              }
            }}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
          >
            Print Agreement
          </button>
        </div>
      </div>
    </Modal>
  );
}
