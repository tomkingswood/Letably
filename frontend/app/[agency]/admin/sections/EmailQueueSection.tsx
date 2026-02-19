'use client';

import { useState, useEffect } from 'react';
import { emailQueue } from '@/lib/api';
import { useAgency } from '@/lib/agency-context';
import { SectionProps } from './index';
import { MessageAlert } from '@/components/ui/MessageAlert';

interface QueuedEmail {
  id: number;
  to_email: string;
  to_name: string | null;
  subject: string;
  html_body: string;
  text_body: string | null;
  status: 'pending' | 'sent' | 'failed';
  priority: number;
  retry_count: number;
  max_retries: number;
  error_message?: string;
  scheduled_at?: string;
  sent_at?: string;
  failed_at?: string;
  created_at: string;
}

export default function EmailQueueSection({ onNavigate, action, itemId, onBack }: SectionProps) {
  const { agencySlug } = useAgency();
  const [emails, setEmails] = useState<QueuedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [previewEmail, setPreviewEmail] = useState<QueuedEmail | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteAllConfirmStep, setDeleteAllConfirmStep] = useState(0); // 0=initial, 1=pending warning shown
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      const response = await emailQueue.getAll();
      setEmails(response.data.emails || []);
    } catch (error) {
      console.error('Error fetching email queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (id: number) => {
    try {
      await emailQueue.retry(id);
      setMessage({ type: 'success', text: 'Email queued for retry' });
      fetchEmails();
    } catch (error) {
      console.error('Error retrying email:', error);
      setMessage({ type: 'error', text: 'Failed to retry email' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this email?')) return;

    try {
      await emailQueue.deleteEmail(id);
      setMessage({ type: 'success', text: 'Email deleted successfully' });
      fetchEmails();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to delete email',
      });
    }
  };

  const handleDeleteAll = async () => {
    // If there are pending emails and user hasn't seen the second warning yet
    if (stats.pending > 0 && deleteAllConfirmStep === 0) {
      setDeleteAllConfirmStep(1);
      return;
    }

    setDeletingAll(true);
    try {
      await emailQueue.deleteAll();
      setMessage({ type: 'success', text: 'All emails deleted successfully' });
      setShowDeleteAllModal(false);
      setDeleteAllConfirmStep(0);
      fetchEmails();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to delete emails',
      });
    } finally {
      setDeletingAll(false);
    }
  };

  const filteredEmails = emails.filter(e => {
    return filterStatus === 'all' || e.status === filterStatus;
  });

  const stats = {
    total: emails.length,
    pending: emails.filter(e => e.status === 'pending').length,
    sent: emails.filter(e => e.status === 'sent').length,
    failed: emails.filter(e => e.status === 'failed').length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'sent': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
      {/* Section Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Email Queue</h2>
          <p className="text-gray-600">Monitor and manage the email sending queue</p>
        </div>
        {emails.length > 0 && (
          <button
            onClick={() => { setShowDeleteAllModal(true); setDeleteAllConfirmStep(0); }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete All
          </button>
        )}
      </div>

      {/* Messages */}
      {message && (
        <MessageAlert type={message.type} message={message.text} className="mb-6" />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Sent</p>
          <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Failed</p>
          <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending' },
            { id: 'sent', label: 'Sent' },
            { id: 'failed', label: 'Failed' },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setFilterStatus(filter.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === filter.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Email Queue List */}
      <div className="space-y-4">
        {filteredEmails.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-gray-600">No emails in queue</p>
          </div>
        ) : (
          filteredEmails.map(email => (
            <div
              key={email.id}
              className="bg-white rounded-lg shadow-md p-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${getStatusColor(email.status)}`}>
                      {email.status}
                    </span>
                    <span className="text-sm text-gray-500">
                      Priority: {email.priority}
                    </span>
                    {email.retry_count > 0 && (
                      <span className="text-sm text-orange-600">
                        Retries: {email.retry_count}/{email.max_retries}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {email.subject}
                  </h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>
                      <strong>To:</strong> {email.to_name ? `${email.to_name} <${email.to_email}>` : email.to_email}
                    </div>
                    <div>
                      <strong>Created:</strong> {new Date(email.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    {email.sent_at && (
                      <div>
                        <strong>Sent:</strong> {new Date(email.sent_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    )}
                    {email.failed_at && (
                      <div className="text-red-600">
                        <strong>Failed:</strong> {new Date(email.failed_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    )}
                    {email.error_message && (
                      <div className="text-red-600">
                        <strong>Error:</strong> {email.error_message}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => setPreviewEmail(email)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Preview
                  </button>
                  {email.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(email.id)}
                      className="px-3 py-1.5 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors text-sm font-medium"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(email.id)}
                    className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete All Confirmation Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            {deleteAllConfirmStep === 0 ? (
              <>
                <h3 className="text-xl font-bold text-red-900 mb-2">Delete All Emails</h3>
                <p className="text-gray-600 mb-4">
                  This will permanently delete <strong>all {emails.length} email{emails.length !== 1 ? 's' : ''}</strong> from the queue.
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800">
                  <strong>This action cannot be undone.</strong>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={stats.pending > 0 ? handleDeleteAll : handleDeleteAll}
                    disabled={deletingAll}
                    className="flex-1 bg-red-700 hover:bg-red-800 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50 transition-colors"
                  >
                    {deletingAll ? 'Deleting...' : 'Delete All'}
                  </button>
                  <button
                    onClick={() => setShowDeleteAllModal(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-red-900 mb-2">Pending Emails Will Be Lost</h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm text-amber-900">
                  <p className="font-semibold mb-2">There {stats.pending === 1 ? 'is' : 'are'} {stats.pending} pending email{stats.pending !== 1 ? 's' : ''} that {stats.pending === 1 ? 'has' : 'have'} not been sent yet:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {emails.filter(e => e.status === 'pending').slice(0, 5).map(e => (
                      <li key={e.id} className="truncate">{e.subject} &rarr; {e.to_email}</li>
                    ))}
                    {stats.pending > 5 && <li>...and {stats.pending - 5} more</li>}
                  </ul>
                  <p className="mt-3 font-semibold text-red-700">These emails will never be sent if you delete them.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteAll}
                    disabled={deletingAll}
                    className="flex-1 bg-red-700 hover:bg-red-800 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50 transition-colors"
                  >
                    {deletingAll ? 'Deleting...' : 'Yes, Delete Everything'}
                  </button>
                  <button
                    onClick={() => setShowDeleteAllModal(false)}
                    disabled={deletingAll}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Preview</h2>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div><strong>Subject:</strong> {previewEmail.subject}</div>
                    <div><strong>To:</strong> {previewEmail.to_name ? `${previewEmail.to_name} <${previewEmail.to_email}>` : previewEmail.to_email}</div>
                    <div>
                      <strong>Status:</strong>{' '}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${getStatusColor(previewEmail.status)}`}>
                        {previewEmail.status}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewEmail(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  x
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <iframe
                  srcDoc={previewEmail.html_body}
                  className="w-full h-[600px] border-0"
                  title="Email Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setPreviewEmail(null)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
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
