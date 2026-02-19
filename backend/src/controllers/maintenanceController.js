const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { queueEmail } = require('../services/emailService');
const { createEmailTemplate, createButton, createInfoBox, escapeHtml } = require('../utils/emailTemplates');
const { getAgencyBranding } = require('../services/brandingService');
const handleError = require('../utils/handleError');
const asyncHandler = require('../utils/asyncHandler');
const maintenanceRepo = require('../repositories/maintenanceRepository');

// Category display names
const CATEGORY_LABELS = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  heating: 'Heating',
  appliances: 'Appliances',
  structural: 'Structural',
  pest_control: 'Pest Control',
  general: 'General',
  other: 'Other'
};

// Priority display names and colors
const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High'
};

// Status display names
const STATUS_LABELS = {
  submitted: 'Submitted',
  in_progress: 'In Progress',
  completed: 'Completed'
};

/**
 * Get file type category from mime type
 */
function getFileType(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'document';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'document';
  return 'other';
}

/**
 * Get comments with attachments for a request
 * @param {number} requestId - The maintenance request ID
 * @param {boolean} includePrivate - Whether to include private comments (default: false for security)
 * @param {string} agencyId - The agency ID for multi-tenancy
 */
async function getCommentsWithAttachments(requestId, includePrivate = false, agencyId) {
  const comments = await maintenanceRepo.getCommentsForRequest(requestId, includePrivate, agencyId);

  // Attach attachments to each comment
  const commentsWithAttachments = [];
  for (const comment of comments) {
    const attachments = await maintenanceRepo.getCommentAttachments(comment.id, agencyId);
    commentsWithAttachments.push({
      ...comment,
      user_name: `${comment.first_name} ${comment.last_name}`,
      user_role: comment.role === 'admin' ? 'admin' : (comment.role === 'landlord' ? 'landlord' : 'tenant'),
      attachments
    });
  }
  return commentsWithAttachments;
}

/**
 * Count attachments for a request
 */
async function countRequestAttachments(requestId, agencyId) {
  return maintenanceRepo.countRequestAttachments(requestId, agencyId);
}

/**
 * Send notifications for maintenance events
 * @param {number} requestId - The maintenance request ID
 * @param {string} eventType - Type of event: 'created', 'status_change', 'comment'
 * @param {object} actingUser - The user who triggered the event
 * @param {object} extraData - Additional data for the notification
 * @param {boolean} extraData.isPrivate - If true, skip tenant notifications (internal chat)
 * @param {string} agencyId - The agency ID for multi-tenancy
 */
