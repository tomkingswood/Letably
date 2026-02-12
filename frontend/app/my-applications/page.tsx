'use client';

import { useState, useEffect } from 'react';
import { applications, settings } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useAuth';
import { getStatusLabel } from '@/lib/statusBadges';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Application {
  id: number;
  application_type: 'student' | 'professional';
  status: 'pending' | 'awaiting_guarantor' | 'submitted' | 'approved' | 'converted_to_tenancy';
  guarantor_required: boolean;
  created_at: string;
  completed_at?: string;
}

export default function MyApplicationsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated } = useRequireAuth();
  const [myApplications, setMyApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState<string>('');

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      window.scrollTo(0, 0);
      fetchMyApplications();
      fetchSettings();
    }
  }, [authLoading, isAuthenticated]);

  const fetchMyApplications = async () => {
    try {
      const response = await applications.getMyApplications();
      setMyApplications(response.data.applications);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await settings.getAll();
      if (response.data.email_address) {
        setAdminEmail(response.data.email_address);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      awaiting_guarantor: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading your applications..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-2">My Applications</h1>
          <p className="text-xl text-white/90">View and complete your tenant applications</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {myApplications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Applications Yet</h3>
            <p className="text-gray-500 mb-4">
              You don't have any applications at the moment. Once an administrator creates an application for you,
              it will appear here.
            </p>
            <Link
              href="/properties"
              className="text-primary hover:text-primary-dark font-semibold"
            >
              Browse Properties
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {myApplications.map((app) => (
              <div key={app.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      {app.application_type === 'student' ? 'Student' : 'Professional'} Application
                    </h2>
                    <p className="text-gray-600">Application #{app.id}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadge(app.status)}`}
                  >
                    {getStatusLabel('application', app.status)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Guarantor Required:</span>{' '}
                    <span className="text-gray-600">{app.guarantor_required ? 'Yes' : 'No'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Created:</span>{' '}
                    <span className="text-gray-600">
                      {new Date(app.created_at).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  {app.completed_at && (
                    <div>
                      <span className="font-medium text-gray-700">Completed:</span>{' '}
                      <span className="text-gray-600">
                        {new Date(app.completed_at).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  )}
                </div>

                {app.status === 'pending' && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Action Required:</strong> Please complete this application to proceed with your tenancy.
                    </p>
                  </div>
                )}

                {app.status === 'awaiting_guarantor' && (
                  <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-4">
                    <p className="text-sm text-orange-800 mb-2">
                      <strong>Awaiting Guarantor:</strong> Your application has been submitted and is awaiting completion by your guarantor.
                      They will receive an email with instructions to complete their part of the application.
                    </p>
                    <p className="text-sm text-orange-700 mt-3">
                      <strong>Haven't received the email?</strong> Please ask your guarantor to check their junk/spam folder.
                      If they still haven't received it, please contact us at{' '}
                      <a href={`mailto:${adminEmail}`} className="underline font-semibold hover:text-orange-900">
                        {adminEmail}
                      </a>
                    </p>
                  </div>
                )}

                <Link
                  href={`/applications/${app.id}`}
                  className="inline-block bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                  {app.status === 'pending' ? 'Complete Application' : 'View Application'}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
