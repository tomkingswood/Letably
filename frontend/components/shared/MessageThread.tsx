'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  getRoleBorderColor,
  RoleBadge,
  CloseIcon,
  TrashIcon,
  AttachmentIcon,
  WarningIcon,
} from '@/lib/thread-utils';

// ============================================
// Shared Interfaces
// ============================================

export interface ThreadAttachment {
  id: number;
  file_path: string;
  original_filename: string;
  file_type: string;
  file_size: number;
}

export interface ThreadMessage {
  id: number;
  content: string | null;
  created_at: string;
  user_name: string;
  user_role: string;
  attachments?: ThreadAttachment[];
}

// ============================================
// File Utilities
// ============================================

export const isImageFile = (filename: string | null | undefined): boolean => {
  if (!filename) return false;
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;
  return imageExtensions.test(filename);
};

export const getFileIcon = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'PDF';
    case 'doc':
    case 'docx': return 'DOC';
    case 'xls':
    case 'xlsx': return 'XLS';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp': return 'IMG';
    default: return 'FILE';
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const isAllowedFileType = (file: File): boolean => {
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  return allowedTypes.includes(file.type);
};

// ============================================
// Component Props
// ============================================

interface MessageThreadProps {
  messages: ThreadMessage[];

  // Message actions - files always supported
  onSendMessage: (content: string, files?: File[]) => Promise<number | null>;
  onDeleteMessage?: (messageId: number) => Promise<boolean>;
  onDeleteAttachment?: (attachmentId: number) => Promise<boolean>;

  // Pagination (optional)
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean;

  // Permissions
  canDeleteMessages?: boolean;
  canDeleteAttachments?: boolean;

  // Display options
  maxFiles?: number;
  emptyMessage?: string;
  submitButtonText?: string;
  title?: string;
  useShortDates?: boolean;
  noWrapper?: boolean;
  showPermanenceWarning?: boolean;
  loading?: boolean;

  // Required utilities
  getAttachmentUrl: (filePath: string) => string;
  formatDate: (dateString: string) => string;
}

// ============================================
// Component
// ============================================

