'use client';

import Link from 'next/link';
import {
  TenancyWithCommunication,
  formatRelativeTime,
  formatTenancyDate,
} from '@/lib/communication-utils';
import { getStatusLabel } from '@/lib/statusBadges';

const getTenancyStatusBadge = (status: string): string => {
  const badges: Record<string, string> = {
    active: 'bg-green-100 text-green-800 border-green-200',
    signed: 'bg-blue-100 text-blue-800 border-blue-200',
    awaiting_signatures: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    pending: 'bg-gray-100 text-gray-800 border-gray-200',
    expired: 'bg-red-100 text-red-800 border-red-200',
  };
  return badges[status] || 'bg-gray-100 text-gray-800 border-gray-200';
};

interface CommunicationListItemProps {
  tenancy: TenancyWithCommunication;
  href: string;
  showLandlord?: boolean;
  showMessagePreview?: boolean;
  variant?: 'full' | 'compact';
}

/**
 * Shared component for displaying a tenancy communication item in a list.
 * Used across admin and landlord communication pages.
 */
export default function CommunicationListItem({
  tenancy,
  href,
  showLandlord = false,
  showMessagePreview = false,
  variant = 'full',
}: CommunicationListItemProps) {
  const isCompact = variant === 'compact';

  return (
    <Link
      href={href}
      className={`block bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow ${
        isCompact ? 'p-4' : 'p-6'
      }`}
    >
      <div className={`flex ${isCompact ? 'items-start' : 'flex-col md:flex-row md:items-start'} justify-between gap-4`}>
        <div className="flex-1 min-w-0">
          {/* Property Address & Status */}
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <h3 className="font-semibold text-gray-900 truncate">{tenancy.property_address}</h3>
            {!isCompact && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getTenancyStatusBadge(tenancy.status)}`}>
                {getStatusLabel('tenancy', tenancy.status)}
              </span>
            )}
          </div>

          {/* Tenant Names */}
          <div className={`text-sm text-gray-600 ${isCompact ? 'mb-1' : 'mb-2'}`}>
            {showLandlord ? (
              <span><span className="font-medium">Tenants:</span> {tenancy.tenant_names?.join(', ') || 'No tenants'}</span>
            ) : (
              <span>Tenants: {tenancy.tenant_names?.join(', ') || 'No tenants'}</span>
            )}
          </div>

          {/* Landlord (admin view only) */}
          {showLandlord && tenancy.landlord_name && (
            <div className="text-sm text-gray-500 mb-2">
              <span className="font-medium">Landlord:</span> {tenancy.landlord_name}
            </div>
          )}

          {/* Message Preview (admin view only) */}
          {showMessagePreview && tenancy.last_message_preview && (
            <div className="text-sm text-gray-500 italic mt-2 bg-gray-50 p-2 rounded">
              "{tenancy.last_message_preview}"
            </div>
          )}

          {/* Tenancy Dates (full variant) */}
          {!isCompact && (
            <p className="text-xs text-gray-500">
              {formatTenancyDate(tenancy.start_date)}
              {tenancy.end_date && ` - ${formatTenancyDate(tenancy.end_date)}`}
            </p>
          )}

          {/* Message count and last message (compact variant) */}
          {isCompact && (
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500">
                {tenancy.message_count} message{tenancy.message_count !== 1 ? 's' : ''}
              </span>
              {tenancy.last_message_at && (
                <span className="text-xs text-gray-500">
                  Last: {formatRelativeTime(tenancy.last_message_at)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right Side - Status & Message Info */}
        <div className={`flex flex-col items-end gap-2 ${isCompact ? '' : 'flex-shrink-0'}`}>
          {/* Status Badge (compact variant) */}
          {isCompact && (
            <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap border ${getTenancyStatusBadge(tenancy.status)}`}>
              {getStatusLabel('tenancy', tenancy.status)}
            </span>
          )}

          {/* Message Count & Last Message (full variant) */}
          {!isCompact && (
            <>
              {tenancy.message_count > 0 ? (
                <>
                  <div className="flex items-center gap-1 text-sm font-medium text-primary">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>{tenancy.message_count} message{tenancy.message_count !== 1 ? 's' : ''}</span>
                  </div>
                  {tenancy.last_message_at && (
                    <span className="text-xs text-gray-500">
                      Last: {formatRelativeTime(tenancy.last_message_at)}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm text-gray-400">No messages</span>
              )}

              {/* Tenancy Dates */}
              <span className="text-xs text-gray-500">
                {formatTenancyDate(tenancy.start_date)}
                {tenancy.end_date && ` - ${formatTenancyDate(tenancy.end_date)}`}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * Empty state component for when there are no tenancies
 */
export function CommunicationEmptyState({
  title = 'No tenancies found',
  message = 'Try adjusting your filters or check back later.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-md p-8 text-center">
      <div className="text-gray-400 text-5xl mb-4">
        <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{message}</p>
    </div>
  );
}
