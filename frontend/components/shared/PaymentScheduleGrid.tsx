'use client';

import React, { useState, useMemo } from 'react';
import { PaymentSchedule, Payment, TenancyMember } from '@/lib/types';
import { calculatePaymentBreakdown } from '@/lib/paymentCalculations';
import { getStatusLabel } from '@/lib/statusBadges';

interface MonthGroup {
  key: string;
  label: string;
  year: number;
  month: number;
  payments: PaymentSchedule[];
  totalDue: number;
  totalPaid: number;
  balance: number;
  status: 'paid' | 'partial' | 'pending' | 'overdue';
  hasOverdue: boolean;
}

interface PaymentScheduleGridProps {
  payments: PaymentSchedule[];
  // Optional props for admin functionality
  isAdmin?: boolean;
  selectedMember?: TenancyMember | null;
  tenancyStartDate?: string;
  tenancyEndDate?: string | null;
  tenancyStatus?: string;
  onRecordPayment?: (payment: PaymentSchedule) => void;
  onEditPayment?: (payment: PaymentSchedule) => void;
  onEditSinglePayment?: (payment: Payment, scheduleId: number) => void;
  onDeleteSinglePayment?: (payment: Payment, scheduleId: number) => void;
  onOpenCreateManualPayment?: () => void;
}

