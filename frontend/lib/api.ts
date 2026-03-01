import axios from 'axios';
import type {
  AgencySettingsUpdate,
  PropertyFormData,
  BedroomFormData,
  LandlordFormData,
  AgreementTestData,
  ReminderThreshold,
  ManualReminderFormData,
  ApplicationFormData,
  HoldingDepositFormData,
} from './types';

// Use internal URL for server-side requests, public URL for client-side
const getApiUrl = () => {
  // Server-side: use localhost
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL_INTERNAL || 'http://localhost:3001/api';
  }
  // Client-side: use public URL
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
};

const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Current agency slug for multi-tenancy
let currentAgencySlug: string | null = null;

/**
 * Set the current agency slug for API requests
 * Also persists to localStorage as fallback for non-agency pages
 */
export const setAgencySlug = (slug: string | null) => {
  currentAgencySlug = slug;
  // Persist for non-agency pages (landlord portal, tenant portal, etc.)
  if (typeof window !== 'undefined' && slug) {
    localStorage.setItem('lastAgencySlug', slug);
  }
};

/**
 * Get the current agency slug
 */
export const getAgencySlug = () => currentAgencySlug;

/**
 * Get the effective agency slug (current or last used)
 * For non-agency pages that need to know which agency context to use
 */
export const getEffectiveAgencySlug = () => {
  if (currentAgencySlug) return currentAgencySlug;
  if (typeof window !== 'undefined') {
    return localStorage.getItem('lastAgencySlug');
  }
  return null;
};

/**
 * Get the current auth token (agency-scoped)
 * Use this for direct fetch calls that bypass the axios interceptor
 */
export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  const effectiveSlug = getEffectiveAgencySlug();
  const tokenKey = getTokenKey(effectiveSlug);
  return localStorage.getItem(tokenKey);
};

/**
 * Get the user key for the effective agency
 */
const getUserKey = (agencySlug: string | null) =>
  agencySlug ? `user_${agencySlug}` : 'user';

/**
 * Get the stored user data (agency-scoped)
 * For non-agency pages that need to check user role
 */
export const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  const effectiveSlug = getEffectiveAgencySlug();
  const userKey = getUserKey(effectiveSlug);
  const userData = localStorage.getItem(userKey);
  if (!userData) return null;
  try {
    return JSON.parse(userData);
  } catch {
    return null;
  }
};

/**
 * Get the agency-specific token key
 */
const getTokenKey = (agencySlug: string | null) =>
  agencySlug ? `token_${agencySlug}` : 'token';

// Add auth token and agency context to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // Get effective agency slug (current context or fallback to last used)
    const effectiveSlug = getEffectiveAgencySlug();

    // Add auth token (agency-scoped to support multi-tab with different agencies)
    const tokenKey = getTokenKey(effectiveSlug);
    const token = localStorage.getItem(tokenKey);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add agency slug header if set
    if (effectiveSlug) {
      config.headers['X-Agency-Slug'] = effectiveSlug;
    }
  }
  return config;
});

// Handle 401 responses globally - clear auth and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const effectiveSlug = getEffectiveAgencySlug();
      const tokenKey = getTokenKey(effectiveSlug);
      const userKey = effectiveSlug ? `user_${effectiveSlug}` : 'user';

      // Only redirect if we had a token (avoid redirect loops on login page)
      const hadToken = localStorage.getItem(tokenKey);
      if (hadToken) {
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userKey);
        const currentPath = window.location.pathname;
        const loginPath = effectiveSlug ? `/${effectiveSlug}/login` : '/login';
        // Don't redirect if already on a login or public page
        if (!currentPath.includes('/login') && !currentPath.includes('/setup-password') && !currentPath.includes('/reset-password')) {
          window.location.href = `${loginPath}?returnUrl=${encodeURIComponent(currentPath)}`;
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Agency API
export const agencies = {
  // Public
  getBySlug: (slug: string) => api.get(`/agencies/${slug}`),
  register: (data: {
    agency_name: string;
    agency_email: string;
    agency_phone?: string;
    admin_email: string;
    admin_password: string;
    admin_first_name: string;
    admin_last_name: string;
    admin_phone?: string;
  }) => api.post('/agencies/register', data),

  // Protected (require auth)
  getCurrent: () => api.get('/agencies/current'),
  updateBranding: (data: {
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    show_powered_by?: boolean;
  }) => api.put('/agencies/branding', data),
  getSettings: () => api.get('/agencies/settings'),
  updateSettings: (data: AgencySettingsUpdate) => api.put('/agencies/settings', data),
};

// Auth API
export const auth = {
  login: (email: string, password: string, agency_slug?: string) =>
    api.post('/auth/login', { email, password, agency_slug: agency_slug || currentAgencySlug }),
  register: (data: { email: string; password: string; first_name: string; last_name: string; phone?: string }) =>
    api.post('/auth/register', data),
  getCurrentUser: () => api.get('/auth/me'),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),
  // Password setup (for admin-created accounts)
  validateSetupToken: (token: string) =>
    api.get(`/auth/setup/${token}`),
  setPasswordWithToken: (token: string, password: string) =>
    api.post(`/auth/setup/${token}`, { password }),
  // Change password (for forced password change)
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  // Update own account
  updateMyAccount: (data: { first_name: string; last_name: string; phone?: string }) =>
    api.put('/auth/me', data),
  // Admin user management (for migration)
  adminCreateUser: (data: { email: string; first_name: string; last_name: string; phone?: string; role?: 'tenant' | 'landlord' | 'admin' }) =>
    api.post('/auth/admin/users', data),
  adminGetUsers: (params?: { search?: string; excludeAdmins?: boolean }) =>
    api.get('/auth/admin/users', { params }),
  adminGetUser: (id: number | string) =>
    api.get(`/auth/admin/users/${id}`),
  adminUpdateUser: (id: number | string, data: { email?: string; first_name?: string; last_name?: string; phone?: string }) =>
    api.put(`/auth/admin/users/${id}`, data),
  adminResetPassword: (id: number | string, send_email: boolean = true) =>
    api.post(`/auth/admin/users/${id}/reset-password`, { send_email }),
  adminDeleteUser: (id: number | string) =>
    api.delete(`/auth/admin/users/${id}`),
};

