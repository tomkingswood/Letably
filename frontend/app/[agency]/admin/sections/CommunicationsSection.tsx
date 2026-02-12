'use client';

import { useState, useEffect } from 'react';
import { tenancyCommunication } from '@/lib/api';
import { useAgency } from '@/lib/agency-context';
import { SectionProps } from './index';

interface Communication {
  id: number;
  tenancy_id: number;
  subject: string;
  message: string;
  sender_type: 'admin' | 'tenant' | 'landlord';
  sender_name?: string;
  is_read: boolean;
  created_at: string;
  property_address?: string;
  tenant_name?: string;
}

export default function CommunicationsSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agencySlug } = useAgency();
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchCommunications();
  }, []);

  const fetchCommunications = async () => {
    try {
      const response = await tenancyCommunication.getAll();
      setCommunications(response.data.communications || []);
    } catch (error) {
      console.error('Error fetching communications:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredComms = communications.filter(c => {
    if (filterType === 'all') return true;
    if (filterType === 'unread') return !c.is_read;
    return c.sender_type === filterType;
  });

  const stats = {
    total: communications.length,
    unread: communications.filter(c => !c.is_read).length,
    fromTenants: communications.filter(c => c.sender_type === 'tenant').length,
    fromLandlords: communications.filter(c => c.sender_type === 'landlord').length,
  };

  const getSenderBadge = (type: string) => {
    switch (type) {
      case 'tenant': return 'bg-blue-100 text-blue-800';
      case 'landlord': return 'bg-green-100 text-green-800';
      case 'admin': return 'bg-purple-100 text-purple-800';
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Tenancy Communications</h2>
        <p className="text-gray-600">View and respond to tenant and landlord messages</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Total Messages</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Unread</p>
          <p className="text-2xl font-bold text-red-600">{stats.unread}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">From Tenants</p>
          <p className="text-2xl font-bold text-blue-600">{stats.fromTenants}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">From Landlords</p>
          <p className="text-2xl font-bold text-green-600">{stats.fromLandlords}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'unread', label: 'Unread' },
            { id: 'tenant', label: 'From Tenants' },
            { id: 'landlord', label: 'From Landlords' },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setFilterType(filter.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === filter.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Communications List */}
      <div className="bg-white rounded-lg shadow-md">
        {filteredComms.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">No communications found</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredComms.map(comm => (
              <div
                key={comm.id}
                className={`p-4 hover:bg-gray-50 ${!comm.is_read ? 'bg-blue-50/50' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {!comm.is_read && (
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                      )}
                      <h4 className="font-medium text-gray-900 truncate">{comm.subject}</h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getSenderBadge(comm.sender_type)}`}>
                        {comm.sender_type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">{comm.message}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {comm.sender_name && <span>From: {comm.sender_name}</span>}
                      {comm.property_address && <span>{comm.property_address}</span>}
                      <span>{new Date(comm.created_at).toLocaleDateString('en-GB')}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate?.('tenancies', { action: 'view', id: comm.tenancy_id.toString() })}
                    className="px-3 py-1.5 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium whitespace-nowrap"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
