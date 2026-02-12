/**
 * Sample data for agreement editor preview
 * Matches the backend templateData structure from agreementService.js
 */

export interface TenantData {
  name: string;
  first_name: string;
  last_name: string;
  address: string;
  email: string;
  phone: string;
  room: string;
  rent_pppw: string;
  deposit_amount: string;
  application_type?: string;
  is_primary?: boolean;
}

export interface SampleTemplateData {
  // Company info
  company_name: string;
  company_address: string;
  company_address_line1: string;
  company_address_line2: string;
  company_city: string;
  company_postcode: string;
  company_email: string;
  company_phone: string;

  // Landlord info
  landlord_display_name: string;
  landlord_address: string;
  landlord_email: string;
  landlord_phone: string;

  // Property info
  property_address: string;
  property_address_line1: string;
  property_address_line2: string;
  property_city: string;
  property_postcode: string;
  property_location: string;

  // Tenancy info
  tenancy_type: 'room_only' | 'whole_house';
  tenancy_type_description: string;
  start_date: string;
  end_date: string;
  status: string;
  is_rolling_monthly: boolean;

  // Primary tenant
  primary_tenant_name: string;
  primary_tenant_first_name: string;
  primary_tenant_last_name: string;
  primary_tenant_address: string;
  primary_tenant_email: string;
  primary_tenant_phone: string;
  primary_tenant_room: string;
  primary_tenant_rent_pppw: string;
  primary_tenant_deposit: string;

  // Other tenants
  other_tenants_names_list: string;
  other_tenants_count: number;
  tenant_names_list: string;
  tenant_contact_details: string;

  // Arrays for loops
  tenants: TenantData[];
  other_tenants: TenantData[];

  // Financial
  individual_rents: boolean;
  individual_deposits: boolean;
  total_rent_pppw: string;
  total_deposit: string;
  rooms_list: string;

  // Bank details
  bank_name: string;
  bank_account_name: string;
  sort_code: string;
  account_number: string;

  // Utilities
  utilities_cap: boolean;
  utilities_cap_amount: string;
  utilities_cap_annual_amount: string;
  utilities_cap_period: string;
  council_tax_included: boolean;
}

// Sample data for room-only tenancy (single tenant)
export const sampleRoomOnlyData: SampleTemplateData = {
  // Company info
  company_name: 'Letably Property Management',
  company_address: '10 High Street, Suite 5, Sheffield, S1 1AA',
  company_address_line1: '10 High Street, Suite 5',
  company_address_line2: '',
  company_city: 'Sheffield',
  company_postcode: 'S1 1AA',
  company_email: 'info@letably.co.uk',
  company_phone: '0114 123 4567',

  // Landlord info
  landlord_display_name: 'John Smith Properties Ltd',
  landlord_address: '25 Park Lane, Sheffield, S10 2AB',
  landlord_email: 'landlord@example.com',
  landlord_phone: '07700 900123',

  // Property info
  property_address: '123 Example Street, Flat 2, Sheffield, S2 3CD',
  property_address_line1: '123 Example Street',
  property_address_line2: 'Flat 2',
  property_city: 'Sheffield',
  property_postcode: 'S2 3CD',
  property_location: 'City Centre',

  // Tenancy info
  tenancy_type: 'room_only',
  tenancy_type_description: 'Room Only',
  start_date: '01/07/2025',
  end_date: '30/06/2026',
  status: 'pending',
  is_rolling_monthly: false,

  // Primary tenant
  primary_tenant_name: 'Mr John Smith',
  primary_tenant_first_name: 'John',
  primary_tenant_last_name: 'Smith',
  primary_tenant_address: '45 Previous Road, Manchester, M1 2AB',
  primary_tenant_email: 'john.smith@email.com',
  primary_tenant_phone: '07700 900456',
  primary_tenant_room: 'Room 1 (En-suite Double)',
  primary_tenant_rent_pppw: '125.00',
  primary_tenant_deposit: '500.00',

  // Other tenants (none for room-only preview)
  other_tenants_names_list: '',
  other_tenants_count: 0,
  tenant_names_list: 'Mr John Smith',
  tenant_contact_details: 'John Smith: john.smith@email.com, 07700 900456',

  // Arrays for loops
  tenants: [
    {
      name: 'John Smith',
      first_name: 'John',
      last_name: 'Smith',
      address: '45 Previous Road, Manchester, M1 2AB',
      email: 'john.smith@email.com',
      phone: '07700 900456',
      room: 'Room 1 (En-suite Double)',
      rent_pppw: '125.00',
      deposit_amount: '500.00',
      is_primary: true,
    },
  ],
  other_tenants: [],

  // Financial
  individual_rents: false,
  individual_deposits: false,
  total_rent_pppw: '125.00',
  total_deposit: '500.00',
  rooms_list: 'Room 1 (En-suite Double)',

  // Bank details
  bank_name: 'Barclays Bank',
  bank_account_name: 'John Smith Properties Ltd',
  sort_code: '20-00-00',
  account_number: '12345678',

  // Utilities
  utilities_cap: true,
  utilities_cap_amount: '450.00',
  utilities_cap_annual_amount: '450.00',
  utilities_cap_period: 'for the period 01/07/2025 to 30/06/2026',
  council_tax_included: true,
};

