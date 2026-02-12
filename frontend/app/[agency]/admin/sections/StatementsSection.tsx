'use client';

import { useState, useEffect } from 'react';
import { adminReports, landlords as landlordsApi } from '@/lib/api';
import { useAgency } from '@/lib/agency-context';
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

export default function StatementsSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agencySlug } = useAgency();
  const [loading, setLoading] = useState(true);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [selectedLandlord, setSelectedLandlord] = useState<string>('all');
  const [periods, setPeriods] = useState<StatementPeriod[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [viewType, setViewType] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [landlordsRes, periodsRes] = await Promise.all([
        landlordsApi.getAll(),
        adminReports.getStatementPeriods()
      ]);
      setLandlords(landlordsRes.data?.landlords || []);
      setPeriods(Array.isArray(periodsRes.data?.periods) ? periodsRes.data.periods : []);
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
      <div className="bg-white rounded-lg shadow-md p-6">
        {viewType === 'monthly' ? (
          <div>
            <h3 className="text-lg font-semibold mb-4">Monthly Statements - {selectedYear}</h3>
            {monthsInYear.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {monthsInYear.map(period => (
                  <button
                    key={`${period.year}-${period.month}`}
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
    </div>
  );
}
