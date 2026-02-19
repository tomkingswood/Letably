'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { tenancyCommunication } from '@/lib/api';
import { TenancyWithCommunication } from '@/lib/communication-utils';
import CommunicationListItem, { CommunicationEmptyState } from '@/components/communication/CommunicationListItem';
import { useAuth } from '@/lib/auth-context';
import { useAgency } from '@/lib/agency-context';
import { getErrorMessage } from '@/lib/types';
import { MessageAlert } from '@/components/ui/MessageAlert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function LandlordCommunicationPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { agencySlug } = useAgency();
  const [loading, setLoading] = useState(true);
  const [tenancies, setTenancies] = useState<TenancyWithCommunication[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchTenancies();
    }
  }, [authLoading, isAuthenticated]);

  const fetchTenancies = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await tenancyCommunication.getLandlordTenancies();
      setTenancies(response.data.tenancies || []);
    } catch (err: unknown) {
      console.error('Error fetching tenancies:', err);
      setError(getErrorMessage(err, 'Failed to load tenancies'));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" text="Loading tenancies..." />
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
              <h1 className="text-4xl font-bold">Tenancy Communication</h1>
              <p className="text-xl text-white/90 mt-1">Communicate with tenants in your properties</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <MessageAlert type="error" message={error} className="mb-6" />

        {/* Tenancies List */}
        {tenancies.length === 0 ? (
          <CommunicationEmptyState
            title="No Active Tenancies"
            message="You don't have any active tenancies to communicate with."
          />
        ) : (
          <div className="space-y-4">
            {tenancies.map((tenancy) => (
              <CommunicationListItem
                key={tenancy.id}
                tenancy={tenancy}
                href={`/${agencySlug}/landlord/communication/${tenancy.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