// Sample data for whole-house tenancy (multiple tenants)
export const sampleWholeHouseData: SampleTemplateData = {
  // Company info
  company_name: 'Letably Property Management',
  company_address: '10 High Street, Suite 5, Sheffield, S1 1AA',
  company_address_line1: '10 High Street, Suite 5',
  company_address_line2: '',
  company_city: 'Sheffield',
  company_postcode: 'S1 1AA',
  company_email: 'info@letably.co.uk',
  company_phone: '0114 123 4567',

  // Landlord info
  landlord_display_name: 'John Smith Properties Ltd',
  landlord_address: '25 Park Lane, Sheffield, S10 2AB',
  landlord_email: 'landlord@example.com',
  landlord_phone: '07700 900123',

  // Property info
  property_address: '456 Student Road, Sheffield, S3 4EF',
  property_address_line1: '456 Student Road',
  property_address_line2: '',
  property_city: 'Sheffield',
  property_postcode: 'S3 4EF',
  property_location: 'Crookes',

  // Tenancy info
  tenancy_type: 'whole_house',
  tenancy_type_description: 'Whole House',
  start_date: '01/07/2025',
  end_date: '30/06/2026',
  status: 'pending',
  is_rolling_monthly: false,

  // Primary tenant
  primary_tenant_name: 'Ms Alice Johnson',
  primary_tenant_first_name: 'Alice',
  primary_tenant_last_name: 'Johnson',
  primary_tenant_address: '78 Old Street, Leeds, LS1 2AB',
  primary_tenant_email: 'alice.johnson@email.com',
  primary_tenant_phone: '07700 900789',
  primary_tenant_room: 'Room 1',
  primary_tenant_rent_pppw: '110.00',
  primary_tenant_deposit: '440.00',

  // Other tenants
  other_tenants_names_list: 'Mr Bob Williams',
  other_tenants_count: 1,
  tenant_names_list: 'Ms Alice Johnson, Mr Bob Williams',
  tenant_contact_details: 'Alice Johnson: alice.johnson@email.com, 07700 900789\nBob Williams: bob.williams@email.com, 07700 900321',

  // Arrays for loops
  tenants: [
    {
      name: 'Alice Johnson',
      first_name: 'Alice',
      last_name: 'Johnson',
      address: '78 Old Street, Leeds, LS1 2AB',
      email: 'alice.johnson@email.com',
      phone: '07700 900789',
      room: 'Room 1',
      rent_pppw: '110.00',
      deposit_amount: '440.00',
      is_primary: true,
    },
    {
      name: 'Bob Williams',
      first_name: 'Bob',
      last_name: 'Williams',
      address: '90 Another Lane, York, YO1 3CD',
      email: 'bob.williams@email.com',
      phone: '07700 900321',
      room: 'Room 2',
      rent_pppw: '110.00',
      deposit_amount: '440.00',
      is_primary: false,
    },
  ],
  other_tenants: [
    {
      name: 'Bob Williams',
      first_name: 'Bob',
      last_name: 'Williams',
      address: '90 Another Lane, York, YO1 3CD',
      email: 'bob.williams@email.com',
      phone: '07700 900321',
      room: 'Room 2',
      rent_pppw: '110.00',
      deposit_amount: '440.00',
    },
  ],

  // Financial
  individual_rents: false,
  individual_deposits: false,
  total_rent_pppw: '110.00',
  total_deposit: '880.00',
  rooms_list: '',

  // Bank details
  bank_name: 'Barclays Bank',
  bank_account_name: 'John Smith Properties Ltd',
  sort_code: '20-00-00',
  account_number: '12345678',

  // Utilities
  utilities_cap: true,
  utilities_cap_amount: '900.00',
  utilities_cap_annual_amount: '900.00',
  utilities_cap_period: 'for the period 01/07/2025 to 30/06/2026',
  council_tax_included: false,
};

// Helper to get sample data by tenancy type
export function getSampleData(tenancyType: 'room_only' | 'whole_house'): SampleTemplateData {
  return tenancyType === 'room_only' ? sampleRoomOnlyData : sampleWholeHouseData;
}
