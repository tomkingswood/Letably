'use client';

import { Modal } from '@/components/ui/Modal';
import { sanitizeHtml } from '@/lib/sanitize';

interface AgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreementHtml: string;
  onPrint: () => void;
}

export function AgreementModal({ isOpen, onClose, agreementHtml, onPrint }: AgreementModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      title="My Signed Agreement"
      onClose={onClose}
      size="6xl"
      footer={
        <div className="flex justify-between items-center w-full">
          <p className="text-sm text-gray-600">
            This is a frozen snapshot of the agreement as it was when signed
          </p>
          <div className="flex gap-3">
            <button
              onClick={onPrint}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Agreement
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      }
    >
      <div
        className="border border-gray-300 rounded max-h-[60vh] overflow-y-auto"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(agreementHtml) }}
      />
    </Modal>
  );
}