// Properties API
export const properties = {
  getAll: (filters?: { location?: string; bedrooms?: string; letting_type?: string }) =>
    api.get('/properties', { params: filters }),
  getById: (id: string | number) =>
    api.get(`/properties/${id}`),
  create: (data: PropertyFormData) => api.post('/properties', data),
  update: (id: string | number, data: Partial<PropertyFormData>) => api.put(`/properties/${id}`, data),
  delete: (id: string | number) => api.delete(`/properties/${id}`),
  updateDisplayOrder: (propertyIds: number[]) => api.patch('/properties/reorder', { propertyIds }),
};

// Bedrooms API
export const bedrooms = {
  getByProperty: (propertyId: string | number) =>
    api.get(`/bedrooms/property/${propertyId}`),
  create: (propertyId: string | number, data: BedroomFormData) =>
    api.post(`/bedrooms/property/${propertyId}`, data),
  update: (id: string | number, data: Partial<BedroomFormData>) => api.put(`/bedrooms/${id}`, data),
  delete: (id: string | number) => api.delete(`/bedrooms/${id}`),
  reorder: (propertyId: string | number, bedroomIds: number[]) =>
    api.patch(`/bedrooms/property/${propertyId}/reorder`, { bedroomIds }),
};

// Images API
export const images = {
  upload: (formData: FormData) =>
    api.post('/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id: string | number) => api.delete(`/images/${id}`),
  setPrimary: (id: string | number) => api.put(`/images/${id}/primary`),
  linkToBedroom: (imageId: string | number, bedroomId: string | number) =>
    api.post(`/images/${imageId}/link-bedroom`, { bedroom_id: bedroomId }),
  unlinkFromBedroom: (imageId: string | number, bedroomId: string | number) =>
    api.post(`/images/${imageId}/unlink-bedroom`, { bedroom_id: bedroomId }),
};

// Viewing Requests API
export const viewingRequests = {
  create: (data: {
    property_id: number;
    name: string;
    email: string;
    phone: string;
    message?: string;
    preferred_date?: string;
    preferred_time?: string;
    website?: string; // Honeypot field
  }) => api.post('/viewing-requests', data),
  createAdmin: (data: {
    property_id: number;
    visitor_name: string;
    visitor_email: string;
    visitor_phone?: string;
    message?: string;
    preferred_date?: string;
    preferred_time?: string;
  }) => api.post('/viewing-requests/admin', data),
  getAll: () => api.get('/viewing-requests'),
  getPendingCount: () => api.get('/viewing-requests/count/pending'),
  updateStatus: (id: string | number, status: string) =>
    api.patch(`/viewing-requests/${id}/status`, { status }),
  updateDate: (id: string | number, preferred_date: string) =>
    api.patch(`/viewing-requests/${id}/date`, { preferred_date }),
  delete: (id: string | number) => api.delete(`/viewing-requests/${id}`),
  bulkDelete: (ids: (string | number)[]) =>
    api.post('/viewing-requests/bulk-delete', { ids }),
};

// Users API (Admin only)
export const users = {
  lookupByEmail: (email: string) => api.get(`/users/lookup?email=${encodeURIComponent(email)}`),
};

// Landlords API (Admin only)
export const landlords = {
  getAll: () => api.get('/landlords'),
  getById: (id: string | number) => api.get(`/landlords/${id}`),
  create: (data: LandlordFormData) => api.post('/landlords', data),
  update: (id: string | number, data: Partial<LandlordFormData>) => api.put(`/landlords/${id}`, data),
  delete: (id: string | number) => api.delete(`/landlords/${id}`),
  previewAgreement: (id: string | number, tenancyType: 'room_only' | 'whole_house', testData?: AgreementTestData) =>
    api.post(`/landlords/${id}/preview-agreement`, { tenancyType, testData }),
};

// Settings API
export const settings = {
  getAll: () => api.get('/settings'), // Public - get all settings
  update: (data: {
    phone_number: string;
    email_address: string;
    facebook_url?: string;
    twitter_url?: string;
    instagram_url?: string;
    company_name: string;
    redress_scheme_name: string;
    redress_scheme_number: string;
    redress_scheme_url?: string;
    cmp_certificate_filename?: string;
    prs_certificate_filename?: string;
    privacy_policy_filename?: string;
    cmp_certificate_expiry?: string;
    prs_certificate_expiry?: string;
    ico_certificate_filename?: string;
    ico_certificate_expiry?: string;
    viewing_min_days_advance?: string;
    holding_deposit_enabled?: string;
    holding_deposit_type?: string;
    holding_deposit_amount?: string;
  }) => api.put('/settings', data), // Admin only - update settings
};


// SMTP API (Admin only)
export const smtp = {
  getSettings: () => api.get('/smtp/settings'),
  updateEmailMode: (email_mode: 'platform' | 'custom') =>
    api.patch('/smtp/email-mode', { email_mode }),
  updateSettings: (data: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password?: string;
    from_email: string;
    from_name: string;
    sending_paused?: boolean;
    queue_interval_seconds?: number;
  }) => api.put('/smtp/settings', data),
  testConnection: () => api.post('/smtp/test-connection'),
  sendTestEmail: (to_email: string) =>
    api.post('/smtp/test-email', { to_email }),
};

