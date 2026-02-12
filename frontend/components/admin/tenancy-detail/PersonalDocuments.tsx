'use client';

import React from 'react';
import { TenancyMember } from '@/lib/types';
import Input from '@/components/ui/Input';
import { formatDate } from '@/lib/dateUtils';

interface Document {
  id: number;
  document_type: string;
  created_at: string;
}

interface PersonalDocumentsProps {
  selectedMember: TenancyMember;
  memberDocuments: Record<number, Document[]>;
  documentFormData: Record<number, { type: string; file: File | null }>;
  uploadingDocument: number | null;
  onDocumentTypeChange: (memberId: number, type: string) => void;
  onDocumentFileChange: (memberId: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadDocument: (memberId: number) => void;
  onDeleteDocument: (memberId: number, documentId: number) => void;
  onViewDocument: (documentId: number) => void;
}

export function PersonalDocuments({
  selectedMember,
  memberDocuments,
  documentFormData,
  uploadingDocument,
  onDocumentTypeChange,
  onDocumentFileChange,
  onUploadDocument,
  onDeleteDocument,
  onViewDocument,
}: PersonalDocumentsProps) {
  return (
    <div className="pt-6 border-t border-gray-200">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Personal Documents</h3>

      {/* Upload Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-3">Upload New Document</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
            <Input
              type="text"
              value={documentFormData[selectedMember.id]?.type || ''}
              onChange={(e) => onDocumentTypeChange(selectedMember.id, e.target.value)}
              placeholder="e.g Deposit Certificate"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File (PDF only)</label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => onDocumentFileChange(selectedMember.id, e)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        <button
          onClick={() => onUploadDocument(selectedMember.id)}
          disabled={uploadingDocument === selectedMember.id}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {uploadingDocument === selectedMember.id ? 'Uploading...' : 'Upload Document'}
        </button>
      </div>

      {/* Documents List */}
      {memberDocuments[selectedMember.id] && memberDocuments[selectedMember.id].length > 0 ? (
        <div className="space-y-2">
          {memberDocuments[selectedMember.id].map(doc => (
            <div key={doc.id} className="flex justify-between items-center p-3 border border-gray-200 rounded">
              <div>
                <p className="font-medium">{doc.document_type.replace('_', ' ')}</p>
                <p className="text-sm text-gray-600">
                  Uploaded: {formatDate(doc.created_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onViewDocument(doc.id)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  View
                </button>
                <button
                  onClick={() => onDeleteDocument(selectedMember.id, doc.id)}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600">No documents uploaded yet.</p>
      )}
    </div>
  );
}
