export interface TenancyMember {
  id: number;
  tenancy_id: number;
  application_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  bedroom_name: string;
  rent_pppw: number;
  deposit_amount: number;
  is_signed: boolean;
  signed_at: string;
  signature_data: string;
  signed_agreement_html: string;
  payment_option: string;
  created_at: string;
}

export interface Tenancy {
  id: number;
  property_address: string;
  location: string;
  start_date: string;
  end_date: string;
  status: string;
  landlord_name: string;
  landlord_email: string;
  landlord_phone: string;
  is_rolling_monthly?: number;
}

export interface TenancySummary {
  id: number;
  status: string;
  start_date: string;
  end_date: string;
  is_rolling_monthly: number;
  property_address: string;
  location: string;
  member_id: number;
}
