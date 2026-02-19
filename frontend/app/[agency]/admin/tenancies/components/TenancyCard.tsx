'use client';

import type { Tenancy } from '@/lib/types';
import { getStatusLabel } from '@/lib/statusBadges';

// Status group definitions
const STATUS_GROUPS = {
  workflow: ['pending', 'awaiting_signatures', 'signed', 'approval'],
  active: ['active'],
  expired: ['expired']
};

// Get status group for a tenancy
function getStatusGroup(status: string, endDate?: string | null): 'workflow' | 'active' | 'expired' {
  if (STATUS_GROUPS.workflow.includes(status)) return 'workflow';
  if (STATUS_GROUPS.active.includes(status)) return 'active';

  return 'expired';
}

// Status group colors and styling
const STATUS_GROUP_STYLES = {
  workflow: {
    border: 'border-l-amber-500',
    badge: 'bg-amber-100 text-amber-800',
  },
  active: {
    border: 'border-l-green-500',
    badge: 'bg-green-100 text-green-800',
  },
  expired: {
    border: 'border-l-gray-400',
    badge: 'bg-gray-100 text-gray-600',
  }
};

interface TenancyCardProps {
  tenancy: Tenancy;
  onDelete: (id: number, e: React.MouseEvent) => void;
  onView: (id: number) => void;
}

export default function TenancyCard({ tenancy, onDelete, onView }: TenancyCardProps) {
  const statusGroup = getStatusGroup(tenancy.status, tenancy.end_date);
  const styles = STATUS_GROUP_STYLES[statusGroup];

  return (
    <div
      onClick={() => onView(tenancy.id)}
      className={`bg-white rounded-xl shadow hover:shadow-md transition-all cursor-pointer border-l-4 ${styles.border}`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Main Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {tenancy.property_address}
              </h3>
              <div className="flex gap-2 flex-wrap">
                {/* Status Badge */}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles.badge}`}>
                  {getStatusLabel('tenancy', tenancy.status)}
                </span>
                {/* Tenancy Type */}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {getStatusLabel('tenancyType', tenancy.tenancy_type)}
                </span>
                {/* Rolling Monthly */}
                {!!tenancy.is_rolling_monthly && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Rolling
                  </span>
                )}
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              {/* Tenants */}
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tenants</span>
                <div className="mt-1">
                  {tenancy.members && tenancy.members.length > 0 ? (
                    <div className="text-sm text-gray-900">
                      {tenancy.members.slice(0, 2).map((member, idx) => (
                        <span key={member.id}>
                          {member.first_name} {member.last_name}
                          {idx < Math.min(tenancy.members!.length - 1, 1) && ', '}
                        </span>
                      ))}
                      {tenancy.members.length > 2 && (
                        <span className="text-gray-500"> +{tenancy.members.length - 2} more</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">{tenancy.member_count || 0} tenant(s)</span>
                  )}
                </div>
              </div>

              {/* Period */}
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Period</span>
                <div className="mt-1 text-sm text-gray-900">
                  {new Date(tenancy.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' - '}
                  {tenancy.end_date
                    ? new Date(tenancy.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : <span className="text-purple-600">Rolling</span>
                  }
                </div>
              </div>

              {/* Location */}
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Location</span>
                <div className="mt-1 text-sm text-gray-900">
                  {tenancy.location || '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onView(tenancy.id);
              }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              View
            </button>
            <button
              onClick={(e) => onDelete(tenancy.id, e)}
              className="px-3 py-1.5 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