async function sendMaintenanceNotifications(requestId, eventType, actingUser, extraData = {}, agencyId) {
  try {
    // Get branding
    const branding = await getAgencyBranding(agencyId);
    const brandName = branding.companyName || 'Letably';

    // Get request details with tenancy and property info
    const request = await maintenanceRepo.getRequestForNotification(requestId, agencyId);
    if (!request) return;

    // Get admin email from settings
    const adminEmail = await maintenanceRepo.getAdminEmail(agencyId);

    // Get all tenants in this tenancy
    const tenants = await maintenanceRepo.getTenantsByTenancyForNotification(request.tenancy_id, agencyId);

    const propertyAddress = `${request.address_line1}, ${request.city}`;
    const priorityLabel = PRIORITY_LABELS[request.priority] || request.priority;
    const statusLabel = STATUS_LABELS[request.status] || request.status;
    const categoryLabel = CATEGORY_LABELS[request.category] || request.category;

    let subject, htmlContent, textContent;

    if (eventType === 'created') {
      subject = `New Maintenance Request: ${escapeHtml(request.title)}`;
      htmlContent = `
        <p>A new maintenance request has been submitted:</p>
        ${createInfoBox([
          `<strong>Property:</strong> ${escapeHtml(propertyAddress)}`,
          `<strong>Title:</strong> ${escapeHtml(request.title)}`,
          `<strong>Category:</strong> ${escapeHtml(categoryLabel)}`,
          `<strong>Priority:</strong> ${escapeHtml(priorityLabel)}`,
          `<strong>Submitted by:</strong> ${escapeHtml(actingUser.first_name)} ${escapeHtml(actingUser.last_name)}`
        ].join('<br>'))}
        <p><strong>Description:</strong></p>
        <p style="background: #f9fafb; padding: 15px; border-radius: 8px;">${escapeHtml(request.description).replace(/\n/g, '<br>')}</p>
      `;
      textContent = `New maintenance request: ${request.title}\nProperty: ${propertyAddress}\nCategory: ${categoryLabel}\nPriority: ${priorityLabel}\nDescription: ${request.description}`;
    } else if (eventType === 'status_change') {
      subject = `Maintenance Request Updated: ${escapeHtml(request.title)}`;
      htmlContent = `
        <p>A maintenance request status has been updated:</p>
        ${createInfoBox([
          `<strong>Property:</strong> ${escapeHtml(propertyAddress)}`,
          `<strong>Title:</strong> ${escapeHtml(request.title)}`,
          `<strong>Status:</strong> ${escapeHtml(extraData.oldStatus)} → <strong>${escapeHtml(statusLabel)}</strong>`,
          `<strong>Updated by:</strong> ${escapeHtml(actingUser.first_name)} ${escapeHtml(actingUser.last_name)}`
        ].join('<br>'))}
      `;
      textContent = `Maintenance request updated: ${request.title}\nStatus: ${extraData.oldStatus} → ${statusLabel}`;
    } else if (eventType === 'comment') {
      const attachmentNote = extraData.attachmentCount > 0
        ? `\n(${extraData.attachmentCount} file${extraData.attachmentCount > 1 ? 's' : ''} attached)`
        : '';

      // Differentiate internal/private messages from public ones
      const isInternal = extraData.isPrivate;
      const internalBadge = isInternal
        ? '<span style="background: #7c3aed; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">INTERNAL</span>'
        : '';
      const internalBanner = isInternal
        ? `<div style="background: #f5f3ff; border: 1px solid #c4b5fd; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <p style="margin: 0; color: #5b21b6; font-size: 14px;">
              <strong>Internal Message</strong> - This message is only visible to landlords and ${brandName}. Tenants cannot see this.
            </p>
          </div>`
        : '';

      subject = isInternal
        ? `[Internal] Maintenance Comment: ${request.title}`
        : `New Comment on Maintenance Request: ${request.title}`;

      const commentBoxStyle = isInternal
        ? 'background: #f5f3ff; border: 1px solid #c4b5fd; padding: 15px; border-radius: 8px;'
        : 'background: #f9fafb; padding: 15px; border-radius: 8px;';

      htmlContent = `
        ${internalBanner}
        <p>A new ${isInternal ? 'internal ' : ''}comment has been added to a maintenance request:${internalBadge}</p>
        ${createInfoBox([
          `<strong>Property:</strong> ${escapeHtml(propertyAddress)}`,
          `<strong>Title:</strong> ${escapeHtml(request.title)}`,
          `<strong>Comment by:</strong> ${escapeHtml(actingUser.first_name)} ${escapeHtml(actingUser.last_name)}`
        ].join('<br>'))}
        <p><strong>Comment:</strong></p>
        <p style="${commentBoxStyle}">${escapeHtml(extraData.comment).replace(/\n/g, '<br>')}${attachmentNote ? `<br><em style="color: #666;">${attachmentNote}</em>` : ''}</p>
      `;
      textContent = `${isInternal ? '[INTERNAL] ' : ''}New comment on maintenance request: ${request.title}\nFrom: ${actingUser.first_name} ${actingUser.last_name}\nComment: ${extraData.comment}${attachmentNote}${isInternal ? `\n\nThis is an internal message - only visible to landlords and ${brandName}.` : ''}`;
    }

    // Build recipient list
    const recipients = [];

    // Add admin
    recipients.push({
      email: adminEmail,
      name: brandName,
      isAdmin: true
    });

    // Add landlord if they want notifications
    if (request.landlord_email && request.receive_maintenance_notifications) {
      recipients.push({
        email: request.landlord_email,
        name: request.landlord_name,
        isLandlord: true
      });
    }

    // Add all tenants (except the one who triggered the action, if it's a comment)
    // SECURITY: Skip tenants for private/internal messages
    if (!extraData.isPrivate) {
      for (const tenant of tenants) {
        if (eventType === 'comment' && tenant.id === actingUser.id) continue;
        recipients.push({
          email: tenant.email,
          name: `${tenant.first_name} ${tenant.last_name}`,
          isTenant: true
        });
      }
    }

    // Send emails
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const slug = req.agency?.slug || '';

    for (const recipient of recipients) {
      // Generate role-specific URL
      let viewUrl;
      if (recipient.isAdmin) {
        viewUrl = `${frontendUrl}/${slug}/admin/maintenance/${requestId}`;
      } else if (recipient.isLandlord) {
        viewUrl = `${frontendUrl}/${slug}/landlord/maintenance/${requestId}`;
      } else {
        viewUrl = `${frontendUrl}/${slug}/tenancy/maintenance/${requestId}`;
      }

      const buttonHtml = createButton(viewUrl, 'View Maintenance Request');

      const emailHtml = createEmailTemplate(
        subject,
        `<p>Hi ${recipient.name.split(' ')[0]},</p>${htmlContent}<div style="text-align: center;">${buttonHtml}</div>`
      );

      await queueEmail({
        to_email: recipient.email,
        to_name: recipient.name,
        subject: subject,
        html_body: emailHtml,
        text_body: `${textContent}\n\nView request: ${viewUrl}`,
        priority: request.priority === 'high' ? 1 : 2
      }, agencyId);
    }
  } catch (error) {
    console.error('Error sending maintenance notifications:', error);
    // Don't throw - notifications failing shouldn't break the main operation
  }
}

