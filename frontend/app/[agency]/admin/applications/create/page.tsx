'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAgency } from '@/lib/agency-context';
import { applications } from '@/lib/api';
import { getErrorMessage } from '@/lib/types';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import UserEmailLookup from '@/components/admin/UserEmailLookup';
import { MessageAlert } from '@/components/ui/MessageAlert';

interface UserData {
  userId: number | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  isNewUser: boolean;
}

interface SuccessData {
  applicationId: number;
  isNewUser: boolean;
  userEmail: string;
  userName: string;
}

export default function CreateApplicationPage() {
  const router = useRouter();
  const { agencySlug } = useAgency();

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  // User data from UserEmailLookup
  const [userData, setUserData] = useState<UserData | null>(null);

  const [formData, setFormData] = useState({
    application_type: 'student' as 'student' | 'professional',
    guarantor_required: true,
  });

  // Handle user data changes from UserEmailLookup
  const handleUserChange = (data: UserData) => {
    setUserData(data);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      // Validate user data
      if (!userData || !userData.email) {
        setError('Please enter a valid email address');
        setCreating(false);
        return;
      }

      // Validate new user has required fields
      if (userData.isNewUser && (!userData.firstName || !userData.lastName)) {
        setError('Please enter first name and last name for the new user');
        setCreating(false);
        return;
      }

      const data = {
        // User data - if existing user, just pass user_id; if new, pass user details
        user_id: userData.userId,
        email: userData.email,
        first_name: userData.firstName,
        last_name: userData.lastName,
        phone: userData.phone || undefined,
        is_new_user: userData.isNewUser,
        // Application data
        application_type: formData.application_type,
        guarantor_required: formData.guarantor_required,
      };

      const response = await applications.create(data);

      // Show success modal
      setSuccessData({
        applicationId: response.data.application_id,
        isNewUser: userData.isNewUser,
        userEmail: userData.email,
        userName: `${userData.firstName} ${userData.lastName}`,
      });
    } catch (err: unknown) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setError(getErrorMessage(err, 'Failed to create application'));
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success Modal */}
      {successData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Created</h2>
              <p className="text-gray-600 mb-4">
                {successData.isNewUser ? (
                  <>
                    A new account has been created for <strong>{successData.userName}</strong>. They will receive an email at <strong>{successData.userEmail}</strong> with instructions to set up their password and complete their application.
                  </>
                ) : (
                  <>
                    An application has been created for <strong>{successData.userName}</strong>. They will receive an email notification.
                  </>
                )}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-6 text-center">
              <p className="text-sm text-gray-500">Application ID</p>
              <p className="text-lg font-semibold text-gray-900">#{successData.applicationId}</p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => router.push(`/${agencySlug}/admin/applications/${successData.applicationId}`)}
                size="lg"
                className="flex-1"
              >
                View Application
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.push(`/${agencySlug}/admin?section=applications`)}
                size="lg"
                className="flex-1"
              >
                Back to List
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-primary text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Create Application</h1>
              <p className="text-xl text-white/90">Create a new application for a user</p>
            </div>
            <Link
              href={`/${agencySlug}/admin?section=applications`}
              className="bg-white text-primary hover:bg-gray-100 px-6 py-2 rounded-lg font-semibold transition-colors"
            >
              Back to Applications
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8">
            {/* Error Message */}
            <MessageAlert type="error" message={error} className="mb-6" />

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tenant Email Lookup */}
              <UserEmailLookup
                onUserChange={handleUserChange}
                phoneRequired={false}
                label="Tenant"
                disabled={creating}
              />

              {/* Application Type */}
              <div>
                <label htmlFor="application_type" className="block text-sm font-medium text-gray-700 mb-2">
                  Application Type *
                </label>
                <select
                  id="application_type"
                  name="application_type"
                  value={formData.application_type}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="student">Student</option>
                  <option value="professional">Professional</option>
                </select>
              </div>

              {/* Guarantor Required */}
              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="guarantor_required"
                  name="guarantor_required"
                  checked={formData.guarantor_required}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label htmlFor="guarantor_required" className="ml-2 block text-sm text-gray-900">
                  Guarantor Required
                  <span className="block text-xs text-gray-500 mt-1">
                    If unchecked, guarantor information will not be required in the application
                  </span>
                  <span className="block text-xs text-amber-600 font-medium mt-1">
                    Warning: This also means no guarantor will be required for the tenancy
                  </span>
                </label>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> The user will receive an email notification with a link to complete their application.
                  They will be able to fill in all required details including personal information, address history{formData.guarantor_required ? ', and guarantor details' : ''}.
                  Property assignment happens when creating the tenancy.
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={creating}
                fullWidth
                size="lg"
              >
                {creating ? 'Creating...' : 'Create Application'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
