'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSuperAuth } from '@/lib/super-auth-context';
import { superAgencies, Agency, AgencyUser, StorageUsage } from '@/lib/super-api';

export default function SuperAdminAgencyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const agencyId = params.id as string;
  const { user, isAuthenticated, isLoading, logout } = useSuperAuth();

  const [agency, setAgency] = useState<Agency | null>(null);
  const [admins, setAdmins] = useState<AgencyUser[]>([]);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sup3rAdm1n');
    }
  }, [isLoading, isAuthenticated, router]);

  // Fetch agency data
  useEffect(() => {
    const fetchAgency = async () => {
      if (!isAuthenticated || !agencyId) return;

      setLoading(true);
      try {
        const [agencyResponse, storageResponse] = await Promise.all([
          superAgencies.get(agencyId),
          superAgencies.getStorageUsage(agencyId)
        ]);
        setAgency(agencyResponse.data.agency);
        setAdmins(agencyResponse.data.admins);
        setStorageUsage(storageResponse.data.storage);
      } catch (error) {
        console.error('Failed to fetch agency:', error);
        setMessage({ type: 'error', text: 'Failed to load agency' });
      } finally {
        setLoading(false);
      }
    };

    fetchAgency();
  }, [isAuthenticated, agencyId]);

  const handleToggleStatus = async () => {
    if (!agency) return;

    setUpdating(true);
    setMessage(null);

    try {
      const response = await superAgencies.toggleStatus(agency.id, !agency.is_active);
      setAgency({ ...agency, is_active: response.data.agency.is_active });
      setMessage({
        type: 'success',
        text: `Agency ${response.data.agency.is_active ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to update status'
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleTogglePropertyImages = async () => {
    if (!agency) return;

    setUpdating(true);
    setMessage(null);

    try {
      const response = await superAgencies.togglePropertyImages(agency.id, !agency.property_images_enabled);
      setAgency({ ...agency, property_images_enabled: response.data.agency.property_images_enabled });
      setMessage({
        type: 'success',
        text: `Property images ${response.data.agency.property_images_enabled ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to update property images setting'
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateTier = async (tier: 'standard' | 'premium') => {
    if (!agency) return;

    setUpdating(true);
    setMessage(null);

    try {
      const response = await superAgencies.updateSubscription(agency.id, { subscription_tier: tier });
      setAgency({ ...agency, subscription_tier: response.data.agency.subscription_tier });
      setMessage({ type: 'success', text: `Subscription updated to ${tier}` });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to update subscription'
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleImpersonate = async (userId: number) => {
    if (!agency) return;

    setUpdating(true);
    setMessage(null);

    try {
      const response = await superAgencies.impersonate(agency.id, userId);
      const { token, agency_id } = response.data;

      // Store the impersonation token in localStorage for the agency
      localStorage.setItem(`token_${agency.slug}`, token);
      localStorage.setItem('token', token);

      // Open in new tab
      window.open(`/${agency.slug}/admin`, '_blank');

      setMessage({ type: 'success', text: 'Impersonation token generated. New tab opened.' });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to impersonate user'
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/sup3rAdm1n');
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="/letably-icon.png"
                alt="Letably"
                width={36}
                height={36}
                className="h-8 w-8"
              />
              <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">SUPER ADMIN</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-300 text-sm">
                {user?.first_name} {user?.last_name}
              </span>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-white text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gray-800/50 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-6">
            <Link
              href="/sup3rAdm1n/dashboard"
              className="py-3 text-gray-400 hover:text-white font-medium text-sm"
            >
              Dashboard
            </Link>
            <Link
              href="/sup3rAdm1n/agencies"
              className="py-3 text-purple-400 border-b-2 border-purple-400 font-medium text-sm"
            >
              Agencies
            </Link>
            <Link
              href="/sup3rAdm1n/email"
              className="py-3 text-gray-400 hover:text-white font-medium text-sm"
            >
              Email Queue
            </Link>
            <Link
              href="/sup3rAdm1n/audit-log"
              className="py-3 text-gray-400 hover:text-white font-medium text-sm"
            >
              Audit Log
            </Link>
            <Link
              href="/sup3rAdm1n/users"
              className="py-3 text-gray-400 hover:text-white font-medium text-sm"
            >
              Super Users
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/sup3rAdm1n/agencies"
            className="text-gray-400 hover:text-white text-sm"
          >
            &larr; Back to Agencies
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : agency ? (
          <>
            {/* Message */}
            {message && (
              <div className={`mb-6 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-900/50 border border-green-700 text-green-300'
                  : 'bg-red-900/50 border border-red-700 text-red-300'
              }`}>
                {message.text}
              </div>
            )}

            {/* Agency Header */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{agency.name}</h2>
                <p className="text-gray-400">{agency.slug} | {agency.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded ${
                  agency.subscription_tier === 'premium'
                    ? 'bg-purple-600/20 text-purple-400'
                    : 'bg-gray-600/20 text-gray-400'
                }`}>
                  {agency.subscription_tier}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${
                  agency.is_active
                    ? 'bg-green-600/20 text-green-400'
                    : 'bg-red-600/20 text-red-400'
                }`}>
                  {agency.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Total Users</p>
                <p className="text-2xl font-bold text-white">{agency.user_count || 0}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Properties</p>
                <p className="text-2xl font-bold text-white">{agency.property_count || 0}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Active Tenancies</p>
                <p className="text-2xl font-bold text-white">{agency.active_tenancy_count || 0}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Created</p>
                <p className="text-lg font-semibold text-white">
                  {new Date(agency.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Storage Usage */}
            {storageUsage && (
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Storage Usage</h3>
              <div className="flex items-baseline gap-2 mb-4">
                <p className="text-3xl font-bold text-white">
                  {storageUsage.total_mb >= 1
                    ? `${storageUsage.total_mb} MB`
                    : `${storageUsage.total_kb} KB`}
                </p>
                <p className="text-gray-400 text-sm">total</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Images', bytes: storageUsage.images_bytes },
                  { label: 'Certificates', bytes: storageUsage.certificates_bytes },
                  { label: 'Maintenance', bytes: storageUsage.maintenance_attachments_bytes },
                  { label: 'ID Documents', bytes: storageUsage.id_documents_bytes },
                  { label: 'Exports', bytes: storageUsage.export_jobs_bytes },
                ].map(({ label, bytes }) => (
                  <div key={label} className="bg-gray-700/50 rounded p-3">
                    <p className="text-gray-400 text-xs mb-1">{label}</p>
                    <p className="text-white font-medium text-sm">
                      {bytes >= 1048576
                        ? `${(bytes / 1048576).toFixed(1)} MB`
                        : `${Math.round(bytes / 1024)} KB`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* Actions */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Actions</h3>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handleToggleStatus}
                  disabled={updating}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                    agency.is_active
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {agency.is_active ? 'Disable Agency' : 'Enable Agency'}
                </button>
                <button
                  onClick={() => handleUpdateTier(agency.subscription_tier === 'premium' ? 'standard' : 'premium')}
                  disabled={updating}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {agency.subscription_tier === 'premium' ? 'Downgrade to Standard' : 'Upgrade to Premium'}
                </button>
                <button
                  onClick={handleTogglePropertyImages}
                  disabled={updating}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                    agency.property_images_enabled
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {agency.property_images_enabled ? 'Disable Property Images' : 'Enable Property Images'}
                </button>
              </div>
            </div>

            {/* Admins */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Agency Admins</h3>
              </div>
              <div className="divide-y divide-gray-700">
                {admins.map((admin) => (
                  <div key={admin.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">
                        {admin.first_name} {admin.last_name}
                      </p>
                      <p className="text-gray-400 text-sm">{admin.email}</p>
                      {admin.last_login_at && (
                        <p className="text-gray-500 text-xs mt-1">
                          Last login: {new Date(admin.last_login_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded ${
                        admin.is_active
                          ? 'bg-green-600/20 text-green-400'
                          : 'bg-red-600/20 text-red-400'
                      }`}>
                        {admin.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => handleImpersonate(admin.id)}
                        disabled={updating || !admin.is_active}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={admin.is_active ? 'Login as this admin' : 'Cannot impersonate inactive user'}
                      >
                        Impersonate
                      </button>
                    </div>
                  </div>
                ))}
                {admins.length === 0 && (
                  <div className="px-6 py-8 text-center text-gray-500">
                    No admin users found
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 py-12">
            Agency not found
          </div>
        )}
      </main>
    </div>
  );
}
