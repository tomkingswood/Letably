/**
 * Template variable definitions for the Agreement Editor
 * These match the backend templateData structure in agreementService.js
 */

export interface TemplateVariable {
  name: string;
  displayName: string;
  description: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  color: string;
  bgColor: string;
  variables: TemplateVariable[];
}

export interface ConditionalBlock {
  name: string;
  displayName: string;
  description: string;
  startTag: string;
  endTag: string;
}

export interface LoopBlock {
  name: string;
  displayName: string;
  description: string;
  startTag: string;
  endTag: string;
  fields: TemplateVariable[];
}

// Variable categories with their colors
export const variableCategories: TemplateCategory[] = [
  {
    id: 'company',
    name: 'Company',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    variables: [
      { name: 'company_name', displayName: 'Company Name', description: 'The agency/company name' },
      { name: 'company_address', displayName: 'Company Address', description: 'Full company address' },
      { name: 'company_email', displayName: 'Company Email', description: 'Company email address' },
      { name: 'company_phone', displayName: 'Company Phone', description: 'Company phone number' },
    ],
  },
  {
    id: 'landlord',
    name: 'Landlord',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    variables: [
      { name: 'landlord_display_name', displayName: 'Landlord Name', description: 'The landlord display name' },
      { name: 'landlord_address', displayName: 'Landlord Address', description: 'Full landlord address' },
      { name: 'landlord_email', displayName: 'Landlord Email', description: 'Landlord email address' },
      { name: 'landlord_phone', displayName: 'Landlord Phone', description: 'Landlord phone number' },
    ],
  },
  {
    id: 'property',
    name: 'Property',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    variables: [
      { name: 'property_address', displayName: 'Property Address', description: 'Full property address' },
      { name: 'property_address_line1', displayName: 'Address Line 1', description: 'Property street address' },
      { name: 'property_city', displayName: 'City', description: 'Property city' },
      { name: 'property_postcode', displayName: 'Postcode', description: 'Property postcode' },
      { name: 'property_location', displayName: 'Location', description: 'Property location/area' },
    ],
  },
  {
    id: 'tenancy',
    name: 'Tenancy',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    variables: [
      { name: 'tenancy_type', displayName: 'Tenancy Type', description: 'room_only or whole_house' },
      { name: 'tenancy_type_description', displayName: 'Tenancy Type Description', description: 'Room Only or Whole House' },
      { name: 'start_date', displayName: 'Start Date', description: 'Tenancy start date' },
      { name: 'end_date', displayName: 'End Date', description: 'Tenancy end date' },
    ],
  },
  {
    id: 'primary_tenant',
    name: 'Primary Tenant',
    color: 'text-rose-700',
    bgColor: 'bg-rose-100',
    variables: [
      { name: 'primary_tenant_name', displayName: 'Tenant Name', description: 'Full name of the signing tenant' },
      { name: 'primary_tenant_first_name', displayName: 'First Name', description: 'Tenant first name' },
      { name: 'primary_tenant_last_name', displayName: 'Last Name', description: 'Tenant last name' },
      { name: 'primary_tenant_email', displayName: 'Email', description: 'Tenant email address' },
      { name: 'primary_tenant_phone', displayName: 'Phone', description: 'Tenant phone number' },
      { name: 'primary_tenant_address', displayName: 'Current Address', description: 'Tenant current address' },
      { name: 'primary_tenant_room', displayName: 'Room', description: 'Assigned room (room_only tenancy)' },
      { name: 'primary_tenant_rent_pppw', displayName: 'Rent PPPW', description: 'Tenant rent per person per week' },
      { name: 'primary_tenant_deposit', displayName: 'Deposit', description: 'Tenant deposit amount' },
    ],
  },
  {
    id: 'other_tenants',
    name: 'Other Tenants',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-100',
    variables: [
      { name: 'other_tenants_names_list', displayName: 'Names List', description: 'Comma-separated list of other tenant names' },
      { name: 'other_tenants_count', displayName: 'Count', description: 'Number of other tenants' },
      { name: 'tenant_names_list', displayName: 'All Tenant Names', description: 'Comma-separated list of all tenant names' },
    ],
  },
  {
    id: 'financial',
    name: 'Financial',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    variables: [
      { name: 'total_rent_pppw', displayName: 'Total Rent PPPW', description: 'Total rent per person per week (if same for all)' },
      { name: 'total_deposit', displayName: 'Total Deposit', description: 'Total deposit amount' },
    ],
  },
  {
    id: 'bank',
    name: 'Bank Details',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    variables: [
      { name: 'bank_name', displayName: 'Bank Name', description: 'Bank name for payments' },
      { name: 'bank_account_name', displayName: 'Account Name', description: 'Bank account holder name' },
      { name: 'sort_code', displayName: 'Sort Code', description: 'Bank sort code' },
      { name: 'account_number', displayName: 'Account Number', description: 'Bank account number' },
    ],
  },
  {
    id: 'utilities',
    name: 'Utilities',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    variables: [
      { name: 'utilities_cap_amount', displayName: 'Utilities Cap', description: 'Utilities cap amount for tenancy period' },
      { name: 'utilities_cap_annual_amount', displayName: 'Annual Utilities Cap', description: 'Annual utilities cap amount' },
      { name: 'utilities_cap_period', displayName: 'Cap Period', description: 'Description of utilities cap period' },
    ],
  },
];

