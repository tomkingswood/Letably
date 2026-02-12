'use client';

import Link from 'next/link';
import { ArrearsItem } from './types';
import { formatCurrency } from './utils';
import ReportExportButton from './ReportExportButton';

interface ArrearsTableProps {
  tenants: ArrearsItem[];
  showLandlord?: boolean;
  showTenancyLink?: boolean;
  tenancyLinkPrefix?: string;
  onError?: (message: string) => void;
}

export default function ArrearsTable({
  tenants,
  showLandlord = false,
  showTenancyLink = false,
  tenancyLinkPrefix = '/admin/tenancies',
  onError,
}: ArrearsTableProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Tenants with Outstanding Payments</h3>
        <ReportExportButton reportType="arrears" onError={onError} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Tenant</th>
              <th className="px-4 py-3 text-left">Property</th>
              {showLandlord && <th className="px-4 py-3 text-left">Landlord</th>}
              <th className="px-4 py-3 text-center">Overdue</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-center">Days</th>
              {showTenancyLink && <th className="px-4 py-3 text-center">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {tenants.map((tenant) => (
              <tr key={tenant.member_id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">{tenant.tenant_name}</p>
                    <p className="text-xs text-gray-500">{tenant.tenant_email}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm">{tenant.property_address}</p>
                  {tenant.bedroom_name && (
                    <p className="text-xs text-gray-500">{tenant.bedroom_name}</p>
                  )}
                </td>
                {showLandlord && (
                  <td className="px-4 py-3 text-sm text-purple-600">
                    {tenant.landlord_name || '-'}
                  </td>
                )}
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                    {tenant.overdue_payments} payment{tenant.overdue_payments !== 1 ? 's' : ''}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-red-600">
                  {formatCurrency(tenant.total_arrears)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    tenant.days_overdue > 30 ? 'bg-red-100 text-red-800' :
                    tenant.days_overdue > 14 ? 'bg-amber-100 text-amber-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {tenant.days_overdue} days
                  </span>
                </td>
                {showTenancyLink && (
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`${tenancyLinkPrefix}/${tenant.tenancy_id}`}
                      className="text-primary hover:underline text-sm"
                    >
                      View Tenancy
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