// Email Queue API (Admin only)
export const emailQueue = {
  getAll: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get('/email-queue', { params }),
  getById: (id: string | number) => api.get(`/email-queue/${id}`),
  getStats: () => api.get('/email-queue/stats'),
  getProcessorStatus: () => api.get('/email-queue/processor-status'),
  retry: (id: string | number) => api.post(`/email-queue/${id}/retry`),
  retryEmail: (id: string | number) => api.post(`/email-queue/${id}/retry`),
  deleteEmail: (id: string | number) => api.delete(`/email-queue/${id}`),
  processQueue: (limit?: number) => api.post('/email-queue/process', { limit }),
  deleteAllProcessed: () => api.delete('/email-queue/delete-processed'),
  deleteAll: () => api.delete('/email-queue/delete-all'),
};

// Reminders API (Admin only)
export const reminders = {
  // Get all active reminders (automated + manual)
  getAll: () => api.get('/reminders'),
  // Get reminder count for badge
  getCount: () => api.get('/reminders/count'),
  // Threshold settings
  getThresholds: () => api.get('/reminders/thresholds'),
  updateThresholds: (data: { thresholds: ReminderThreshold[] }) => api.put('/reminders/thresholds', data),
  reorderThresholds: (thresholdIds: number[]) => api.patch('/reminders/thresholds/reorder', { thresholdIds }),
  // Manual reminders
  getAllManual: () => api.get('/reminders/manual'),
  createManual: (data: {
    title: string;
    description?: string;
    reminder_date: string;
    severity: 'low' | 'medium' | 'critical';
    property_id?: number;
  }) => api.post('/reminders/manual', data),
  updateManual: (id: string | number, data: ManualReminderFormData) => api.put(`/reminders/manual/${id}`, data),
  deleteManual: (id: string | number) => api.delete(`/reminders/manual/${id}`),
  // Dismiss reminder
  dismiss: (id: string | number) => api.post(`/reminders/${id}/dismiss`),
  // Email processing
  processEmails: () => api.post('/reminders/process-emails'),
};

