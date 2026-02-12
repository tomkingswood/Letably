import React from 'react';
import { formatDateFull } from '@/lib/dateUtils';

interface GuarantorAgreementProps {
  agreement: {
    guarantor_name: string;
    guarantor_address?: string;
    tenant_name: string;
    property_full_address: string;
    tenancy_start_date: string;
    tenancy_end_date: string;
    company_name: string;
    company_address?: string;
    monthly_rent?: string;
    term_duration?: string;
    tenant_signed_agreement_html?: string;
  };
  onViewTenantAgreement?: () => void;
}

export default function GuarantorAgreementDocument({ agreement, onViewTenantAgreement }: GuarantorAgreementProps) {
  // Calculate term duration properly accounting for actual month lengths
  const calculateTermDuration = () => {
    const startDate = new Date(agreement.tenancy_start_date);
    // Add 1 day to end date since tenancy end dates are inclusive (last day of tenancy)
    const endDate = new Date(agreement.tenancy_end_date);
    endDate.setDate(endDate.getDate() + 1);

    // Calculate month difference
    let years = endDate.getFullYear() - startDate.getFullYear();
    let months = endDate.getMonth() - startDate.getMonth();
    let days = endDate.getDate() - startDate.getDate();

    // Adjust if days are negative
    if (days < 0) {
      months--;
      // Get days in previous month
      const prevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
      days += prevMonth.getDate();
    }

    // Adjust if months are negative
    if (months < 0) {
      years--;
      months += 12;
    }

    // Convert years to months
    const totalMonths = years * 12 + months;

    // Format the duration string
    let termDuration = '';
    if (totalMonths > 0) {
      termDuration += `${totalMonths} Month${totalMonths !== 1 ? 's' : ''}`;
    }
    if (days > 0) {
      if (termDuration) termDuration += ' ';
      termDuration += `${days} day${days !== 1 ? 's' : ''}`;
    }
    if (!termDuration) {
      termDuration = '0 days';
    }

    return termDuration;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8 md:p-12 mb-6">
      {/* Agreement Header */}
      <div className="text-center mb-8 pb-8 border-b-2 border-gray-300">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          DEED OF GUARANTEE
        </h1>
        <p className="text-lg text-gray-700">{agreement.company_name}</p>
      </div>

      {/* Important Warning */}
      <div className="bg-yellow-50 border-2 border-amber-500 rounded-lg p-4 mb-6">
        <p className="font-bold text-amber-900 mb-2 text-sm">
          IMPORTANT WARNING TO INTENDED GUARANTORS:
        </p>
        <p className="text-amber-900 text-sm">
          By signing this document you agree to underwrite the rental and other responsibilities of the Tenant under his/her tenancy agreement. This means that if the tenant fails fulfil their obligations, the Guarantor would also be liable. If you do not understand this document, you should consider taking legal advice before signing it.
        </p>
      </div>

      {/* Parties */}
      <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-6">
        <div className="mb-4">
          <p className="mb-2 text-sm">
            <strong>TO</strong> (Name of landlord/Agent):{' '}
            <span className="text-blue-900">{agreement.company_name || 'The Letting Agent'}</span>
          </p>
          <p className="mb-4 text-sm">
            <strong>OF</strong> (Address of Landlord/Agent):{' '}
            <span className="text-blue-900">
              {agreement.company_address || '16 South Close, Unstone, Dronfield, S18 4DT'}
            </span>
          </p>
        </div>
        <div>
          <p className="mb-2 text-sm">
            <strong>FROM</strong> (Name of Guarantor):{' '}
            <span className="text-blue-900">{agreement.guarantor_name}</span>
          </p>
          <p className="text-sm">
            <strong>OF</strong> (Address of Guarantor):{' '}
            <span className="text-blue-900">{agreement.guarantor_address || ''}</span>
          </p>
        </div>
      </div>

      {/* Particulars */}
      <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 mb-6">
        <h2 className="font-bold text-blue-900 mb-3 text-base">PARTICULARS:</h2>
        <div className="text-sm space-y-2">
          <p>
            <strong>Tenant:</strong> <span className="text-blue-900">{agreement.tenant_name}</span>{' '}
            <span className="text-xs text-gray-600">
              (Name of tenant for whom the guarantee is given)
            </span>
          </p>
          <p>
            <strong>Property Address:</strong>{' '}
            <span className="text-blue-900">{agreement.property_full_address}</span>
          </p>
          <p>
            <strong>RENT:</strong>{' '}
            <span className="text-blue-900 font-bold">£{agreement.monthly_rent || '0.00'} per Month</span>{' '}
            <span className="text-xs text-gray-600">
              N.B: The FULL amount of Rent payment under the Agreement on which this Tenant is named.
            </span>
          </p>
          <p>
            <strong>TERM:</strong> <span className="text-blue-900">{calculateTermDuration()}</span>{' '}
            <span className="text-xs text-gray-600">
              PLUS the time during which there is any continuation of the tenancy under a statutory periodic tenancy.
            </span>
          </p>
        </div>
      </div>

      {/* Guarantee Declaration */}
      <div className="mb-8">
        <h2 className="font-bold text-gray-900 mb-4 text-lg">Guarantee Declaration</h2>

        {[
          `I hereby guarantee the aforementioned Tenant's obligations under the Tenancy agreement dated ${formatDateFull(agreement.tenancy_start_date)}. This guarantee includes monies due as rent in line with the Tenancy agreement and any other monies due where the Tenant has not complied with their responsibilities as stipulated in the agreement.`,

          `Our liability under this guarantee in respect of the rent payable under the Agreement shall be limited to the Tenant's contribution to the total rent for the Property, and their fair share of utilities (where included in the agreement). Otherwise, my guarantee is unlimited. For the purpose of this Guarantee, the Tenant's share will be calculated by dividing the total charges due by the number of tenants named on the agreement.`,

          `I agree to pay any required rent as requested in writing within seven days, if the said amount is overdue by a minimum of 14 days.`,

          `If the tenant does not comply with any of the terms of the Agreement which are the Tenant's responsibility, I will on written demand pay to you all losses which you are entitled to as a result of the Tenant breaking the terms of the Agreement, subject to full written calculation and detailed explanation of the loss. I understand that losses can include any damages, expenses or costs (including legal costs) that result if any rent or other monies payable are not paid or if any term of the agreement is broken.`,

          `This guarantee shall continue beyond expiry of the agreement if the Tenant remains resident at the property, including where a statutory periodic tenancy arises under the Housing Act 1988 or there is a contractual continuation on the expiry of the fixed term granted by the Agreement. I agree that we will pay the rent and any other money payable and also pay any losses if any of the other terms of the tenancy are broken under this statutory periodic tenancy or contractual continuation.`,

          `This guarantee cannot be revoked or cancelled for so long as the Tenant remains a tenant of the property under the fixed term tenancy granted by the Agreement, or if a statutory periodic tenancy or contractual continuation arises thereafter.`
        ].map((text, index) => (
          <div key={index} className="flex items-start gap-3 mb-5">
            <div className="bg-primary text-white w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 font-bold">
              {index + 1}
            </div>
            <div className="text-gray-700 text-sm flex-1">
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Acknowledgement */}
      <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-6">
        <p className="text-sm text-gray-700 italic">
          I acknowledge that I have received a copy of the Tenancy Agreement to which this Guarantee relates and agree to this Guarantee as described.
        </p>
      </div>

      {/* View Tenant Agreement Button - Below Acknowledgement */}
      {agreement.tenant_signed_agreement_html && onViewTenantAgreement && (
        <div className="mb-6">
          <button
            onClick={onViewTenantAgreement}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Tenant Agreement
          </button>
        </div>
      )}
    </div>
  );
}
