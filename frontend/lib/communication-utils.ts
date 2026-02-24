/**
 * Shared utilities for tenancy communication functionality
 * Used across tenant, admin, and landlord communication pages
 */

// Re-export shared thread utilities
export { formatRelativeTime } from './thread-utils';

// ============================================
// TypeScript Interfaces
// ============================================

export interface MessageAttachment {
  id: number;
  message_id: number;
  file_path: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface CommunicationMessage {
  id: number;
  tenancy_id: number;
  user_id: number;
  content: string;
  created_at: string;
  user_name: string;
  user_role: string;
  attachments: MessageAttachment[];
  is_private?: number; // 0 = public, 1 = private (internal chat)
}

export interface CommunicationThread {
  tenancy: {
    id: number;
    property_address: string;
    start_date: string;
    end_date: string | null;
    status: string;
  };
  messages: CommunicationMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  has_landlord?: boolean; // Whether the property has a landlord (show internal chat if true)
}

export interface TenancyWithCommunication {
  id: number;
  property_address: string;
  start_date: string;
  end_date: string | null;
  status: string;
  message_count: number;
  last_message_at: string | null;
  last_message_preview?: string | null;
  tenant_names: string[];
  landlord_name?: string | null;
  property_id?: number;
}

// ============================================
// Helper Functions
// ============================================

export {
  formatDateWithTime as formatMessageDate,
  formatDateTimeShort as formatMessageDateShort,
} from './dateUtils';


/**
 * Get upload URL for attachments
 */
export const getAttachmentUrl = (filePath: string): string => {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
  // If filePath already includes 'uploads/', use as-is; otherwise prepend the communication uploads path
  if (filePath.startsWith('uploads/')) {
    return `${backendUrl}/${filePath}`;
  }
  return `${backendUrl}/uploads/tenancy-communications/${filePath}`;
};

/**
 * Map API response to CommunicationMessage
 */
export const mapApiMessage = (message: any): CommunicationMessage => ({
  ...message,
  user_name: message.user_name || `${message.first_name || ''} ${message.last_name || ''}`.trim(),
  user_role: message.user_role || message.role || 'tenant',
  attachments: message.attachments || [],
});

export { formatDateMonthShort as formatTenancyDate } from './dateUtils';
