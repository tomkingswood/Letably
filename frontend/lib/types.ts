export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: 'tenant' | 'admin' | 'landlord';
  created_at: string;
}

export interface Property {
  id: number;
  address_line1: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
  location?: string;
  bathrooms: number;
  communal_areas: number;
  available_from: string;
  property_type: string;
  has_parking: boolean;
  has_garden: boolean;
  description?: string;
  bills_included: boolean;
  broadband_speed?: string;
  map_embed?: string;
  street_view_embed?: string;
  youtube_url?: string;
  letting_type: 'Whole House' | 'Room Only';
  landlord_id?: number;
  landlord?: Landlord;
  is_live: boolean;
  images: Array<{ id: number; file_path: string; is_primary: boolean }> | string[];
  bedrooms?: Bedroom[];
  created_at: string;
  updated_at: string;
}

export interface Bedroom {
  id: number;
  property_id: number;
  bedroom_name: string;
  status: 'available' | 'let';
  price_pppw?: number;
  bedroom_description?: string;
  available_from?: string;
  youtube_url?: string;
  images: string[];
  created_at: string;
  updated_at: string;
}

export interface ViewingRequest {
  id: number;
  property_id: number;
  visitor_name: string;
  visitor_email: string;
  visitor_phone: string;
  message?: string;
  preferred_date?: string;
  preferred_time?: string;
  status: string;
  created_at: string;
  address_line1?: string;
}

export interface Landlord {
  id: number;
  name?: string;
  legal_name?: string;
  agreement_display_format?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
  bank_name?: string;
  bank_account_name?: string;
  sort_code?: string;
  account_number?: string;
  utilities_cap_amount?: number;
  council_tax_in_bills?: boolean;
  manage_rent?: boolean;
  receive_maintenance_notifications?: boolean;
  receive_payment_notifications?: boolean;
  receive_tenancy_communications?: boolean;
  uses_whatsapp_reporting?: boolean;
  notes?: string;
  properties?: Array<{
    id: number;
    address_line1: string;
    location?: string;
    bedroom_count: number;
    is_live: boolean;
  }>;
  created_at: string;
  updated_at: string;
}

export interface TenancyMember {
  id: number;
  tenancy_id: number;
  application_id: number;
  bedroom_id?: number;
  rent_pppw: number;
  deposit_amount: number;
  signature_data?: string;
  signed_at?: string;
  is_signed?: boolean;
  signed_agreement_html?: string;
  payment_option?: string;
  user_id?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  bedroom_name?: string;
  application_type?: string;
  guarantor_required?: boolean;
  guarantor_name?: string;
  guarantor_dob?: string;
  guarantor_email?: string;
  guarantor_phone?: string;
  guarantor_address?: string;
  guarantor_relationship?: string;
  guarantor_id_type?: string;
  title?: string;
  current_address?: string;
  // Key tracking (sent to/from backend API, may not persist in DB)
  key_status?: 'not_collected' | 'collected' | 'returned';
  key_collection_date?: string | null;
  key_return_date?: string | null;
  created_at: string;
}

export interface GuarantorAgreement {
  id: number;
  tenancy_member_id: number;
  guarantor_token: string;
  is_signed: boolean;
  signed_at?: string;
  signature_data?: string;
  signed_agreement_html?: string;
  guarantor_name?: string;
  guarantor_email?: string;
  guarantor_phone?: string;
  guarantor_address?: string;
  token_expires_at?: string;
  // Computed fields from backend joins
  tenant_first_name?: string;
  tenant_surname?: string;
  tenant_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Tenancy {
  id: number;
  property_id: number;
  property_address?: string;
  location?: string;
  tenancy_type: 'room_only' | 'whole_house';
  start_date: string;
  end_date: string | null;
  status: 'pending' | 'awaiting_signatures' | 'signed' | 'approval' | 'active' | 'expired';
  // Rolling monthly tenancy fields
  is_rolling_monthly?: boolean;
  auto_generate_payments?: boolean;
  member_count?: number;
  members?: TenancyMember[];
  // Landlord contact info
  landlord_name?: string;
  landlord_email?: string;
  landlord_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: number;
  payment_schedule_id: number;
  amount: number;
  payment_date: string;
  payment_reference?: string;
  created_at: string;
}

export interface PaymentSchedule {
  id: number;
  tenancy_id: number;
  tenancy_member_id: number;
  payment_type: 'rent' | 'deposit' | 'utilities' | 'fees' | 'other';
  description?: string;
  due_date: string;
  amount_due: number;
  status: 'pending' | 'paid' | 'overdue' | 'partial';
  amount_paid: number; // Calculated field from backend
  schedule_type?: 'automated' | 'manual';
  created_at: string;
  updated_at: string;
  // Payment coverage period
  covers_from?: string;
  covers_to?: string;
  // Payment history
  payment_history?: Payment[];
  // Latest payment info (computed from payment_history)
  paid_date?: string;
  payment_reference?: string;
  // Joined fields from tenancy_members
  rent_pppw?: number;
  deposit_amount?: number;
  payment_option?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  // Joined fields from other tables
  tenant_name?: string;
  property_address?: string;
  tenancy_status?: string;
}

export interface Application {
  id: number;
  user_id: number;
  property_id?: number;
  bedroom_id?: number;
  application_type: string;
  status: string;
  user_name?: string;
  user_email?: string;
  user?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  property?: {
    id: number;
    address_line1: string;
    address_line2?: string;
    city?: string;
    postcode?: string;
  };
  bedroom?: {
    id: number;
    bedroom_name: string;
  };
  created_at: string;
  updated_at?: string;
}

export const LETTING_TYPES = [
  'Whole House',
  'Room Only',
] as const;

// Agreement Section
export interface AgreementSection {
  id: number;
  landlord_id?: number;
  landlord_name?: string;
  section_key: string;
  section_title: string;
  section_content: string;
  section_order: number;
  is_active: boolean;
  agreement_type: 'tenancy_agreement';
  created_at: string;
  updated_at: string;
}

/**
 * Safely extracts an error message from an unknown error object
 * Works with Axios errors, standard Error objects, and unknown types
 *
 * @param error - The caught error (unknown type)
 * @param fallback - Fallback message if error cannot be parsed
 * @returns A user-friendly error message string
 *
 * @example
 * try {
 *   await api.doSomething();
 * } catch (error) {
 *   setError(getErrorMessage(error, 'Failed to do something'));
 * }
 */
export function getErrorMessage(error: unknown, fallback = 'An error occurred'): string {
  // Handle Axios error response
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { data?: { error?: string; message?: string; errors?: Record<string, string[]> }; status?: number } };
    const data = axiosError.response?.data;

