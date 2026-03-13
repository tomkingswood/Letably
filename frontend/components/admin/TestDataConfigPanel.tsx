'use client';

import { Dispatch, SetStateAction } from 'react';

export interface TestDataState {
  primary_tenant_first_name: string;
  primary_tenant_last_name: string;
  primary_tenant_email: string;
  primary_tenant_phone: string;
  primary_tenant_rent: string;
  primary_tenant_deposit: string;
  primary_tenant_room: string;
  second_tenant_first_name: string;
  second_tenant_last_name: string;
  second_tenant_email: string;
  second_tenant_phone: string;
  second_tenant_rent: string;
  second_tenant_deposit: string;
  second_tenant_room: string;
  property_address_line1: string;
  property_city: string;
  property_postcode: string;
  start_date: string;
  end_date: string;
  council_tax_included: boolean;
  // Optional extended fields (used by landlord preview)
  primary_tenant_address?: string;
  second_tenant_address?: string;
  property_address_line2?: string;
  property_bedrooms?: string;
  property_bathrooms?: string;
  utilities_cap_enabled?: boolean;
  utilities_cap_amount?: string;
}

export const defaultTestData: TestDataState = {
  primary_tenant_first_name: 'John',
  primary_tenant_last_name: 'Smith',
  primary_tenant_email: 'john.smith@example.com',
  primary_tenant_phone: '07700900123',
  primary_tenant_rent: '125',
  primary_tenant_deposit: '500',
  primary_tenant_room: 'Room 1 (Double)',
  second_tenant_first_name: 'Jane',
  second_tenant_last_name: 'Doe',
  second_tenant_email: 'jane.doe@example.com',
  second_tenant_phone: '07700900456',
  second_tenant_rent: '115',
  second_tenant_deposit: '450',
  second_tenant_room: 'Room 2 (Single)',
  property_address_line1: '123 Example Street',
  property_city: 'Sheffield',
  property_postcode: 'S1 2AB',
  start_date: '2025-09-01',
  end_date: '',
  council_tax_included: true,
};

export const defaultTestDataExtended: TestDataState = {
  ...defaultTestData,
  primary_tenant_address: '45 Test Lane, Manchester, M1 1AA',
  second_tenant_address: '67 Sample Road, Leeds, LS1 1BB',
  property_address_line2: '',
  property_bedrooms: '5',
  property_bathrooms: '2',
  utilities_cap_enabled: true,
  utilities_cap_amount: '50',
};

const inputClass = 'w-full px-2 py-1 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500';

interface TestDataConfigPanelProps {
  testData: TestDataState;
  setTestData: Dispatch<SetStateAction<TestDataState>>;
  showExtendedFields?: boolean;
}

