'use client';

import DynamicHeroIcon from '@/components/ui/DynamicHeroIcon';

interface DocumentsCardProps {
  propertyCertificates: any[];
  myDocuments: any[];
  onDownloadDocument: (documentId: number) => void;
}

export function DocumentsCard({ propertyCertificates, myDocuments, onDownloadDocument }: DocumentsCardProps) {
  return (
    <>
      {/* Documentation & Certificates Card */}
      {propertyCertificates.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900">Documentation & Certificates</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {propertyCertificates.map((cert) => (
              <a
                key={cert.id}
                href={`/uploads/${cert.file_path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border border-blue-200 rounded-lg transition-all shadow-sm hover:shadow-md"
                title={cert.type_description || cert.type_display_name}
              >
                <DynamicHeroIcon icon={cert.type_icon} className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{cert.type_display_name}</div>
                  {cert.expiry_date && (
                    <div className="text-xs text-gray-600 mt-1">
                      Expires: {new Date(cert.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Personal Documents Card */}
      {myDocuments.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900">Personal Documents</h2>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Documents specific to your tenancy that have been uploaded by your landlord or letting agent.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {myDocuments.map((doc) => (
              <button
                key={doc.id}
                onClick={() => onDownloadDocument(doc.id)}
                className="flex items-center gap-3 px-4 py-3 bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border border-green-200 rounded-lg transition-all shadow-sm hover:shadow-md text-left"
              >
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{doc.document_type}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Uploaded {new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
