'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { tenancyCommunication } from '@/lib/api';
import { SectionProps } from './index';
import {
  CommunicationMessage,
  CommunicationThread as ThreadType,
  mapApiMessage,
  formatMessageDateShort,
  getAttachmentUrl,
} from '@/lib/communication-utils';
import { getErrorMessage } from '@/lib/types';
import { MessageAlert } from '@/components/ui/MessageAlert';
import MessageThread, { ThreadMessage } from '@/components/shared/MessageThread';

interface TenancyThread {
  id: number;
  status: string;
  start_date: string;
  end_date: string;
  property_address: string;
  location: string;
  message_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
}

interface ExtendedThreadMessage extends ThreadMessage {
  is_private?: number;
}

function transformMessagesToThread(messages: CommunicationMessage[]): ExtendedThreadMessage[] {
  return messages.map(message => ({
    id: message.id,
    content: message.content,
    created_at: message.created_at,
    user_name: message.user_name,
    user_role: message.user_role,
    is_private: message.is_private,
    attachments: message.attachments?.map(att => ({
      id: att.id,
      file_path: att.file_path,
      original_filename: att.original_filename,
      file_type: att.file_type,
      file_size: att.file_size,
    })),
  }));
}

// ============================================
// Thread Detail View (inline)
// ============================================
function CommunicationThreadView({ tenancyId, onBack }: { tenancyId: string; onBack: () => void }) {
  const id = parseInt(tenancyId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [thread, setThread] = useState<ThreadType | null>(null);
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [hasLandlord, setHasLandlord] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 50;

  const fetchThread = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (!append) setLoading(true);
      const response = await tenancyCommunication.getAdminThread(id, { page: pageNum, limit });
      const data = response.data;
      const mappedMessages = (data.messages || []).map(mapApiMessage);

      if (append) {
        setMessages(prev => [...mappedMessages, ...prev]);
      } else {
        setMessages(mappedMessages);
      }

      setThread(data);
      setHasMore(data.pagination?.hasMore || false);
      setHasLandlord(data.has_landlord || false);
      setPage(pageNum);
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        setError('Tenancy not found.');
      } else {
        setError(getErrorMessage(err, 'Failed to load messages'));
      }
    } finally {
      setLoading(false);
    }
  }, [id, limit]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  const handleSendMessage = async (content: string, files?: File[]): Promise<number | null> => {
    try {
      setError('');
      const response = await tenancyCommunication.sendMessageAdmin(id, content, files, false);
      setSuccess('Message sent successfully');
      await fetchThread();
      return response.data.messageId || null;
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send message'));
      return null;
    }
  };

  const handleSendPrivateMessage = async (content: string, files?: File[]): Promise<number | null> => {
    try {
      setError('');
      const response = await tenancyCommunication.sendMessageAdmin(id, content, files, true);
      setSuccess('Internal message sent successfully');
      await fetchThread();
      return response.data.messageId || null;
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send internal message'));
      return null;
    }
  };

  const handleDeleteMessage = async (messageId: number): Promise<boolean> => {
    try {
      setError('');
      await tenancyCommunication.deleteMessage(messageId);
      setSuccess('Message deleted successfully');
      await fetchThread();
      return true;
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete message'));
      return false;
    }
  };

  const handleDeleteAttachment = async (attachmentId: number): Promise<boolean> => {
    try {
      setError('');
      await tenancyCommunication.deleteAttachment(attachmentId);
      setSuccess('Attachment deleted successfully');
      await fetchThread();
      return true;
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete attachment'));
      return false;
    }
  };

  const handleLoadMore = async () => {
    await fetchThread(page + 1, true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error && !thread) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-5xl mb-4">💬</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{error}</h3>
        <button onClick={onBack} className="text-primary hover:underline">
          Back to Communications
        </button>
      </div>
    );
  }

  const allMessages = transformMessagesToThread(messages);
  const publicMessages = allMessages.filter(m => !m.is_private || m.is_private === 0);
  const privateMessages = allMessages.filter(m => m.is_private === 1);

  return (
    <div>
      {/* Back button + header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="text-primary hover:underline text-sm mb-2 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Communications
        </button>
        <h2 className="text-2xl font-bold text-gray-900">Tenancy Communication</h2>
        {thread?.tenancy && (
          <p className="text-gray-600">{thread.tenancy.property_address}</p>
        )}
      </div>

      <MessageAlert type="success" message={success} className="mb-4" onDismiss={() => setSuccess('')} />
      <MessageAlert type="error" message={error} className="mb-4" onDismiss={() => setError('')} />

      {/* Admin Info Card */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-1">Admin View</p>
            <p>As an admin, you can see all messages and have the ability to delete messages and attachments. Your messages will be tagged as &quot;Admin&quot;.</p>
          </div>
        </div>
      </div>

      {/* Public Messages */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Messages</h3>
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-4">
          <p className="text-sm">
            Messages here are visible to all tenants on this tenancy, the landlord, and the admin team.
          </p>
        </div>
        <MessageThread
          messages={publicMessages}
          onSendMessage={handleSendMessage}
          onDeleteMessage={handleDeleteMessage}
          onDeleteAttachment={handleDeleteAttachment}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          loading={loading}
          canDeleteMessages={true}
          canDeleteAttachments={true}
          emptyMessage="No messages yet. Start a conversation with the tenants and landlord!"
          getAttachmentUrl={getAttachmentUrl}
          formatDate={formatMessageDateShort}
          noWrapper={true}
        />
      </div>

      {/* Internal Chat - Only show if property has a landlord */}
      {hasLandlord && (
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-violet-600">Internal Chat</span>
          </h3>
          <div className="bg-violet-50 border border-violet-200 text-violet-800 px-4 py-3 rounded-lg mb-4">
            <p className="text-sm">
              Messages here are private between you and the landlord. Tenants cannot see this section.
            </p>
          </div>
          <MessageThread
            messages={privateMessages}
            onSendMessage={handleSendPrivateMessage}
            onDeleteMessage={handleDeleteMessage}
            onDeleteAttachment={handleDeleteAttachment}
            canDeleteMessages={true}
            canDeleteAttachments={true}
            emptyMessage="No internal messages yet"
            submitButtonText="Send Internal Message"
            getAttachmentUrl={getAttachmentUrl}
            formatDate={formatMessageDateShort}
            noWrapper={true}
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Communications Section (list view)
// ============================================
export default function CommunicationsSection({ onNavigate, action, itemId }: SectionProps) {
  const [tenancies, setTenancies] = useState<TenancyThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMessages, setFilterMessages] = useState<'all' | 'has_messages'>('has_messages');
  const [showExpired, setShowExpired] = useState(false);
  const prevViewMode = useRef(false);

  const isViewMode = action === 'view' && !!itemId;

  // Refresh list when returning from view mode
  useEffect(() => {
    if (prevViewMode.current && !isViewMode) {
      fetchTenancies();
    }
    prevViewMode.current = isViewMode;
  }, [isViewMode]);

  useEffect(() => {
    if (!isViewMode) {
      fetchTenancies();
    }
  }, [filterMessages]);

  const fetchTenancies = async () => {
    try {
      setLoading(true);
      const params = filterMessages === 'has_messages' ? { has_messages: 'true' } : {};
      const response = await tenancyCommunication.getAllTenancies(params);
      setTenancies(response.data.tenancies || []);
    } catch (error) {
      console.error('Error fetching communications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Render inline thread view
  if (isViewMode) {
    return (
      <CommunicationThreadView
        tenancyId={itemId}
        onBack={() => onNavigate?.('communications')}
      />
    );
  }

  const filteredTenancies = tenancies
    .filter(t => t.status !== 'pending')
    .filter(t => showExpired || t.status !== 'expired');
  const totalMessages = filteredTenancies.reduce((sum, t) => sum + (Number(t.message_count) || 0), 0);
  const tenanciesWithMessages = filteredTenancies.filter(t => Number(t.message_count) > 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleViewThread = (tenancyId: number) => {
    onNavigate?.('communications', { action: 'view', id: tenancyId.toString() });
  };

  return (
    <div>
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Tenancy Communications</h2>
        <p className="text-gray-600">View and respond to tenant and landlord messages</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Total Tenancies</p>
          <p className="text-2xl font-bold text-gray-900">{tenancies.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">With Messages</p>
          <p className="text-2xl font-bold text-blue-600">{tenanciesWithMessages}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-gray-600 text-sm">Total Messages</p>
          <p className="text-2xl font-bold text-green-600">{totalMessages}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all' as const, label: 'All Tenancies' },
              { id: 'has_messages' as const, label: 'With Messages' },
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setFilterMessages(filter.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterMessages === filter.id
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showExpired}
              onChange={(e) => setShowExpired(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            Show expired tenancies
          </label>
        </div>
      </div>

      {/* Tenancy Threads List */}
      <div className="bg-white rounded-lg shadow-md">
        {filteredTenancies.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">No tenancies found</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredTenancies.map(tenancy => (
              <div
                key={tenancy.id}
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleViewThread(tenancy.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900 truncate">{tenancy.property_address}</h4>
                      {Number(tenancy.message_count) > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {tenancy.message_count} message{Number(tenancy.message_count) !== 1 ? 's' : ''}
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        tenancy.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {tenancy.status}
                      </span>
                    </div>
                    {tenancy.last_message_preview && (
                      <p className="text-sm text-gray-600 line-clamp-1 mb-1">{tenancy.last_message_preview}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {tenancy.location && <span>{tenancy.location}</span>}
                      {tenancy.last_message_at && (
                        <span>Last message: {new Date(tenancy.last_message_at).toLocaleDateString('en-GB')}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewThread(tenancy.id);
                    }}
                    className="px-3 py-1.5 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-sm font-medium whitespace-nowrap"
                  >
                    View Thread
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
