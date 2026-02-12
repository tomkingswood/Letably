'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSuperAuth } from '@/lib/super-auth-context';
import { superStats, superAgencies, PlatformStats, Agency } from '@/lib/super-api';

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useSuperAuth();

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentAgencies, setRecentAgencies] = useState<Agency[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sup3rAdm1n');
    }
  }, [isLoading, isAuthenticated, router]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated) return;

      try {
        const [statsRes, agenciesRes] = await Promise.all([
          superStats.getPlatform(),
          superAgencies.list()
        ]);

        setStats(statsRes.data.stats);
        setRecentAgencies(agenciesRes.data.agencies.slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchData();
  }, [isAuthenticated]);

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
              className="py-3 text-purple-400 border-b-2 border-purple-400 font-medium text-sm"
            >
              Dashboard
            </Link>
            <Link
              href="/sup3rAdm1n/agencies"
              className="py-3 text-gray-400 hover:text-white font-medium text-sm"
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
        <h2 className="text-2xl font-bold text-white mb-6">Platform Overview</h2>

        {loadingStats ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-800 rounded-lg p-6">
                <p className="text-gray-400 text-sm mb-1">Active Agencies</p>
                <p className="text-3xl font-bold text-white">{stats?.active_agencies || 0}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-6">
                <p className="text-gray-400 text-sm mb-1">Premium Agencies</p>
                <p className="text-3xl font-bold text-purple-400">{stats?.premium_agencies || 0}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-6">
                <p className="text-gray-400 text-sm mb-1">Total Users</p>
                <p className="text-3xl font-bold text-white">{stats?.total_users || 0}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-6">
                <p className="text-gray-400 text-sm mb-1">New (30d)</p>
                <p className="text-3xl font-bold text-green-400">{stats?.new_agencies_30d || 0}</p>
              </div>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-500 text-xs mb-1">Inactive Agencies</p>
                <p className="text-xl font-semibold text-gray-300">{stats?.inactive_agencies || 0}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-500 text-xs mb-1">Total Admins</p>
                <p className="text-xl font-semibold text-gray-300">{stats?.total_admins || 0}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-500 text-xs mb-1">Total Tenants</p>
                <p className="text-xl font-semibold text-gray-300">{stats?.total_tenants || 0}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-500 text-xs mb-1">Total Properties</p>
                <p className="text-xl font-semibold text-gray-300">{stats?.total_properties || 0}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-500 text-xs mb-1">Active Tenancies</p>
                <p className="text-xl font-semibold text-gray-300">{stats?.active_tenancies || 0}</p>
              </div>
            </div>

            {/* Recent Agencies */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Recent Agencies</h3>
                <Link
                  href="/sup3rAdm1n/agencies"
                  className="text-purple-400 hover:text-purple-300 text-sm"
                >
                  View All
                </Link>
              </div>
              <div className="divide-y divide-gray-700">
                {recentAgencies.map((agency) => (
                  <Link
                    key={agency.id}
                    href={`/sup3rAdm1n/agencies/${agency.id}`}
                    className="block px-6 py-4 hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{agency.name}</p>
                        <p className="text-gray-400 text-sm">{agency.slug}</p>
                      </div>
                      <div className="flex items-center gap-4">
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
                  </Link>
                ))}
                {recentAgencies.length === 0 && (
                  <div className="px-6 py-8 text-center text-gray-500">
                    No agencies yet
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
