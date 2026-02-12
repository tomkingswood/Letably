'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSuperAuth } from '@/lib/super-auth-context';
import { superEmail, SmtpSettings, QueuedEmail, EmailQueueStats } from '@/lib/super-api';
import { getErrorMessage } from '@/lib/types';
import { formatDateTime } from '@/lib/dateUtils';

export default function SuperAdminEmailPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useSuperAuth();

  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings | null>(null);
  const [emails, setEmails] = useState<QueuedEmail[]>([]);
  const [stats, setStats] = useState<EmailQueueStats | null>(null);
  const [loadingSmtp, setLoadingSmtp] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedEmail, setSelectedEmail] = useState<QueuedEmail | null>(null);

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
        const [smtpRes, statsRes] = await Promise.all([
          superEmail.getSmtpSettings(),
          superEmail.getQueueStats()
        ]);
        setSmtpSettings(smtpRes.data.settings);
        setStats(statsRes.data);
      } catch (error) {
        console.error('Failed to fetch SMTP settings:', error);
      } finally {
        setLoadingSmtp(false);
      }

      fetchQueue();
    };

    fetchData();
  }, [isAuthenticated]);

  const fetchQueue = async () => {
    setLoadingQueue(true);
    try {
      const params: { status?: string; limit?: number } = { limit: 100 };
      if (statusFilter) params.status = statusFilter;

      const queueRes = await superEmail.getQueue(params);
      setEmails(queueRes.data.emails);
    } catch (error) {
      console.error('Failed to fetch email queue:', error);
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchQueue();
    }
  }, [statusFilter, isAuthenticated]);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setStatusMessage(null);
    try {
      const res = await superEmail.testConnection();
      setStatusMessage({
        type: res.data.success ? 'success' : 'error',
        message: res.data.message
      });
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        message: getErrorMessage(err, 'Connection test failed')
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress) return;
    setSendingTestEmail(true);
    setStatusMessage(null);
    try {
      const res = await superEmail.sendTestEmail(testEmailAddress);
      setStatusMessage({
        type: res.data.success ? 'success' : 'error',
        message: res.data.success ? `Test email sent to ${testEmailAddress}` : (res.data.error || 'Failed to send')
      });
      if (res.data.success) setTestEmailAddress('');
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        message: getErrorMessage(err, 'Failed to send test email')
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleRetry = async (id: number) => {
    try {
      await superEmail.retryEmail(id);
      fetchQueue();
      // Refresh stats
      const statsRes = await superEmail.getQueueStats();
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to retry email:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this email?')) return;
    try {
      await superEmail.deleteEmail(id);
      fetchQueue();
      // Refresh stats
      const statsRes = await superEmail.getQueueStats();
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to delete email:', error);
    }
  };

  const handleBulkDelete = async (status: string) => {
    const days = prompt(`Delete all ${status} emails older than how many days? (Leave empty for all)`);
    if (days === null) return;

    const olderThanDays = days ? parseInt(days) : undefined;

    try {
      const res = await superEmail.bulkDelete(status, olderThanDays);
      setStatusMessage({
        type: 'success',
        message: `Deleted ${res.data.deleted_count} emails`
      });
      fetchQueue();
      // Refresh stats
      const statsRes = await superEmail.getQueueStats();
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to bulk delete:', error);
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
              className="py-3 text-purple-400 border-b-2 border-purple-400 font-medium text-sm"
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
        <h2 className="text-2xl font-bold text-white mb-6">Email Queue &amp; SMTP</h2>

        {/* Status Message */}
        {statusMessage && (
          <div className={`mb-6 p-4 rounded-lg ${
            statusMessage.type === 'success' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
          }`}>
            {statusMessage.message}
          </div>
        )}

        {/* SMTP Settings Card */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Platform SMTP Settings</h3>
          <p className="text-gray-400 text-sm mb-4">
            These settings are configured via environment variables (.env file).
          </p>

          {loadingSmtp ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : smtpSettings ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-500 text-xs">Host</p>
                  <p className="text-white font-mono text-sm">{smtpSettings.host || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Port</p>
                  <p className="text-white font-mono text-sm">{smtpSettings.port}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Secure (TLS)</p>
                  <p className="text-white font-mono text-sm">{smtpSettings.secure ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Username</p>
                  <p className="text-white font-mono text-sm">{smtpSettings.username || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">From Email</p>
                  <p className="text-white font-mono text-sm">{smtpSettings.from_email || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">From Name</p>
                  <p className="text-white font-mono text-sm">{smtpSettings.from_name || 'Not set'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${
                  smtpSettings.configured
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-red-900/50 text-red-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${smtpSettings.configured ? 'bg-green-400' : 'bg-red-400'}`}></span>
                  {smtpSettings.configured ? 'Configured' : 'Not Configured'}
                </span>
              </div>

              <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-700">
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection || !smtpSettings.configured}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm"
                >
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>

                <div className="flex gap-2">
                  <input
                    type="email"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    placeholder="test@example.com"
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm placeholder-gray-400"
                  />
                  <button
                    onClick={handleSendTestEmail}
                    disabled={sendingTestEmail || !smtpSettings.configured || !testEmailAddress}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm"
                  >
                    {sendingTestEmail ? 'Sending...' : 'Send Test'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-red-400">Failed to load SMTP settings</p>
          )}
        </div>

        {/* Queue Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Pending</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.overall.pending}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Sent</p>
              <p className="text-2xl font-bold text-green-400">{stats.overall.sent}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Failed</p>
              <p className="text-2xl font-bold text-red-400">{stats.overall.failed}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Last 24h</p>
              <p className="text-2xl font-bold text-white">{stats.recent.sent_24h}</p>
              <p className="text-gray-500 text-xs">sent</p>
            </div>
          </div>
        )}

        {/* Email Queue */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Email Queue</h3>
            <div className="flex items-center gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
              </select>
              <button
                onClick={() => fetchQueue()}
                className="text-gray-400 hover:text-white text-sm"
              >
                Refresh
              </button>
              {stats && stats.overall.sent > 0 && (
                <button
                  onClick={() => handleBulkDelete('sent')}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Clear Sent
                </button>
              )}
            </div>
          </div>

          {loadingQueue ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">To</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Subject</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Agency</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {emails.map((email) => (
                    <tr key={email.id} className="hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <p className="text-white text-sm">{email.to_email}</p>
                        {email.to_name && (
                          <p className="text-gray-400 text-xs">{email.to_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedEmail(email)}
                          className="text-white text-sm hover:text-purple-400 text-left max-w-xs truncate block"
                        >
                          {email.subject}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-400 text-sm">{email.agency_name || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          email.status === 'sent' ? 'bg-green-900/50 text-green-400' :
                          email.status === 'failed' ? 'bg-red-900/50 text-red-400' :
                          'bg-yellow-900/50 text-yellow-400'
                        }`}>
                          {email.status}
                        </span>
                        {email.error_message && (
                          <p className="text-red-400 text-xs mt-1 max-w-xs truncate" title={email.error_message}>
                            {email.error_message}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {formatDateTime(email.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {email.status === 'failed' && (
                            <button
                              onClick={() => handleRetry(email.id)}
                              className="text-purple-400 hover:text-purple-300 text-sm"
                            >
                              Retry
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(email.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {emails.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No emails in queue
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats by Agency */}
        {stats && stats.by_agency.length > 0 && (
          <div className="mt-6 bg-gray-800 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Queue by Agency</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Agency</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Pending</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Sent</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Failed</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {stats.by_agency.map((agency) => (
                    <tr key={agency.agency_id} className="hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <p className="text-white text-sm">{agency.agency_name || 'Unknown'}</p>
                        <p className="text-gray-400 text-xs">{agency.agency_slug || '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-yellow-400">{agency.pending}</td>
                      <td className="px-4 py-3 text-right text-green-400">{agency.sent}</td>
                      <td className="px-4 py-3 text-right text-red-400">{agency.failed}</td>
                      <td className="px-4 py-3 text-right text-white font-medium">{agency.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Email Detail Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Email Details</h3>
              <button
                onClick={() => setSelectedEmail(null)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                <div>
                  <p className="text-gray-500 text-xs">To</p>
                  <p className="text-white">{selectedEmail.to_email}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Subject</p>
                  <p className="text-white">{selectedEmail.subject}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Status</p>
                  <span className={`text-xs px-2 py-1 rounded ${
                    selectedEmail.status === 'sent' ? 'bg-green-900/50 text-green-400' :
                    selectedEmail.status === 'failed' ? 'bg-red-900/50 text-red-400' :
                    'bg-yellow-900/50 text-yellow-400'
                  }`}>
                    {selectedEmail.status}
                  </span>
                </div>
                {selectedEmail.error_message && (
                  <div>
                    <p className="text-gray-500 text-xs">Error</p>
                    <p className="text-red-400 text-sm">{selectedEmail.error_message}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500 text-xs mb-2">HTML Body</p>
                  <div
                    className="bg-white rounded p-4 text-black text-sm max-h-60 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.html_body }}
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-2">
              {selectedEmail.status === 'failed' && (
                <button
                  onClick={() => {
                    handleRetry(selectedEmail.id);
                    setSelectedEmail(null);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
                >
                  Retry
                </button>
              )}
              <button
                onClick={() => setSelectedEmail(null)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
