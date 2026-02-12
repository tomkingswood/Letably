'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { landlordPanel, getAuthToken } from '@/lib/api';
import { getErrorMessage } from '@/lib/types';
import Button from '@/components/ui/Button';
import { useRequireLandlord } from '@/hooks/useAuth';
import { MessageAlert } from '@/components/ui/MessageAlert';
import { formatDateDayMonth } from '@/lib/dateUtils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface StatementPeriod {
  year: number;
  months: number[];
}

interface MonthlySummary {
  month: number;
  monthName: string;
  totalDue: number;
  totalPaid: number;
  currentlyDue: number;
  futureScheduled: number;
  rollingEstimate: number;
  paymentCount: number;
  paidCount: number;
}

interface AnnualSummary {
  year: number;
  monthly: MonthlySummary[];
  annual: {
    totalScheduled: number;
    currentlyDue: number;
    futureScheduled: number;
    rollingEstimate: number;
    totalPaid: number;
    totalOutstanding: number;
    paymentCount: number;
    paidCount: number;
    collectionRate: number;
  };
}

interface PropertyPayment {
  id: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  payment_type: string;
  description: string;
  tenant_name: string;
  bedroom_name: string | null;
}

interface PropertyBreakdown {
  property_id: number;
  address: string;
  tenancy_type: string;
  totalDue: number;
  totalPaid: number;
  payments: PropertyPayment[];
}