export default function MessageThread({
  messages,
  onSendMessage,
  onDeleteMessage,
  onDeleteAttachment,
  onLoadMore,
  hasMore = false,
  canDeleteMessages = false,
  canDeleteAttachments = false,
  maxFiles = 10,
  emptyMessage = 'No messages yet.',
  submitButtonText = 'Send Message',
  title = 'Messages',
  noWrapper = false,
  showPermanenceWarning = false,
  loading = false,
  getAttachmentUrl,
  formatDate,
}: MessageThreadProps) {
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages container when messages change (not when loading older messages)
  useEffect(() => {
    if (!loadingMore && messagesContainerRef.current) {
      // Scroll within the container, not the whole page
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, loadingMore]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && selectedFiles.length === 0) || submitting) return;

    try {
      setSubmitting(true);
      setUploadError(null);
      await onSendMessage(newMessage.trim(), selectedFiles.length > 0 ? selectedFiles : undefined);
      setNewMessage('');
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types
    const invalidFiles = files.filter(file => !isAllowedFileType(file));
    if (invalidFiles.length > 0) {
      setUploadError('Invalid file type. Allowed: Images (JPG, PNG, GIF, WEBP) and documents (PDF, Word, Excel)');
      return;
    }

    // Validate file sizes
    const oversizedFiles = files.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setUploadError('File too large. Maximum size is 10MB per file.');
      return;
    }

    // Check total file limit
    if (selectedFiles.length + files.length > maxFiles) {
      setUploadError(`Maximum ${maxFiles} files per message.`);
      return;
    }

    setUploadError(null);
    setSelectedFiles(prev => [...prev, ...files]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleLoadMore = async () => {
    if (!onLoadMore || loadingMore) return;
    setLoadingMore(true);
    await onLoadMore();
    setLoadingMore(false);
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!onDeleteMessage || !confirm('Are you sure you want to delete this message?')) return;
    await onDeleteMessage(messageId);
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!onDeleteAttachment || !confirm('Are you sure you want to delete this attachment?')) return;
    await onDeleteAttachment(attachmentId);
  };

  const renderAttachment = (attachment: ThreadAttachment) => {
    const url = getAttachmentUrl(attachment.file_path);
    const isImage = isImageFile(attachment.original_filename);

    return (
      <div key={attachment.id} className="mt-2 relative group/attachment">
        {isImage ? (
          <div className="relative inline-block">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Image
                src={url}
                alt={attachment.original_filename}
                width={200}
                height={150}
                className="rounded-lg border border-gray-200 hover:border-primary transition-colors object-cover"
              />
            </a>
            {canDeleteAttachments && onDeleteAttachment && (
              <button
                onClick={() => handleDeleteAttachment(attachment.id)}
                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover/attachment:opacity-100 transition-opacity"
                title="Delete attachment"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200 max-w-xs">
            <span className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded">
              {getFileIcon(attachment.original_filename)}
            </span>
            <div className="flex-1 min-w-0">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline truncate block"
              >
                {attachment.original_filename}
              </a>
              <span className="text-xs text-gray-500">{formatFileSize(attachment.file_size)}</span>
            </div>
            {canDeleteAttachments && onDeleteAttachment && (
              <button
                onClick={() => handleDeleteAttachment(attachment.id)}
                className="p-1 text-red-500 hover:bg-red-50 rounded opacity-0 group-hover/attachment:opacity-100 transition-opacity"
                title="Delete attachment"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const content = (
    <>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {title} ({messages.length})
      </h2>

      {/* Messages List - Scrollable container */}
      <div ref={messagesContainerRef} className="max-h-96 overflow-y-auto mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
        {/* Load More Button */}
        {hasMore && onLoadMore && (
          <div className="flex justify-center mb-4">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-4 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load earlier messages'}
            </button>
          </div>
        )}

        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : messages.length === 0 ? (
            <p className="text-gray-500 text-center py-4">{emptyMessage}</p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`border-l-4 pl-4 ${getRoleBorderColor(message.user_role)} bg-white rounded-r-lg p-3 group`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{message.user_name}</span>
                    <RoleBadge role={message.user_role} />
                    <span className="text-xs text-gray-500">{formatDate(message.created_at)}</span>
                  </div>
                  {canDeleteMessages && onDeleteMessage && (
                    <button
                      onClick={() => handleDeleteMessage(message.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete message"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
                {message.content && (
                  <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
                )}
                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {message.attachments.map(renderAttachment)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Send Message Form */}
      <form onSubmit={handleSubmit} className="border-t pt-4">
        {showPermanenceWarning && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <WarningIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Messages and attachments cannot be edited or deleted after sending. Please review your message before submitting.
            </p>
          </div>
        )}
        <label className="block text-sm font-medium text-gray-700 mb-2">Add a Message</label>
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary resize-none"
          placeholder="Write your message here..."
        />

        {/* File attachment section */}
        <div className="mt-2">
          {selectedFiles.length > 0 ? (
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                    {getFileIcon(file.name)}
                  </span>
                  <span className="text-sm text-gray-700 flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
              {selectedFiles.length < maxFiles && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <AttachmentIcon />
                  Add more files
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
            >
              <AttachmentIcon />
              Attach files
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
          />
        </div>

        {uploadError && (
          <p className="mt-2 text-sm text-red-600">{uploadError}</p>
        )}

        <div className="flex justify-end mt-3">
          <button
            type="submit"
            disabled={submitting || (!newMessage.trim() && selectedFiles.length === 0)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending...' : submitButtonText}
          </button>
        </div>
      </form>
    </>
  );

  if (noWrapper) {
    return content;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {content}
    </div>
  );
}