// Applications API
export const applications = {
  // Admin routes
  create: (data: {
    user_id: number | null;
    application_type: 'student' | 'professional';
    guarantor_required?: boolean;
    // New user fields (required when user_id is null)
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    is_new_user?: boolean;
    send_welcome_email?: boolean;
    // Holding deposit fields
    property_id?: number;
    bedroom_id?: number;
    reservation_days?: number;
    deposit_amount_override?: number;
  }) => api.post('/applications', data),
  getAll: (params?: { status?: string; application_type?: string }) =>
    api.get('/applications/all', { params }),
  getByIdAdmin: (id: string | number) => api.get(`/applications/admin/${id}`),
  delete: (id: string | number) => api.delete(`/applications/${id}`),
  regenerateGuarantorToken: (id: string | number) =>
    api.post(`/applications/${id}/regenerate-guarantor-token`),
  approve: (id: string | number) =>
    api.post(`/applications/${id}/approve`),

  // User routes
  getMyApplications: () => api.get('/applications/my-applications'),
  getById: (id: string | number) => api.get(`/applications/${id}`),
  update: (id: string | number, data: ApplicationFormData) => api.put(`/applications/${id}`, data),
  submit: (id: string | number, data: ApplicationFormData) => api.put(`/applications/${id}`, { ...data, submit: true }),

  // Public guarantor routes (no auth)
  getByGuarantorToken: (token: string) =>
    axios.get(`${getApiUrl()}/applications/guarantor/${token}`),
  submitGuarantorForm: (token: string, data: {
    guarantor_name: string;
    guarantor_dob: string;
    guarantor_relationship: string;
    guarantor_email: string;
    guarantor_phone: string;
    guarantor_address: string;
    guarantor_id_type: string;
    guarantor_signature_name: string;
    guarantor_signature_agreed: boolean;
  }) => axios.post(`${getApiUrl()}/applications/guarantor/${token}`, data),

  // ID Document routes
  uploadApplicantId: (id: string | number, file: File) => {
    const formData = new FormData();
    formData.append('id_document', file);
    return api.post(`/applications/${id}/upload-id`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  uploadGuarantorId: (token: string, file: File) => {
    const formData = new FormData();
    formData.append('id_document', file);
    return axios.post(`${getApiUrl()}/applications/guarantor/${token}/upload-id`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getIdDocumentStatus: (id: string | number, type: 'applicant_id' | 'guarantor_id' = 'applicant_id') =>
    api.get(`/applications/${id}/id-document/status?type=${type}`),
  getIdDocumentUrl: (id: string | number, type: 'applicant_id' | 'guarantor_id' = 'applicant_id') =>
    `${getApiUrl()}/applications/${id}/id-document?type=${type}`,
  deleteApplicantId: (id: string | number, type: 'applicant_id' | 'guarantor_id' = 'applicant_id') =>
    api.delete(`/applications/${id}/delete-id?type=${type}`),
  deleteGuarantorId: (token: string) =>
    axios.delete(`${getApiUrl()}/applications/guarantor/${token}/delete-id`),
  getGuarantorIdDocumentStatus: (token: string) =>
    axios.get(`${getApiUrl()}/applications/guarantor/${token}/id-document/status`),
  getGuarantorIdDocumentUrl: (token: string) =>
    `${getApiUrl()}/applications/guarantor/${token}/id-document`,
};

// Tenancies API (Admin only)
export const tenancies = {
  getAll: (params?: {
    search?: string;
    status?: string;
    statusGroup?: 'workflow' | 'active' | 'expired';
    type?: 'room_only' | 'whole_house' | 'rolling_monthly';
    property_id?: string | number;
    startDateFrom?: string;
    startDateTo?: string;
  }) => api.get('/tenancies', { params }),
  getById: (id: string | number) => api.get(`/tenancies/${id}`),
  getCompletedApplicationsByProperty: () => api.get('/tenancies/completed-applications'),
  getApprovedApplicants: () => api.get('/tenancies/approved-applicants'),
  create: (data: {
    property_id: number;
    tenancy_type: 'room_only' | 'whole_house';
    start_date: string;
    end_date: string;
    status?: string;
    is_rolling_monthly?: boolean;
    auto_generate_payments?: boolean;
    members: Array<{
      application_id: number;
      bedroom_id?: number;
      rent_pppw: number;
      deposit_amount: number;
      holding_deposit_id?: number;
      holding_deposit_apply_to?: 'first_rent' | 'tenancy_deposit';
    }>;
  }) => api.post('/tenancies', data),
  update: (id: string | number, data: {
    start_date: string;
    end_date: string;
    status: string;
    auto_generate_payments?: boolean;
  }) => api.put(`/tenancies/${id}`, data),
  updateMember: (tenancyId: string | number, memberId: string | number, data: {
    bedroom_id?: number | null;
    rent_pppw?: number;
    deposit_amount?: number;
  }) => api.put(`/tenancies/${tenancyId}/members/${memberId}`, data),
  delete: (id: string | number) => api.delete(`/tenancies/${id}`),
  generateAgreement: (tenancyId: string | number, memberId?: string | number) =>
    memberId
      ? api.get(`/tenancies/${tenancyId}/members/${memberId}/agreement`)
      : api.get(`/tenancies/${tenancyId}/agreement`),
  // Tenant signing endpoints
  getMyPendingTenancies: () => api.get('/tenancies/my-pending-tenancies'),
  getPendingAgreements: () => api.get('/tenancies/my-pending-agreements'),
  getMyActiveTenancy: (tenancyId?: number) => api.get('/tenancies/my-tenancy', { params: tenancyId ? { tenancyId } : {} }),
  getMyStatus: () => api.get('/tenancies/my-status'),
  getTenantAgreement: (tenancyId: string | number, memberId: string | number) =>
    api.get(`/tenancies/${tenancyId}/members/${memberId}/sign`),
  signAgreement: (tenancyId: string | number, memberId: string | number, signature_data: string, payment_option: string) =>
    api.post(`/tenancies/${tenancyId}/members/${memberId}/sign`, { signature_data, payment_option }),
  // Key tracking (member-level)
  updateMemberKeyTracking: (tenancyId: string | number, memberId: string | number, data: {
    key_status?: 'not_collected' | 'collected' | 'returned';
    key_collection_date?: string | null;
    key_return_date?: string | null;
  }) => api.put(`/tenancies/${tenancyId}/members/${memberId}/key-tracking`, data),
  // Revert member signature (admin only)
  revertMemberSignature: (tenancyId: string | number, memberId: string | number) =>
    api.post(`/tenancies/${tenancyId}/members/${memberId}/revert-signature`),
  createDepositReturnSchedules: (id: string | number) =>
    api.post(`/tenancies/${id}/deposit-return-schedules`),
  // Guarantor agreements (admin)
  getGuarantorAgreements: (tenancyId: string | number) =>
    api.get(`/tenancies/${tenancyId}/guarantor-agreements`),
  regenerateGuarantorAgreementToken: (tenancyId: string | number, agreementId: string | number) =>
    api.post(`/tenancies/${tenancyId}/guarantor-agreements/${agreementId}/regenerate-token`),
  // Create rolling tenancy from existing
  createRollingFromExisting: (tenancyId: string | number, data: {
    start_date: string;
    end_date?: string | null;
    members: Array<{
      member_id: number;
      bedroom_id?: number | null;
      rent_pppw?: number;
      deposit_amount?: number;
    }>;
  }) => api.post(`/tenancies/${tenancyId}/create-rolling`, data),
  // Migration tenancy (admin only - no application required)
  createMigration: (data: {
    property_id: number;
    tenancy_type: 'room_only' | 'whole_house';
    start_date: string;
    end_date?: string;
    is_rolling_monthly?: boolean;
    auto_generate_payments?: boolean;
    send_portal_email?: boolean;
    members: Array<{
      user_id: number;
      first_name: string;
      surname: string;
      bedroom_id?: number;
      rent_pppw: number;
      deposit_amount: number;
      payment_option?: 'monthly' | 'quarterly' | 'upfront';
    }>;
  }) => api.post('/tenancies/migration', data),
};

// Guarantor API (public endpoints)
export const guarantor = {
  getAgreementByToken: (token: string) => api.get(`/guarantor/${token}`),
  signAgreement: (token: string, signature_data: string) =>
    api.post(`/guarantor/${token}/sign`, { signature_data }),
  getSignedAgreement: (token: string) => api.get(`/guarantor/${token}/signed`),
};

// Landlord Panel API (landlord role only)
export const landlordPanel = {
  getInfo: () => api.get('/landlord-panel/info'),
  getTenancies: () => api.get('/landlord-panel/tenancies'),
  getTenancyDetails: (tenancyId: string | number) => api.get(`/landlord-panel/tenancies/${tenancyId}`),
  getPaymentSchedules: (params?: { year?: number; month?: number }) =>
    api.get('/landlord-panel/payment-schedules', { params }),
  // Maintenance
  getMaintenanceRequests: (params?: { status?: string; tenancy_id?: string }) =>
    api.get('/landlord-panel/maintenance', { params }),
  getMaintenanceRequestById: (requestId: string | number) =>
    api.get(`/landlord-panel/maintenance/${requestId}`),
  updateMaintenanceRequest: (requestId: string | number, data: { status?: string; priority?: string }) =>
    api.put(`/landlord-panel/maintenance/${requestId}`, data),
  addMaintenanceComment: (requestId: string | number, content: string, files?: File[], isPrivate: boolean = false) => {
    if (files && files.length > 0) {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('is_private', isPrivate ? 'true' : 'false');
      files.forEach(file => formData.append('attachments', file));
      return api.post(`/landlord-panel/maintenance/${requestId}/comments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post(`/landlord-panel/maintenance/${requestId}/comments`, { content, is_private: isPrivate });
  },
  // Statements
  getStatementPeriods: () => api.get('/landlord-panel/statements/periods'),
  getMonthlyStatement: (year: number, month: number) =>
    api.get(`/landlord-panel/statements/${year}/${month}`),
  getAnnualSummary: (year: number) =>
    api.get(`/landlord-panel/statements/${year}/annual`),
  downloadStatementPDF: (year: number, month: number) =>
    `${getApiUrl()}/landlord-panel/statements/${year}/${month}/pdf`,
  downloadAnnualStatementPDF: (year: number) =>
    `${getApiUrl()}/landlord-panel/statements/${year}/annual/pdf`,
  // Reports (use unified /reports/ endpoints)
  getPortfolioOverview: () => api.get('/reports/overview'),
  getOccupancyReport: () => api.get('/reports/occupancy'),
  getFinancialReport: (year?: number) =>
    api.get('/reports/financial', { params: year ? { year } : undefined }),
  getArrearsReport: () => api.get('/reports/arrears'),
  getUpcomingEndings: (days?: number) =>
    api.get('/reports/upcoming-endings', { params: days ? { days } : undefined }),
};

// Payments API
export const payments = {
  // Tenant routes
  getMySchedule: () => api.get('/payments/my-schedule'),
  // Admin routes
  getAllPaymentSchedules: (params?: { year?: number; month?: number; property_id?: string; landlord_id?: string }) =>
    api.get('/payments/all', { params }),
  getTenancyPayments: (tenancyId: string | number) => api.get(`/payments/tenancy/${tenancyId}`),
  getTenancyStats: (tenancyId: string | number) => api.get(`/payments/tenancy/${tenancyId}/stats`),
  recordPayment: (paymentId: string | number, data: {
    amount_paid: number;
    paid_date: string;
    payment_reference?: string;
    status?: 'pending' | 'paid' | 'partial' | 'overdue';
  }) => api.put(`/payments/${paymentId}`, data),
  revertPayment: (paymentId: string | number) => api.delete(`/payments/${paymentId}`),
  updatePaymentAmount: (paymentId: string | number, data: {
    amount_due: number;
    due_date: string;
    payment_type: string;
    description: string;
  }) =>
    api.patch(`/payments/${paymentId}/amount`, data),
  deletePaymentSchedule: (paymentId: string | number) =>
    api.delete(`/payments/${paymentId}/schedule`),
  createManualPayment: (data: {
    tenancy_id: number;
    member_id: number;
    due_date: string;
    amount_due: number;
    payment_type: string;
    description?: string;
  }) => api.post('/payments', data),
  updateSinglePayment: (paymentScheduleId: string | number, singlePaymentId: string | number, data: {
    amount: number;
    payment_date: string;
    payment_reference?: string;
  }) => api.put(`/payments/${paymentScheduleId}/payment/${singlePaymentId}`, data),
  deleteSinglePayment: (paymentScheduleId: string | number, singlePaymentId: string | number) =>
    api.delete(`/payments/${paymentScheduleId}/payment/${singlePaymentId}`),
};

// Agreement Sections API (Admin only)
export const agreementSections = {
  getAll: (params?: { landlord_id?: string | number; agreement_type?: 'tenancy_agreement' }) => {
    const queryParams = new URLSearchParams();
    if (params?.landlord_id) queryParams.set('landlord_id', String(params.landlord_id));
    if (params?.agreement_type) queryParams.set('agreement_type', params.agreement_type);
    const queryString = queryParams.toString();
    return api.get(`/agreement-sections${queryString ? `?${queryString}` : ''}`);
  },
  getById: (id: string | number) => api.get(`/agreement-sections/${id}`),
  getForLandlord: (landlordId: string | number, agreementType?: 'tenancy_agreement') =>
    api.get(`/agreement-sections/landlord/${landlordId}${agreementType ? `?agreement_type=${agreementType}` : ''}`),
  create: (data: {
    landlord_id?: number;
    section_key: string;
    section_title: string;
    section_content: string;
    section_order: number;
    is_active?: boolean;
    agreement_type?: 'tenancy_agreement';
  }) => api.post('/agreement-sections', data),
  update: (id: string | number, data: {
    landlord_id?: number;
    section_key?: string;
    section_title?: string;
    section_content?: string;
    section_order?: number;
    is_active?: boolean;
    agreement_type?: 'tenancy_agreement';
  }) => api.put(`/agreement-sections/${id}`, data),
  delete: (id: string | number) => api.delete(`/agreement-sections/${id}`),
  duplicate: (id: string | number, landlordId?: number) =>
    api.post(`/agreement-sections/${id}/duplicate`, { landlord_id: landlordId }),
  previewDefault: (tenancyType: 'room_only' | 'whole_house') =>
    api.get('/agreement-sections/preview-default', { params: { tenancyType } }),
};

// Certificate Types API (consolidated - handles property, agency, and future tenancy types)
export const certificateTypes = {
  getAll: (type?: string) => api.get('/certificate-types', { params: type ? { type } : {} }),
  getById: (id: string | number) => api.get(`/certificate-types/${id}`),
  create: (data: {
    name: string;
    display_name?: string;
    icon?: string;
    display_order?: number;
    type?: string;
    has_expiry?: boolean;
    default_validity_months?: number;
  }) => api.post('/certificate-types', data),
  update: (id: string | number, data: {
    name?: string;
    display_name?: string;
    icon?: string;
    display_order?: number;
    is_active?: boolean;
    has_expiry?: boolean;
    default_validity_months?: number;
  }) => api.put(`/certificate-types/${id}`, data),
  delete: (id: string | number) => api.delete(`/certificate-types/${id}`),
  reorder: (order: Array<{ id: number; display_order: number }>) =>
    api.post('/certificate-types/reorder', { order }),
};

// Certificates API (consolidated - handles property certs, agency docs, etc.)
export const certificates = {
  getByEntity: (entityType: string, entityId: string | number) =>
    api.get(`/certificates/entity/${entityType}/${entityId}`),
  upload: (entityType: string, entityId: string | number, typeId: string | number, formData: FormData) =>
    api.post(`/certificates/entity/${entityType}/${entityId}/upload/${typeId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateExpiry: (entityType: string, entityId: string | number, typeId: string | number, expiryDate: string | null) =>
    api.put(`/certificates/entity/${entityType}/${entityId}/${typeId}/expiry`, { expiry_date: expiryDate }),
  delete: (entityType: string, entityId: string | number, typeId: string | number) =>
    api.delete(`/certificates/entity/${entityType}/${entityId}/${typeId}`),
  download: (id: string | number) => api.get(`/certificates/${id}/download`, { responseType: 'blob' }),
  getDownloadUrl: (id: string | number) => `/api/certificates/${id}/download`,
  getWithTypes: (entityType: string) => api.get(`/certificates/with-types/${entityType}`),
};

// Tenant Documents API
export const tenantDocuments = {
  upload: (formData: FormData) =>
    api.post('/tenant-documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getMemberDocuments: (memberId: string | number) =>
    api.get(`/tenant-documents/member/${memberId}`),
  getMyDocuments: () =>
    api.get('/tenant-documents/my-documents'),
  download: (id: string | number) =>
    api.get(`/tenant-documents/${id}/download`, { responseType: 'blob' }),
  delete: (id: string | number) =>
    api.delete(`/tenant-documents/${id}`),
};

// Maintenance API
export const maintenance = {
  // Options (public)
  getOptions: () => api.get('/maintenance/options'),
  // Admin - getAll alias for getAllRequests
  getAll: (params?: { status?: string; priority?: string; category?: string; property_id?: number }) =>
    api.get('/maintenance/admin', { params }),

  // Tenant routes
  getMyRequests: () => api.get('/maintenance/my-requests'),
  getRequestById: (id: string | number) => api.get(`/maintenance/requests/${id}`),
  createRequest: (data: {
    tenancy_id: number;
    title: string;
    description: string;
    category: string;
    priority?: string;
  }) => api.post('/maintenance/requests', data),
  addComment: (requestId: string | number, content: string, files?: File[]) => {
    if (files && files.length > 0) {
      const formData = new FormData();
      formData.append('content', content);
      files.forEach(file => formData.append('attachments', file));
      return api.post(`/maintenance/requests/${requestId}/comments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post(`/maintenance/requests/${requestId}/comments`, { content });
  },

  // Admin routes
  getAllRequests: (params?: {
    status?: string;
    priority?: string;
    category?: string;
    property_id?: string | number;
    date_from?: string;
    date_to?: string;
  }) => api.get('/maintenance/admin', { params }),
  getRequestByIdAdmin: (id: string | number) => api.get(`/maintenance/admin/${id}`),
  updateRequest: (id: string | number, data: {
    status?: string;
    priority?: string;
  }) => api.put(`/maintenance/admin/${id}`, data),
  addCommentAdmin: (requestId: string | number, content: string, files?: File[], isPrivate: boolean = false) => {
    if (files && files.length > 0) {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('is_private', isPrivate ? 'true' : 'false');
      files.forEach(file => formData.append('attachments', file));
      return api.post(`/maintenance/admin/${requestId}/comments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post(`/maintenance/admin/${requestId}/comments`, { content, is_private: isPrivate });
  },
  getRequestsByTenancy: (tenancyId: string | number) =>
    api.get(`/maintenance/admin/tenancy/${tenancyId}`),
  deleteRequest: (id: string | number) =>
    api.delete(`/maintenance/admin/${id}`),
  deleteAttachment: (attachmentId: string | number) =>
    api.delete(`/maintenance/admin/attachments/${attachmentId}`),
  deleteComment: (commentId: string | number) =>
    api.delete(`/maintenance/admin/comments/${commentId}`),
};

// Admin Reports API (Admin only)
export const adminReports = {
  // Statements
  getStatementPeriods: () => api.get('/admin/statements/periods'),
  getMonthlyStatement: (year: number, month: number, landlordId?: number) =>
    api.get(`/admin/statements/${year}/${month}`, { params: landlordId ? { landlord_id: landlordId } : undefined }),
  getAnnualSummary: (year: number, landlordId?: number) =>
    api.get(`/admin/statements/${year}/annual`, { params: landlordId ? { landlord_id: landlordId } : undefined }),
  downloadAnnualStatementPDF: (year: number, landlordId?: number) =>
    `${getApiUrl()}/admin/statements/${year}/annual/pdf${landlordId ? `?landlord_id=${landlordId}` : ''}`,
  // Reports (use unified /reports/ endpoints - admin can filter by landlord_id)
  getPortfolioOverview: (landlordId?: number) =>
    api.get('/reports/overview', { params: landlordId ? { landlord_id: landlordId } : undefined }),
  getOccupancyReport: (landlordId?: number) =>
    api.get('/reports/occupancy', { params: landlordId ? { landlord_id: landlordId } : undefined }),
  getFinancialReport: (year?: number, landlordId?: number) =>
    api.get('/reports/financial', { params: { ...(year ? { year } : {}), ...(landlordId ? { landlord_id: landlordId } : {}) } }),
  getArrearsReport: (landlordId?: number) =>
    api.get('/reports/arrears', { params: landlordId ? { landlord_id: landlordId } : undefined }),
  getUpcomingEndings: (days?: number, landlordId?: number) =>
    api.get('/reports/upcoming-endings', { params: { ...(days ? { days } : {}), ...(landlordId ? { landlord_id: landlordId } : {}) } }),
};

// Tenancy Communication API
export const tenancyCommunication = {
  // Tenant routes
  getMyThread: (params?: { page?: number; limit?: number }) =>
    api.get('/tenancy-communication/my-thread', { params }),
  sendMessage: (content: string, files?: File[]) => {
    const formData = new FormData();
    formData.append('content', content);
    if (files) {
      files.forEach(file => formData.append('attachments', file));
    }
    return api.post('/tenancy-communication/my-thread/messages', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Landlord routes
  getLandlordTenancies: () => api.get('/tenancy-communication/landlord/tenancies'),
  getLandlordThread: (tenancyId: number, params?: { page?: number; limit?: number }) =>
    api.get(`/tenancy-communication/landlord/${tenancyId}`, { params }),
  sendMessageLandlord: (tenancyId: number, content: string, files?: File[], isPrivate: boolean = false) => {
    const formData = new FormData();
    formData.append('content', content);
    formData.append('is_private', isPrivate ? 'true' : 'false');
    if (files) {
      files.forEach(file => formData.append('attachments', file));
    }
    return api.post(`/tenancy-communication/landlord/${tenancyId}/messages`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Admin routes
  getAll: (params?: { page?: number; limit?: number }) =>
    api.get('/tenancy-communication/admin', { params }),
  getAllTenancies: (params?: { property_id?: number; status?: string; has_messages?: string }) =>
    api.get('/tenancy-communication/admin/tenancies', { params }),
  getAdminThread: (tenancyId: number, params?: { page?: number; limit?: number }) =>
    api.get(`/tenancy-communication/admin/${tenancyId}`, { params }),
  sendMessageAdmin: (tenancyId: number, content: string, files?: File[], isPrivate: boolean = false) => {
    const formData = new FormData();
    formData.append('content', content);
    formData.append('is_private', isPrivate ? 'true' : 'false');
    if (files) {
      files.forEach(file => formData.append('attachments', file));
    }
    return api.post(`/tenancy-communication/admin/${tenancyId}/messages`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteMessage: (messageId: number) =>
    api.delete(`/tenancy-communication/admin/messages/${messageId}`),
  deleteAttachment: (attachmentId: number) =>
    api.delete(`/tenancy-communication/admin/attachments/${attachmentId}`),
};

// Data Export API (Admin only)
export const dataExport = {
  getAll: (params?: { status?: string; entity_type?: string; limit?: number; offset?: number }) =>
    api.get('/data-export', { params }),
  getById: (id: string | number) => api.get(`/data-export/${id}`),
  getStats: () => api.get('/data-export/stats'),
  getOptions: () => api.get('/data-export/options'),
  create: (data: {
    entity_type: string;
    export_format?: 'csv' | 'xml';
    filters?: Record<string, unknown>;
    include_related?: boolean;
  }) => api.post('/data-export', data),
  retry: (id: string | number) => api.post(`/data-export/${id}/retry`),
  delete: (id: string | number) => api.delete(`/data-export/${id}`),
  getDownloadUrl: (id: string | number) => `${getApiUrl()}/data-export/${id}/download`,
  processQueue: (limit?: number) => api.post('/data-export/process', null, { params: { limit } }),
};

// Holding Deposits API
export const holdingDeposits = {
  // Admin routes
  create: (data: HoldingDepositFormData) =>
    api.post('/holding-deposits', data),
  getAll: (params?: { status?: string }) =>
    api.get('/holding-deposits', { params }),
  getByApplication: (applicationId: string | number) =>
    api.get(`/holding-deposits/application/${applicationId}`),
  getById: (id: string | number) =>
    api.get(`/holding-deposits/${id}`),
  updateStatus: (id: string | number, data: { status: 'refunded' | 'forfeited'; notes?: string }) =>
    api.patch(`/holding-deposits/${id}/status`, data),
  recordPayment: (id: string | number, data: { payment_reference?: string; date_received: string }) =>
    api.patch(`/holding-deposits/${id}/record-payment`, data),
  undoPayment: (id: string | number) =>
    api.patch(`/holding-deposits/${id}/undo-payment`),
  // Tenant route
  getByApplicationForTenant: (applicationId: string | number) =>
    api.get(`/holding-deposits/my-application/${applicationId}`),
};
