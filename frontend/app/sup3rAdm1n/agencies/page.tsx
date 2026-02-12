'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSuperAuth } from '@/lib/super-auth-context';
import { superAgencies, Agency } from '@/lib/super-api';

export default function SuperAdminAgenciesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useSuperAuth();

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<string>('');

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sup3rAdm1n');
    }
  }, [isLoading, isAuthenticated, router]);

  // Fetch agencies
  useEffect(() => {
    const fetchAgencies = async () => {
      if (!isAuthenticated) return;

      setLoading(true);
      try {
        const response = await superAgencies.list({
          search: search || undefined,
          status: statusFilter || undefined,
          subscription_tier: tierFilter || undefined
        });
        setAgencies(response.data.agencies);
      } catch (error) {
        console.error('Failed to fetch agencies:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchAgencies, 300);
    return () => clearTimeout(debounce);
  }, [isAuthenticated, search, statusFilter, tierFilter]);

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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Agencies</h2>
          <p className="text-gray-400 text-sm">{agencies.length} total</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <input
            type="text"
            placeholder="Search agencies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent w-full sm:w-auto sm:min-w-[250px]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">All Tiers</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
        </div>

        {/* Agencies Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Agency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Tier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Users
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Properties
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Tenancies
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Storage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {agencies.map((agency) => (
                    <tr
                      key={agency.id}
                      className="hover:bg-gray-700/30 cursor-pointer transition-colors"
                      onClick={() => router.push(`/sup3rAdm1n/agencies/${agency.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-white font-medium">{agency.name}</p>
                          <p className="text-gray-500 text-sm">{agency.slug}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded ${
                          agency.subscription_tier === 'premium'
                            ? 'bg-purple-600/20 text-purple-400'
                            : 'bg-gray-600/20 text-gray-400'
                        }`}>
                          {agency.subscription_tier}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded ${
                          agency.is_active
                            ? 'bg-green-600/20 text-green-400'
                            : 'bg-red-600/20 text-red-400'
                        }`}>
                          {agency.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-300">
                        {agency.user_count || 0}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-300">
                        {agency.property_count || 0}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-300">
                        {agency.active_tenancy_count || 0}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-300 text-sm">
                        {(() => {
                          const bytes = agency.total_storage_bytes || 0;
                          if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
                          if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
                          if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
                          return `${bytes} B`;
                        })()}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {new Date(agency.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {agencies.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        No agencies found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
