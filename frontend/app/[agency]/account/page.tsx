'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { auth } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAgency } from '@/lib/agency-context';
import { getErrorMessage, User } from '@/lib/types';
import { MessageAlert } from '@/components/ui/MessageAlert';
import { validatePassword } from '@/lib/validation';

export default function AccountPage() {
  const router = useRouter();
  const { user: authUser, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const { agencySlug } = useAgency();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push(`/${agencySlug}`);
      return;
    }

    const fetchUser = async () => {
      try {
        const response = await auth.getCurrentUser();
        const fetchedUser = response.data.user;
        setUser(fetchedUser);
        setFirstName(fetchedUser.first_name || '');
        setLastName(fetchedUser.last_name || '');
        setPhone(fetchedUser.phone || '');
      } catch (err: unknown) {
        console.error('Error fetching user:', err);
        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr.response?.status === 401) {
          logout();
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [authLoading, isAuthenticated, agencySlug, router, logout]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const response = await auth.updateMyAccount({
        first_name: firstName,
        last_name: lastName,
        phone: phone || undefined,
      });

      const updatedUser = response.data.user;
      const userKey = agencySlug ? `user_${agencySlug}` : 'user';
      localStorage.setItem(userKey, JSON.stringify(updatedUser));
      setUser(updatedUser);
      setSuccess('Your account has been updated successfully.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update account. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    const { error: passwordValidationError } = validatePassword(newPassword);
    if (passwordValidationError) {
      setPasswordError(passwordValidationError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password.');
      return;
    }

    setChangingPassword(true);

    try {
      await auth.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Your password has been changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
    } catch (err: unknown) {
      setPasswordError(getErrorMessage(err, 'Failed to change password. Please try again.'));
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
              <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Manage Account</h1>

            {/* Account Details Form */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Account Details</h2>

              <MessageAlert type="error" message={error} className="mb-4" />
              <MessageAlert type="success" message={success} className="mb-4" />

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Email address cannot be changed. Contact us if you need to update it.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                  <Input
                    label="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>

                <Input
                  label="Phone Number"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Optional"
                />

                <div className="pt-4">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </div>

            {/* Password Change Section */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Password</h2>
                {!showPasswordChange && (
                  <Button
                    variant="outline"
                    onClick={() => setShowPasswordChange(true)}
                  >
                    Change Password
                  </Button>
                )}
              </div>

              {showPasswordChange ? (
                <>
                  <MessageAlert type="error" message={passwordError} className="mb-4" />
                  <MessageAlert type="success" message={passwordSuccess} className="mb-4" />

                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <Input
                      type="password"
                      label="Current Password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />

                    <Input
                      type="password"
                      label="New Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="At least 8 characters"
                    />

                    <Input
                      type="password"
                      label="Confirm New Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />

                    <div className="flex gap-3 pt-2">
                      <Button type="submit" disabled={changingPassword}>
                        {changingPassword ? 'Changing...' : 'Change Password'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowPasswordChange(false);
                          setCurrentPassword('');
                          setNewPassword('');
                          setConfirmPassword('');
                          setPasswordError('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                <p className="text-gray-600">
                  Your password is secure. Click "Change Password" if you'd like to update it.
                </p>
              )}
            </div>

            {/* Account Role */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Account Type</h2>
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    user?.role === 'admin'
                      ? 'bg-primary/10 text-primary'
                      : user?.role === 'landlord'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {user?.role === 'admin'
                    ? 'Administrator'
                    : user?.role === 'landlord'
                    ? 'Landlord'
                    : 'Tenant'}
                </span>
              </div>
              <p className="text-gray-600 text-sm mt-2">
                Your account type determines what features you can access.
              </p>
            </div>
          </div>
        </div>
    </main>
  );
}
