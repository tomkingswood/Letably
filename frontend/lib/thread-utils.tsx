/**
 * Shared utilities for thread-based components (Communication, Maintenance, etc.)
 * Provides common styling and formatting for message threads across the application
 */

// ============================================
// Role Styling Utilities
// ============================================

/**
 * Get border color class based on user role
 * Used for the left border on message items
 */
export const getRoleBorderColor = (role: string): string => {
  switch (role) {
    case 'admin':
      return 'border-primary';
    case 'landlord':
      return 'border-green-400';
    case 'user':
      return 'border-blue-400';
    default:
      return 'border-gray-300';
  }
};

/**
 * Get role badge styling (background, text color, and label)
 */
export const getRoleBadgeStyle = (role: string): { bg: string; text: string; label: string } => {
  switch (role) {
    case 'admin':
      return { bg: 'bg-primary/10', text: 'text-primary', label: 'Admin' };
    case 'landlord':
      return { bg: 'bg-green-100', text: 'text-green-800', label: 'Landlord' };
    case 'user':
      return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Tenant' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'User' };
  }
};

// ============================================
// Date Formatting Utilities (re-exported from dateUtils)
// ============================================

export {
  getRelativeTime as formatRelativeTime,
} from './dateUtils';

// ============================================
// Reusable Icon Components
// ============================================

export const CloseIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const TrashIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export const AttachmentIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
  </svg>
);

export const WarningIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

// ============================================
// Role Badge Component
// ============================================

interface RoleBadgeProps {
  role: string;
  className?: string;
}

export const RoleBadge = ({ role, className = '' }: RoleBadgeProps) => {
  const style = getRoleBadgeStyle(role);
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${style.bg} ${style.text} ${className}`}>
      {style.label}
    </span>
  );
};
