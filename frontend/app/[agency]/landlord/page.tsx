'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { landlordPanel, tenancyCommunication } from '@/lib/api';
import { TenancyWithCommunication } from '@/lib/communication-utils';
import Button from '@/components/ui/Button';
import CommunicationListItem from '@/components/communication/CommunicationListItem';
import { useAuth } from '@/lib/auth-context';
import { useAgency } from '@/lib/agency-context';
import { getErrorMessage } from '@/lib/types';
import { formatDateLong } from '@/lib/dateUtils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

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
  tenant_count: number;
}

interface MaintenanceSummary {
  total: number;
  submitted: number;
  in_progress: number;
  completed: number;
  high_priority: number;
}

interface MaintenanceRequest {
  id: number;
  title: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  address_line1: string;
}

export default function LandlordDashboard() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const { agencySlug } = useAgency();
  const [loading, setLoading] = useState(true);
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [landlordName, setLandlordName] = useState('');
  const [error, setError] = useState('');
  const [maintenanceSummary, setMaintenanceSummary] = useState<MaintenanceSummary | null>(null);
  const [recentMaintenance, setRecentMaintenance] = useState<MaintenanceRequest[]>([]);
  const [recentCommunications, setRecentCommunications] = useState<TenancyWithCommunication[]>([]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchLandlordData();
    }
  }, [authLoading, isAuthenticated]);

  const fetchLandlordData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch landlord info, tenancies, maintenance, and communications in parallel
      const [infoResponse, tenanciesResponse, maintenanceResponse, communicationsResponse] = await Promise.all([
        landlordPanel.getInfo(),
        landlordPanel.getTenancies(),
        landlordPanel.getMaintenanceRequests(),
        tenancyCommunication.getLandlordTenancies()
      ]);

      setLandlordName(infoResponse.data.landlord.name);
      setTenancies(tenanciesResponse.data.tenancies);
      setMaintenanceSummary(maintenanceResponse.data.summary);
      // Get only the first 5 non-completed requests for the dashboard
      const activeRequests = maintenanceResponse.data.requests
        .filter((r: MaintenanceRequest) => r.status !== 'completed')
        .slice(0, 5);
      setRecentMaintenance(activeRequests);

      // Get tenancies with recent messages (sorted by last_message_at)
      const tenanciesWithMessages = (communicationsResponse.data.tenancies || [])
        .filter((t: TenancyWithCommunication) => t.message_count > 0)
        .slice(0, 5);
      setRecentCommunications(tenanciesWithMessages);
    } catch (err: unknown) {
      console.error('Error fetching landlord data:', err);
      setError(getErrorMessage(err, 'Failed to load landlord data'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push(`/${agencySlug}`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" text="Loading your properties..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="text-center">
            <div className="text-red-600 text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={handleLogout}>Return to Login</Button>
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
              <h1 className="text-4xl font-bold mb-2">Landlord Portal</h1>
              <p className="text-xl text-white/90">Welcome back, {landlordName}</p>
            </div>
            <Button
              variant="secondary"
              onClick={handleLogout}
              className="bg-white text-primary hover:bg-gray-100 w-full sm:w-auto"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Quick Actions */}
        <div className="mb-6 flex flex-wrap gap-3">
          <Button
            onClick={() => router.push(`/${agencySlug}/landlord/payment-calendar`)}
            className="w-full sm:w-auto flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Payment Calendar
          </Button>
          <Button
            onClick={() => router.push(`/${agencySlug}/landlord/maintenance`)}
            variant="secondary"
            className="w-full sm:w-auto flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            View All Maintenance
          </Button>
          <Button
            onClick={() => router.push(`/${agencySlug}/landlord/communication`)}
            variant="secondary"
            className="w-full sm:w-auto flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            View All Communications
          </Button>
          <Button
            onClick={() => router.push(`/${agencySlug}/landlord/statements`)}
            variant="secondary"
            className="w-full sm:w-auto flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Financial Statements
          </Button>
          <Button
            onClick={() => router.push(`/${agencySlug}/landlord/reports`)}
            variant="secondary"
            className="w-full sm:w-auto flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Reports
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 mb-1">Active Tenancies</p>
            <p className="text-3xl font-bold text-primary">{tenancies.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 mb-1">Total Tenants</p>
            <p className="text-3xl font-bold text-blue-600">
              {tenancies.reduce((sum, t) => sum + t.tenant_count, 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 mb-1">Active Maintenance</p>
            <p className="text-3xl font-bold text-purple-600">
              {(maintenanceSummary?.submitted || 0) + (maintenanceSummary?.in_progress || 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 mb-1">High Priority</p>
            <p className="text-3xl font-bold text-red-600">
              {maintenanceSummary?.high_priority || 0}
            </p>
          </div>
        </div>

        {/* Tenancies List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold">Your Active Tenancies</h2>
          </div>

          {tenancies.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No active tenancies found</p>
            </div>
          ) : (
            <div className="divide-y">
              {tenancies.map((tenancy) => (
                <div
                  key={tenancy.id}
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/${agencySlug}/landlord/${tenancy.id}`)}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {tenancy.address_line1}
                        {tenancy.address_line2 && `, ${tenancy.address_line2}`}
                      </h3>
                      <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                        <span>📍 {tenancy.property_location}</span>
                        <span>👥 {tenancy.tenant_count} Tenant{tenancy.tenant_count !== 1 ? 's' : ''}</span>
                        <span>
                          {tenancy.tenancy_type === 'room_only' ? '🏠 Room Only' : '🏡 Whole House'}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-500">
                        <span>📅 {formatDateLong(tenancy.start_date)} - {formatDateLong(tenancy.end_date)}</span>
                      </div>
                    </div>
                    <div>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/${agencySlug}/landlord/${tenancy.id}`);
                        }}
                        className="w-full md:w-auto"
                      >
                        View Details →
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Maintenance Requests */}
        {recentMaintenance.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden mt-8">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold">Active Maintenance Requests</h2>
              <Button
                onClick={() => router.push(`/${agencySlug}/landlord/maintenance`)}
                variant="secondary"
                className="text-sm"
              >
                View All
              </Button>
            </div>
            <div className="divide-y">
              {recentMaintenance.map((request) => (
                <div
                  key={request.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/${agencySlug}/landlord/maintenance/${request.id}`)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{request.title}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          request.priority === 'high' ? 'bg-red-100 text-red-800' :
                          request.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {request.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{request.address_line1}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDateLong(request.created_at)}
                      </p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                      request.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                      request.status === 'in_progress' ? 'bg-purple-100 text-purple-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {request.status === 'in_progress' ? 'In Progress' :
                       request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Communications */}
        {recentCommunications.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden mt-8">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold">Recent Communications</h2>
              <Button
                onClick={() => router.push(`/${agencySlug}/landlord/communication`)}
                variant="secondary"
                className="text-sm"
              >
                View All
              </Button>
            </div>
            <div className="p-4 space-y-3">
              {recentCommunications.map((comm) => (
                <CommunicationListItem
                  key={comm.id}
                  tenancy={comm}
                  href={`/${agencySlug}/landlord/communication/${comm.id}`}
                  variant="compact"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
