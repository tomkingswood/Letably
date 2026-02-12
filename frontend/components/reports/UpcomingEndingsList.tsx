'use client';

import Link from 'next/link';
import { UpcomingEnding } from './types';
import { formatCurrency, formatDate } from './utils';
import ReportExportButton from './ReportExportButton';

interface UpcomingEndingsListProps {
  tenancies: UpcomingEnding[];
  showLandlord?: boolean;
  showTenancyLink?: boolean;
  tenancyLinkPrefix?: string;
  onError?: (message: string) => void;
}

export default function UpcomingEndingsList({
  tenancies,
  showLandlord = false,
  showTenancyLink = false,
  tenancyLinkPrefix = '/admin/tenancies',
  onError,
}: UpcomingEndingsListProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Tenancies Ending Soon</h3>
        <ReportExportButton reportType="upcoming-endings" onError={onError} />
      </div>
      <div className="divide-y">
        {tenancies.map((tenancy) => (
          <div key={tenancy.tenancy_id} className="p-4 hover:bg-gray-50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{tenancy.property_address}</h4>
                <p className="text-sm text-gray-600 mt-1">{tenancy.tenants}</p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="text-gray-500">
                    {tenancy.tenant_count} tenant{tenancy.tenant_count !== 1 ? 's' : ''}
                  </span>
                  <span className="text-gray-500">
                    {formatCurrency(tenancy.total_weekly_rent)}/pw
                  </span>
                  {showLandlord && tenancy.landlord_name && (
                    <span className="text-purple-600">
                      {tenancy.landlord_name}
                    </span>
                  )}
                  {tenancy.is_rolling_monthly ? (
                    <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full">
                      Rolling Monthly
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Ends {formatDate(tenancy.end_date)}</p>
                <span className={`inline-block mt-1 px-3 py-1 text-sm font-medium rounded-full ${
                  tenancy.days_until_end <= 7 ? 'bg-red-100 text-red-800' :
                  tenancy.days_until_end <= 30 ? 'bg-amber-100 text-amber-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {tenancy.days_until_end <= 0 ? 'Ending today' :
                   tenancy.days_until_end === 1 ? 'Tomorrow' :
                   `${tenancy.days_until_end} days`}
                </span>
                {showTenancyLink && (
                  <div className="mt-2">
                    <Link
                      href={`${tenancyLinkPrefix}/${tenancy.tenancy_id}`}
                      className="text-primary hover:underline text-sm"
                    >
                      View Tenancy
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