// ============================================
// TENANT ENDPOINTS
// ============================================

/**
 * Get maintenance requests for tenant's active tenancy
 */
exports.getMyRequests = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const agencyId = req.agencyId;

  // Find user's active tenancy
  const tenancy = await maintenanceRepo.getUserActiveTenancy(userId, agencyId);

  if (!tenancy) {
    return res.json({ requests: [], tenancy: null });
  }

  // Get all maintenance requests for this tenancy
  const requests = await maintenanceRepo.getRequestsForTenancy(tenancy.tenancy_id, agencyId);

  // Add attachment count to each request
  const requestsWithAttachments = [];
  for (const request of requests) {
    const attachmentCount = await countRequestAttachments(request.id, agencyId);
    requestsWithAttachments.push({
      ...request,
      attachment_count: attachmentCount
    });
  }

  res.json({
    requests: requestsWithAttachments,
    tenancy: {
      id: tenancy.tenancy_id,
      address: `${tenancy.address_line1}, ${tenancy.city}`
    }
  });
}, 'fetch maintenance requests');

/**
 * Get single maintenance request (tenant view)
 */
exports.getRequestById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const agencyId = req.agencyId;

  // Get request with validation that user is part of the tenancy
  const request = await maintenanceRepo.getRequestByIdForTenant(id, userId, agencyId);

  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  // Get comments with attachments
  const comments = await getCommentsWithAttachments(id, false, agencyId);

  res.json({ request, comments });
}, 'fetch maintenance request');

/**
 * Create new maintenance request (tenant)
 */
exports.createRequest = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const agencyId = req.agencyId;
  const { title, description, category, priority = 'medium' } = req.body;

  // Validate required fields
  if (!title || !description || !category) {
    return res.status(400).json({ error: 'Title, description, and category are required' });
  }

  // Find user's active tenancy
  const tenancy = await maintenanceRepo.getUserActiveTenancy(userId, agencyId);

  if (!tenancy) {
    return res.status(400).json({ error: 'You do not have an active tenancy' });
  }

  // Create the request
  const request = await maintenanceRepo.createRequest({
    tenancyId: tenancy.tenancy_id,
    userId,
    title,
    description,
    category,
    priority
  }, agencyId);
  const requestId = request.id;

  // Get acting user info for notification
  const actingUser = await maintenanceRepo.getUserById(userId, agencyId);

  // Send notifications
  await sendMaintenanceNotifications(requestId, 'created', actingUser, {}, agencyId);

  res.status(201).json({
    message: 'Maintenance request created successfully',
    request
  });
}, 'create maintenance request');

