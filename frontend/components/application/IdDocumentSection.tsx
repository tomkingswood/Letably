import { IdDocumentStatus } from '@/lib/types';

interface IdDocumentSectionProps {
  isStudent: boolean;
  idType: string;
  onIdTypeChange: (value: string) => void;
  idDocumentUploaded: boolean;
  idDocumentInfo: IdDocumentStatus | null;
  uploadingId: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onView: () => void;
  onDelete: () => void;
  isPending: boolean;
  disabled: boolean;
  onShowRightToRent: () => void;
}

export default function IdDocumentSection({
  isStudent,
  idType,
  onIdTypeChange,
  idDocumentUploaded,
  idDocumentInfo,
  uploadingId,
  onFileChange,
  onView,
  onDelete,
  isPending,
  disabled,
  onShowRightToRent,
}: IdDocumentSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onShowRightToRent}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Right to Rent Checks
        </button>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-gray-600 mb-4">
          Please select which form of identification you will provide for Right to Rent checks *
        </p>
        <label className="flex items-center">
          <input
            type="radio"
            name="id_type"
            value="Driving Licence"
            checked={idType === 'Driving Licence'}
            onChange={(e) => onIdTypeChange(e.target.value)}
            disabled={disabled}
            className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
          />
          <span className="ml-2 text-sm text-gray-900">UK Driving Licence</span>
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            name="id_type"
            value="Passport"
            checked={idType === 'Passport'}
            onChange={(e) => onIdTypeChange(e.target.value)}
            disabled={disabled}
            className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
          />
          <span className="ml-2 text-sm text-gray-900">Valid Passport</span>
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            name="id_type"
            value={isStudent ? 'Student ID' : 'Work ID'}
            checked={idType === (isStudent ? 'Student ID' : 'Work ID')}
            onChange={(e) => onIdTypeChange(e.target.value)}
            disabled={disabled}
            className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
          />
          <span className="ml-2 text-sm text-gray-900">
            {isStudent ? 'Student ID Card' : 'Work ID / Employee Badge'}
          </span>
        </label>
      </div>

      {/* ID Document Upload */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Upload ID Document <span className="text-red-600">*</span>
        </h3>

        {idDocumentUploaded ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-green-800">ID Document Uploaded</p>
                <p className="text-sm text-green-700 mt-1">
                  {idDocumentInfo?.filename} ({((idDocumentInfo?.size ?? 0) / 1024).toFixed(0)} KB)
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Uploaded: {idDocumentInfo?.uploadedAt ? new Date(idDocumentInfo.uploadedAt).toLocaleString('en-GB') : ''}
                </p>

                {isPending && (
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={onView}
                      className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View
                    </button>
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={uploadingId}
                      className="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Please upload a clear photo or scan of your ID document. Accepted formats: JPEG, PNG, PDF (max 10MB)
            </p>
            <div className="flex items-center gap-3">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  capture="environment"
                  onChange={onFileChange}
                  disabled={disabled || uploadingId}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary file:text-white
                    hover:file:bg-primary-dark
                    file:cursor-pointer
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </label>
            </div>
            {uploadingId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-sm text-blue-900 font-medium">Uploading document...</p>
                </div>
              </div>
            )}
            {!disabled && !uploadingId && (
              <p className="text-xs text-gray-500">
                Note: File will upload automatically after selection. Accepted formats: JPEG, PNG, PDF (max 10MB)
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