export default function TestDataConfigPanel({ testData, setTestData, showExtendedFields }: TestDataConfigPanelProps) {
  const update = (field: keyof TestDataState, value: string | boolean) => {
    setTestData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="mt-4 pt-4 border-t border-blue-200">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Primary Tenant */}
        <div className="space-y-3">
          <h5 className="font-semibold text-blue-900 text-sm uppercase tracking-wide">Primary Tenant</h5>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={testData.primary_tenant_first_name}
              onChange={(e) => update('primary_tenant_first_name', e.target.value)}
              placeholder="First name"
              className={inputClass}
            />
            <input
              type="text"
              value={testData.primary_tenant_last_name}
              onChange={(e) => update('primary_tenant_last_name', e.target.value)}
              placeholder="Last name"
              className={inputClass}
            />
          </div>
          <input
            type="email"
            value={testData.primary_tenant_email}
            onChange={(e) => update('primary_tenant_email', e.target.value)}
            placeholder="Email"
            className={inputClass}
          />
          <input
            type="tel"
            value={testData.primary_tenant_phone}
            onChange={(e) => update('primary_tenant_phone', e.target.value)}
            placeholder="Phone"
            className={inputClass}
          />
          {showExtendedFields && (
            <input
              type="text"
              value={testData.primary_tenant_address || ''}
              onChange={(e) => update('primary_tenant_address', e.target.value)}
              placeholder="Address"
              className={inputClass}
            />
          )}
          <input
            type="text"
            value={testData.primary_tenant_room}
            onChange={(e) => update('primary_tenant_room', e.target.value)}
            placeholder="Room name"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-blue-700">Rent (&pound;/week)</label>
              <input
                type="number"
                value={testData.primary_tenant_rent}
                onChange={(e) => update('primary_tenant_rent', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-blue-700">Deposit (&pound;)</label>
              <input
                type="number"
                value={testData.primary_tenant_deposit}
                onChange={(e) => update('primary_tenant_deposit', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Second Tenant */}
        <div className="space-y-3">
          <h5 className="font-semibold text-blue-900 text-sm uppercase tracking-wide">Second Tenant (Whole House)</h5>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={testData.second_tenant_first_name}
              onChange={(e) => update('second_tenant_first_name', e.target.value)}
              placeholder="First name"
              className={inputClass}
            />
            <input
              type="text"
              value={testData.second_tenant_last_name}
              onChange={(e) => update('second_tenant_last_name', e.target.value)}
              placeholder="Last name"
              className={inputClass}
            />
          </div>
          <input
            type="email"
            value={testData.second_tenant_email}
            onChange={(e) => update('second_tenant_email', e.target.value)}
            placeholder="Email"
            className={inputClass}
          />
          <input
            type="tel"
            value={testData.second_tenant_phone}
            onChange={(e) => update('second_tenant_phone', e.target.value)}
            placeholder="Phone"
            className={inputClass}
          />
          {showExtendedFields && (
            <input
              type="text"
              value={testData.second_tenant_address || ''}
              onChange={(e) => update('second_tenant_address', e.target.value)}
              placeholder="Address"
              className={inputClass}
            />
          )}
          <input
            type="text"
            value={testData.second_tenant_room}
            onChange={(e) => update('second_tenant_room', e.target.value)}
            placeholder="Room name"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-blue-700">Rent (&pound;/week)</label>
              <input
                type="number"
                value={testData.second_tenant_rent}
                onChange={(e) => update('second_tenant_rent', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-blue-700">Deposit (&pound;)</label>
              <input
                type="number"
                value={testData.second_tenant_deposit}
                onChange={(e) => update('second_tenant_deposit', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Property & Tenancy */}
        <div className="space-y-3">
          <h5 className="font-semibold text-blue-900 text-sm uppercase tracking-wide">Property & Tenancy</h5>
          <input
            type="text"
            value={testData.property_address_line1}
            onChange={(e) => update('property_address_line1', e.target.value)}
            placeholder="Address line 1"
            className={inputClass}
          />
          {showExtendedFields && (
            <input
              type="text"
              value={testData.property_address_line2 || ''}
              onChange={(e) => update('property_address_line2', e.target.value)}
              placeholder="Address line 2"
              className={inputClass}
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={testData.property_city}
              onChange={(e) => update('property_city', e.target.value)}
              placeholder="City"
              className={inputClass}
            />
            <input
              type="text"
              value={testData.property_postcode}
              onChange={(e) => update('property_postcode', e.target.value)}
              placeholder="Postcode"
              className={inputClass}
            />
          </div>
          {showExtendedFields && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-blue-700">Bedrooms</label>
                <input
                  type="number"
                  value={testData.property_bedrooms || ''}
                  onChange={(e) => update('property_bedrooms', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-blue-700">Bathrooms</label>
                <input
                  type="number"
                  value={testData.property_bathrooms || ''}
                  onChange={(e) => update('property_bathrooms', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-blue-700">Start date</label>
              <input
                type="date"
                value={testData.start_date}
                onChange={(e) => update('start_date', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          {showExtendedFields && (
            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testData.utilities_cap_enabled ?? true}
                  onChange={(e) => update('utilities_cap_enabled', e.target.checked)}
                  className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-blue-900">Utilities cap enabled</span>
              </label>
              {testData.utilities_cap_enabled && (
                <div>
                  <label className="text-xs text-blue-700">Utilities cap (&pound;/week)</label>
                  <input
                    type="number"
                    value={testData.utilities_cap_amount || ''}
                    onChange={(e) => update('utilities_cap_amount', e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}
            </div>
          )}
          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={testData.council_tax_included}
                onChange={(e) => update('council_tax_included', e.target.checked)}
                className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-blue-900">Council tax included in bills</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function parseNumeric(value: string, fallback: number): number {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
}

/** Build the test data payload for the preview API call */
export function buildTestDataPayload(testData: TestDataState) {
  return {
    primaryTenant: {
      firstName: testData.primary_tenant_first_name,
      lastName: testData.primary_tenant_last_name,
      email: testData.primary_tenant_email,
      phone: testData.primary_tenant_phone,
      address: testData.primary_tenant_address,
      room: testData.primary_tenant_room,
      rent: parseNumeric(testData.primary_tenant_rent, 125),
      deposit: parseNumeric(testData.primary_tenant_deposit, 500),
    },
    secondTenant: {
      firstName: testData.second_tenant_first_name,
      lastName: testData.second_tenant_last_name,
      email: testData.second_tenant_email,
      phone: testData.second_tenant_phone,
      address: testData.second_tenant_address,
      room: testData.second_tenant_room,
      rent: parseNumeric(testData.second_tenant_rent, 115),
      deposit: parseNumeric(testData.second_tenant_deposit, 450),
    },
    propertyData: {
      address_line1: testData.property_address_line1,
      address_line2: testData.property_address_line2,
      city: testData.property_city,
      postcode: testData.property_postcode,
      bedrooms: testData.property_bedrooms,
      bathrooms: testData.property_bathrooms,
    },
    startDate: testData.start_date,
    endDate: testData.end_date || undefined,
    councilTaxIncluded: testData.council_tax_included,
    utilitiesCapEnabled: testData.utilities_cap_enabled ?? true,
    utilitiesCapAmount: testData.utilities_cap_amount,
  };
}
