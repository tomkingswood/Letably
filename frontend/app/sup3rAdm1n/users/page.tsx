'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSuperAuth } from '@/lib/super-auth-context';
import { superUsers, SuperUser } from '@/lib/super-api';

export default function SuperAdminUsersPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useSuperAuth();

  const [users, setUsers] = useState<SuperUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: ''
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sup3rAdm1n');
    }
  }, [isLoading, isAuthenticated, router]);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      if (!isAuthenticated) return;

      setLoading(true);
      try {
        const response = await superUsers.list();
        setUsers(response.data.users);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isAuthenticated]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage(null);

    try {
      const response = await superUsers.create(formData);
      setUsers([response.data.user, ...users]);
      setShowCreateForm(false);
      setFormData({ email: '', password: '', first_name: '', last_name: '' });
      setMessage({ type: 'success', text: 'Super user created successfully' });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to create user'
      });
    } finally {
      setCreating(false);
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
              className="py-3 text-purple-400 border-b-2 border-purple-400 font-medium text-sm"
            >
              Super Users
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Super Users</h2>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            {showCreateForm ? 'Cancel' : 'Add Super User'}
          </button>
        </div>

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

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Create New Super User</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users List */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {users.map((u) => (
                <div key={u.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">
                      {u.first_name} {u.last_name}
                      {u.id === user?.id && (
                        <span className="ml-2 text-xs text-purple-400">(You)</span>
                      )}
                    </p>
                    <p className="text-gray-400 text-sm">{u.email}</p>
                    {u.last_login_at && (
                      <p className="text-gray-500 text-xs mt-1">
                        Last login: {new Date(u.last_login_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      u.is_active
                        ? 'bg-green-600/20 text-green-400'
                        : 'bg-red-600/20 text-red-400'
                    }`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-purple-600/20 text-purple-400">
                      {u.role}
                    </span>
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-500">
                  No super users found
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
