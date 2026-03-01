'use client';

import { useState, useEffect } from 'react';
import { viewingRequests as viewingRequestsApi, properties as propertiesApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/types';
import { MessageAlert } from '@/components/ui/MessageAlert';
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

interface PropertyOption {
  id: number;
  address_line1: string;
}

export default function ViewingRequestsSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const [requests, setRequests] = useState<ViewingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [propertiesError, setPropertiesError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    property_id: '',
    visitor_name: '',
    visitor_email: '',
    visitor_phone: '',
    preferred_date: '',
    preferred_time: '',
    message: '',
  });

  useEffect(() => {
    fetchRequests();
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const response = await propertiesApi.getAll();
      setProperties(response.data.properties || []);
    } catch (err: unknown) {
      console.error('Error fetching properties:', err);
      setPropertiesError(getErrorMessage(err, 'Failed to load properties'));
    }
  };

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

  const resetForm = () => {
    setFormData({
      property_id: '',
      visitor_name: '',
      visitor_email: '',
      visitor_phone: '',
      preferred_date: '',
      preferred_time: '',
      message: '',
    });
    setFormError(null);
  };

  const handleCreateViewing = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setFormSubmitting(true);

    try {
      await viewingRequestsApi.createAdmin({
        property_id: Number(formData.property_id),
        visitor_name: formData.visitor_name,
        visitor_email: formData.visitor_email,
        visitor_phone: formData.visitor_phone || undefined,
        preferred_date: formData.preferred_date || undefined,
        preferred_time: formData.preferred_time || undefined,
        message: formData.message || undefined,
      });
      setFormSuccess('Viewing request created successfully');
      resetForm();
      setShowForm(false);
      await fetchRequests();
    } catch (err: unknown) {
      setFormError(getErrorMessage(err, 'Failed to create viewing request'));
    } finally {
      setFormSubmitting(false);
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
        <div className="flex items-center gap-3">
          {stats.pending > 0 && (
            <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
              {stats.pending} pending
            </span>
          )}
          <button
            onClick={() => { setShowForm(!showForm); setFormError(null); setFormSuccess(null); }}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            {showForm ? 'Cancel' : 'Add Viewing'}
          </button>
        </div>
      </div>

      <MessageAlert type="success" message={formSuccess} onDismiss={() => setFormSuccess(null)} />

      {/* Inline Creation Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">New Viewing Request</h3>
          <MessageAlert type="error" message={formError} onDismiss={() => setFormError(null)} />
          <form onSubmit={handleCreateViewing} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property *</label>
                <select
                  value={formData.property_id}
                  onChange={(e) => setFormData({ ...formData, property_id: e.target.value })}
                  required
                  disabled={!!propertiesError}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
                >
                  <option value="">{propertiesError ? 'Failed to load properties' : 'Select a property'}</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.address_line1}</option>
                  ))}
                </select>
                {propertiesError && (
                  <p className="text-sm text-red-600 mt-1">{propertiesError}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visitor Name *</label>
                <input
                  type="text"
                  value={formData.visitor_name}
                  onChange={(e) => setFormData({ ...formData, visitor_name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visitor Email *</label>
                <input
                  type="email"
                  value={formData.visitor_email}
                  onChange={(e) => setFormData({ ...formData, visitor_email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visitor Phone</label>
                <input
                  type="tel"
                  value={formData.visitor_phone}
                  onChange={(e) => setFormData({ ...formData, visitor_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Date</label>
                <input
                  type="date"
                  value={formData.preferred_date}
                  onChange={(e) => setFormData({ ...formData, preferred_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Time</label>
                <input
                  type="time"
                  value={formData.preferred_time}
                  onChange={(e) => setFormData({ ...formData, preferred_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={formSubmitting}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {formSubmitting ? 'Creating...' : 'Create Viewing'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

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
