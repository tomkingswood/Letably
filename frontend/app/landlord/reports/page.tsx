'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { landlordPanel } from '@/lib/api';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  OccupancyPropertyCard,
  ArrearsTable,
  UpcomingEndingsList,
  ReportExportButton,
  formatCurrency,
  PropertyOccupancy,
  ArrearsItem,
  UpcomingEnding,
} from '@/components/reports';
import { useRequireLandlord } from '@/hooks/useAuth';
import { getErrorMessage } from '@/lib/types';
import { MessageAlert } from '@/components/ui/MessageAlert';

interface PortfolioOverview {
  properties: number;
  bedrooms: number;
  occupiedBedrooms: number;
  vacantBedrooms: number;
  occupancyRate: number;
  activeTenancies: number;
  totalTenants: number;
  bedroomDetails: Array<{
    id: number;
    bedroom_name: string;
    address_line1: string;
    is_occupied: number;
    tenant_name: string | null;
    tenancy_end_date: string | null;
  }>;
}

interface OccupancyReport {
  properties: PropertyOccupancy[];
  summary: {
    properties: number;
    bedrooms: number;
    occupied: number;
    vacant: number;
    occupancyRate: number;
  };
}

interface ArrearsReport {
  tenants: ArrearsItem[];
  summary: {
    tenantsInArrears: number;
    totalArrears: number;
    totalOverduePayments: number;
  };
}

interface UpcomingEndingsReport {
  tenancies: UpcomingEnding[];
  summary: {
    endingCount: number;
    potentialRentLoss: number;
  };
}

type ReportTab = 'overview' | 'arrears' | 'endings';

export default function LandlordReportsPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useRequireLandlord();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [landlordName, setLandlordName] = useState('');
  const [error, setError] = useState('');

  // Report data
  const [overview, setOverview] = useState<PortfolioOverview | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancyReport | null>(null);
  const [arrears, setArrears] = useState<ArrearsReport | null>(null);
  const [upcomingEndings, setUpcomingEndings] = useState<UpcomingEndingsReport | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchInitialData();
    }
  }, [authLoading, isAuthenticated]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [overviewRes, infoRes, occupancyRes] = await Promise.all([
        landlordPanel.getPortfolioOverview(),
        landlordPanel.getInfo(),
        landlordPanel.getOccupancyReport()
      ]);
      // Unified reports endpoint returns { report } for all report types
      setOverview(overviewRes.data.report);
      setLandlordName(infoRes.data.landlord.name);
      setOccupancy(occupancyRes.data.report);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load reports'));
    } finally {
      setLoading(false);
    }
  };

  const fetchArrears = async () => {
    if (arrears) return;
    try {
      const res = await landlordPanel.getArrearsReport();
      setArrears(res.data.report);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load arrears report'));
    }
  };

  const fetchUpcomingEndings = async () => {
    if (upcomingEndings) return;
    try {
      const res = await landlordPanel.getUpcomingEndings(90);
      setUpcomingEndings(res.data.report);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load upcoming endings'));
    }
  };

  const handleTabChange = async (tab: ReportTab) => {
    setActiveTab(tab);
    if (tab === 'arrears') await fetchArrears();
    if (tab === 'endings') await fetchUpcomingEndings();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" text="Loading reports..." />
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <div>
              <h1 className="text-2xl font-bold">Reports Dashboard</h1>
              <p className="text-white/80">{landlordName}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <MessageAlert type="error" message={error} className="mb-6" onDismiss={() => setError('')} />

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b">
            <nav className="flex flex-wrap -mb-px">
              {[
                { id: 'overview', label: 'Portfolio Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
                { id: 'arrears', label: 'Arrears', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                { id: 'endings', label: 'Upcoming Endings', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as ReportTab)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                  </svg>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && overview && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-sm text-gray-600 mb-1">Properties</p>
                <p className="text-3xl font-bold text-gray-900">{overview.properties}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-sm text-gray-600 mb-1">Total Bedrooms</p>
                <p className="text-3xl font-bold text-blue-600">{overview.bedrooms}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-sm text-gray-600 mb-1">Occupied</p>
                <p className="text-3xl font-bold text-green-600">{overview.occupiedBedrooms}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-sm text-gray-600 mb-1">Occupancy Rate</p>
                <p className="text-3xl font-bold text-primary">{overview.occupancyRate}%</p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="font-semibold text-gray-900 mb-2">Active Tenancies</h3>
                <p className="text-2xl font-bold text-gray-900">{overview.activeTenancies}</p>
                <p className="text-sm text-gray-600 mt-1">{overview.totalTenants} total tenants</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="font-semibold text-gray-900 mb-2">Vacant Rooms</h3>
                <p className="text-2xl font-bold text-amber-600">{overview.vacantBedrooms}</p>
                <p className="text-sm text-gray-600 mt-1">Available for letting</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 flex items-center justify-center gap-3">
                <Button onClick={() => router.push('/landlord/statements')}>
                  View Financial Statements
                </Button>
                <ReportExportButton reportType="occupancy" onError={setError} />
              </div>
            </div>

            {/* Property Details */}
            {occupancy && occupancy.properties.map((property) => (
              <OccupancyPropertyCard
                key={property.id}
                property={property}
                showLandlord={false}
              />
            ))}
          </div>
        )}

        {activeTab === 'arrears' && (
          <div className="space-y-6">
            {!arrears ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p className="text-gray-600">Loading arrears report...</p>
              </div>
            ) : arrears.tenants.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <div className="text-green-500 text-5xl mb-4">&#10003;</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Arrears</h3>
                <p className="text-gray-600">All tenants are up to date with their payments.</p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-red-50 rounded-lg shadow-md p-6 border border-red-200">
                    <p className="text-sm text-red-600">Total Arrears</p>
                    <p className="text-3xl font-bold text-red-700">{formatCurrency(arrears.summary.totalArrears)}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <p className="text-sm text-gray-600">Tenants in Arrears</p>
                    <p className="text-3xl font-bold text-gray-900">{arrears.summary.tenantsInArrears}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <p className="text-sm text-gray-600">Overdue Payments</p>
                    <p className="text-3xl font-bold text-amber-600">{arrears.summary.totalOverduePayments}</p>
                  </div>
                </div>

                <ArrearsTable
                  tenants={arrears.tenants}
                  showLandlord={false}
                  showTenancyLink={false}
                  onError={setError}
                />
              </>
            )}
          </div>
        )}

        {activeTab === 'endings' && (
          <div className="space-y-6">
            {!upcomingEndings ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p className="text-gray-600">Loading upcoming endings...</p>
              </div>
            ) : upcomingEndings.tenancies.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <div className="text-gray-400 text-5xl mb-4">&#128197;</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Upcoming Endings</h3>
                <p className="text-gray-600">No tenancies are ending within the next 90 days.</p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-amber-50 rounded-lg shadow-md p-6 border border-amber-200">
                    <p className="text-sm text-amber-600">Tenancies Ending (90 days)</p>
                    <p className="text-3xl font-bold text-amber-700">{upcomingEndings.summary.endingCount}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <p className="text-sm text-gray-600">Potential Weekly Rent Loss</p>
                    <p className="text-3xl font-bold text-gray-900">{formatCurrency(upcomingEndings.summary.potentialRentLoss)}/pw</p>
                  </div>
                </div>

                <UpcomingEndingsList
                  tenancies={upcomingEndings.tenancies}
                  showLandlord={false}
                  showTenancyLink={false}
                  onError={setError}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
