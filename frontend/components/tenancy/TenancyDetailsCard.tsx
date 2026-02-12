'use client';

import { Tenancy, TenancyMember } from './types';

interface TenancyDetailsCardProps {
  tenancy: Tenancy | null;
  myMember: TenancyMember | null;
  paymentOptionLabels: Record<string, string>;
}

export function TenancyDetailsCard({ tenancy, myMember, paymentOptionLabels }: TenancyDetailsCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-3 mb-6">
        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <h2 className="text-2xl font-bold text-gray-900">Tenancy Details</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600 mb-1">Property Address</p>
          <p className="font-medium text-gray-900">{tenancy?.property_address}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-1">Location</p>
          <p className="font-medium text-gray-900">{tenancy?.location}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-1">Start Date</p>
          <p className="font-medium text-gray-900">
            {tenancy?.start_date && new Date(tenancy.start_date).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-1">End Date</p>
          <p className="font-medium text-gray-900">
            {tenancy?.end_date && new Date(tenancy.end_date).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })}
          </p>
        </div>

        {myMember?.bedroom_name && (
          <div>
            <p className="text-sm text-gray-600 mb-1">Your Bedroom</p>
            <p className="font-medium text-gray-900">{myMember.bedroom_name}</p>
          </div>
        )}

        <div>
          <p className="text-sm text-gray-600 mb-1">Your Rent</p>
          <p className="font-medium text-green-600">&pound;{myMember?.rent_pppw} per week</p>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-1">Your Deposit</p>
          <p className="font-medium text-blue-600">&pound;{myMember?.deposit_amount}</p>
        </div>

        {myMember?.payment_option && (
          <div>
            <p className="text-sm text-gray-600 mb-1">Payment Option</p>
            <p className="font-medium text-gray-900">
              {paymentOptionLabels[myMember.payment_option] || myMember.payment_option}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
