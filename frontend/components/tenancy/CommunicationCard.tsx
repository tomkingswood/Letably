'use client';

import MessageThread, { ThreadMessage } from '@/components/shared/MessageThread';
import { CommunicationMessage, formatMessageDateShort, getAttachmentUrl } from '@/lib/communication-utils';

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

interface CommunicationCardProps {
  communicationMessages: CommunicationMessage[];
  loadingCommunication: boolean;
  communicationHasMore: boolean;
  onSendMessage: (content: string, files?: File[]) => Promise<number | null>;
  onLoadMore: () => Promise<void>;
}

export function CommunicationCard({
  communicationMessages,
  loadingCommunication,
  communicationHasMore,
  onSendMessage,
  onLoadMore,
}: CommunicationCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900">Communication</h2>
        </div>
        <p className="text-sm text-gray-500 mt-2">Chat with your landlord and letting agent about your tenancy</p>
      </div>
      <div className="p-6">
        {/* Visibility info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="mb-1"><strong>Please note:</strong> All messages here are visible to all tenants on this tenancy, your landlord, and the letting agent.</p>
              <p>If you need to discuss a private matter, please contact us directly.</p>
            </div>
          </div>
        </div>

        <MessageThread
          messages={transformMessagesToThread(communicationMessages)}
          onSendMessage={onSendMessage}
          onLoadMore={onLoadMore}
          hasMore={communicationHasMore}
          loading={loadingCommunication}
          emptyMessage="No messages yet."
          noWrapper={true}
          showPermanenceWarning={true}
          getAttachmentUrl={getAttachmentUrl}
          formatDate={formatMessageDateShort}
        />
      </div>
    </div>
  );
}
