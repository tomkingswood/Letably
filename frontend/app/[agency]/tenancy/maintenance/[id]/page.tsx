'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { maintenance as maintenanceApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAgency } from '@/lib/agency-context';
import {
  MaintenanceComment,
  getCategoryInfo,
  getPriorityInfo,
  getStatusInfo,
  formatMaintenanceDate,
  formatMaintenanceDateShort,
  getAttachmentUrl,
} from '@/lib/maintenance-utils';
import MessageThread, { ThreadMessage } from '@/components/shared/MessageThread';
import { getErrorMessage } from '@/lib/types';
import { MessageAlert } from '@/components/ui/MessageAlert';

interface MaintenanceRequest {
  id: number;
  tenancy_id: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  property_address: string;
  comments: MaintenanceComment[];
}

// Transform maintenance comments to ThreadMessage format
function transformCommentsToMessages(comments: MaintenanceComment[]): ThreadMessage[] {
  return comments.map(comment => {
    let content = comment.content;

    // Convert status changes to readable text
    if (comment.comment_type === 'status_change') {
      const oldStatus = getStatusInfo(comment.old_value || '').label;
      const newStatus = getStatusInfo(comment.new_value || '').label;
      content = `Changed status from "${oldStatus}" to "${newStatus}"`;
    } else if (comment.comment_type === 'priority_change') {
      const oldPriority = getPriorityInfo(comment.old_value || '').label;
      const newPriority = getPriorityInfo(comment.new_value || '').label;
      content = `Changed priority from "${oldPriority}" to "${newPriority}"`;
    }

    return {
      id: comment.id,
      content,
      created_at: comment.created_at,
      user_name: comment.user_name,
      user_role: comment.user_role,
      attachments: comment.attachments?.map(att => ({
        id: att.id,
        file_path: att.file_path,
        original_filename: att.original_filename,
        file_type: att.file_type,
        file_size: att.file_size,
      })),
    };
  });
}

export default function TenantMaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { agencySlug } = useAgency();
  const [request, setRequest] = useState<MaintenanceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');


  const fetchRequest = useCallback(async () => {
    try {
      setLoading(true);
      const response = await maintenanceApi.getRequestById(id);
      const { request: reqData, comments } = response.data;

      // Map API response to expected interface
      const mappedRequest: MaintenanceRequest = {
        ...reqData,
        property_address: `${reqData.address_line1}, ${reqData.city}`,
        comments: comments || [],
      };

      setRequest(mappedRequest);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load maintenance request'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  const handleAddComment = async (content: string, files?: File[]): Promise<number | null> => {
    if (!request) return null;
    try {
      setError('');
      const response = await maintenanceApi.addComment(request.id, content, files);
      setSuccess('Message sent successfully');
      await fetchRequest();
      return response.data.commentId || null;
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send message'));
      return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-gray-600 mt-4">Loading maintenance request...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-gray-400 text-5xl mb-4">🔧</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Request not found</h3>
          <Link href={`/${agencySlug}/tenancy`} className="text-primary hover:underline">
            Back to My Tenancy
          </Link>
        </div>
      </div>
    );
  }

  const categoryInfo = getCategoryInfo(request.category);
  const priorityInfo = getPriorityInfo(request.priority);
  const statusInfo = getStatusInfo(request.status);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white py-6">
        <div className="max-w-4xl mx-auto px-4">
          <Link href={`/${agencySlug}/tenancy`} className="text-white/80 hover:text-white text-sm mb-2 inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to My Tenancy
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-3xl">{categoryInfo.icon}</span>
            <div>
              <h1 className="text-2xl font-bold">{request.title}</h1>
              <p className="text-white/80">{request.property_address}</p>
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
        <div className="space-y-6">
          {/* Status Badges */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex flex-wrap gap-3">
              <div>
                <span className="text-xs text-gray-500 block mb-1">Status</span>
                <span className={`px-3 py-1 text-sm font-medium rounded-full border ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block mb-1">Priority</span>
                <span className={`px-3 py-1 text-sm font-medium rounded-full border ${priorityInfo.color}`}>
                  {priorityInfo.label}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block mb-1">Category</span>
                <span className="px-3 py-1 text-sm font-medium rounded-full border bg-gray-100 text-gray-800 border-gray-200">
                  {categoryInfo.icon} {categoryInfo.label}
                </span>
              </div>
              <div className="ml-auto text-right">
                <span className="text-xs text-gray-500 block mb-1">Submitted</span>
                <span className="text-sm text-gray-700">{formatMaintenanceDate(request.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{request.description}</p>
          </div>

          {/* Message Thread */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Messages</h2>

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
              messages={transformCommentsToMessages(request.comments)}
              onSendMessage={handleAddComment}
              emptyMessage="No messages yet. Add a message or attach files to provide updates."
              getAttachmentUrl={getAttachmentUrl}
              formatDate={formatMaintenanceDateShort}
              noWrapper={true}
              showPermanenceWarning={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