export function PaymentScheduleGrid({
  payments,
  isAdmin = false,
  selectedMember,
  tenancyStartDate,
  tenancyEndDate,
  tenancyStatus,
  onRecordPayment,
  onEditPayment,
  onEditSinglePayment,
  onDeleteSinglePayment,
  onOpenCreateManualPayment,
}: PaymentScheduleGridProps) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [expandedPayments, setExpandedPayments] = useState<Set<number>>(new Set());

  // Group payments by month
  const monthGroups = useMemo(() => {
    const groups: Map<string, MonthGroup> = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Show all payments (including paid)
    payments.forEach(payment => {
      const dueDate = new Date(payment.due_date);
      const year = dueDate.getFullYear();
      const month = dueDate.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: dueDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
          year,
          month,
          payments: [],
          totalDue: 0,
          totalPaid: 0,
          balance: 0,
          status: 'pending',
          hasOverdue: false,
        });
      }

      const group = groups.get(key)!;
      group.payments.push(payment);
      group.totalDue += payment.amount_due;
      group.totalPaid += payment.amount_paid || 0;
      group.balance = group.totalDue - group.totalPaid;

      // Check if this payment is overdue
      if (payment.status === 'overdue' || (dueDate < today && payment.status !== 'paid')) {
        group.hasOverdue = true;
      }
    });

    // Calculate status for each group
    groups.forEach(group => {
      const allPaid = group.payments.every(p => p.status === 'paid');
      const somePartial = group.payments.some(p => p.status === 'partial');
      const somePaid = group.totalPaid > 0;

      if (allPaid) {
        group.status = 'paid';
      } else if (group.hasOverdue) {
        group.status = 'overdue';
      } else if (somePartial || somePaid) {
        group.status = 'partial';
      } else {
        group.status = 'pending';
      }
    });

    // Sort by date
    return Array.from(groups.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }, [payments]);

  // Calculate summary statistics
  const totalDue = payments.reduce((sum, p) => sum + p.amount_due, 0);
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  const totalBalance = totalDue - totalPaid;

  const toggleMonth = (key: string) => {
    setExpandedMonth(prev => prev === key ? null : key);
  };

  const togglePaymentExpanded = (paymentId: number) => {
    setExpandedPayments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paymentId)) {
        newSet.delete(paymentId);
      } else {
        newSet.add(paymentId);
      }
      return newSet;
    });
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'paid':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-700',
          icon: '✓',
          badge: 'bg-green-100 text-green-800',
        };
      case 'partial':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-700',
          icon: '◐',
          badge: 'bg-amber-100 text-amber-800',
        };
      case 'overdue':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          icon: '!',
          badge: 'bg-red-100 text-red-800',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-700',
          icon: '○',
          badge: 'bg-gray-100 text-gray-800',
        };
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      partial: 'bg-blue-100 text-blue-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div>
      {/* Header with controls - only show if admin has manual payment option */}
      {isAdmin && onOpenCreateManualPayment && (
        <div className="flex justify-end mb-4">
          <button
            onClick={onOpenCreateManualPayment}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Manual Payment
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-900 mb-1">Total Due</p>
          <p className={`text-2xl font-bold ${totalDue < 0 ? 'text-red-600' : 'text-blue-600'}`}>
            {totalDue < 0 ? '-' : ''}£{Math.abs(totalDue).toFixed(2)}
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm font-medium text-green-900 mb-1">Total Paid</p>
          <p className="text-2xl font-bold text-green-600">
            £{totalPaid.toFixed(2)}
          </p>
        </div>
        <div className={`${totalBalance > 0 ? 'bg-orange-50 border-orange-200' : totalBalance < 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
          <p className={`text-sm font-medium mb-1 ${totalBalance > 0 ? 'text-orange-900' : totalBalance < 0 ? 'text-red-900' : 'text-gray-900'}`}>
            Outstanding Balance
          </p>
          <p className={`text-2xl font-bold ${totalBalance > 0 ? 'text-orange-600' : totalBalance < 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {totalBalance < 0 ? '-' : ''}£{Math.abs(totalBalance).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Monthly Grid */}
      {monthGroups.length === 0 ? (
        <p className="text-gray-600">No payment schedules to display.</p>
      ) : (
        <div className="space-y-3">
          {/* Grid of month cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {monthGroups.map(group => {
              const styles = getStatusStyles(group.status);
              const isExpanded = expandedMonth === group.key;

              return (
                <button
                  key={group.key}
                  onClick={() => toggleMonth(group.key)}
                  className={`${styles.bg} ${styles.border} border-2 rounded-lg p-3 text-left transition-all hover:shadow-md ${isExpanded ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-lg font-bold ${styles.text}`}>{styles.icon}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles.badge}`}>
                      {group.payments.length}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {new Date(group.year, group.month).toLocaleDateString('en-GB', { month: 'short' })}
                  </p>
                  <p className="text-xs text-gray-500">{group.year}</p>
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-600">
                      Due: <span className="font-medium">£{group.totalDue.toFixed(0)}</span>
                    </p>
                    {group.totalPaid > 0 && (
                      <p className="text-xs text-green-600">
                        Paid: <span className="font-medium">£{group.totalPaid.toFixed(0)}</span>
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Expanded month detail */}
          {expandedMonth && (
            <div className="mt-4 bg-white border-2 border-primary rounded-lg p-4">
              {monthGroups.filter(g => g.key === expandedMonth).map(group => (
                <div key={group.key}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{group.label}</h3>
                    <button
                      onClick={() => setExpandedMonth(null)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Due:</span>
                      <span className="ml-2 font-bold text-blue-600">£{group.totalDue.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Paid:</span>
                      <span className="ml-2 font-bold text-green-600">£{group.totalPaid.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Balance:</span>
                      <span className={`ml-2 font-bold ${group.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        £{group.balance.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {group.payments.map(payment => {
                      const balance = payment.amount_due - (payment.amount_paid || 0);
                      const isNegative = payment.amount_due < 0;
                      const dueDate = new Date(payment.due_date);
                      const isPast = dueDate < new Date() && payment.status !== 'paid';
                      const isPaymentExpanded = expandedPayments.has(payment.id);
                      const breakdown = selectedMember && tenancyStartDate
                        ? calculatePaymentBreakdown(payment, selectedMember, tenancyStartDate, tenancyEndDate ?? null)
                        : null;

                      return (
                        <div
                          key={payment.id}
                          className={`border rounded-lg ${
                            payment.status === 'paid' ? 'bg-green-50 border-green-200' :
                            payment.status === 'overdue' ? 'bg-red-50 border-red-200' :
                            isPast ? 'bg-yellow-50 border-yellow-200' :
                            'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-medium text-gray-900">{payment.description || payment.payment_type}</h4>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusBadge(payment.status)}`}>
                                    {getStatusLabel('payment', payment.status)}
                                  </span>
                                  {isNegative && (
                                    <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">
                                      Refund
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                  <div>
                                    <span className="text-gray-600">Amount:</span>
                                    <span className={`ml-1 font-bold ${isNegative ? 'text-red-600' : 'text-blue-600'}`}>
                                      {payment.amount_due < 0 ? '-' : ''}£{Math.abs(payment.amount_due).toFixed(2)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Due:</span>
                                    <span className="ml-1 font-medium">{dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Paid:</span>
                                    <span className="ml-1 font-bold text-green-600">£{(payment.amount_paid || 0).toFixed(2)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Balance:</span>
                                    <span className={`ml-1 font-bold ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                      £{balance.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {isAdmin && (
                                <div className="flex gap-2 ml-4">
                                  {tenancyStatus === 'active' && payment.status !== 'paid' && onRecordPayment && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onRecordPayment(payment); }}
                                      className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                    >
                                      Record
                                    </button>
                                  )}
                                  {onEditPayment && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onEditPayment(payment); }}
                                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                      Edit
                                    </button>
                                  )}
                                  {payment.payment_type === 'rent' && payment.schedule_type !== 'manual' && breakdown && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); togglePaymentExpanded(payment.id); }}
                                      className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                                    >
                                      {isPaymentExpanded ? 'Hide' : 'Info'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Payment History */}
                            {isAdmin && tenancyStatus === 'active' && payment.payment_history && payment.payment_history.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <h5 className="text-xs font-semibold text-gray-900 mb-2">
                                  Payments ({payment.payment_history.length})
                                </h5>
                                <div className="space-y-1">
                                  {payment.payment_history.map((singlePayment: Payment) => (
                                    <div key={singlePayment.id} className="flex items-center justify-between bg-green-100 rounded p-2 text-xs">
                                      <div className="flex gap-4">
                                        <span className="font-bold text-green-700">£{Math.abs(singlePayment.amount).toFixed(2)}</span>
                                        <span className="text-gray-600">{new Date(singlePayment.payment_date).toLocaleDateString('en-GB')}</span>
                                        {singlePayment.payment_reference && (
                                          <span className="text-gray-500">Ref: {singlePayment.payment_reference}</span>
                                        )}
                                      </div>
                                      {onEditSinglePayment && onDeleteSinglePayment && (
                                        <div className="flex gap-1">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); onEditSinglePayment(singlePayment, payment.id); }}
                                            className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); onDeleteSinglePayment(singlePayment, payment.id); }}
                                            className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Breakdown Section for admin */}
                            {isAdmin && isPaymentExpanded && breakdown && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-xs">
                                  <h5 className="font-semibold text-gray-900 mb-2">Calculation Breakdown</h5>
                                  <div className="space-y-1">
                                    <p><span className="text-gray-600">Rent (PPPW):</span> £{breakdown.pppw.toFixed(2)}</p>
                                    <p><span className="text-gray-600">Monthly Rate:</span> £{breakdown.monthlyRate.toFixed(2)}</p>
                                    <p><span className="text-gray-600">Period:</span> {breakdown.periodStart.toLocaleDateString('en-GB')} - {breakdown.periodEnd.toLocaleDateString('en-GB')}</p>
                                    {breakdown.isFullMonth ? (
                                      <p className="font-medium text-purple-600">Full month = £{breakdown.calculatedAmount.toFixed(2)}</p>
                                    ) : (
                                      <p className="font-medium text-purple-600">
                                        {breakdown.days}/{breakdown.daysInMonth} days = £{breakdown.calculatedAmount.toFixed(2)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PaymentScheduleGrid;
