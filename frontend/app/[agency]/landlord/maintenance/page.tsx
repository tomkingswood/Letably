'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { landlordPanel } from '@/lib/api';
import Button from '@/components/ui/Button';
import { MessageAlert } from '@/components/ui/MessageAlert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  MaintenanceRequestListItem,
  MaintenanceSummary,
  getCategoryInfo,
  getPriorityColor,
  getStatusColor,
  formatMaintenanceDateOnly,
  formatStatusLabel,
} from '@/lib/maintenance-utils';
import { useAuth } from '@/lib/auth-context';
import { useAgency } from '@/lib/agency-context';
import { getErrorMessage } from '@/lib/types';

export default function LandlordMaintenancePage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { agencySlug } = useAgency();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<MaintenanceRequestListItem[]>([]);
  const [summary, setSummary] = useState<MaintenanceSummary | null>(null);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchMaintenanceRequests();
    }
  }, [authLoading, isAuthenticated, statusFilter]);

  const fetchMaintenanceRequests = async () => {
    try {
      setLoading(true);
      setError('');

      const params = statusFilter !== 'all' ? { status: statusFilter } : undefined;
      const response = await landlordPanel.getMaintenanceRequests(params);

      setRequests(response.data.requests);
      setSummary(response.data.summary);
    } catch (err: unknown) {
      console.error('Error fetching maintenance requests:', err);
      setError(getErrorMessage(err, 'Failed to load maintenance requests'));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" text="Loading maintenance requests..." />
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
              <Link href={`/${agencySlug}/landlord`} className="text-white/80 hover:text-white text-sm mb-2 inline-flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </Link>
              <h1 className="text-4xl font-bold">Maintenance Requests</h1>
              <p className="text-xl text-white/90 mt-1">View and track maintenance issues for your properties</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <MessageAlert type="error" message={error} className="mb-6" />

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <button
              onClick={() => setStatusFilter('all')}
              className={`bg-white rounded-lg shadow-md p-4 text-left transition-all ${
                statusFilter === 'all' ? 'ring-2 ring-primary' : ''
              }`}
            >
              <p className="text-gray-600 text-sm">Total</p>
              <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
            </button>
            <button
              onClick={() => setStatusFilter('submitted')}
              className={`bg-white rounded-lg shadow-md p-4 text-left transition-all ${
                statusFilter === 'submitted' ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <p className="text-gray-600 text-sm">Submitted</p>
              <p className="text-2xl font-bold text-blue-600">{summary.submitted}</p>
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`bg-white rounded-lg shadow-md p-4 text-left transition-all ${
                statusFilter === 'in_progress' ? 'ring-2 ring-purple-500' : ''
              }`}
            >
              <p className="text-gray-600 text-sm">In Progress</p>
              <p className="text-2xl font-bold text-purple-600">{summary.in_progress}</p>
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`bg-white rounded-lg shadow-md p-4 text-left transition-all ${
                statusFilter === 'completed' ? 'ring-2 ring-green-500' : ''
              }`}
            >
              <p className="text-gray-600 text-sm">Completed</p>
              <p className="text-2xl font-bold text-green-600">{summary.completed}</p>
            </button>
            <div className="bg-white rounded-lg shadow-md p-4">
              <p className="text-gray-600 text-sm">High Priority</p>
              <p className="text-2xl font-bold text-red-600">{summary.high_priority}</p>
            </div>
          </div>
        )}

        {/* Requests List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold">
              {statusFilter === 'all' ? 'All Requests' :
               statusFilter === 'in_progress' ? 'In Progress' :
               statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) + ' Requests'}
            </h2>
          </div>

          {requests.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-5xl mb-4">🔧</div>
              <p className="text-gray-600">No maintenance requests found</p>
            </div>
          ) : (
            <div className="divide-y">
              {requests.map((request) => {
                const categoryInfo = getCategoryInfo(request.category);
                return (
                  <div
                    key={request.id}
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/${agencySlug}/landlord/maintenance/${request.id}`)}
                  >
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      <div className="text-3xl">{categoryInfo.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{request.title}</h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getPriorityColor(request.priority)}`}>
                            {request.priority}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusColor(request.status)}`}>
                            {formatStatusLabel(request.status)}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-2">
                          {request.address_line1}
                          {request.address_line2 && `, ${request.address_line2}`}
                        </p>
                        <p className="text-sm text-gray-500 line-clamp-2 mb-2">{request.description}</p>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                          <span>Reported by {request.created_by_first_name} {request.created_by_last_name}</span>
                          <span>{formatMaintenanceDateOnly(request.created_at)}</span>
                          {(request.comment_count ?? 0) > 0 && (
                            <span>{request.comment_count} comment{request.comment_count !== 1 ? 's' : ''}</span>
                          )}
                          {(request.attachment_count ?? 0) > 0 && (
                            <span>{request.attachment_count} attachment{request.attachment_count !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/${agencySlug}/landlord/maintenance/${request.id}`);
                          }}
                          className="w-full md:w-auto"
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
