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
 * - Landlord preview modal (?section=landlords&action=edit&id=Y)
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

      {/* Agreement Document — uses inline styles so it prints correctly */}
      <div className={`agreement-document ${className}`} style={{ background: '#fff', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '2rem 3rem', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#333' }}>
        {/* Document Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '2px solid #d1d5db' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>
            ASSURED SHORTHOLD TENANCY AGREEMENT
          </h1>
          <p style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '0.5rem' }}>
            Periodic (Rolling Monthly) Tenancy
          </p>
          <p style={{ fontSize: '0.875rem', color: '#4b5563' }}>
            Provided under part 1 of the Housing Act 1988 and amended under part 3 of the Housing
            Act 1996
          </p>
        </div>

        {/* Agreement Sections */}
        {agreement.sections.map((section, index) => (
          <div key={section.id} style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ background: 'var(--agency-primary, #3B82F6)', color: '#fff', width: '2rem', height: '2rem', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', flexShrink: 0, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>
                {index + 1}
              </span>
              {section.section_title}
            </h2>
            <div
              style={{ maxWidth: 'none', color: '#374151', lineHeight: 1.7, fontSize: '0.875rem' }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.section_content) }}
            />
          </div>
        ))}

        {/* Other Tenants Listed (if any) */}
        {showSignatures && agreement.other_tenants && agreement.other_tenants.length > 0 && (
          <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '2px solid #d1d5db' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '0.75rem' }}>Other Tenants in this Tenancy:</h3>
            <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.5rem' }}>
              The following tenants will each sign their own individual agreements:
            </p>
            <ul style={{ listStyleType: 'disc', listStylePosition: 'inside', color: '#374151' }}>
              {agreement.other_tenants.map((tenant, idx) => (
                <li key={idx} style={{ padding: '0.25rem 0' }}>
                  {tenant.name}
                  {tenant.room && (
                    <span style={{ fontSize: '0.875rem', color: '#4b5563' }}> (Room: {tenant.room})</span>
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
