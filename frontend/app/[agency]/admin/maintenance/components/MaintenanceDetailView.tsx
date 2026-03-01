'use client';

import { useState, useEffect, useCallback } from 'react';
import { maintenance as maintenanceApi } from '@/lib/api';
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
import { getErrorMessage } from '@/lib/types';
import { MessageAlert } from '@/components/ui/MessageAlert';
import MessageThread, { ThreadMessage } from '@/components/shared/MessageThread';

interface MaintenanceRequest extends MaintenanceRequestDetail {
  property_id: number;
  has_landlord?: boolean;
}

interface ExtendedThreadMessage extends ThreadMessage {
  is_private?: boolean;
}

function transformCommentsToMessages(comments: MaintenanceComment[]): ExtendedThreadMessage[] {
  return comments.map(comment => {
    let content = comment.content;

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
      is_private: !!comment.is_private,
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

interface MaintenanceDetailViewProps {
  id: string;
  onBack: () => void;
  onNavigate?: (section: string, params?: Record<string, string>) => void;
}

export default function MaintenanceDetailView({ id, onBack, onNavigate }: MaintenanceDetailViewProps) {
  const [request, setRequest] = useState<MaintenanceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newStatus, setNewStatus] = useState('');
  const [newPriority, setNewPriority] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchRequest = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await maintenanceApi.getRequestByIdAdmin(id);
      const { request: reqData, comments, has_landlord } = response.data;

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

  const handleUpdateStatus = async () => {
    if (!request) return;
    if (newStatus === request.status && newPriority === request.priority) return;

    try {
      setUpdatingStatus(true);
      setError('');
      await maintenanceApi.updateRequest(request.id, {
        status: newStatus !== request.status ? newStatus : undefined,
        priority: newPriority !== request.priority ? newPriority : undefined,
      });
      setSuccess('Request updated successfully');
      await fetchRequest();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update request'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const submitComment = async (content: string, files: File[] | undefined, isPrivate: boolean): Promise<number | null> => {
    if (!request) return null;
    try {
      setError('');
      const response = await maintenanceApi.addCommentAdmin(request.id, content, files, isPrivate);
      setSuccess(isPrivate ? 'Internal message sent successfully' : 'Message sent successfully');
      await fetchRequest();
      return response.data.commentId || null;
    } catch (err: unknown) {
      setError(getErrorMessage(err, isPrivate ? 'Failed to send internal message' : 'Failed to send message'));
      return null;
    }
  };

  const handleAddComment = (content: string, files?: File[]) => submitComment(content, files, false);
  const handleAddPrivateComment = (content: string, files?: File[]) => submitComment(content, files, true);

  const handleDeleteAttachment = async (attachmentId: number): Promise<boolean> => {
    try {
      setError('');
      await maintenanceApi.deleteAttachment(attachmentId);
      setSuccess('Attachment deleted successfully');
      await fetchRequest();
      return true;
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete attachment'));
      return false;
    }
  };

  const handleDeleteComment = async (commentId: number): Promise<boolean> => {
    try {
      setError('');
      await maintenanceApi.deleteComment(commentId);
      setSuccess('Message deleted successfully');
      await fetchRequest();
      return true;
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete message'));
      return false;
    }
  };

  const handleDeleteRequest = async () => {
    if (!request) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete this maintenance request?\n\n"${request.title}"\n\nThis will also delete all attachments and messages. This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setError('');
      await maintenanceApi.deleteRequest(request.id);
      onBack();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete request'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-gray-600 mt-4">Loading maintenance request...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          {error ? (
            <>
              <h3 className="text-lg font-medium text-red-600 mb-2">Failed to load request</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => fetchRequest()} className="text-primary hover:underline">
                  Retry
                </button>
                <button onClick={onBack} className="text-gray-600 hover:underline">
                  Back to Maintenance
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Request not found</h3>
              <button onClick={onBack} className="text-primary hover:underline">
                Back to Maintenance
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const categoryInfo = getCategoryInfo(request.category);
  const priorityInfo = getPriorityInfo(request.priority);
  const statusInfo = getStatusInfo(request.status);

  const allMessages = transformCommentsToMessages(request.comments);
  const publicMessages = allMessages.filter(m => !m.is_private);
  const privateMessages = allMessages.filter(m => m.is_private);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <span className="text-4xl">{categoryInfo.icon}</span>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{request.title}</h2>
            <p className="text-gray-600">
              {request.property_id && onNavigate ? (
                <button
                  onClick={() => onNavigate('properties', { action: 'edit', id: request.property_id.toString() })}
                  className="hover:underline text-primary"
                >
                  {request.property_address}
                </button>
              ) : (
                request.property_address
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to List
          </button>
          {request.tenancy_id && onNavigate && (
            <button
              onClick={() => onNavigate('tenancies', { action: 'view', id: request.tenancy_id.toString() })}
              className="px-4 py-2 text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
            >
              View Tenancy
            </button>
          )}
          <button
            onClick={handleDeleteRequest}
            className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete Request
          </button>
        </div>
      </div>

      {/* Messages */}
      <MessageAlert type="success" message={success} className="mb-4" onDismiss={() => setSuccess('')} />
      <MessageAlert type="error" message={error} className="mb-4" onDismiss={() => setError('')} />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details & Thread */}
        <div className="lg:col-span-2 space-y-6">
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

          {/* Message Thread - Public */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Messages</h2>
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-4">
              <p className="text-sm">
                Messages here are visible to all tenants on this tenancy, the landlord, and the admin team.
              </p>
            </div>
            <MessageThread
              messages={publicMessages}
              onSendMessage={handleAddComment}
              onDeleteMessage={handleDeleteComment}
              onDeleteAttachment={handleDeleteAttachment}
              canDeleteMessages={true}
              canDeleteAttachments={true}
              emptyMessage="No messages yet"
              submitButtonText="Send Message"
              getAttachmentUrl={getAttachmentUrl}
              formatDate={formatMaintenanceDateShort}
              noWrapper={true}
            />
          </div>

          {/* Message Thread - Internal (Landlord only) */}
          {request.has_landlord && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-violet-600">Internal Chat</span>
              </h2>
              <div className="bg-violet-50 border border-violet-200 text-violet-800 px-4 py-3 rounded-lg mb-4">
                <p className="text-sm">
                  Messages here are private between you and the landlord. Tenants cannot see this section.
                </p>
              </div>
              <MessageThread
                messages={privateMessages}
                onSendMessage={handleAddPrivateComment}
                onDeleteMessage={handleDeleteComment}
                onDeleteAttachment={handleDeleteAttachment}
                canDeleteMessages={true}
                canDeleteAttachments={true}
                emptyMessage="No internal messages yet"
                submitButtonText="Send Internal Message"
                getAttachmentUrl={getAttachmentUrl}
                formatDate={formatMaintenanceDateShort}
                noWrapper={true}
              />
            </div>
          )}
        </div>

        {/* Right Column - Status & Actions */}
        <div className="space-y-6">
          {/* Status & Priority */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status & Priority</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="maintenance-status" className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  id="maintenance-status"
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
                <label htmlFor="maintenance-priority" className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  id="maintenance-priority"
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
                  onClick={handleUpdateStatus}
                  disabled={updatingStatus}
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {updatingStatus ? 'Updating...' : 'Update Status'}
                </button>
              )}
            </div>
          </div>

          {/* Details */}
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
        </div>
      </div>
    </div>
  );
}
