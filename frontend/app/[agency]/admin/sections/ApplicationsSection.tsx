'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { applications as applicationsApi } from '@/lib/api';
import { Application, getErrorMessage } from '@/lib/types';
import { getStatusBadge, getStatusLabel } from '@/lib/statusBadges';
import { useAgency } from '@/lib/agency-context';
import ApplicationDetailView from '../applications/ApplicationDetailView';
import { SectionProps } from './index';

export default function ApplicationsSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const router = useRouter();
  const { agencySlug } = useAgency();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const isCreateMode = action === 'new';
  const isViewMode = action === 'view' && !!itemId;

  // Redirect to standalone page for create (has its own complex form)
  useEffect(() => {
    if (isCreateMode) {
      router.push(`/${agencySlug}/admin/applications/create`);
    }
  }, [isCreateMode, agencySlug, router]);

  useEffect(() => {
    fetchData();
  }, []);

  // Re-fetch when navigating back from detail view
  const wasViewMode = useRef(false);
  useEffect(() => {
    if (wasViewMode.current && !isViewMode) {
      fetchData();
    }
    wasViewMode.current = isViewMode;
  }, [isViewMode]);

  const fetchData = async () => {
    try {
      const appsResponse = await applicationsApi.getAll();
      setApplications(appsResponse.data.applications || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  // View mode - render application detail inline
  if (isViewMode) {
    return (
      <ApplicationDetailView
        id={itemId}
        onBack={() => onNavigate?.('applications')}
      />
    );
  }

  const filteredApplications = applications.filter(app => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      (app.user_name?.toLowerCase().includes(searchLower)) ||
      (app.user_email?.toLowerCase().includes(searchLower));
    const matchesStatus = filterStatus === 'all' || app.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show loading while redirecting to create page
  if (isCreateMode) {
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
          <h2 className="text-2xl font-bold text-gray-900">Applications</h2>
          <p className="text-gray-600">Review and manage tenant applications</p>
        </div>
        <button
          onClick={() => onNavigate?.('applications', { action: 'new' })}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Application
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Approved</p>
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Rejected</p>
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="in_tenancy">In Tenancy</option>
          </select>
        </div>
      </div>

      {/* Applications List */}
      <div className="bg-white rounded-lg shadow-md">
        {filteredApplications.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">No applications found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Applicant</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map(app => (
                  <tr key={app.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium">{app.user_name}</div>
                      <div className="text-sm text-gray-500">{app.user_email}</div>
                    </td>
                    <td className="py-3 px-4 capitalize">{app.application_type?.replace('_', ' ')}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge('application', app.status)}`}>
                        {getStatusLabel('application', app.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {new Date(app.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onNavigate?.('applications', { action: 'view', id: app.id.toString() })}
                        className="px-3 py-1.5 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
