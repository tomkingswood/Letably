'use client';

import type { Agreement } from '@/lib/types';
import { formatTenancyPeriod } from '@/lib/dateUtils';
import { MessageAlert } from '@/components/ui/MessageAlert';
import AgreementDocument from '@/components/AgreementDocument';

interface AgreementPreviewModalProps {
  agreement: Agreement | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  /** Warning box title */
  warningTitle?: string;
  /** Warning box description */
  warningText?: string;
}

export default function AgreementPreviewModal({
  agreement,
  loading,
  error,
  onClose,
  warningTitle = 'Preview Mode — Dummy Data',
  warningText = 'This is a preview using sample data. Actual agreements will use real tenant and property information.',
}: AgreementPreviewModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold">Agreement Preview</h3>
            <p className="text-sm text-white/90 mt-1">Preview with dummy data</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-gray-600 mt-4">Generating preview...</p>
              </div>
            </div>
          )}

          {error && <MessageAlert type="error" message={error} />}

          {agreement && !loading && (
            <>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-yellow-900 mb-1">{warningTitle}</h4>
                    <p className="text-sm text-yellow-800">{warningText}</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-bold text-blue-900 mb-2">Agreement Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-blue-700 font-medium">Landlord</p>
                    <p className="text-blue-900">{agreement.landlord?.display_name || 'Test Landlord'}</p>
                  </div>
                  <div>
                    <p className="text-blue-700 font-medium">Tenancy Period</p>
                    <p className="text-blue-900">
                      {formatTenancyPeriod(agreement.tenancy?.start_date, agreement.tenancy?.end_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-700 font-medium">Tenancy Type</p>
                    <p className="text-blue-900">
                      {agreement.tenancy?.tenancy_type === 'room_only' ? 'Room Only (1 tenant)' : 'Whole House (2 tenants)'}
                    </p>
                  </div>
                </div>
              </div>

              <AgreementDocument
                agreement={agreement}
                showInfoBox={false}
                showSignatures={false}
              />
            </>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-between items-center bg-gray-50">
          <p className="text-sm text-gray-600">
            {agreement && `${agreement.sections?.length || 0} sections rendered`}
          </p>
          <div className="flex gap-3">
            {agreement && (
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Print Preview
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