// Conditional blocks for tenancy type variations
export const conditionalBlocks: ConditionalBlock[] = [
  {
    name: 'if_room_only',
    displayName: 'Room Only',
    description: 'Content shown only for room-only tenancies',
    startTag: '{{#if_room_only}}',
    endTag: '{{/if_room_only}}',
  },
  {
    name: 'if_whole_house',
    displayName: 'Whole House',
    description: 'Content shown only for whole-house tenancies',
    startTag: '{{#if_whole_house}}',
    endTag: '{{/if_whole_house}}',
  },
  {
    name: 'if_rolling_monthly',
    displayName: 'Rolling Monthly',
    description: 'Content shown only for rolling monthly tenancies',
    startTag: '{{#if_rolling_monthly}}',
    endTag: '{{/if_rolling_monthly}}',
  },
  {
    name: 'if_fixed_term',
    displayName: 'Fixed Term',
    description: 'Content shown only for fixed-term tenancies',
    startTag: '{{#if_fixed_term}}',
    endTag: '{{/if_fixed_term}}',
  },
  {
    name: 'if_individual_rents',
    displayName: 'Individual Rents',
    description: 'Content shown when tenants have different rent amounts',
    startTag: '{{#if_individual_rents}}',
    endTag: '{{/if_individual_rents}}',
  },
  {
    name: 'if_individual_deposits',
    displayName: 'Individual Deposits',
    description: 'Content shown when tenants have different deposit amounts',
    startTag: '{{#if_individual_deposits}}',
    endTag: '{{/if_individual_deposits}}',
  },
  {
    name: 'if_utilities_cap',
    displayName: 'Utilities Cap',
    description: 'Content shown when utilities cap is set',
    startTag: '{{#if utilities_cap}}',
    endTag: '{{/if}}',
  },
  {
    name: 'if_council_tax_included',
    displayName: 'Council Tax Included',
    description: 'Content shown when council tax is included in bills',
    startTag: '{{#if council_tax_included}}',
    endTag: '{{/if}}',
  },
];

// Loop blocks for iterating over tenants
export const loopBlocks: LoopBlock[] = [
  {
    name: 'tenants',
    displayName: 'All Tenants',
    description: 'Loop through all tenants in the tenancy',
    startTag: '{{#each tenants}}',
    endTag: '{{/each}}',
    fields: [
      { name: 'name', displayName: 'Full Name', description: 'Tenant full name' },
      { name: 'first_name', displayName: 'First Name', description: 'Tenant first name' },
      { name: 'last_name', displayName: 'Last Name', description: 'Tenant last name' },
      { name: 'email', displayName: 'Email', description: 'Tenant email' },
      { name: 'phone', displayName: 'Phone', description: 'Tenant phone' },
      { name: 'room', displayName: 'Room', description: 'Assigned room' },
      { name: 'rent_pppw', displayName: 'Rent PPPW', description: 'Rent per person per week' },
      { name: 'deposit_amount', displayName: 'Deposit', description: 'Deposit amount' },
    ],
  },
  {
    name: 'other_tenants',
    displayName: 'Other Tenants',
    description: 'Loop through other tenants (excluding the signing tenant)',
    startTag: '{{#each other_tenants}}',
    endTag: '{{/each}}',
    fields: [
      { name: 'name', displayName: 'Full Name', description: 'Tenant full name' },
      { name: 'first_name', displayName: 'First Name', description: 'Tenant first name' },
      { name: 'last_name', displayName: 'Last Name', description: 'Tenant last name' },
      { name: 'email', displayName: 'Email', description: 'Tenant email' },
      { name: 'phone', displayName: 'Phone', description: 'Tenant phone' },
      { name: 'room', displayName: 'Room', description: 'Assigned room' },
      { name: 'rent_pppw', displayName: 'Rent PPPW', description: 'Rent per person per week' },
      { name: 'deposit_amount', displayName: 'Deposit', description: 'Deposit amount' },
    ],
  },
];

// Helper function to get category by variable name
export function getCategoryForVariable(variableName: string): TemplateCategory | undefined {
  return variableCategories.find(cat =>
    cat.variables.some(v => v.name === variableName)
  );
}

// Helper to get all variables as a flat list
export function getAllVariables(): (TemplateVariable & { category: string })[] {
  return variableCategories.flatMap(cat =>
    cat.variables.map(v => ({ ...v, category: cat.id }))
  );
}

// Helper to check if a string is a known variable
export function isKnownVariable(name: string): boolean {
  return variableCategories.some(cat =>
    cat.variables.some(v => v.name === name)
  );
}