    // Check for error field (most common in our API)
    if (data?.error && typeof data.error === 'string') {
      return data.error;
    }

    // Check for message field
    if (data?.message && typeof data.message === 'string') {
      return data.message;
    }

    // Check for validation errors
    if (data?.errors) {
      const firstError = Object.values(data.errors).flat()[0];
      if (firstError) return firstError;
    }
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return error.message || fallback;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  return fallback;
}

/**
 * Type guard to check if an error has a specific HTTP status code
 */
export function isHttpError(error: unknown, status: number): boolean {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { status?: number } };
    return axiosError.response?.status === status;
  }
  return false;
}

export interface Agreement {
  is_rolling_monthly?: boolean;
  property_address?: string;
  primary_tenant_name?: string;
  // Guarantor signing fields
  guarantor_name?: string;
  tenant_name?: string;
  tenant_signed_agreement_html?: string;
  tenancy_start_date?: string;
  tenancy_end_date?: string | null;
  tenancy: {
    id: number;
    property_address: string;
    start_date: string;
    end_date: string | null;
    status: string;
    tenancy_type: string;
  };
  landlord: {
    name: string;
    display_name: string;
  };
  primary_tenant: {
    id: number;
    name: string;
    email: string;
    room: string | null;
    rent_pppw: number;
    deposit_amount: number;
  };
  other_tenants: Array<{
    name: string;
    email: string;
    room: string | null;
  }>;
  tenants: Array<{
    name: string;
    email: string;
    room?: string | null;
    rent_pppw?: string;
    deposit_amount?: string;
    is_primary?: boolean;
  }>;
  sections: Array<{
    id: number;
    section_key: string;
    section_title: string;
    section_content: string;
    section_order: number;
  }>;
}

// Approved applicant for tenancy creation
export interface ApprovedApplicant {
  id: number;
  user_id: number;
  application_type: 'student' | 'professional';
  status: 'approved';
  guarantor_required: boolean;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

// API Request/Update Types
export interface AgencySettingsUpdate {
  default_deposit_weeks?: number;
  default_rent_pppw?: number;
  payment_reminder_days?: number;
  auto_generate_agreements?: boolean;
  require_guarantor_for_students?: boolean;
  viewing_min_days_advance?: number;
  viewing_max_days_advance?: number;
  [key: string]: unknown;
}

export interface PropertyFormData {
  address_line1: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
  location?: string;
  bathrooms?: number;
  communal_areas?: number;
  available_from?: string;
  property_type?: string;
  has_parking?: boolean;
  has_garden?: boolean;
  description?: string;
  bills_included?: boolean;
  broadband_speed?: string;
  map_embed?: string;
  street_view_embed?: string;
  youtube_url?: string;
  letting_type?: 'Whole House' | 'Room Only';
  landlord_id?: number | null;
  is_live?: boolean;
}

export interface BedroomFormData {
  bedroom_name: string;
  status?: 'available' | 'let' | string;
  price_pppw?: number | string | null;
  bedroom_description?: string;
  available_from?: string;
  youtube_url?: string;
}

export interface LandlordFormData {
  name?: string;
  legal_name?: string;
  agreement_display_format?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
  bank_name?: string;
  bank_account_name?: string;
  sort_code?: string;
  account_number?: string;
  utilities_cap_amount?: number | string;
  council_tax_in_bills?: boolean | string;
  manage_rent?: boolean;
  receive_maintenance_notifications?: boolean;
  receive_payment_notifications?: boolean;
  receive_tenancy_communications?: boolean;
  uses_whatsapp_reporting?: boolean;
  notes?: string;
  send_welcome_email?: boolean;
}

export interface AgreementTestData {
  tenant_name?: string;
  tenant_email?: string;
  bedroom_name?: string;
  rent_pppw?: number;
  deposit_amount?: number;
  start_date?: string;
  end_date?: string;
}

export interface ReminderThreshold {
  id?: number;
  reminder_type: string;
  threshold_days: number;
  severity: 'low' | 'medium' | 'critical';
  is_active?: boolean;
  display_order?: number;
}

export interface ManualReminderFormData {
  title?: string;
  description?: string;
  reminder_date?: string;
  severity?: 'low' | 'medium' | 'critical' | string;
  property_id?: number | null;
  is_dismissed?: boolean;
}

// Application form data is highly variable and contains many optional fields
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApplicationFormData = Record<string, any>;

export interface IdDocumentStatus {
  uploaded: boolean;
  uploadedAt?: string;
  filename?: string;
  size?: number;
}

export interface AgreementMemberData {
  first_name?: string;
  last_name?: string;
  signed_at?: string;
  signature_data?: string;
  payment_option?: string;
  is_signed?: boolean;
  property_address?: string;
}
