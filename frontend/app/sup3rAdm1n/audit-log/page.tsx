'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSuperAuth } from '@/lib/super-auth-context';
import { superAuditLog, AuditLogEntry } from '@/lib/super-api';

export default function SuperAdminAuditLogPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useSuperAuth();

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sup3rAdm1n');
    }
  }, [isLoading, isAuthenticated, router]);

  // Fetch audit log
  useEffect(() => {
    const fetchLog = async () => {
      if (!isAuthenticated) return;

      setLoading(true);
      try {
        const response = await superAuditLog.list({ limit: 100 });
        setEntries(response.data.audit_log);
      } catch (error) {
        console.error('Failed to fetch audit log:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLog();
  }, [isAuthenticated]);

  const handleLogout = () => {
    logout();
    router.push('/sup3rAdm1n');
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
              className="py-3 text-purple-400 border-b-2 border-purple-400 font-medium text-sm"
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
        <h2 className="text-2xl font-bold text-white mb-6">Audit Log</h2>

        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {entries.map((entry) => (
                <div key={entry.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-medium">
                        {formatAction(entry.action)}
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        by {entry.super_user_first_name} {entry.super_user_last_name} ({entry.super_user_email})
                      </p>
                      {entry.target_type && (
                        <p className="text-gray-500 text-xs mt-1">
                          Target: {entry.target_type} #{entry.target_id}
                        </p>
                      )}
                      {entry.details && Object.keys(entry.details).length > 0 && (
                        <p className="text-gray-500 text-xs mt-1 font-mono">
                          {JSON.stringify(entry.details)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-sm">
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                      {entry.ip_address && (
                        <p className="text-gray-500 text-xs mt-1">
                          IP: {entry.ip_address}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {entries.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-500">
                  No audit log entries yet
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
