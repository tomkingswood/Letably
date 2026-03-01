'use client';

import { useState, useEffect } from 'react';
import { adminReports } from '@/lib/api';
import { useAgency } from '@/lib/agency-context';
import { SectionProps } from './index';

interface PortfolioData {
  properties?: number;
  bedrooms?: number;
  occupiedBedrooms?: number;
  vacantBedrooms?: number;
  occupancyRate?: number;
  activeTenancies?: number;
  totalTenants?: number;
}

interface OccupancyData {
  properties?: Array<{
    id: number;
    address: string;
    occupancy: { occupied: number; total: number; rate: number };
    bedrooms: Array<{
      id: number;
      name: string;
      baseRent: number | null;
      isOccupied: boolean;
      tenant: { name: string; rentPPPW: number; tenancyStart: string; tenancyEnd: string | null } | null;
      nextTenant: { name: string; rentPPPW: number; tenancyStart: string; tenancyEnd: string | null } | null;
    }>;
  }>;
  summary?: { properties: number; bedrooms: number; occupied: number; vacant: number; occupancyRate: number };
}

interface ArrearsData {
  tenants?: Array<{
    member_id: number;
    tenant_name: string;
    tenant_email: string;
    property_address: string;
    bedroom_name: string | null;
    total_arrears: number;
    overdue_payments: number;
    days_overdue: number;
  }>;
  summary?: {
    tenantsInArrears: number;
    totalArrears: number;
    totalOverduePayments: number;
  };
}

interface UpcomingEndingsData {
  tenancies?: Array<{
    tenancy_id: number;
    tenants: string;
    property_address: string;
    end_date: string;
    days_until_end: number;
  }>;
}

