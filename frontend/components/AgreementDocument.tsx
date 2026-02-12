import React from 'react';
import type { Agreement } from '@/lib/types';
import { formatTenancyPeriod } from '@/lib/dateUtils';
import { sanitizeHtml } from '@/lib/sanitize';

interface AgreementDocumentProps {
  agreement: Agreement;
  showInfoBox?: boolean;
  showSignatures?: boolean;
  className?: string;
}

/**
 * Reusable component for rendering tenancy agreements
 * Used by:
 * - Admin tenancy agreement preview (/admin/tenancies/[id]/agreement/[memberId])
 * - Tenant signing page (/agreements/sign/[tenancyId]/[memberId])
 * - Landlord preview modal (/admin/landlords/[id])
 */
export default function AgreementDocument({
  agreement,
  showInfoBox = true,
  showSignatures = true,
  className = '',
}: AgreementDocumentProps) {
  return (
    <>
      {/* Agreement Information Box */}
      {showInfoBox && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 print:hidden">
          <h2 className="font-bold text-blue-900 mb-2">Agreement Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-blue-700 font-medium">Landlord</p>
              <p className="text-blue-900">{agreement.landlord.display_name}</p>
            </div>
            <div>
              <p className="text-blue-700 font-medium">Tenancy Period</p>
              <p className="text-blue-900">
                {formatTenancyPeriod(agreement.tenancy.start_date, agreement.tenancy.end_date)}
              </p>
            </div>
            <div>
              <p className="text-blue-700 font-medium">Signing Tenant</p>
              <p className="text-blue-900">{agreement.primary_tenant.name}</p>
              {agreement.primary_tenant.room && (
                <p className="text-blue-700 text-xs mt-1">Room: {agreement.primary_tenant.room}</p>
              )}
            </div>
          </div>
          {agreement.other_tenants && agreement.other_tenants.length > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-blue-700 font-medium text-sm">
                Other Tenants ({agreement.other_tenants.length})
              </p>
              <p className="text-blue-900 text-sm">
                {agreement.other_tenants.map((t) => t.name).join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Agreement Document */}
      <div className={`bg-white rounded-lg shadow-md p-8 md:p-12 agreement-document ${className}`}>
        {/* Document Header */}
        <div className="text-center mb-8 pb-8 border-b-2 border-gray-300">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ASSURED SHORTHOLD TENANCY AGREEMENT
          </h1>
          <p className="text-base text-gray-500 mb-2">
            {agreement.is_rolling_monthly ? 'Periodic (Rolling Monthly) Tenancy' : 'Fixed Term Tenancy'}
          </p>
          <p className="text-sm text-gray-600">
            Provided under part 1 of the Housing Act 1988 and amended under part 3 of the Housing
            Act 1996
          </p>
        </div>

        {/* Agreement Sections */}
        {agreement.sections.map((section, index) => (
          <div key={section.id} className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">
                {index + 1}
              </span>
              {section.section_title}
            </h2>
            <div
              className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.section_content) }}
            />
          </div>
        ))}

        {/* Other Tenants Listed (if any) */}
        {showSignatures && agreement.other_tenants && agreement.other_tenants.length > 0 && (
          <div className="mt-12 pt-8 border-t-2 border-gray-300">
            <h3 className="font-bold text-lg mb-3">Other Tenants in this Tenancy:</h3>
            <p className="text-sm text-gray-600 mb-2">
              The following tenants will each sign their own individual agreements:
            </p>
            <ul className="list-disc list-inside text-gray-700">
              {agreement.other_tenants.map((tenant, idx) => (
                <li key={idx} className="py-1">
                  {tenant.name}
                  {tenant.room && (
                    <span className="text-sm text-gray-600"> (Room: {tenant.room})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
