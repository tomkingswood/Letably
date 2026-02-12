'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { landlordPanel } from '@/lib/api';
import { useRequireLandlord } from '@/hooks/useAuth';
import {
  MaintenanceComment,
  MaintenanceRequestDetail,
  MAINTENANCE_STATUSES,
  MAINTENANCE_PRIORITIES,
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

// Extended ThreadMessage with is_private flag
interface ExtendedThreadMessage extends ThreadMessage {
  is_private?: number;
}

// Transform maintenance comments to ThreadMessage format
function transformCommentsToMessages(comments: MaintenanceComment[]): ExtendedThreadMessage[] {
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
      is_private: comment.is_private,
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

interface MaintenanceRequest extends MaintenanceRequestDetail {
  property_location: string;
  has_landlord?: boolean;
}

export default function LandlordMaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading: authLoading, isAuthenticated } = useRequireLandlord();
  const [request, setRequest] = useState<MaintenanceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [newStatus, setNewStatus] = useState('');
  const [newPriority, setNewPriority] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchRequest = useCallback(async () => {
    try {
      setLoading(true);
      const response = await landlordPanel.getMaintenanceRequestById(id);
      const { request: reqData, comments, has_landlord } = response.data;

      // Map API response to expected interface
      const mappedRequest: MaintenanceRequest = {
        ...reqData,
        creator_name: `${reqData.created_by_first_name} ${reqData.created_by_last_name}`,
        creator_email: reqData.created_by_email,
        property_address: `${reqData.address_line1}, ${reqData.city}`,
        comments: comments || [],
        has_landlord: has_landlord,
      };

      setRequest(mappedRequest);
      setNewStatus(reqData.status);
      setNewPriority(reqData.priority);
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
      const response = await landlordPanel.addMaintenanceComment(request.id, content, files, false);
      setSuccess('Message sent successfully');
      await fetchRequest();
      return response.data.commentId || null;
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send message'));
      return null;
    }
  };

  const handleAddPrivateComment = async (content: string, files?: File[]): Promise<number | null> => {
    if (!request) return null;
    try {
      setError('');
      const response = await landlordPanel.addMaintenanceComment(request.id, content, files, true);
      setSuccess('Internal message sent successfully');
      await fetchRequest();
      return response.data.commentId || null;
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send internal message'));
      return null;
    }
  };

  const handleUpdate = async () => {
    if (!request) return;

    const statusChanged = newStatus !== request.status;
    const priorityChanged = newPriority !== request.priority;

    if (!statusChanged && !priorityChanged) return;

    try {
      setUpdating(true);
      setError('');

      const updateData: { status?: string; priority?: string } = {};
      if (statusChanged) updateData.status = newStatus;
      if (priorityChanged) updateData.priority = newPriority;

      await landlordPanel.updateMaintenanceRequest(request.id, updateData);
      setSuccess('Request updated successfully');
      await fetchRequest();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update request'));
    } finally {
      setUpdating(false);
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
          <Link href="/landlord/maintenance" className="text-primary hover:underline">
            Back to Maintenance
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
        <div className="container mx-auto px-4">
          <Link href="/landlord/maintenance" className="text-white/80 hover:text-white text-sm mb-2 inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Maintenance
          </Link>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-4xl">{categoryInfo.icon}</span>
            <div>
              <h1 className="text-2xl font-bold">{request.title}</h1>
              <p className="text-white/90">{request.property_address}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="container mx-auto px-4 mt-4">
        <MessageAlert type="success" message={success} className="mb-4" onDismiss={() => setSuccess('')} />
        <MessageAlert type="error" message={error} className="mb-4" onDismiss={() => setError('')} />
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Details & Thread */}
          <div className="lg:col-span-2 space-y-6">
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
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{request.description}</p>
              <div className="mt-4 pt-4 border-t text-sm text-gray-500">
                Reported by <span className="font-medium text-gray-700">{request.creator_name}</span> ({request.creator_email})
                <br />
                on {formatMaintenanceDate(request.created_at)}
              </div>
            </div>

            {/* Message Thread - Public Messages */}
            {(() => {
              const allMessages = transformCommentsToMessages(request.comments);
              const publicMessages = allMessages.filter(m => !m.is_private || m.is_private === 0);
              const privateMessages = allMessages.filter(m => m.is_private === 1);

              return (
                <>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Messages</h2>

                    {/* Public visibility info banner */}
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-4">
                      <p className="text-sm">
                        Messages here are visible to all tenants on this tenancy, you, and the letting agent.
                      </p>
                    </div>

                    <MessageThread
                      messages={publicMessages}
                      onSendMessage={handleAddComment}
                      emptyMessage="No messages yet. Add a message to communicate with the tenant or admin."
                      getAttachmentUrl={getAttachmentUrl}
                      formatDate={formatMaintenanceDateShort}
                      noWrapper={true}
                    />
                  </div>

                  {/* Internal Chat - Landlords always see this section */}
                  {request.has_landlord && (
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="text-violet-600">Internal Chat</span>
                      </h2>

                      {/* Info banner */}
                      <div className="bg-violet-50 border border-violet-200 text-violet-800 px-4 py-3 rounded-lg mb-4">
                        <p className="text-sm">
                          Messages here are private between you and the letting agent. Tenants cannot see this section.
                        </p>
                      </div>

                      <MessageThread
                        messages={privateMessages}
                        onSendMessage={handleAddPrivateComment}
                        emptyMessage="No internal messages yet"
                        submitButtonText="Send Internal Message"
                        getAttachmentUrl={getAttachmentUrl}
                        formatDate={formatMaintenanceDateShort}
                        noWrapper={true}
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Right Column - Info */}
          <div className="space-y-6">
            {/* Update Status & Priority */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Update Request</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  >
                    {MAINTENANCE_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  >
                    {MAINTENANCE_PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                {(newStatus !== request.status || newPriority !== request.priority) && (
                  <button
                    onClick={handleUpdate}
                    disabled={updating}
                    className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {updating ? 'Updating...' : 'Update Request'}
                  </button>
                )}
              </div>
            </div>

            {/* Quick Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-gray-500">Category</dt>
                  <dd className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <span>{categoryInfo.icon}</span>
                    {categoryInfo.label}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Current Status</dt>
                  <dd>
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full border ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Priority</dt>
                  <dd>
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full border ${priorityInfo.color}`}>
                      {priorityInfo.label}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Property</dt>
                  <dd className="text-sm font-medium text-gray-900">{request.property_address}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Created</dt>
                  <dd className="text-sm font-medium text-gray-900">{formatMaintenanceDate(request.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Last Updated</dt>
                  <dd className="text-sm font-medium text-gray-900">{formatMaintenanceDate(request.updated_at)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Request ID</dt>
                  <dd className="text-sm font-medium text-gray-900">#{request.id}</dd>
                </div>
              </dl>
            </div>

            {/* Note for Landlords */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">About Maintenance Requests</h3>
              <p className="text-sm text-blue-700">
                You can update the status, priority, and add messages with attachments to communicate with tenants and our team.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
