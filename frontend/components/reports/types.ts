/**
 * Shared types for report components
 */

export interface BedroomTenant {
  name: string;
  rentPPPW: number;
  tenancyStart: string;
  tenancyEnd: string | null;
}

export interface Bedroom {
  id: number;
  name: string;
  baseRent: number;
  isOccupied: boolean;
  tenant: BedroomTenant | null;
  nextTenant: BedroomTenant | null;
}

export interface WholeHouseTenancy {
  id: number;
  tenants: string;
  tenantCount: number;
  totalRent: number;
  startDate: string;
  endDate: string | null;
}

export interface PropertyOccupancy {
  id: number;
  address: string;
  city: string;
  postcode: string;
  location: string;
  landlord_id?: number;
  landlord_name?: string | null;
  bedrooms: Bedroom[];
  wholeHouseTenancy: WholeHouseTenancy | null;
  nextWholeHouseTenancy: WholeHouseTenancy | null;
  occupancy: {
    occupied: number;
    total: number;
    rate: number;
  };
}

export interface ArrearsItem {
  member_id: number;
  tenant_name: string;
  tenant_email: string;
  tenant_phone: string;
  property_address: string;
  bedroom_name: string | null;
  tenancy_id: number;
  overdue_payments: number;
  total_arrears: number;
  days_overdue: number;
  landlord_id?: number;
  landlord_name?: string | null;
}

export interface UpcomingEnding {
  tenancy_id: number;
  end_date: string;
  status: string;
  is_rolling_monthly: number;
  property_address: string;
  property_id: number;
  tenants: string;
  tenant_count: number;
  total_weekly_rent: number;
  days_until_end: number;
  landlord_id?: number;
  landlord_name?: string | null;
}
