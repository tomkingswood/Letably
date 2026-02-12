/**
 * Super Admin API Client
 *
 * Handles all API calls for the Letably super admin dashboard.
 */

import axios from 'axios';

const getApiUrl = () => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL_INTERNAL || 'http://localhost:3001/api';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
};

const superApi = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
superApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('super_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Token storage key
const TOKEN_KEY = 'super_token';

export const superAuth = {
  login: (email: string, password: string) =>
    superApi.post('/super/auth/login', { email, password }),

  getCurrentUser: () => superApi.get('/super/auth/me'),

  getToken: () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return null;
  },

  setToken: (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
    }
  },

  clearToken: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
    }
  },
};

export interface Agency {
  id: number;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  logo_url?: string;
  primary_color?: string;
  subscription_tier: 'standard' | 'premium';
  subscription_expires_at?: string;
  is_active: boolean;
  property_images_enabled: boolean;
  created_at: string;
  updated_at: string;
  user_count?: number;
  admin_count?: number;
  property_count?: number;
  active_tenancy_count?: number;
  total_storage_bytes?: number;
}

export interface StorageUsage {
  images_bytes: number;
  certificates_bytes: number;
  maintenance_attachments_bytes: number;
  id_documents_bytes: number;
  export_jobs_bytes: number;
  total_bytes: number;
  total_kb: number;
  total_mb: number;
}

export interface AgencyUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
}

export interface PlatformStats {
  active_agencies: number;
  inactive_agencies: number;
  premium_agencies: number;
  total_users: number;
  total_admins: number;
  total_tenants: number;
  total_landlords: number;
  total_properties: number;
  active_tenancies: number;
  new_agencies_30d: number;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  target_type?: string;
  target_id?: number;
  details?: Record<string, any>;
  ip_address?: string;
  created_at: string;
  super_user_email?: string;
  super_user_first_name?: string;
  super_user_last_name?: string;
}

export interface SuperUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

export const superAgencies = {
  list: (params?: { search?: string; status?: string; subscription_tier?: string }) =>
    superApi.get<{ agencies: Agency[] }>('/super/agencies', { params }),

  get: (id: number | string) =>
    superApi.get<{ agency: Agency; admins: AgencyUser[] }>(`/super/agencies/${id}`),

  toggleStatus: (id: number | string, is_active: boolean) =>
    superApi.patch<{ agency: Agency }>(`/super/agencies/${id}/status`, { is_active }),

  updateSubscription: (id: number | string, data: { subscription_tier?: string; subscription_expires_at?: string | null }) =>
    superApi.patch<{ agency: Agency }>(`/super/agencies/${id}/subscription`, data),

  getUsers: (id: number | string, params?: { role?: string; search?: string }) =>
    superApi.get<{ users: AgencyUser[] }>(`/super/agencies/${id}/users`, { params }),

  impersonate: (agencyId: number | string, userId: number | string) =>
    superApi.post<{ token: string; user: AgencyUser; agency_id: number; message: string }>(
      `/super/agencies/${agencyId}/impersonate/${userId}`
    ),

  togglePropertyImages: (id: number | string, property_images_enabled: boolean) =>
    superApi.patch<{ agency: Agency }>(`/super/agencies/${id}/property-images`, { property_images_enabled }),

  getStorageUsage: (id: number | string) =>
    superApi.get<{ agency_id: number; storage: StorageUsage }>(`/super/agencies/${id}/storage`),
};

export const superStats = {
  getPlatform: () => superApi.get<{ stats: PlatformStats }>('/super/stats'),
};

export const superUsers = {
  list: () => superApi.get<{ users: SuperUser[] }>('/super/users'),

  create: (data: { email: string; password: string; first_name: string; last_name: string }) =>
    superApi.post<{ user: SuperUser }>('/super/users', data),
};

export const superAuditLog = {
  list: (params?: { limit?: number; offset?: number; action?: string; target_type?: string }) =>
    superApi.get<{ audit_log: AuditLogEntry[] }>('/super/audit-log', { params }),
};

// Email Queue Types
export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  from_email: string;
  from_name: string;
  configured: boolean;
}

export interface QueuedEmail {
  id: number;
  agency_id: number;
  agency_name?: string;
  agency_slug?: string;
  to_email: string;
  to_name?: string;
  subject: string;
  html_body: string;
  text_body?: string;
  status: 'pending' | 'sent' | 'failed';
  priority: number;
  retry_count: number;
  error_message?: string;
  scheduled_at?: string;
  sent_at?: string;
  created_at: string;
}

export interface EmailQueueStats {
  overall: {
    pending: number;
    sent: number;
    failed: number;
    total: number;
  };
  by_agency: Array<{
    agency_id: number;
    agency_name: string;
    agency_slug: string;
    pending: number;
    sent: number;
    failed: number;
    total: number;
  }>;
  recent: {
    sent_24h: number;
    failed_24h: number;
    queued_24h: number;
  };
}

export const superEmail = {
  // SMTP Settings (read-only from .env)
  getSmtpSettings: () =>
    superApi.get<{ settings: SmtpSettings }>('/super/email/smtp-settings'),

  testConnection: () =>
    superApi.post<{ success: boolean; message: string }>('/super/email/test-connection'),

  sendTestEmail: (to_email: string) =>
    superApi.post<{ success: boolean; message?: string; messageId?: string; error?: string }>(
      '/super/email/test-send',
      { to_email }
    ),

  // Email Queue
  getQueue: (params?: { status?: string; agency_id?: number; limit?: number; offset?: number }) =>
    superApi.get<{
      emails: QueuedEmail[];
      stats: { pending: number; sent: number; failed: number; total: number };
      pagination: { limit: number; offset: number };
    }>('/super/email/queue', { params }),

  getQueueStats: () =>
    superApi.get<EmailQueueStats>('/super/email/queue/stats'),

  retryEmail: (id: number) =>
    superApi.post<{ email: QueuedEmail }>(`/super/email/queue/${id}/retry`),

  deleteEmail: (id: number) =>
    superApi.delete<{ success: boolean }>(`/super/email/queue/${id}`),

  bulkDelete: (status: string, older_than_days?: number) =>
    superApi.delete<{ success: boolean; deleted_count: number }>('/super/email/queue/bulk', {
      data: { status, older_than_days },
    }),
};

export default superApi;
