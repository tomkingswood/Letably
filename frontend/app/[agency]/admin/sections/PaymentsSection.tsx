'use client';

import { useState, useEffect, useMemo } from 'react';
import { payments as paymentsApi } from '@/lib/api';
import { useAgency } from '@/lib/agency-context';
import { getErrorMessage } from '@/lib/types';
import { RecordPaymentModal, EditPaymentScheduleModal } from '@/components/admin/tenancy-detail/PaymentModals';
import { MessageAlert } from '@/components/ui/MessageAlert';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { SectionProps } from './index';

/** Parse a YYYY-MM-DD string as local midnight (avoids UTC timezone shift). */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format today's date as YYYY-MM-DD using local timezone. */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface PaymentSchedule {
  id: number;
  tenant_name?: string;
  property_address?: string;
  bedroom_name?: string;
  amount_due: number;
  due_date: string;
  status: string;
  payment_type?: string;
  description?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getStatusDotColor(status: string) {
  switch (status) {
    case 'paid': return 'bg-green-500';
    case 'pending': return 'bg-yellow-500';
    case 'overdue': return 'bg-red-500';
    case 'partial': return 'bg-blue-500';
    default: return 'bg-gray-400';
  }
}

export default function PaymentsSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agencySlug } = useAgency();
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [year, month] = selectedMonth.split('-').map(Number);

  // Record payment modal state
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentSchedule | null>(null);
  const [paymentFormData, setPaymentFormData] = useState({
    amount_paid: 0,
    paid_date: todayLocal(),
    payment_reference: '',
  });

  // Edit payment modal state
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [editingPaymentAmount, setEditingPaymentAmount] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [editPaymentFormData, setEditPaymentFormData] = useState({
    amount_due: 0,
    due_date: '',
    payment_type: 'rent',
    description: '',
  });

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Feedback messages
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchPayments();
  }, [selectedMonth]);

  // Reset selected day when month changes
  useEffect(() => {
    setSelectedDay(null);
  }, [selectedMonth]);

  // Auto-clear success message
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await paymentsApi.getAllPaymentSchedules({
        year,
        month
      });
      setSchedules(response.data.schedules || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- Payment action handlers ---

  const openRecordPaymentModal = (payment: PaymentSchedule) => {
    setSelectedPayment(payment);
    setPaymentFormData({
      amount_paid: parseFloat(payment.amount_due as unknown as string) || 0,
      paid_date: todayLocal(),
      payment_reference: '',
    });
    setShowRecordPaymentModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    setRecordingPayment(true);
    setErrorMsg('');
    try {
      await paymentsApi.recordPayment(selectedPayment.id, paymentFormData);
      setSuccessMsg('Payment recorded successfully');
      setShowRecordPaymentModal(false);
      fetchPayments();
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, 'Failed to record payment'));
    } finally {
      setRecordingPayment(false);
    }
  };

  const openEditPaymentModal = (payment: PaymentSchedule) => {
    setSelectedPayment(payment);
    setEditPaymentFormData({
      amount_due: parseFloat(payment.amount_due as unknown as string) || 0,
      due_date: payment.due_date?.split('T')[0] || '',
      payment_type: payment.payment_type || 'rent',
      description: payment.description || '',
    });
    setShowEditPaymentModal(true);
  };

  const handleUpdatePaymentAmount = async () => {
    if (!selectedPayment) return;
    setEditingPaymentAmount(true);
    setErrorMsg('');
    try {
      await paymentsApi.updatePaymentAmount(selectedPayment.id, editPaymentFormData);
      setSuccessMsg('Payment schedule updated successfully');
      setShowEditPaymentModal(false);
      fetchPayments();
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, 'Failed to update payment schedule'));
    } finally {
      setEditingPaymentAmount(false);
    }
  };

  const handleDeletePaymentSchedule = () => {
    if (!selectedPayment) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeletePaymentSchedule = async () => {
    if (!selectedPayment) return;
    setDeletingPayment(true);
    setErrorMsg('');
    try {
      await paymentsApi.deletePaymentSchedule(selectedPayment.id);
      setSuccessMsg('Payment schedule deleted successfully');
      setShowDeleteConfirm(false);
      setShowEditPaymentModal(false);
      fetchPayments();
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, 'Failed to delete payment schedule'));
    } finally {
      setDeletingPayment(false);
    }
  };

  const filteredSchedules = schedules.filter(s => {
    return filterStatus === 'all' || s.status === filterStatus;
  });

  // Group filtered payments by day of month
  const paymentsByDay = useMemo(() => {
    const map = new Map<number, PaymentSchedule[]>();
    filteredSchedules.forEach(s => {
      const day = parseLocalDate(s.due_date).getDate();
      const existing = map.get(day) || [];
      existing.push(s);
      map.set(day, existing);
    });
    return map;
  }, [filteredSchedules]);

  // Calendar grid computation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month, 0).getDate();
    const startOffset = (firstDay + 6) % 7; // shift to Mon=0
    return { daysInMonth, startOffset };
  }, [year, month]);

  // Stats
  const stats = {
    total: schedules.length,
    pending: schedules.filter(s => s.status === 'pending').length,
    paid: schedules.filter(s => s.status === 'paid').length,
    overdue: schedules.filter(s => s.status === 'overdue').length,
    totalDue: schedules.reduce((sum, s) => sum + (parseFloat(s.amount_due as unknown as string) || 0), 0),
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

  const navigateMonth = (direction: -1 | 1) => {
    const d = new Date(year, month - 1 + direction, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  const selectedDayPayments = selectedDay ? (paymentsByDay.get(selectedDay) || []) : [];

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
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              List
            </button>
          </div>

          {/* Month Navigation — calendar mode uses arrows, list mode uses native picker */}
          {viewMode === 'list' ? (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateMonth(-1)}
                aria-label="Previous month"
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-gray-900 min-w-[140px] text-center">
                {MONTH_NAMES[month - 1]} {year}
              </span>
              <button
                onClick={() => navigateMonth(1)}
                aria-label="Next month"
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Messages */}
      <MessageAlert type="success" message={successMsg} className="mb-4" />
      <MessageAlert type="error" message={errorMsg} className="mb-4" />

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

      {viewMode === 'calendar' ? (
        <>
          {/* Status Filter for Calendar */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setSelectedDay(null); }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="partial">Partial</option>
            </select>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {DAY_HEADERS.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {/* Leading blank cells */}
              {Array.from({ length: calendarDays.startOffset }).map((_, i) => (
                <div key={`blank-${i}`} className="min-h-[80px] border border-gray-100" />
              ))}

              {/* Actual day cells */}
              {Array.from({ length: calendarDays.daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayPayments = paymentsByDay.get(day) || [];
                const isToday = isCurrentMonth && today.getDate() === day;
                const isSelected = selectedDay === day;
                const hasPayments = dayPayments.length > 0;
                const dayTotal = dayPayments.reduce((sum, s) => sum + (parseFloat(s.amount_due as unknown as string) || 0), 0);

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`min-h-[80px] border border-gray-100 p-1.5 text-left transition-colors relative ${
                      isSelected
                        ? 'bg-primary/5 ring-2 ring-primary'
                        : hasPayments
                          ? 'hover:bg-gray-50 cursor-pointer'
                          : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className={`text-sm font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                      isToday ? 'bg-primary text-white' : 'text-gray-700'
                    }`}>
                      {day}
                    </span>

                    {hasPayments && (
                      <div className="mt-1">
                        {/* Status dots */}
                        <div className="flex flex-wrap gap-0.5 mb-1">
                          {dayPayments.slice(0, 6).map(p => (
                            <span
                              key={p.id}
                              className={`w-2 h-2 rounded-full ${getStatusDotColor(p.status)}`}
                              title={`${p.tenant_name}: £${parseFloat(p.amount_due as unknown as string)?.toFixed(2)} (${p.status})`}
                            />
                          ))}
                          {dayPayments.length > 6 && (
                            <span className="text-[10px] text-gray-500">+{dayPayments.length - 6}</span>
                          )}
                        </div>
                        {/* Day total */}
                        <p className="text-[11px] font-medium text-gray-600 truncate">
                          £{dayTotal.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">Status:</span>
              {[
                { label: 'Paid', color: 'bg-green-500' },
                { label: 'Pending', color: 'bg-yellow-500' },
                { label: 'Overdue', color: 'bg-red-500' },
                { label: 'Partial', color: 'bg-blue-500' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-xs text-gray-600">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Day Detail Panel */}
          {selectedDay !== null && (
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  {selectedDay} {MONTH_NAMES[month - 1]} {year}
                </h3>
                <button
                  onClick={() => setSelectedDay(null)}
                  aria-label="Close day detail"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {selectedDayPayments.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500">No payments on this day</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Tenant</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Property</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Amount</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDayPayments.map(schedule => (
                        <tr key={schedule.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{schedule.tenant_name || '-'}</td>
                          <td className="py-3 px-4">
                            <div>{schedule.property_address || '-'}</div>
                            {schedule.bedroom_name && (
                              <div className="text-sm text-gray-500">{schedule.bedroom_name}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium">£{parseFloat(schedule.amount_due as unknown as string)?.toFixed(2)}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(schedule.status)}`}>
                              {schedule.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {schedule.status !== 'paid' && (
                                <button
                                  onClick={() => openRecordPaymentModal(schedule)}
                                  className="text-xs px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                >
                                  Record Payment
                                </button>
                              )}
                              <button
                                onClick={() => openEditPaymentModal(schedule)}
                                className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Filters — List view */}
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
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
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
                          {parseLocalDate(schedule.due_date).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3 px-4 font-medium">£{parseFloat(schedule.amount_due as unknown as string)?.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(schedule.status)}`}>
                            {schedule.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {schedule.status !== 'paid' && (
                              <button
                                onClick={() => openRecordPaymentModal(schedule)}
                                className="text-xs px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                              >
                                Record Payment
                              </button>
                            )}
                            <button
                              onClick={() => openEditPaymentModal(schedule)}
                              className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      {/* Payment Modals */}
      <RecordPaymentModal
        isOpen={showRecordPaymentModal}
        onClose={() => setShowRecordPaymentModal(false)}
        onSubmit={handleRecordPayment}
        recordingPayment={recordingPayment}
        paymentFormData={paymentFormData}
        onPaymentFormDataChange={setPaymentFormData}
      />

      <EditPaymentScheduleModal
        isOpen={showEditPaymentModal}
        onClose={() => setShowEditPaymentModal(false)}
        onUpdatePayment={handleUpdatePaymentAmount}
        onDeleteSchedule={handleDeletePaymentSchedule}
        editingPaymentAmount={editingPaymentAmount}
        deletingPayment={deletingPayment}
        editPaymentFormData={editPaymentFormData}
        onEditPaymentFormDataChange={setEditPaymentFormData}
      />

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Payment Schedule"
      >
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete this payment schedule? This action cannot be undone.
        </p>
        <ModalFooter
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDeletePaymentSchedule}
          confirmText={deletingPayment ? 'Deleting...' : 'Delete'}
          confirmColor="red"
          isLoading={deletingPayment}
        />
      </Modal>
    </div>
  );
}
