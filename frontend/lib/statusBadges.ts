/**
 * Centralized status badge styling and labels
 * Used across admin pages for consistent status display
 */

export type StatusType =
  | 'application'
  | 'email'
  | 'viewingRequest'
  | 'severity'
  | 'tenancy'
  | 'tenancyType'
  | 'payment'
  | 'paymentType'
  | 'property'
  | 'userRole'
  | 'applicantType'
  | 'maintenance';

interface StatusConfig {
  badge: string;
  label: string;
}

/**
 * Status configurations for different entity types
 */
const STATUS_CONFIGS: Record<StatusType, Record<string, StatusConfig>> = {
  application: {
    pending: {
      badge: 'bg-yellow-600 text-white',
      label: 'Pending'
    },
    awaiting_guarantor: {
      badge: 'bg-orange-600 text-white',
      label: 'Awaiting Guarantor'
    },
    submitted: {
      badge: 'bg-blue-600 text-white',
      label: 'Submitted'
    },
    approved: {
      badge: 'bg-green-600 text-white',
      label: 'Approved'
    },
    converted_to_tenancy: {
      badge: 'bg-purple-600 text-white',
      label: 'Converted to Tenancy'
    },
  },

  email: {
    pending: {
      badge: 'bg-blue-800 text-white',
      label: 'Pending'
    },
    sent: {
      badge: 'bg-blue-800 text-white',
      label: 'Sent'
    },
    failed: {
      badge: 'bg-red-700 text-white',
      label: 'Failed'
    },
  },

  viewingRequest: {
    pending: {
      badge: 'bg-blue-800 text-white',
      label: 'Pending'
    },
    confirmed: {
      badge: 'bg-blue-800 text-white',
      label: 'Confirmed'
    },
    completed: {
      badge: 'bg-blue-800 text-white',
      label: 'Completed'
    },
    cancelled: {
      badge: 'bg-red-700 text-white',
      label: 'Cancelled'
    },
  },

  severity: {
    critical: {
      badge: 'bg-red-700 text-white',
      label: 'Critical'
    },
    medium: {
      badge: 'bg-red-700 text-white',
      label: 'Medium'
    },
    low: {
      badge: 'bg-blue-800 text-white',
      label: 'Low'
    },
  },

  tenancy: {
    pending: {
      badge: 'bg-blue-800 text-white',
      label: 'Pending'
    },
    awaiting_signatures: {
      badge: 'bg-blue-800 text-white',
      label: 'Awaiting Signatures'
    },
    approval: {
      badge: 'bg-blue-800 text-white',
      label: 'Approval'
    },
    active: {
      badge: 'bg-blue-800 text-white',
      label: 'Active'
    },
    awaiting_new_tenancy: {
      badge: 'bg-amber-600 text-white',
      label: 'Awaiting New Tenancy'
    },
    expired: {
      badge: 'bg-red-700 text-white',
      label: 'Expired'
    },
    taken_over: {
      badge: 'bg-purple-700 text-white',
      label: 'Taken Over'
    },
  },

  tenancyType: {
    room_only: {
      badge: 'bg-blue-800 text-white',
      label: 'Room Only'
    },
    whole_house: {
      badge: 'bg-blue-800 text-white',
      label: 'Whole House'
    },
    rolling_monthly: {
      badge: 'bg-blue-800 text-white',
      label: 'Rolling Monthly'
    },
  },

  payment: {
    pending: {
      badge: 'bg-blue-800 text-white',
      label: 'Pending'
    },
    paid: {
      badge: 'bg-blue-800 text-white',
      label: 'Paid'
    },
    partial: {
      badge: 'bg-blue-800 text-white',
      label: 'Partial'
    },
    overdue: {
      badge: 'bg-red-700 text-white',
      label: 'Overdue'
    },
  },

  paymentType: {
    rent: {
      badge: 'bg-blue-800 text-white',
      label: 'Rent'
    },
    deposit: {
      badge: 'bg-blue-800 text-white',
      label: 'Deposit'
    },
    utilities: {
      badge: 'bg-blue-800 text-white',
      label: 'Utilities'
    },
    fees: {
      badge: 'bg-blue-800 text-white',
      label: 'Fees'
    },
    other: {
      badge: 'bg-blue-800 text-white',
      label: 'Other'
    },
  },

  property: {
    live: {
      badge: 'bg-blue-800 text-white',
      label: 'Live'
    },
    unlisted: {
      badge: 'bg-blue-800 text-white',
      label: 'Unlisted'
    },
    draft: {
      badge: 'bg-blue-800 text-white',
      label: 'Draft'
    },
    available: {
      badge: 'bg-blue-800 text-white',
      label: 'Available'
    },
    unavailable: {
      badge: 'bg-blue-800 text-white',
      label: 'Unavailable'
    },
  },

  userRole: {
    admin: {
      badge: 'bg-blue-800 text-white',
      label: 'Admin'
    },
    landlord: {
      badge: 'bg-blue-800 text-white',
      label: 'Landlord'
    },
    user: {
      badge: 'bg-blue-800 text-white',
      label: 'User'
    },
  },

  applicantType: {
    student: {
      badge: 'bg-blue-800 text-white',
      label: 'Student'
    },
    professional: {
      badge: 'bg-blue-800 text-white',
      label: 'Professional'
    },
  },

  maintenance: {
    open: {
      badge: 'bg-yellow-600 text-white',
      label: 'Open'
    },
    in_progress: {
      badge: 'bg-blue-600 text-white',
      label: 'In Progress'
    },
    completed: {
      badge: 'bg-green-600 text-white',
      label: 'Completed'
    },
    closed: {
      badge: 'bg-gray-600 text-white',
      label: 'Closed'
    },
    pending: {
      badge: 'bg-yellow-600 text-white',
      label: 'Pending'
    },
  },
};

/**
 * Get badge CSS classes for a status
 * @param type - Type of entity (application, email, etc.)
 * @param status - Status value
 * @returns Tailwind CSS classes for badge styling
 */
export function getStatusBadge(type: StatusType, status: string): string {
  const config = STATUS_CONFIGS[type]?.[status];
  return config?.badge || 'bg-gray-100 text-gray-800';
}

/**
 * Get human-readable label for a status
 * @param type - Type of entity (application, email, etc.)
 * @param status - Status value
 * @returns Human-readable status label
 */
export function getStatusLabel(type: StatusType, status: string): string {
  const config = STATUS_CONFIGS[type]?.[status];
  return config?.label || status;
}

/**
 * Get both badge classes and label for a status
 * @param type - Type of entity
 * @param status - Status value
 * @returns Object with badge classes and label
 */
export function getStatusConfig(type: StatusType, status: string): StatusConfig {
  return STATUS_CONFIGS[type]?.[status] || {
    badge: 'bg-gray-100 text-gray-800',
    label: status,
  };
}

/**
 * Render a status badge component props
 * @param type - Type of entity
 * @param status - Status value
 * @returns Props object for rendering a badge
 */
export function getStatusBadgeProps(type: StatusType, status: string) {
  const config = getStatusConfig(type, status);
  return {
    className: `inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.badge}`,
    children: config.label,
  };
}