/**
 * Add comment to request (tenant) - with optional file attachments
 */
exports.addComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const agencyId = req.agencyId;
  const { content } = req.body;
  const files = req.files || [];

  // Require either content or files
  if ((!content || !content.trim()) && files.length === 0) {
    return res.status(400).json({ error: 'Message content or attachments are required' });
  }

  // Validate user has access to this request
  const hasAccess = await maintenanceRepo.userHasAccessToRequest(id, userId, agencyId);

  if (!hasAccess) {
    return res.status(404).json({ error: 'Request not found' });
  }

  // Add comment
  const commentContent = content?.trim() || '';
  const insertedComment = await maintenanceRepo.insertComment({
    requestId: id,
    userId,
    content: commentContent
  }, agencyId);

  const commentId = insertedComment.id;

  // Add attachments if any
  if (files.length > 0) {
    for (const file of files) {
      await maintenanceRepo.insertAttachment({
        commentId,
        filePath: file.filename,
        originalFilename: file.originalname,
        fileType: getFileType(file.mimetype),
        fileSize: file.size
      }, agencyId);
    }
  }

  // Get the created comment with attachments
  const comment = await maintenanceRepo.getCommentById(commentId, agencyId);
  const attachments = await maintenanceRepo.getCommentAttachments(commentId, agencyId);

  // Get acting user info for notification
  const actingUser = await maintenanceRepo.getUserById(userId, agencyId);

  // Send notifications
  await sendMaintenanceNotifications(id, 'comment', actingUser, {
    comment: commentContent || '(Attachment only)',
    attachmentCount: files.length
  }, agencyId);

  res.status(201).json({
    comment: {
      ...comment,
      user_name: `${comment.first_name} ${comment.last_name}`,
      user_role: comment.role === 'admin' ? 'admin' : (comment.role === 'landlord' ? 'landlord' : 'tenant'),
      attachments
    },
    commentId
  });
}, 'add comment');

/**
 * Upload attachments to an existing comment (tenant)
 */
exports.uploadAttachments = asyncHandler(async (req, res) => {
  const { id, commentId } = req.params;
  const userId = req.user.id;
  const agencyId = req.agencyId;
  const files = req.files || [];

  if (files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  // Validate user has access and owns the comment
  const commentExists = await maintenanceRepo.validateCommentForTenant(commentId, id, userId, agencyId);

  if (!commentExists) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  // Add attachments
  for (const file of files) {
    await maintenanceRepo.insertAttachment({
      commentId,
      filePath: file.filename,
      originalFilename: file.originalname,
      fileType: getFileType(file.mimetype),
      fileSize: file.size
    }, agencyId);
  }

  const attachments = await maintenanceRepo.getCommentAttachments(commentId, agencyId);

  res.status(201).json({ attachments });
}, 'upload attachments');

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * Get all maintenance requests (admin) with filtering
 */
exports.getAllRequests = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { status, priority, category, property_id, tenancy_id, search, dateFrom, dateTo } = req.query;

  // Get filtered requests
  const requests = await maintenanceRepo.getAllRequestsWithFilters({
    status,
    priority,
    category,
    propertyId: property_id,
    tenancyId: tenancy_id,
    search,
    dateFrom,
    dateTo
  }, agencyId);

  // Add attachment count to each request
  const requestsWithAttachments = [];
  for (const request of requests) {
    const attachmentCount = await countRequestAttachments(request.id, agencyId);
    requestsWithAttachments.push({
      ...request,
      attachment_count: attachmentCount
    });
  }

  // Get stats
  const stats = await maintenanceRepo.getRequestStats(agencyId);

  res.json({ requests: requestsWithAttachments, stats });
}, 'fetch maintenance requests');

/**
 * Get single maintenance request (admin view)
 */
exports.getRequestByIdAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;

  const request = await maintenanceRepo.getRequestByIdAdmin(id, agencyId);

  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  // Get ALL comments including private ones (admin can see everything)
  const comments = await getCommentsWithAttachments(id, true, agencyId);

  // Get all tenants in this tenancy
  const tenants = await maintenanceRepo.getTenantsByTenancy(request.tenancy_id, agencyId);

  // Check if property has a landlord (for showing internal chat section)
  const hasLandlord = request.landlord_id != null;

  res.json({
    request,
    comments,
    tenants,
    has_landlord: hasLandlord
  });
}, 'fetch maintenance request');

