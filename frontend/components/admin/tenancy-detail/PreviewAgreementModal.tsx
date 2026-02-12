'use client';

import React from 'react';
import { Agreement } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import AgreementDocument from '@/components/AgreementDocument';

interface PreviewAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMemberName: string;
  loadingPreview: boolean;
  previewAgreement: Agreement | null;
}

export function PreviewAgreementModal({
  isOpen,
  onClose,
  selectedMemberName,
  loadingPreview,
  previewAgreement,
}: PreviewAgreementModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Preview Agreement - ${selectedMemberName}`}
      size="6xl"
    >
      {loadingPreview ? (
        <div className="flex items-center justify-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-gray-600 ml-4">Generating agreement preview...</p>
        </div>
      ) : previewAgreement ? (
        <AgreementDocument
          agreement={previewAgreement}
          showInfoBox={true}
          showSignatures={false}
        />
      ) : null}
    </Modal>
  );
}
