'use client';

import { useState, useEffect } from 'react';
import { payments as paymentsApi } from '@/lib/api';
import { useAgency } from '@/lib/agency-context';
import { SectionProps } from './index';

interface PaymentSchedule {
  id: number;
  tenant_name?: string;
  property_address?: string;
  bedroom_name?: string;
  amount_due: number;
  due_date: string;
  status: string;
  payment_type?: string;
}

export default function PaymentsSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agencySlug } = useAgency();
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    fetchPayments();
  }, [selectedMonth]);

  const fetchPayments = async () => {
    try {
      const [year, month] = selectedMonth.split('-');
      const response = await paymentsApi.getAllPaymentSchedules({
        year: parseInt(year),
        month: parseInt(month)
      });
      setSchedules(response.data.schedules || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSchedules = schedules.filter(s => {
    return filterStatus === 'all' || s.status === filterStatus;
  });

  // Stats
  const stats = {
    total: schedules.length,
    pending: schedules.filter(s => s.status === 'pending').length,
    paid: schedules.filter(s => s.status === 'paid').length,
    overdue: schedules.filter(s => s.status === 'overdue').length,
    totalDue: schedules.reduce((sum, s) => sum + (s.amount_due || 0), 0),
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'partial': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payment Calendar</h2>
          <p className="text-gray-600">View and manage payment schedules</p>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Paid</p>
          <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Overdue</p>
          <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Total Due</p>
          <p className="text-2xl font-bold text-primary">£{stats.totalDue.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="partial">Partial</option>
        </select>
      </div>

      {/* Payments List */}
      <div className="bg-white rounded-lg shadow-md">
        {filteredSchedules.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">No payment schedules found for this month</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Tenant</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Property</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Due Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Amount</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedules.map(schedule => (
                  <tr key={schedule.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{schedule.tenant_name || '-'}</td>
                    <td className="py-3 px-4">
                      <div>{schedule.property_address || '-'}</div>
                      {schedule.bedroom_name && (
                        <div className="text-sm text-gray-500">{schedule.bedroom_name}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {new Date(schedule.due_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3 px-4 font-medium">£{schedule.amount_due?.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(schedule.status)}`}>
                        {schedule.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
