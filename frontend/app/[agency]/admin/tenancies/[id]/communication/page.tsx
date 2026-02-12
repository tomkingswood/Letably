'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAgency } from '@/lib/agency-context';
import { useAuth, useRequireAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { tenancyCommunication } from '@/lib/api';
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

// Extended ThreadMessage with is_private flag
interface ExtendedThreadMessage extends ThreadMessage {
  is_private?: number;
}

// Transform communication messages to ThreadMessage format
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

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function AdminCommunicationPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { agencySlug } = useAgency();
  const { user } = useAuth();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth('');
  const pathname = usePathname();
  const tenancyId = parseInt(id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [thread, setThread] = useState<ThreadType | null>(null);
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [hasLandlord, setHasLandlord] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 50;

  const basePath = `/${agencySlug}`;

  // Check admin role
  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.role !== 'admin') {
      router.push(basePath);
    }
  }, [authLoading, isAuthenticated, user, router, basePath]);

  const fetchThread = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (!append) setLoading(true);
      const response = await tenancyCommunication.getAdminThread(tenancyId, { page: pageNum, limit });
      const data = response.data;

      // Map messages
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
      const axiosError = err as { response?: { status?: number; data?: { error?: string } } };
      if (axiosError.response?.status === 404) {
        setError('Tenancy not found.');
      } else {
        setError(getErrorMessage(err, 'Failed to load messages'));
      }
    } finally {
      setLoading(false);
    }
  }, [tenancyId, limit]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  const handleSendMessage = async (content: string, files?: File[]): Promise<number | null> => {
    try {
      setError('');
      const response = await tenancyCommunication.sendMessageAdmin(tenancyId, content, files, false);
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
      const response = await tenancyCommunication.sendMessageAdmin(tenancyId, content, files, true);
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

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-gray-600 mt-4">Loading messages...</p>
        </div>
      </div>
    );
  }

  // Not authorized
  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  if (error && !thread) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-gray-400 text-5xl mb-4">💬</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{error}</h3>
          <Link href={`/${agencySlug}/admin/tenancies/${id}`} className="text-primary hover:underline">
            Back to Tenancy
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white py-6">
        <div className="max-w-4xl mx-auto px-4">
          <Link href={`/${agencySlug}/admin/tenancies/${id}`} className="text-white/80 hover:text-white text-sm mb-2 inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Tenancy
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <div>
              <h1 className="text-2xl font-bold">Tenancy Communication</h1>
              {thread?.tenancy && (
                <p className="text-white/80">{thread.tenancy.property_address}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="max-w-4xl mx-auto px-4 mt-4">
        <MessageAlert type="success" message={success} className="mb-4" onDismiss={() => setSuccess('')} />
        <MessageAlert type="error" message={error} className="mb-4" onDismiss={() => setError('')} />
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Admin Info Card */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Admin View</p>
              <p>As an admin, you can see all messages and have the ability to delete messages and attachments. Your messages will be tagged as "Admin".</p>
            </div>
          </div>
        </div>

        {/* Communication Thread - Public Messages */}
        {(() => {
          const allMessages = transformMessagesToThread(messages);
          const publicMessages = allMessages.filter(m => !m.is_private || m.is_private === 0);
          const privateMessages = allMessages.filter(m => m.is_private === 1);

          return (
            <>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Messages</h2>

                {/* Public visibility info banner */}
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
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-violet-600">Internal Chat</span>
                  </h2>

                  {/* Info banner */}
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
            </>
          );
        })()}
      </div>
    </div>
  );
}
