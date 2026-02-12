'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { tenancyCommunication } from '@/lib/api';
import { useRequireTenant } from '@/hooks/useAuth';
import {
  CommunicationMessage,
  CommunicationThread as ThreadType,
  formatMessageDateShort,
  mapApiMessage,
  getAttachmentUrl,
} from '@/lib/communication-utils';
import MessageThread, { ThreadMessage } from '@/components/shared/MessageThread';
import { getErrorMessage } from '@/lib/types';
import { MessageAlert } from '@/components/ui/MessageAlert';

// Transform communication messages to ThreadMessage format
function transformMessagesToThread(messages: CommunicationMessage[]): ThreadMessage[] {
  return messages.map(message => ({
    id: message.id,
    content: message.content,
    created_at: message.created_at,
    user_name: message.user_name,
    user_role: message.user_role,
    attachments: message.attachments?.map(att => ({
      id: att.id,
      file_path: att.file_path,
      original_filename: att.original_filename,
      file_type: att.file_type,
      file_size: att.file_size,
    })),
  }));
}

export default function TenantCommunicationPage() {
  const { isLoading: authLoading, isAuthenticated } = useRequireTenant();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [thread, setThread] = useState<ThreadType | null>(null);
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 50;


  const fetchThread = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (!append) setLoading(true);
      const response = await tenancyCommunication.getMyThread({ page: pageNum, limit });
      const data = response.data;

      // Map messages
      const mappedMessages = (data.messages || []).map(mapApiMessage);

      if (append) {
        // Prepend older messages (since we load earlier messages)
        setMessages(prev => [...mappedMessages, ...prev]);
      } else {
        setMessages(mappedMessages);
      }

      setThread(data);
      setHasMore(data.pagination?.hasMore || false);
      setPage(pageNum);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr.response?.status === 404) {
        setError('You do not have an active tenancy to communicate about.');
      } else {
        setError(getErrorMessage(err, 'Failed to load messages'));
      }
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  const handleSendMessage = async (content: string, files?: File[]): Promise<number | null> => {
    try {
      setError('');
      const response = await tenancyCommunication.sendMessage(content, files);
      setSuccess('Message sent successfully');
      // Refresh to get the new message
      await fetchThread();
      return response.data.messageId || null;
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send message'));
      return null;
    }
  };

  const handleLoadMore = async () => {
    await fetchThread(page + 1, true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-gray-600 mt-4">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (error && !thread) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-gray-400 text-5xl mb-4">💬</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{error}</h3>
          <Link href="/tenancy" className="text-primary hover:underline">
            Back to My Tenancy
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
          <Link href="/tenancy" className="text-white/80 hover:text-white text-sm mb-2 inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to My Tenancy
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
        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Chat with your landlord and letting agent about your tenancy</p>
              <p className="mb-2">Use this space to communicate with your landlord and your letting agent about anything related to your tenancy.</p>
              <p className="mb-2"><strong>Please note:</strong> All messages here are visible to all tenants on this tenancy, your landlord, and the letting agent.</p>
              <p>If you need to discuss a private matter, please contact us directly.</p>
            </div>
          </div>
        </div>

        {/* Communication Thread */}
        <MessageThread
          messages={transformMessagesToThread(messages)}
          onSendMessage={handleSendMessage}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          loading={loading}
          emptyMessage="No messages yet. Start a conversation about your tenancy!"
          showPermanenceWarning={true}
          getAttachmentUrl={getAttachmentUrl}
          formatDate={formatMessageDateShort}
        />
      </div>
    </div>
  );
}