/**
 * Update maintenance request (admin) - status/priority
 */
exports.updateRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const agencyId = req.agencyId;
  const { status, priority } = req.body;

  // Get current request
  const current = await maintenanceRepo.getRequestById(id, agencyId);
  if (!current) {
    return res.status(404).json({ error: 'Request not found' });
  }

  // Track changes for thread
  const changes = [];
  const updateData = {};

  if (status && status !== current.status) {
    updateData.status = status;
    changes.push({ type: 'status_change', oldValue: current.status, newValue: status });
  }

  if (priority && priority !== current.priority) {
    updateData.priority = priority;
    changes.push({ type: 'priority_change', oldValue: current.priority, newValue: priority });
  }

  if (changes.length === 0) {
    return res.status(400).json({ error: 'No changes provided' });
  }

  // Update request
  const updated = await maintenanceRepo.updateRequest(id, updateData, agencyId);

  // Add change entries to thread
  for (const change of changes) {
    await maintenanceRepo.insertChangeComment({
      requestId: id,
      userId,
      changeType: change.type,
      oldValue: change.oldValue,
      newValue: change.newValue
    }, agencyId);
  }

  // Get acting user info for notification
  const actingUser = await maintenanceRepo.getUserById(userId, agencyId);

  // Send notifications for status changes
  if (changes.some(c => c.type === 'status_change')) {
    const oldStatus = changes.find(c => c.type === 'status_change')?.oldValue;
    await sendMaintenanceNotifications(id, 'status_change', actingUser, {
      oldStatus: STATUS_LABELS[oldStatus] || oldStatus
    }, agencyId);
  }

  res.json({ request: updated });
}, 'update maintenance request');

/**
 * Add comment to request (admin) - with optional file attachments
 */
exports.addCommentAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const agencyId = req.agencyId;
  const { content, is_private } = req.body;
  const files = req.files || [];

  // Require either content or files
  if ((!content || !content.trim()) && files.length === 0) {
    return res.status(400).json({ error: 'Message content or attachments are required' });
  }

  // Validate request exists
  const requestExists = await maintenanceRepo.getRequestById(id, agencyId);
  if (!requestExists) {
    return res.status(404).json({ error: 'Request not found' });
  }

  // Add comment (with is_private flag for internal chat)
  const commentContent = content?.trim() || '';
  const isPrivate = is_private === true || is_private === 'true' || is_private === 1;
  const insertedComment = await maintenanceRepo.insertComment({
    requestId: id,
    userId,
    content: commentContent,
    isPrivate
  }, agencyId);

  const commentId = insertedComment.id;

  // Add attachments if any
  if (files.length > 0) {
    for (const file of files) {
      await maintenanceRepo.insertAttachment({
        commentId,
        filePath: file.filename,
        originalFilename: file.originalname,
        fileType: getFileType(file.mimetype),
        fileSize: file.size
      }, agencyId);
    }
  }

  // Get the created comment with attachments
  const comment = await maintenanceRepo.getCommentById(commentId, agencyId);
  const attachments = await maintenanceRepo.getCommentAttachments(commentId, agencyId);

  // Get acting user info for notification
  const actingUser = await maintenanceRepo.getUserById(userId, agencyId);

  // Send notifications (skip tenants for private/internal messages)
  await sendMaintenanceNotifications(id, 'comment', actingUser, {
    comment: commentContent || '(Attachment only)',
    attachmentCount: files.length,
    isPrivate: isPrivate
  }, agencyId);

  res.status(201).json({
    comment: {
      ...comment,
      user_name: `${comment.first_name} ${comment.last_name}`,
      user_role: comment.role === 'admin' ? 'admin' : (comment.role === 'landlord' ? 'landlord' : 'tenant'),
      is_private: isPrivate,
      attachments
    },
    commentId
  });
}, 'add comment');

/**
 * Upload attachments to an existing comment (admin)
 */