interface MonthlyStatement {
  period: {
    year: number;
    month: number;
    monthName: string;
  };
  summary: {
    totalDue: number;
    totalPaid: number;
    totalOutstanding: number;
    paymentCount: number;
    paidCount: number;
    pendingCount: number;
    overdueCount: number;
  };
  properties: PropertyBreakdown[];
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function LandlordStatementsPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useRequireLandlord();
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<StatementPeriod[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [annualSummary, setAnnualSummary] = useState<AnnualSummary | null>(null);
  const [monthlyStatement, setMonthlyStatement] = useState<MonthlyStatement | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [error, setError] = useState('');
  const [landlordName, setLandlordName] = useState('');
  const [loadedAnnualYear, setLoadedAnnualYear] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchPeriods();
    }
  }, [authLoading, isAuthenticated]);

  const fetchPeriods = async () => {
    try {
      setLoading(true);
      const [periodsResponse, infoResponse] = await Promise.all([
        landlordPanel.getStatementPeriods(),
        landlordPanel.getInfo()
      ]);
      setPeriods(periodsResponse.data.periods);
      setLandlordName(infoResponse.data.landlord.name);

      // Default to current year if available and fetch annual summary
      if (periodsResponse.data.periods.length > 0) {
        const currentYear = new Date().getFullYear();
        const yearExists = periodsResponse.data.periods.find((p: StatementPeriod) => p.year === currentYear);
        const yearToSelect = yearExists ? currentYear : periodsResponse.data.periods[0].year;
        setSelectedYear(yearToSelect);

        // Fetch annual summary immediately after setting year
        try {
          setLoadingStatement(true);
          const annualResponse = await landlordPanel.getAnnualSummary(yearToSelect);
          if (annualResponse.data?.summary) {
            setAnnualSummary(annualResponse.data.summary);
            setLoadedAnnualYear(yearToSelect);
          }
        } catch (annualErr: unknown) {
          setError(getErrorMessage(annualErr, 'Failed to load annual summary'));
        } finally {
          setLoadingStatement(false);
        }
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load statement periods'));
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnualSummary = async (year: number) => {
    try {
      setLoadingStatement(true);
      setMonthlyStatement(null);
      setSelectedMonth(null);
      const response = await landlordPanel.getAnnualSummary(year);
      if (response.data?.summary) {
        setAnnualSummary(response.data.summary);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load annual summary'));
    } finally {
      setLoadingStatement(false);
    }
  };

  // When year changes in dropdown, fetch the annual summary for that year
  useEffect(() => {
    if (selectedYear && selectedYear !== loadedAnnualYear && !loading) {
      fetchAnnualSummary(selectedYear);
      setLoadedAnnualYear(selectedYear);
    }
  }, [selectedYear, loadedAnnualYear, loading]);

  const fetchMonthlyStatement = async (year: number, month: number) => {
    try {
      setLoadingStatement(true);
      setSelectedMonth(month);
      const response = await landlordPanel.getMonthlyStatement(year, month);
      setMonthlyStatement(response.data.statement);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load monthly statement'));
    } finally {
      setLoadingStatement(false);
    }
  };

  const downloadPDF = (year: number, month: number) => {
    const token = getAuthToken();
    const url = landlordPanel.downloadStatementPDF(year, month);
    // Open in new tab with auth header via fetch and blob
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(response => response.blob())
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `Statement-${year}-${month.toString().padStart(2, '0')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      })
      .catch((err: unknown) => {
        console.error('Error downloading PDF:', err);
        setError('Failed to download statement PDF');
      });
  };

  const downloadAnnualPDF = (year: number) => {
    const token = getAuthToken();
    const url = landlordPanel.downloadAnnualStatementPDF(year);
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(response => response.blob())
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `Annual-Statement-${year}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      })
      .catch((err: unknown) => {
        console.error('Error downloading annual PDF:', err);
        setError('Failed to download annual statement PDF');
      });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" text="Loading statements..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white py-6">
        <div className="container mx-auto px-4">
          <Link href="/landlord" className="text-white/80 hover:text-white text-sm mb-2 inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <h1 className="text-2xl font-bold">Financial Statements</h1>
              <p className="text-white/80">{landlordName}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <MessageAlert type="error" message={error} className="mb-6" onDismiss={() => setError('')} />

        {periods.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-gray-400 text-5xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Statements Available</h3>
            <p className="text-gray-600">Payment data will appear here once tenancies have scheduled payments.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Year/Month Selection */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-4 sticky top-4">
                <h3 className="font-semibold text-gray-900 mb-4">Select Period</h3>

                {/* Year selection */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 mb-2">Year</label>
                  <select
                    value={selectedYear || ''}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  >
                    {periods.map(p => (
                      <option key={p.year} value={p.year}>{p.year}</option>
                    ))}
                  </select>
                </div>

                {/* Month selection */}
                {selectedYear && (
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Month</label>
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setSelectedMonth(null);
                          setMonthlyStatement(null);
                          // Refetch annual summary when switching back to annual view
                          if (selectedYear) {
                            fetchAnnualSummary(selectedYear);
                          }
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedMonth === null
                            ? 'bg-primary text-white'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        Annual Overview
                      </button>
                      {periods
                        .find(p => p.year === selectedYear)?.months
                        .map(month => (
                          <button
                            key={month}
                            onClick={() => fetchMonthlyStatement(selectedYear, month)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              selectedMonth === month
                                ? 'bg-primary text-white'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            {monthNames[month - 1]}
                          </button>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Statement Content */}
            <div className="lg:col-span-3">
              {loadingStatement ? (
                <div className="bg-white rounded-lg shadow-md p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                  <p className="text-gray-600">Loading statement...</p>
                </div>
              ) : selectedMonth && monthlyStatement ? (
                /* Monthly Statement View */
                <div className="space-y-6">
                  {/* Header with download */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                          {monthlyStatement.period.monthName} {monthlyStatement.period.year}
                        </h2>
                        <p className="text-gray-600">Monthly Statement</p>
                      </div>
                      <Button
                        onClick={() => downloadPDF(monthlyStatement.period.year, monthlyStatement.period.month)}
                        className="flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download PDF
                      </Button>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Total Due</p>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(monthlyStatement.summary.totalDue)}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Collected</p>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(monthlyStatement.summary.totalPaid)}</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Outstanding</p>
                        <p className="text-xl font-bold text-amber-600">{formatCurrency(monthlyStatement.summary.totalOutstanding)}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Payments</p>
                        <p className="text-xl font-bold text-blue-600">{monthlyStatement.summary.paidCount}/{monthlyStatement.summary.paymentCount}</p>
                      </div>
                    </div>
                  </div>

                  {/* Property Breakdown */}
                  {monthlyStatement.properties.map((property) => (
                    <div key={property.property_id} className="bg-white rounded-lg shadow-md overflow-hidden">
                      <div className="p-4 bg-gray-50 border-b">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900">{property.address}</h3>
                          <div className="text-sm text-gray-600">
                            <span className="text-green-600 font-medium">{formatCurrency(property.totalPaid)}</span>
                            <span className="mx-1">/</span>
                            <span>{formatCurrency(property.totalDue)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                            <tr>
                              <th className="px-4 py-3 text-left">Date</th>
                              <th className="px-4 py-3 text-left">Tenant</th>
                              <th className="px-4 py-3 text-left">Description</th>
                              <th className="px-4 py-3 text-right">Due</th>
                              <th className="px-4 py-3 text-right">Paid</th>
                              <th className="px-4 py-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {property.payments.map((payment) => (
                              <tr key={payment.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm">{formatDateDayMonth(payment.due_date)}</td>
                                <td className="px-4 py-3 text-sm font-medium">{payment.tenant_name}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{payment.bedroom_name || payment.payment_type}</td>
                                <td className="px-4 py-3 text-sm text-right">{formatCurrency(payment.amount_due)}</td>
                                <td className="px-4 py-3 text-sm text-right">{formatCurrency(payment.amount_paid)}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    payment.status === 'paid' ? 'bg-green-100 text-green-800' :
                                    payment.status === 'partial' ? 'bg-amber-100 text-amber-800' :
                                    payment.status === 'overdue' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : annualSummary ? (
                /* Annual Overview */
                <div className="space-y-6">
                  {/* Annual Summary */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{annualSummary.year} Annual Summary</h2>
                        <p className="text-gray-600">Full Year Overview</p>
                      </div>
                      <Button
                        onClick={() => downloadAnnualPDF(annualSummary.year)}
                        className="flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download PDF
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-4 mb-6">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Total Scheduled</p>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(annualSummary.annual.totalScheduled)}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Currently Due</p>
                        <p className="text-xl font-bold text-blue-600">{formatCurrency(annualSummary.annual.currentlyDue)}</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Future Scheduled</p>
                        <p className="text-xl font-bold text-purple-600">{formatCurrency(annualSummary.annual.futureScheduled)}</p>
                      </div>
                      <div className="bg-indigo-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Rolling Est.</p>
                        <p className="text-xl font-bold text-indigo-600">{formatCurrency(annualSummary.annual.rollingEstimate)}</p>
                        <p className="text-xs text-gray-500 mt-1">Not yet generated</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Collected</p>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(annualSummary.annual.totalPaid)}</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Outstanding</p>
                        <p className="text-xl font-bold text-amber-600">{formatCurrency(annualSummary.annual.totalOutstanding)}</p>
                      </div>
                      <div className="bg-primary/10 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Collection Rate</p>
                        <p className="text-xl font-bold text-primary">{annualSummary.annual.collectionRate}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Breakdown Table */}
                  <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="p-4 border-b">
                      <h3 className="font-semibold text-gray-900">Monthly Breakdown</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                          <tr>
                            <th className="px-4 py-3 text-left">Month</th>
                            <th className="px-4 py-3 text-right">Currently Due</th>
                            <th className="px-4 py-3 text-right">Future</th>
                            <th className="px-4 py-3 text-right">Rolling Est.</th>
                            <th className="px-4 py-3 text-right">Collected</th>
                            <th className="px-4 py-3 text-right">Outstanding</th>
                            <th className="px-4 py-3 text-center">Payments</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {annualSummary.monthly.map((month) => {
                            const outstanding = Math.max(0, month.currentlyDue - month.totalPaid);
                            const hasData = month.paymentCount > 0 || month.rollingEstimate > 0;
                            return (
                              <tr key={month.month} className={`hover:bg-gray-50 ${!hasData ? 'text-gray-400' : ''}`}>
                                <td className="px-4 py-3 font-medium">{month.monthName}</td>
                                <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(month.currentlyDue)}</td>
                                <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(month.futureScheduled)}</td>
                                <td className={`px-4 py-3 text-right ${month.rollingEstimate > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                                  {formatCurrency(month.rollingEstimate)}
                                </td>
                                <td className="px-4 py-3 text-right text-green-600">{formatCurrency(month.totalPaid)}</td>
                                <td className={`px-4 py-3 text-right ${outstanding > 0 ? 'text-amber-600' : ''}`}>
                                  {formatCurrency(outstanding)}
                                </td>
                                <td className="px-4 py-3 text-center">{month.paidCount}/{month.paymentCount}</td>
                                <td className="px-4 py-3 text-center">
                                  {month.paymentCount > 0 && (
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => fetchMonthlyStatement(annualSummary.year, month.month)}
                                        className="text-primary hover:underline text-sm"
                                      >
                                        View
                                      </button>
                                      <button
                                        onClick={() => downloadPDF(annualSummary.year, month.month)}
                                        className="text-gray-500 hover:text-gray-700"
                                        title="Download PDF"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50 font-semibold">
                          <tr>
                            <td className="px-4 py-3">Total</td>
                            <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(annualSummary.annual.currentlyDue)}</td>
                            <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(annualSummary.annual.futureScheduled)}</td>
                            <td className="px-4 py-3 text-right text-indigo-600">{formatCurrency(annualSummary.annual.rollingEstimate)}</td>
                            <td className="px-4 py-3 text-right text-green-600">{formatCurrency(annualSummary.annual.totalPaid)}</td>
                            <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(annualSummary.annual.totalOutstanding)}</td>
                            <td className="px-4 py-3 text-center">{annualSummary.annual.paidCount}/{annualSummary.annual.paymentCount}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                /* Fallback - loading or no data */
                <div className="bg-white rounded-lg shadow-md p-8 text-center">
                  <div className="text-gray-400 text-5xl mb-4">📊</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Period</h3>
                  <p className="text-gray-600">Choose a year and month from the left panel to view your statement.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
