/**
 * Shared utilities for maintenance request functionality
 * Used across tenant, admin, and landlord maintenance pages
 */

// ============================================
// TypeScript Interfaces
// ============================================

export interface MaintenanceAttachment {
  id: number;
  comment_id: number;
  file_path: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface MaintenanceComment {
  id: number;
  user_id: number;
  comment_type: 'comment' | 'status_change' | 'priority_change';
  content: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user_name: string;
  user_role: string;
  attachments?: MaintenanceAttachment[];
  is_private?: number; // 0 = public, 1 = private (internal chat)
}

export interface MaintenanceRequestBase {
  id: number;
  tenancy_id: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRequestDetail extends MaintenanceRequestBase {
  creator_name: string;
  creator_email: string;
  property_address: string;
  property_id?: number;
  property_location?: string;
  comments: MaintenanceComment[];
  has_landlord?: boolean; // Whether the property has a landlord (show internal chat if true)
}

export interface MaintenanceRequestListItem extends MaintenanceRequestBase {
  address_line1: string;
  address_line2?: string;
  city: string;
  postcode?: string;
  created_by_first_name?: string;
  created_by_last_name?: string;
  comment_count?: number;
  attachment_count?: number;
}

export interface MaintenanceSummary {
  total: number;
  submitted: number;
  in_progress: number;
  completed: number;
  high_priority?: number;
}

// ============================================
// Constants
// ============================================

export interface CategoryInfo {
  value: string;
  label: string;
  icon: string;
}

export interface PriorityInfo {
  value: string;
  label: string;
  color: string;
}

export interface StatusInfo {
  value: string;
  label: string;
  color: string;
}

export const MAINTENANCE_CATEGORIES: CategoryInfo[] = [
  { value: 'plumbing', label: 'Plumbing', icon: '🔧' },
  { value: 'electrical', label: 'Electrical', icon: '⚡' },
  { value: 'heating', label: 'Heating', icon: '🔥' },
  { value: 'appliances', label: 'Appliances', icon: '🔌' },
  { value: 'structural', label: 'Structural', icon: '🏗️' },
  { value: 'pest_control', label: 'Pest Control', icon: '🐛' },
  { value: 'general', label: 'General', icon: '🔨' },
  { value: 'other', label: 'Other', icon: '📋' },
];

export const MAINTENANCE_PRIORITIES: PriorityInfo[] = [
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-800 border-red-200' },
];

export const MAINTENANCE_STATUSES: StatusInfo[] = [
  { value: 'submitted', label: 'Submitted', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800 border-green-200' },
];

// Maps for quick lookup
export const CATEGORIES_MAP: Record<string, CategoryInfo> = Object.fromEntries(
  MAINTENANCE_CATEGORIES.map(c => [c.value, c])
);

export const PRIORITIES_MAP: Record<string, PriorityInfo> = Object.fromEntries(
  MAINTENANCE_PRIORITIES.map(p => [p.value, p])
);

export const STATUSES_MAP: Record<string, StatusInfo> = Object.fromEntries(
  MAINTENANCE_STATUSES.map(s => [s.value, s])
);

// ============================================
// Helper Functions
// ============================================

/**
 * Get category info by value
 */
export const getCategoryInfo = (category: string): CategoryInfo => {
  return CATEGORIES_MAP[category] || { value: category, label: category, icon: '📋' };
};

/**
 * Get priority info by value
 */
export const getPriorityInfo = (priority: string): PriorityInfo => {
  return PRIORITIES_MAP[priority] || PRIORITIES_MAP.medium;
};

/**
 * Get status info by value
 */
export const getStatusInfo = (status: string): StatusInfo => {
  return STATUSES_MAP[status] || STATUSES_MAP.submitted;
};

/**
 * Get priority color class (for badges without border)
 */
export const getPriorityColor = (priority: string): string => {
  return getPriorityInfo(priority).color;
};

/**
 * Get status color class (for badges without border)
 */
export const getStatusColor = (status: string): string => {
  return getStatusInfo(status).color;
};

export {
  formatDateWithTime as formatMaintenanceDate,
  formatDateTimeShort as formatMaintenanceDateShort,
  formatDateMonthShort as formatMaintenanceDateOnly,
} from './dateUtils';

/**
 * Format status for display (handle snake_case)
 */
export const formatStatusLabel = (status: string): string => {
  return getStatusInfo(status).label;
};

/**
 * Map API response to MaintenanceComment
 */
export const mapApiComment = (comment: any): MaintenanceComment => ({
  ...comment,
  user_name: comment.user_name || `${comment.first_name} ${comment.last_name}`,
  user_role: comment.user_role || comment.role,
  attachments: comment.attachments || [],
});

// ============================================
// Attachment URL Helper
// ============================================

/**
 * Get upload URL for attachments
 */
export const getAttachmentUrl = (filePath: string): string => {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
  if (filePath.startsWith('uploads/')) {
    return `${backendUrl}/${filePath}`;
  }
  return `${backendUrl}/uploads/maintenance/${filePath}`;
};
