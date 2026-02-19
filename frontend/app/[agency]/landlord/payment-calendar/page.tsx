'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { landlordPanel } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAgency } from '@/lib/agency-context';

interface PaymentSchedule {
  id: number;
  tenancy_id: number;
  tenancy_member_id: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: 'pending' | 'paid' | 'partial' | 'overdue';
  payment_type: string;
  description: string;
  tenant_name: string;
  property_address: string;
  tenancy_status: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  payments: PaymentSchedule[];
}

export default function LandlordPaymentCalendarPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { agencySlug } = useAgency();
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
  const [showPaid, setShowPaid] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentSchedule | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDayPaymentsModal, setShowDayPaymentsModal] = useState(false);
  const [selectedDayPayments, setSelectedDayPayments] = useState<PaymentSchedule[]>([]);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [overduePreviousMonths, setOverduePreviousMonths] = useState(0);
  const [overdueAmount, setOverdueAmount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchPaymentSchedules();
    }
  }, [user, currentDate, showPaid]);

  const fetchPaymentSchedules = async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      const response = await landlordPanel.getPaymentSchedules({ year, month });

      let filteredSchedules = response.data.schedules;

      // Filter out paid schedules if showPaid is false
      if (!showPaid) {
        filteredSchedules = filteredSchedules.filter((s: PaymentSchedule) => s.status !== 'paid');
      }

      setSchedules(filteredSchedules);
      setOverdueCount(response.data.summary.overdue);
      setOverduePreviousMonths(response.data.summary.overduePreviousMonths);
      setOverdueAmount(response.data.summary.overdueAmount);
    } catch (error) {
      console.error('Error fetching payment schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCalendarDays = (): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Start from the previous Sunday
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // End at the next Saturday
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const days: CalendarDay[] = [];
    const currentDay = new Date(startDate);

    while (currentDay <= endDate) {
      const dateStr = currentDay.toISOString().split('T')[0];
      const dayPayments = schedules.filter(s => s.due_date === dateStr);

      days.push({
        date: new Date(currentDay),
        isCurrentMonth: currentDay.getMonth() === month,
        payments: dayPayments,
      });

      currentDay.setDate(currentDay.getDate() + 1);
    }

    return days;
  };

  const getPaymentColor = (schedule: PaymentSchedule): string => {
    if (schedule.status === 'paid') {
      return 'bg-green-100 border-green-500 text-green-800';
    }

    const dueDate = new Date(schedule.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'bg-red-100 border-red-500 text-red-800'; // Overdue
    } else if (diffDays <= 7) {
      return 'bg-orange-100 border-orange-500 text-orange-800'; // Due soon
    } else {
      return 'bg-blue-100 border-blue-500 text-blue-800'; // Future
    }
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handlePaymentClick = (schedule: PaymentSchedule) => {
    setSelectedPayment(schedule);
    setShowPaymentModal(true);
  };

  const handleShowDayPayments = (date: Date, payments: PaymentSchedule[]) => {
    setSelectedDayDate(date);
    setSelectedDayPayments(payments);
    setShowDayPaymentsModal(true);
  };

  if (!user) {
    return null;
  }

  const calendarDays = getCalendarDays();
  const monthName = currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Payment Calendar</h1>
              <p className="text-xl text-white/90">View payment schedules for your properties</p>
            </div>
            <button
              onClick={() => router.push(`/${agencySlug}/landlord`)}
              className="px-6 py-3 bg-white text-primary rounded-lg hover:bg-gray-100 transition-colors w-full sm:w-auto"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Warning for overdue payments */}
        {overdueCount > 0 && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <div className="flex items-center">
              <svg className="w-6 h-6 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-bold text-red-800">
                  Warning: {overdueCount} overdue payment{overdueCount !== 1 ? 's' : ''}
                  {overduePreviousMonths > 0 && ` (${overduePreviousMonths} of which in previous months)`}
                </p>
                <p className="text-red-700">
                  Total overdue amount: £{overdueAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={previousMonth}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                ← Previous
              </button>
              <h2 className="text-2xl font-bold text-gray-900">{monthName}</h2>
              <button
                onClick={nextMonth}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Next →
              </button>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPaid}
                  onChange={(e) => setShowPaid(e.target.checked)}
                  className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <span className="text-gray-700">Show paid payments</span>
              </label>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Status Legend:</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-sm text-gray-700">Overdue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span className="text-sm text-gray-700">Due within 7 days</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-sm text-gray-700">Upcoming</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm text-gray-700">Paid</span>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading payment schedules...</div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                <div key={day} className="text-center font-semibold text-gray-700 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dayDate = new Date(day.date);
                dayDate.setHours(0, 0, 0, 0);
                const isToday = dayDate.getTime() === today.getTime();

                return (
                  <div
                    key={index}
                    className={`min-h-[120px] border-2 rounded p-2 ${
                      isToday
                        ? 'bg-blue-50 border-blue-500 shadow-md'
                        : day.isCurrentMonth
                          ? 'bg-white border-gray-300'
                          : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className={`text-sm font-semibold mb-2 ${
                      isToday
                        ? 'text-blue-700'
                        : day.isCurrentMonth
                          ? 'text-gray-900'
                          : 'text-gray-400'
                    }`}>
                      {isToday ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-600 text-white rounded-full">
                          {day.date.getDate()}
                        </span>
                      ) : (
                        day.date.getDate()
                      )}
                    </div>
                    <div className="space-y-1">
                      {day.payments.slice(0, 2).map(payment => (
                        <button
                          key={payment.id}
                          onClick={() => handlePaymentClick(payment)}
                          className={`w-full text-left p-1 rounded border text-xs truncate hover:opacity-80 transition-opacity ${getPaymentColor(payment)}`}
                        >
                          <div className="font-semibold truncate">{payment.tenant_name}</div>
                          <div className="truncate">£{payment.amount_due.toFixed(2)}</div>
                        </button>
                      ))}
                      {day.payments.length > 2 && (
                        <button
                          onClick={() => handleShowDayPayments(day.date, day.payments)}
                          className="w-full text-center p-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          +{day.payments.length - 2} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Payment Detail Modal */}
      {showPaymentModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">Payment Details</h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Payment Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Payment Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">Tenant</p>
                    <p className="font-medium">{selectedPayment.tenant_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Property</p>
                    <p className="font-medium">{selectedPayment.property_address}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Due Date</p>
                    <p className="font-medium">{new Date(selectedPayment.due_date).toLocaleDateString('en-GB')}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Payment Type</p>
                    <p className="font-medium capitalize">{selectedPayment.payment_type}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Amount Due</p>
                    <p className="font-medium">£{selectedPayment.amount_due.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Amount Paid</p>
                    <p className="font-medium">£{selectedPayment.amount_paid.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Balance</p>
                    <p className={`font-medium ${
                      selectedPayment.amount_due - selectedPayment.amount_paid > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      £{(selectedPayment.amount_due - selectedPayment.amount_paid).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Status</p>
                    <p className={`font-medium ${
                      selectedPayment.status === 'paid' ? 'text-green-600' :
                      selectedPayment.status === 'overdue' ? 'text-red-600' :
                      selectedPayment.status === 'partial' ? 'text-orange-600' :
                      'text-blue-600'
                    }`}>
                      {selectedPayment.status.charAt(0).toUpperCase() + selectedPayment.status.slice(1)}
                    </p>
                  </div>
                </div>
                {selectedPayment.description && (
                  <div className="mt-3">
                    <p className="text-gray-600 text-sm">Description</p>
                    <p className="font-medium text-sm">{selectedPayment.description}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 w-full"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Day Payments Modal */}
      {showDayPaymentsModal && selectedDayDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">
                Payments for {selectedDayDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => setShowDayPaymentsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-3">
              {selectedDayPayments.length === 0 ? (
                <p className="text-gray-600">No payments scheduled for this day.</p>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    {selectedDayPayments.length} payment{selectedDayPayments.length !== 1 ? 's' : ''} scheduled
                  </p>
                  {selectedDayPayments.map(payment => (
                    <button
                      key={payment.id}
                      onClick={() => {
                        setShowDayPaymentsModal(false);
                        handlePaymentClick(payment);
                      }}
                      className={`w-full text-left p-3 rounded border-2 hover:shadow-md transition-all ${getPaymentColor(payment)}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-semibold text-base mb-1">{payment.tenant_name}</div>
                          <div className="text-sm text-gray-700">{payment.property_address}</div>
                          <div className="text-sm text-gray-600 mt-1 capitalize">{payment.payment_type}</div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-lg font-bold">£{payment.amount_due.toFixed(2)}</div>
                          <div className="text-xs mt-1">
                            <span className={`font-medium ${
                              payment.status === 'paid' ? 'text-green-600' :
                              payment.status === 'overdue' ? 'text-red-600' :
                              payment.status === 'partial' ? 'text-orange-600' :
                              'text-blue-600'
                            }`}>
                              {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {payment.amount_paid > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-300 text-sm">
                          <span className="text-gray-600">Paid: </span>
                          <span className="font-medium text-green-600">£{payment.amount_paid.toFixed(2)}</span>
                          <span className="text-gray-600 ml-3">Balance: </span>
                          <span className="font-medium text-orange-600">£{(payment.amount_due - payment.amount_paid).toFixed(2)}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
