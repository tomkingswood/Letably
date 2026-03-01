'use client';

import { useState, useEffect } from 'react';
import { adminReports, landlords as landlordsApi } from '@/lib/api';
import { useAgency } from '@/lib/agency-context';
import { getErrorMessage } from '@/lib/types';
import { SectionProps } from './index';

interface Landlord {
  id: number;
  name: string;
}

interface StatementPeriod {
  year: number;
  month: number;
  label: string;
}

interface StatementPayment {
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

interface StatementProperty {
  property_id: number;
  address: string;
  tenancy_type: string;
  totalDue: number;
  totalPaid: number;
  payments: StatementPayment[];
}

interface StatementLandlord {
  landlord_id: number | null;
  landlord_name: string;
  totalDue: number;
  totalPaid: number;
  properties: StatementProperty[];
}

interface MonthlyStatement {
  period: { year: number; month: number; monthName: string };
  summary: {
    totalDue: number;
    totalPaid: number;
    totalOutstanding: number;
    paymentCount: number;
    paidCount: number;
    pendingCount: number;
    overdueCount: number;
    landlordCount: number;
  };
  landlords: StatementLandlord[];
}

export default function StatementsSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agencySlug } = useAgency();
  const [loading, setLoading] = useState(true);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [selectedLandlord, setSelectedLandlord] = useState<string>('all');
  const [periods, setPeriods] = useState<StatementPeriod[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [viewType, setViewType] = useState<'monthly' | 'annual'>('monthly');
  const [statement, setStatement] = useState<MonthlyStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setStatement(null);
  }, [selectedLandlord, selectedYear, viewType]);

  const fetchData = async () => {
    try {
      const [landlordsRes, periodsRes] = await Promise.all([
        landlordsApi.getAll(),
        adminReports.getStatementPeriods()
      ]);
      setLandlords(landlordsRes.data?.landlords || []);
      // Backend returns { year, months: number[] }[] — flatten to StatementPeriod[]
      const raw = Array.isArray(periodsRes.data?.periods) ? periodsRes.data.periods : [];
      const flat: StatementPeriod[] = [];
      for (const group of raw) {
        const monthsList = Array.isArray(group.months) ? group.months : [];
        for (const m of monthsList) {
          flat.push({
            year: group.year,
            month: m,
            label: new Date(group.year, m - 1, 1).toLocaleString('en-GB', { month: 'long' }),
          });
        }
      }
      flat.sort((a, b) => a.year - b.year || a.month - b.month);
      setPeriods(flat);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const periodsArray = Array.isArray(periods) ? periods : [];
  const currentYear = new Date().getFullYear();
  const yearsFromPeriods = [...new Set(periodsArray.map(p => p.year))];
  const years = yearsFromPeriods.length > 0 ? yearsFromPeriods.sort((a, b) => b - a) : [currentYear];
  const monthsInYear = periodsArray.filter(p => p.year === selectedYear);

  const handleViewStatement = async (year: number, month: number) => {
    setStatementLoading(true);
    setStatementError('');
    try {
      const landlordId = selectedLandlord !== 'all' ? parseInt(selectedLandlord) : undefined;
      const res = await adminReports.getMonthlyStatement(year, month, landlordId);
      const stmt = res.data.statement;
      if (stmt) {
        if (stmt.summary) {
          stmt.summary.totalDue = Number(stmt.summary.totalDue);
          stmt.summary.totalPaid = Number(stmt.summary.totalPaid);
          stmt.summary.totalOutstanding = Number(stmt.summary.totalOutstanding);
        }
        for (const ll of (stmt.landlords || [])) {
          ll.totalDue = Number(ll.totalDue);
          ll.totalPaid = Number(ll.totalPaid);
          for (const prop of (ll.properties || [])) {
            prop.totalDue = Number(prop.totalDue);
            prop.totalPaid = Number(prop.totalPaid);
            for (const pay of (prop.payments || [])) {
              pay.amount_due = Number(pay.amount_due);
              pay.amount_paid = Number(pay.amount_paid);
            }
          }
        }
      }
      setStatement(stmt);
    } catch (err: unknown) {
      setStatementError(getErrorMessage(err, 'Failed to load statement'));
    } finally {
      setStatementLoading(false);
    }
  };

  const handleDownloadAnnual = () => {
    const landlordId = selectedLandlord !== 'all' ? parseInt(selectedLandlord) : undefined;
    const url = adminReports.downloadAnnualStatementPDF(selectedYear, landlordId);
    window.open(url, '_blank');
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Financial Statements</h2>
        <p className="text-gray-600">View monthly and annual payment statements for landlords</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Landlord</label>
            <select
              value={selectedLandlord}
              onChange={(e) => setSelectedLandlord(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All Landlords</option>
              {landlords.map(l => (
                <option key={l.id} value={l.id.toString()}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">View</label>
            <div className="flex gap-2">
              <button
                onClick={() => setViewType('monthly')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewType === 'monthly'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setViewType('annual')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewType === 'annual'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Annual
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {statement ? (
        /* Statement Detail View */
        <div>
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setStatement(null)}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h3 className="text-xl font-bold text-gray-900">
              {statement.period.monthName} {statement.period.year}
            </h3>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-md p-4">
              <p className="text-sm text-gray-500">Total Due</p>
              <p className="text-xl font-bold text-gray-900">&pound;{Number(statement.summary.totalDue).toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <p className="text-sm text-gray-500">Total Paid</p>
              <p className="text-xl font-bold text-green-600">&pound;{Number(statement.summary.totalPaid).toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <p className="text-sm text-gray-500">Outstanding</p>
              <p className="text-xl font-bold text-red-600">&pound;{Number(statement.summary.totalOutstanding).toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <p className="text-sm text-gray-500">Payments</p>
              <p className="text-xl font-bold text-gray-900">
                {statement.summary.paidCount}/{statement.summary.paymentCount}
                <span className="text-sm font-normal text-gray-500 ml-1">paid</span>
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <p className="text-sm text-gray-500">Overdue</p>
              <p className={`text-xl font-bold ${statement.summary.overdueCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {statement.summary.overdueCount}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <p className="text-sm text-gray-500">Collection Rate</p>
              <p className={`text-xl font-bold ${
                Number(statement.summary.totalDue) > 0
                  ? Math.round((Number(statement.summary.totalPaid) / Number(statement.summary.totalDue)) * 100) >= 90 ? 'text-green-600' : 'text-amber-600'
                  : 'text-gray-900'
              }`}>
                {Number(statement.summary.totalDue) > 0
                  ? Math.round((Number(statement.summary.totalPaid) / Number(statement.summary.totalDue)) * 100)
                  : 0}%
              </p>
            </div>
          </div>

          {/* Landlord Breakdown */}
          {statement.landlords.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600 text-center py-4">No payment data for this period</p>
            </div>
          ) : (
            <div className="space-y-6">
              {statement.landlords.map((landlord) => (
                <div key={landlord.landlord_id ?? 'unassigned'} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">{landlord.landlord_name}</h4>
                    <div className="text-sm text-gray-600">
                      Due: &pound;{Number(landlord.totalDue).toFixed(2)} &middot; Paid: &pound;{Number(landlord.totalPaid).toFixed(2)}
                    </div>
                  </div>
                  {landlord.properties.map((property) => (
                    <div key={property.property_id} className="border-b last:border-b-0">
                      <div className="px-6 py-3 bg-gray-50/50 border-b">
                        <p className="text-sm font-medium text-gray-700">{property.address}</p>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="px-6 py-2 font-medium">Tenant</th>
                            <th className="px-6 py-2 font-medium">Type</th>
                            <th className="px-6 py-2 font-medium">Due Date</th>
                            <th className="px-6 py-2 font-medium text-right">Due</th>
                            <th className="px-6 py-2 font-medium text-right">Paid</th>
                            <th className="px-6 py-2 font-medium text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {property.payments.map((payment) => (
                            <tr key={payment.id} className="border-b last:border-b-0 hover:bg-gray-50">
                              <td className="px-6 py-2 text-gray-900">
                                {payment.tenant_name}
                                {payment.bedroom_name && (
                                  <span className="text-gray-400 ml-1">({payment.bedroom_name})</span>
                                )}
                              </td>
                              <td className="px-6 py-2 text-gray-600 capitalize">{payment.payment_type}</td>
                              <td className="px-6 py-2 text-gray-600">{new Date(payment.due_date).toLocaleDateString('en-GB')}</td>
                              <td className="px-6 py-2 text-right text-gray-900">&pound;{Number(payment.amount_due).toFixed(2)}</td>
                              <td className="px-6 py-2 text-right text-gray-900">&pound;{Number(payment.amount_paid).toFixed(2)}</td>
                              <td className="px-6 py-2 text-right">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                  payment.status === 'paid' ? 'bg-green-100 text-green-800' :
                                  payment.status === 'overdue' || payment.status === 'partial' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {payment.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6">
          {statementError && (
            <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-3 mb-4">{statementError}</div>
          )}
          {viewType === 'monthly' ? (
            <div>
              <h3 className="text-lg font-semibold mb-4">Monthly Statements - {selectedYear}</h3>
              {statementLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : monthsInYear.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {monthsInYear.map(period => (
                    <button
                      key={`${period.year}-${period.month}`}
                      onClick={() => handleViewStatement(period.year, period.month)}
                      className="p-4 border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left"
                    >
                      <p className="font-medium text-gray-900">{period.label}</p>
                      <p className="text-sm text-gray-500">View statement</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center py-8">No statements available for {selectedYear}</p>
              )}
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold mb-4">Annual Summary - {selectedYear}</h3>
              <div className="flex flex-col items-center py-8">
                <div className="bg-emerald-50 rounded-full p-6 mb-4">
                  <svg className="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 mb-4">Download the complete annual statement for {selectedYear}</p>
                <button
                  onClick={handleDownloadAnnual}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium"
                >
                  Download PDF
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
