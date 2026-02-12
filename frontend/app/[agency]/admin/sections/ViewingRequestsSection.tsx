'use client';

import { useState, useEffect } from 'react';
import { viewingRequests as viewingRequestsApi } from '@/lib/api';
import { useAgency } from '@/lib/agency-context';
import { SectionProps } from './index';

interface ViewingRequest {
  id: number;
  visitor_name: string;
  visitor_email: string;
  visitor_phone?: string;
  message?: string;
  preferred_date?: string;
  preferred_time?: string;
  status: string;
  address_line1?: string;
  property_id?: number;
  created_at: string;
}

export default function ViewingRequestsSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agencySlug } = useAgency();
  const [requests, setRequests] = useState<ViewingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await viewingRequestsApi.getAll();
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error('Error fetching viewing requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await viewingRequestsApi.updateStatus(id, status);
      setRequests(requests.map(r =>
        r.id === id ? { ...r, status } : r
      ));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const filteredRequests = requests.filter(r => {
    return filterStatus === 'all' || r.status === filterStatus;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    confirmed: requests.filter(r => r.status === 'confirmed').length,
    completed: requests.filter(r => r.status === 'completed').length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Viewing Requests</h2>
          <p className="text-gray-600">Review and respond to property viewing requests</p>
        </div>
        {stats.pending > 0 && (
          <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
            {stats.pending} pending
          </span>
        )}
      </div>

      {/* Stats */}
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
          <p className="text-gray-600 text-sm">Confirmed</p>
          <p className="text-2xl font-bold text-blue-600">{stats.confirmed}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Completed</p>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Requests List */}
      <div className="bg-white rounded-lg shadow-md">
        {filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">No viewing requests found</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredRequests.map(request => (
              <div key={request.id} className="p-4 hover:bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">{request.visitor_name}</h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{request.address_line1 || 'Property not specified'}</p>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      <span>{request.visitor_email}</span>
                      {request.visitor_phone && <span>{request.visitor_phone}</span>}
                      {request.preferred_date && (
                        <span>Preferred: {new Date(request.preferred_date).toLocaleDateString('en-GB')}</span>
                      )}
                      <span>Submitted: {new Date(request.created_at).toLocaleDateString('en-GB')}</span>
                    </div>
                  </div>
                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateStatus(request.id, 'confirmed')}
                        className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(request.id, 'cancelled')}
                        className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
