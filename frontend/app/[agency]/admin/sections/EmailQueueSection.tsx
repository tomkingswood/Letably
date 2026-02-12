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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Email Queue</h2>
        <p className="text-gray-600">Monitor and manage the email sending queue</p>
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