exports.uploadAttachmentsAdmin = asyncHandler(async (req, res) => {
  const { id, commentId } = req.params;
  const agencyId = req.agencyId;
  const files = req.files || [];

  if (files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  // Validate comment exists and belongs to request
  const commentExists = await maintenanceRepo.validateCommentForAdmin(commentId, id, agencyId);

  if (!commentExists) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  // Add attachments
  for (const file of files) {
    await maintenanceRepo.insertAttachment({
      commentId,
      filePath: file.filename,
      originalFilename: file.originalname,
      fileType: getFileType(file.mimetype),
      fileSize: file.size
    }, agencyId);
  }

  const attachments = await maintenanceRepo.getCommentAttachments(commentId, agencyId);

  res.status(201).json({ attachments });
}, 'upload attachments');

/**
 * Delete attachment (admin only)
 */
exports.deleteAttachment = asyncHandler(async (req, res) => {
  const { attachmentId } = req.params;
  const agencyId = req.agencyId;

  // Get attachment details
  const attachment = await maintenanceRepo.getAttachmentById(attachmentId, agencyId);
  if (!attachment) {
    return res.status(404).json({ error: 'Attachment not found' });
  }

  // Delete from database
  await maintenanceRepo.deleteAttachment(attachmentId, agencyId);

  // Delete physical file
  if (attachment.file_path) {
    const filePath = path.join(__dirname, '../../uploads/maintenance', attachment.file_path);
    await fsp.unlink(filePath).catch(() => {});
  }

  res.json({ message: 'Attachment deleted successfully' });
}, 'delete attachment');

/**
 * Delete comment/message (admin only)
 * Also deletes all associated attachments
 */
exports.deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const agencyId = req.agencyId;

  // Get comment details
  const comment = await maintenanceRepo.getCommentForAdmin(commentId, agencyId);
  if (!comment) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  // Get all attachments for this comment
  const attachments = await maintenanceRepo.getAttachmentsForComment(commentId, agencyId);

  // Delete physical files for attachments
  for (const attachment of attachments) {
    if (attachment.file_path) {
      const filePath = path.join(__dirname, '../../uploads/maintenance', attachment.file_path);
      await fsp.unlink(filePath).catch(() => {});
    }
  }

  // Delete attachments from database
  await maintenanceRepo.deleteAttachmentsForComment(commentId, agencyId);

  // Delete the comment
  await maintenanceRepo.deleteComment(commentId, agencyId);

  res.json({ message: 'Comment deleted successfully' });
}, 'delete comment');

/**
 * Get requests for a specific tenancy (admin)
 */
exports.getRequestsByTenancy = asyncHandler(async (req, res) => {
  const { tenancyId } = req.params;
  const agencyId = req.agencyId;

  const requests = await maintenanceRepo.getRequestsByTenancyId(tenancyId, agencyId);

  // Add attachment count to each request
  const requestsWithAttachments = [];
  for (const request of requests) {
    const attachmentCount = await countRequestAttachments(request.id, agencyId);
    requestsWithAttachments.push({
      ...request,
      attachment_count: attachmentCount
    });
  }

  res.json({ requests: requestsWithAttachments });
}, 'fetch maintenance requests');

// Export constants for frontend use
exports.getCategories = (req, res) => {
  res.json({
    categories: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
    priorities: Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label })),
    statuses: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
  });
};

/**
 * Delete a maintenance request (admin only)
 * Also removes all associated comments, attachments, and physical files
 */
exports.deleteRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;

  // Get request
  const request = await maintenanceRepo.getRequestById(id, agencyId);
  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  // Get all attachments for this request to delete files
  const attachments = await maintenanceRepo.getAttachmentsForRequest(id, agencyId);

  // Delete physical files
  for (const attachment of attachments) {
    if (attachment.file_path) {
      const filePath = path.join(__dirname, '../../uploads/maintenance', attachment.file_path);
      await fsp.unlink(filePath).catch(() => {});
    }
  }

  // Delete from database (comments/attachments cascade)
  await maintenanceRepo.deleteRequest(id, agencyId);

  res.json({
    message: 'Maintenance request deleted successfully',
    attachmentsDeleted: attachments.length
  });
}, 'delete maintenance request');
