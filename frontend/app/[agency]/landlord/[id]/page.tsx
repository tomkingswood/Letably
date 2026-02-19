'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { landlordPanel } from '@/lib/api';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { useAgency } from '@/lib/agency-context';
import { getErrorMessage } from '@/lib/types';
import { formatDateLong } from '@/lib/dateUtils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface TenancyMember {
  id: number;
  first_name: string;
  surname: string;
  email: string;
  phone?: string;
  rent_pppw: number;
  deposit_amount: number;
  payment_option?: string;
  bedroom_name?: string;
  payment_schedules: PaymentSchedule[];
}

interface PaymentSchedule {
  id: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  payment_type: string;
  description?: string;
}

interface Tenancy {
  id: number;
  start_date: string;
  end_date: string;
  status: string;
  tenancy_type: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postcode: string;
  property_location: string;
}

export default function LandlordTenancyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { agencySlug } = useAgency();
  const [loading, setLoading] = useState(true);
  const [tenancy, setTenancy] = useState<Tenancy | null>(null);
  const [members, setMembers] = useState<TenancyMember[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchTenancyDetails();
    }
  }, [authLoading, isAuthenticated, id]);

  const fetchTenancyDetails = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await landlordPanel.getTenancyDetails(id);
      setTenancy(response.data.tenancy);
      setMembers(response.data.members);
    } catch (err: unknown) {
      console.error('Error fetching tenancy details:', err);
      setError(getErrorMessage(err, 'Failed to load tenancy details'));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `£${amount.toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentOptionLabel = (option?: string) => {
    if (!option) return 'Not set';
    switch (option) {
      case 'monthly':
        return 'Monthly - due on 1st of each month';
      case 'quarterly':
        return 'Quarterly - 3 payments per year';
      case 'annually':
        return 'Annually - Single payment';
      default:
        return option;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" text="Loading tenancy details..." />
      </div>
    );
  }

  if (error || !tenancy) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="text-center">
            <div className="text-red-600 text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error || 'Tenancy not found'}</p>
            <Button onClick={() => router.push(`/${agencySlug}/landlord`)}>Back to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                {tenancy.address_line1}
                {tenancy.address_line2 && `, ${tenancy.address_line2}`}
              </h1>
              <p className="text-xl text-white/90">
                {tenancy.city} {tenancy.postcode} · {tenancy.property_location}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => router.push(`/${agencySlug}/landlord`)}
              className="bg-white text-primary hover:bg-gray-100 w-full sm:w-auto"
            >
              ← Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Tenancy Info */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Tenancy Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-gray-600 text-sm">Type</p>
              <p className="font-semibold">
                {tenancy.tenancy_type === 'room_only' ? 'Room Only' : 'Whole House'}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Start Date</p>
              <p className="font-semibold">{formatDateLong(tenancy.start_date)}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">End Date</p>
              <p className="font-semibold">{formatDateLong(tenancy.end_date)}</p>
            </div>
          </div>
        </div>

        {/* Tenants */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Tenants ({members.length})</h2>

          {members.map((member) => (
            <div key={member.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Member Info */}
              <div className="p-6 border-b bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {member.first_name} {member.surname}
                    </h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>📧 {member.email}</p>
                      {member.phone && <p>📞 {member.phone}</p>}
                      {member.bedroom_name && <p>🚪 {member.bedroom_name}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Rent (per week)</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(member.rent_pppw)}</p>
                    <p className="text-sm text-gray-600 mt-2">Deposit</p>
                    <p className="text-lg font-semibold">{formatCurrency(member.deposit_amount)}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600">Payment Schedule:</p>
                  <p className="font-semibold">{getPaymentOptionLabel(member.payment_option)}</p>
                </div>
              </div>

              {/* Payment Schedule */}
              {member.payment_schedules.length > 0 && (
                <div className="p-6">
                  <h4 className="font-semibold mb-4">Payment Schedules</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left">
                        <tr>
                          <th className="py-2 px-3">Due Date</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Amount Due</th>
                          <th className="py-2 px-3">Amount Paid</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {member.payment_schedules.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50">
                            <td className="py-2 px-3">{formatDateLong(payment.due_date)}</td>
                            <td className="py-2 px-3 capitalize">{payment.payment_type}</td>
                            <td className="py-2 px-3">{formatCurrency(payment.amount_due)}</td>
                            <td className="py-2 px-3">{formatCurrency(payment.amount_paid)}</td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                                {payment.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
