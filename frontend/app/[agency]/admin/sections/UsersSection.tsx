'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/api';
import { getErrorMessage } from '@/lib/types';
import { useAgency } from '@/lib/agency-context';
import { SectionProps } from './index';
import Input from '@/components/ui/Input';
import { MessageAlert } from '@/components/ui/MessageAlert';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  phone?: string;
  created_at: string;
  last_login_at?: string;
}

export default function UsersSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agencySlug } = useAgency();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  // Edit modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ email: '', first_name: '', last_name: '', phone: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete dialog state
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [linkedRecords, setLinkedRecords] = useState<{ tenancies: number; applications: number; maintenance_requests: number } | null>(null);

  // Landlord delete info modal state
  const [landlordDeleteUser, setLandlordDeleteUser] = useState<User | null>(null);

  // Reset password state
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [resetSending, setResetSending] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);


  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await auth.adminGetUsers();
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  // Stats
  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    tenants: users.filter(u => u.role === 'tenant').length,
    landlords: users.filter(u => u.role === 'landlord').length,
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'tenant': return 'bg-blue-100 text-blue-800';
      case 'landlord': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Edit handlers
  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditForm({
      email: user.email,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
    });
    setEditError(null);
  };

  const handleEditSave = async () => {
    if (!editingUser) return;
    setEditSaving(true);
    setEditError(null);

    try {
      await auth.adminUpdateUser(editingUser.id, {
        email: editForm.email,
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        phone: editForm.phone || undefined,
      });
      setEditingUser(null);
      fetchUsers();
    } catch (err: unknown) {
      setEditError(getErrorMessage(err, 'Failed to update user'));
    } finally {
      setEditSaving(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deletingUser) return;
    setDeleteConfirming(true);
    setDeleteError(null);
    setLinkedRecords(null);

    try {
      await auth.adminDeleteUser(deletingUser.id);
      setDeletingUser(null);
      fetchUsers();
    } catch (err: unknown) {
      // Extract linked_records from the API response if present
      const axiosErr = err as { response?: { data?: { linked_records?: { tenancies: number; applications: number; maintenance_requests: number } } } };
      const records = axiosErr?.response?.data?.linked_records;
      if (records) {
        setLinkedRecords(records);
      }
      setDeleteError(getErrorMessage(err, 'Failed to delete user'));
    } finally {
      setDeleteConfirming(false);
    }
  };

  // Reset password handler
  const handleResetPassword = async () => {
    if (!resettingUser) return;
    setResetSending(true);

    try {
      await auth.adminResetPassword(resettingUser.id, true);
      setResetSuccess(`Password reset email sent to ${resettingUser.email}`);
      setResettingUser(null);
      setTimeout(() => setResetSuccess(null), 5000);
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Failed to reset password'));
    } finally {
      setResetSending(false);
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
      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Edit User</h3>

            <MessageAlert type="error" message={editError} className="mb-4 text-sm" />

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                  required
                />
                <Input
                  label="Last Name"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                  required
                />
              </div>
              <Input
                label="Email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
              />
              <Input
                label="Phone (Optional)"
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleEditSave}
                disabled={editSaving || !editForm.email || !editForm.first_name || !editForm.last_name}
                className="flex-1 bg-primary hover:bg-primary-dark text-white py-2.5 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditingUser(null)}
                disabled={editSaving}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-red-900 mb-2">Delete User</h3>
            <p className="text-gray-600 mb-4">
              This will permanently remove <strong>{deletingUser.first_name} {deletingUser.last_name}</strong> ({deletingUser.email}) from the system.
            </p>
            <MessageAlert type="error" message={deleteError} className="mb-4 text-sm" />
            {linkedRecords && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-900">
                <p className="font-semibold mb-2">This user has the following linked records:</p>
                <ul className="list-disc list-inside space-y-1">
                  {linkedRecords.tenancies > 0 && (
                    <li>{linkedRecords.tenancies} {linkedRecords.tenancies === 1 ? 'tenancy' : 'tenancies'}</li>
                  )}
                  {linkedRecords.applications > 0 && (
                    <li>{linkedRecords.applications} {linkedRecords.applications === 1 ? 'application' : 'applications'}</li>
                  )}
                  {linkedRecords.maintenance_requests > 0 && (
                    <li>{linkedRecords.maintenance_requests} {linkedRecords.maintenance_requests === 1 ? 'maintenance request' : 'maintenance requests'}</li>
                  )}
                </ul>
                <p className="mt-2 text-amber-700">Remove these records first before deleting the user.</p>
              </div>
            )}
            {!linkedRecords && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800">
                <strong>This action cannot be undone.</strong> This will only succeed if the user has no linked tenancies, applications, or maintenance requests.
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleteConfirming}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50 transition-colors"
              >
                {deleteConfirming ? 'Deleting...' : 'Delete User'}
              </button>
              <button
                onClick={() => { setDeletingUser(null); setDeleteError(null); setLinkedRecords(null); }}
                disabled={deleteConfirming}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Landlord Delete Info Modal */}
      {landlordDeleteUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Cannot Delete User Directly</h3>
            <p className="text-gray-600 mb-4">
              <strong>{landlordDeleteUser.first_name} {landlordDeleteUser.last_name}</strong> is a landlord account. To delete this user, you must delete the landlord from the Landlords section. This will remove both the landlord record and their user account.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setLandlordDeleteUser(null);
                  onNavigate?.('landlords');
                }}
                className="flex-1 bg-primary hover:bg-primary-dark text-white py-2.5 rounded-lg font-semibold transition-colors"
              >
                Go to Landlords
              </button>
              <button
                onClick={() => setLandlordDeleteUser(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Confirmation */}
      {resettingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Reset Password</h3>
            <p className="text-gray-600 mb-6">
              Send a password reset email to <strong>{resettingUser.email}</strong>? They will receive a link to set a new password.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleResetPassword}
                disabled={resetSending}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50 transition-colors"
              >
                {resetSending ? 'Sending...' : 'Send Reset Email'}
              </button>
              <button
                onClick={() => setResettingUser(null)}
                disabled={resetSending}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Users</h2>
          <p className="text-gray-600">Manage user accounts</p>
        </div>
      </div>

      {/* Success Toast */}
      <MessageAlert type="success" message={resetSuccess} className="mb-4" />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Total Users</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Admins</p>
          <p className="text-2xl font-bold text-purple-600">{stats.admins}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Tenants</p>
          <p className="text-2xl font-bold text-blue-600">{stats.tenants}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Landlords</p>
          <p className="text-2xl font-bold text-green-600">{stats.landlords}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="tenant">Tenant</option>
            <option value="landlord">Landlord</option>
          </select>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-lg shadow-md">
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Phone</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Joined</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium">{user.first_name} {user.last_name}</div>
                    </td>
                    <td className="py-3 px-4">{user.email}</td>
                    <td className="py-3 px-4">{user.phone || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleColor(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {new Date(user.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-sm px-3 py-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors"
                          title="Edit user"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setResettingUser(user)}
                          className="text-sm px-3 py-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                          title="Reset password"
                        >
                          Reset Password
                        </button>
                        {user.role === 'landlord' ? (
                          <button
                            onClick={() => setLandlordDeleteUser(user)}
                            className="text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete landlord user"
                          >
                            Delete
                          </button>
                        ) : (
                          <button
                            onClick={() => { setDeletingUser(user); setDeleteError(null); }}
                            className="text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete user"
                          >
                            Delete
                          </button>
                        )}
                      </div>
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