export default function ReportsSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agencySlug } = useAgency();
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState('portfolio');
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [occupancyData, setOccupancyData] = useState<OccupancyData | null>(null);
  const [arrearsData, setArrearsData] = useState<ArrearsData | null>(null);
  const [upcomingEndingsData, setUpcomingEndingsData] = useState<UpcomingEndingsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReport();
  }, [selectedReport]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      switch (selectedReport) {
        case 'portfolio':
          const portfolioRes = await adminReports.getPortfolioOverview();
          setPortfolioData(portfolioRes.data.report);
          break;
        case 'occupancy': {
          const occupancyRes = await adminReports.getOccupancyReport();
          const occReport = occupancyRes.data.report;
          if (occReport?.properties) {
            for (const prop of occReport.properties) {
              for (const bed of prop.bedrooms) {
                if (bed.baseRent != null) bed.baseRent = Number(bed.baseRent);
                if (bed.tenant) bed.tenant.rentPPPW = Number(bed.tenant.rentPPPW);
                if (bed.nextTenant) bed.nextTenant.rentPPPW = Number(bed.nextTenant.rentPPPW);
              }
            }
          }
          setOccupancyData(occReport);
          break;
        }
        case 'arrears': {
          const arrearsRes = await adminReports.getArrearsReport();
          const arrReport = arrearsRes.data.report;
          if (arrReport?.summary) {
            arrReport.summary.totalArrears = Number(arrReport.summary.totalArrears);
          }
          if (arrReport?.tenants) {
            for (const t of arrReport.tenants) {
              t.total_arrears = Number(t.total_arrears);
            }
          }
          setArrearsData(arrReport);
          break;
        }
        case 'upcoming-endings':
          const endingsRes = await adminReports.getUpcomingEndings(30);
          setUpcomingEndingsData(endingsRes.data.report);
          break;
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const reportTypes = [
    { id: 'portfolio', name: 'Portfolio Overview', description: 'Overview of properties and occupancy' },
    { id: 'occupancy', name: 'Occupancy Report', description: 'Detailed bedroom occupancy status' },
    { id: 'arrears', name: 'Arrears Report', description: 'Outstanding payment tracking' },
    { id: 'upcoming-endings', name: 'Upcoming Endings', description: 'Tenancies ending soon' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'let': case 'occupied': return 'bg-green-100 text-green-800';
      case 'available': return 'bg-blue-100 text-blue-800';
      case 'unavailable': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
        <p className="text-gray-600">View insights and generate reports</p>
      </div>

      {/* Report Type Selector */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {reportTypes.map((report) => (
            <button
              key={report.id}
              onClick={() => setSelectedReport(report.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedReport === report.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {report.name}
            </button>
          ))}
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchReport}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        ) : (
          <div>
            <h3 className="text-xl font-semibold mb-6">
              {reportTypes.find(r => r.id === selectedReport)?.name}
            </h3>

            {/* Portfolio Overview */}
            {selectedReport === 'portfolio' && portfolioData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600 text-sm">Properties</p>
                  <p className="text-2xl font-bold text-gray-900">{portfolioData.properties || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600 text-sm">Total Bedrooms</p>
                  <p className="text-2xl font-bold text-gray-900">{portfolioData.bedrooms || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600 text-sm">Occupied</p>
                  <p className="text-2xl font-bold text-green-600">{portfolioData.occupiedBedrooms || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600 text-sm">Vacant</p>
                  <p className="text-2xl font-bold text-red-600">{portfolioData.vacantBedrooms || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600 text-sm">Occupancy Rate</p>
                  <p className="text-2xl font-bold text-primary">{portfolioData.occupancyRate || 0}%</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600 text-sm">Active Tenancies</p>
                  <p className="text-2xl font-bold text-gray-900">{portfolioData.activeTenancies || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600 text-sm">Total Tenants</p>
                  <p className="text-2xl font-bold text-gray-900">{portfolioData.totalTenants || 0}</p>
                </div>
              </div>
            )}

            {/* Occupancy Report */}
            {selectedReport === 'occupancy' && occupancyData && (
              <div className="space-y-6">
                {occupancyData.summary && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-2">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-600 text-sm">Properties</p>
                      <p className="text-2xl font-bold text-gray-900">{occupancyData.summary.properties}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-600 text-sm">Bedrooms</p>
                      <p className="text-2xl font-bold text-gray-900">{occupancyData.summary.bedrooms}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-600 text-sm">Occupied</p>
                      <p className="text-2xl font-bold text-green-600">{occupancyData.summary.occupied}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-600 text-sm">Vacant</p>
                      <p className="text-2xl font-bold text-red-600">{occupancyData.summary.vacant}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-600 text-sm">Occupancy Rate</p>
                      <p className="text-2xl font-bold text-primary">{occupancyData.summary.occupancyRate}%</p>
                    </div>
                  </div>
                )}
                {occupancyData.properties && occupancyData.properties.length > 0 ? (
                  occupancyData.properties.map(property => (
                    <div key={property.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">{property.address}</h4>
                        <span className="text-sm text-gray-500">
                          {property.occupancy.occupied}/{property.occupancy.total} occupied ({property.occupancy.rate}%)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {property.bedrooms.map((bedroom) => (
                          <div key={bedroom.id} className={`rounded p-3 ${bedroom.isOccupied ? 'bg-green-50' : 'bg-gray-50'}`}>
                            <p className="font-medium text-sm">{bedroom.name}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              bedroom.isOccupied ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {bedroom.isOccupied ? 'Occupied' : 'Vacant'}
                            </span>
                            {bedroom.tenant && (
                              <p className="text-xs text-gray-600 mt-1">{bedroom.tenant.name}</p>
                            )}
                            {bedroom.baseRent != null && !bedroom.isOccupied && (
                              <p className="text-xs text-gray-400 mt-1">&pound;{Number(bedroom.baseRent).toFixed(2)} pppw</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600 text-center py-8">No occupancy data available</p>
                )}
              </div>
            )}

            {/* Arrears Report */}
            {selectedReport === 'arrears' && arrearsData && (
              <div>
                {arrearsData.summary && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-red-600 text-sm">Total Arrears</p>
                      <p className="text-2xl font-bold text-red-700">&pound;{Number(arrearsData.summary.totalArrears).toFixed(2)}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-red-600 text-sm">Tenants in Arrears</p>
                      <p className="text-2xl font-bold text-red-700">{arrearsData.summary.tenantsInArrears}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-red-600 text-sm">Overdue Payments</p>
                      <p className="text-2xl font-bold text-red-700">{arrearsData.summary.totalOverduePayments}</p>
                    </div>
                  </div>
                )}
                {arrearsData.tenants && arrearsData.tenants.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Tenant</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Property</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Overdue</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Days</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-700">Arrears</th>
                        </tr>
                      </thead>
                      <tbody>
                        {arrearsData.tenants.map(t => (
                          <tr key={t.member_id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <p className="font-medium">{t.tenant_name}</p>
                              <p className="text-xs text-gray-500">{t.tenant_email}</p>
                            </td>
                            <td className="py-3 px-4">
                              {t.property_address}
                              {t.bedroom_name && <span className="text-gray-400 ml-1">({t.bedroom_name})</span>}
                            </td>
                            <td className="py-3 px-4">{t.overdue_payments}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                t.days_overdue > 30 ? 'bg-red-100 text-red-800' :
                                t.days_overdue > 14 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-orange-100 text-orange-800'
                              }`}>
                                {t.days_overdue}d
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-red-600">&pound;{Number(t.total_arrears).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-600 text-center py-8">No arrears found - all payments are up to date!</p>
                )}
              </div>
            )}

            {/* Upcoming Endings Report */}
            {selectedReport === 'upcoming-endings' && upcomingEndingsData && (
              <div>
                {upcomingEndingsData.tenancies && upcomingEndingsData.tenancies.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Tenant</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Property</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">End Date</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-700">Days Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {upcomingEndingsData.tenancies.map(t => (
                          <tr key={t.tenancy_id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium">{t.tenants}</td>
                            <td className="py-3 px-4">{t.property_address}</td>
                            <td className="py-3 px-4">{new Date(t.end_date).toLocaleDateString('en-GB')}</td>
                            <td className="py-3 px-4 text-right">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                t.days_until_end <= 7 ? 'bg-red-100 text-red-800' :
                                t.days_until_end <= 14 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {t.days_until_end} days
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-600 text-center py-8">No tenancies ending in the next 30 days</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
