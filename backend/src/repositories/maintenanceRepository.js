/**
 * Maintenance Repository
 * Centralized database queries for maintenance-related data
 */

const db = require('../db');

// ============================================
// ATTACHMENT & COMMENT HELPERS
// ============================================

/**
 * Get attachments for a comment
 * @param {number} commentId - Comment ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of attachments
 */
async function getCommentAttachments(commentId, agencyId) {
  const result = await db.query(`
    SELECT mca.id, mca.comment_id, mca.file_path, mca.original_filename, mca.file_type, mca.file_size, mca.created_at
    FROM maintenance_attachments mca
    JOIN maintenance_comments mc ON mca.comment_id = mc.id
    JOIN maintenance_requests mr ON mc.request_id = mr.id
    WHERE mca.comment_id = $1 AND mr.agency_id = $2
    ORDER BY mca.created_at ASC
  `, [commentId, agencyId], agencyId);
  return result.rows;
}

/**
 * Count attachments for a request
 * @param {number} requestId - Request ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<number>} Attachment count
 */
async function countRequestAttachments(requestId, agencyId) {
  const result = await db.query(`
    SELECT COUNT(*) as count
    FROM maintenance_attachments mca
    JOIN maintenance_comments mc ON mca.comment_id = mc.id
    JOIN maintenance_requests mr ON mc.request_id = mr.id
    WHERE mc.request_id = $1 AND mr.agency_id = $2
  `, [requestId, agencyId], agencyId);
  return parseInt(result.rows[0]?.count || 0);
}

/**
 * Get comments for a request with user info
 * @param {number} requestId - Request ID
 * @param {boolean} includePrivate - Include private comments
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of comments
 */
async function getCommentsForRequest(requestId, includePrivate, agencyId) {
  const privateFilter = includePrivate ? '' : 'AND (mc.is_private = false OR mc.is_private IS NULL)';

  const result = await db.query(`
    SELECT
      mc.*,
      u.first_name,
      u.last_name,
      u.role
    FROM maintenance_comments mc
    JOIN users u ON mc.user_id = u.id
    JOIN maintenance_requests mr ON mc.request_id = mr.id
    WHERE mc.request_id = $1 AND mr.agency_id = $2 ${privateFilter}
    ORDER BY mc.created_at ASC
  `, [requestId, agencyId], agencyId);
  return result.rows;
}

// ============================================
// TENANT QUERIES
// ============================================

/**
 * Get user's active tenancy
 * @param {number} userId - User ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Tenancy info or null
 */
async function getUserActiveTenancy(userId, agencyId) {
  const result = await db.query(`
    SELECT t.id as tenancy_id, t.status, p.address_line1, p.city
    FROM tenancy_members tm
    JOIN tenancies t ON tm.tenancy_id = t.id
    JOIN properties p ON t.property_id = p.id
    WHERE tm.user_id = $1 AND t.status = 'active'
    ORDER BY t.start_date DESC
    LIMIT 1
  `, [userId], agencyId);
  return result.rows[0] || null;
}

/**
 * Get maintenance requests for a tenancy (tenant view - public comments only)
 * @param {number} tenancyId - Tenancy ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of requests
 */
async function getRequestsForTenancy(tenancyId, agencyId) {
  const result = await db.query(`
    SELECT
      mr.*,
      u.first_name as created_by_first_name,
      u.last_name as created_by_last_name,
      (SELECT COUNT(*) FROM maintenance_comments WHERE request_id = mr.id AND comment_type = 'comment' AND (is_private = false OR is_private IS NULL)) as comment_count
    FROM maintenance_requests mr
    JOIN users u ON mr.created_by_user_id = u.id
    WHERE mr.tenancy_id = $1
    ORDER BY mr.created_at DESC
  `, [tenancyId], agencyId);
  return result.rows;
}

/**
 * Get request by ID for tenant (with access validation)
 * @param {number} requestId - Request ID
 * @param {number} userId - User ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Request or null
 */
async function getRequestByIdForTenant(requestId, userId, agencyId) {
  const result = await db.query(`
    SELECT
      mr.*,
      u.first_name as created_by_first_name,
      u.last_name as created_by_last_name,
      p.address_line1,
      p.city
    FROM maintenance_requests mr
    JOIN users u ON mr.created_by_user_id = u.id
    JOIN tenancies t ON mr.tenancy_id = t.id
    JOIN properties p ON t.property_id = p.id
    JOIN tenancy_members tm ON t.id = tm.tenancy_id
    WHERE mr.id = $1 AND tm.user_id = $2
  `, [requestId, userId], agencyId);
  return result.rows[0] || null;
}

/**
 * Check if user has access to a request
 * @param {number} requestId - Request ID
 * @param {number} userId - User ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<boolean>} True if user has access
 */
async function userHasAccessToRequest(requestId, userId, agencyId) {
  const result = await db.query(`
    SELECT 1 FROM maintenance_requests mr
    JOIN tenancy_members tm ON mr.tenancy_id = tm.tenancy_id
    WHERE mr.id = $1 AND tm.user_id = $2
  `, [requestId, userId], agencyId);
  return result.rows.length > 0;
}

/**
 * Create a maintenance request
 * @param {Object} data - Request data
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object>} Created request
 */
async function createRequest({ tenancyId, userId, title, description, category, priority }, agencyId) {
  const result = await db.query(`
    INSERT INTO maintenance_requests (agency_id, tenancy_id, created_by_user_id, title, description, category, priority)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [agencyId, tenancyId, userId, title, description, category, priority], agencyId);
  return result.rows[0];
}

/**
 * Insert a comment
 * @param {Object} data - Comment data
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object>} Created comment
 */
async function insertComment({ requestId, userId, content, isPrivate = false }, agencyId) {
  const result = await db.query(`
    INSERT INTO maintenance_comments (agency_id, request_id, user_id, comment_type, content, is_private)
    VALUES ($1, $2, $3, 'comment', $4, $5)
    RETURNING *
  `, [agencyId, requestId, userId, content, isPrivate], agencyId);
  return result.rows[0];
}

/**
 * Insert an attachment
 * @param {Object} data - Attachment data
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object>} Created attachment
 */
async function insertAttachment({ commentId, filePath, originalFilename, fileType, fileSize }, agencyId) {
  const result = await db.query(`
    INSERT INTO maintenance_attachments (agency_id, comment_id, file_path, original_filename, file_type, file_size)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [agencyId, commentId, filePath, originalFilename, fileType, fileSize], agencyId);
  return result.rows[0];
}

/**
 * Get comment by ID with user info
 * @param {number} commentId - Comment ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Comment or null
 */
async function getCommentById(commentId, agencyId) {
  const result = await db.query(`
    SELECT mc.*, u.first_name, u.last_name, u.role
    FROM maintenance_comments mc
    JOIN users u ON mc.user_id = u.id
    WHERE mc.id = $1
  `, [commentId], agencyId);
  return result.rows[0] || null;
}

/**
 * Get user by ID
 * @param {number} userId - User ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} User or null
 */
async function getUserById(userId, agencyId) {
  const result = await db.query(
    'SELECT id, first_name, last_name FROM users WHERE id = $1',
    [userId],
    agencyId
  );
  return result.rows[0] || null;
}

/**
 * Validate comment for tenant (user owns comment and has tenancy access)
 * @param {number} commentId - Comment ID
 * @param {number} requestId - Request ID
 * @param {number} userId - User ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Comment or null
 */
async function validateCommentForTenant(commentId, requestId, userId, agencyId) {
  const result = await db.query(`
    SELECT mc.* FROM maintenance_comments mc
    JOIN maintenance_requests mr ON mc.request_id = mr.id
    JOIN tenancy_members tm ON mr.tenancy_id = tm.tenancy_id
    WHERE mc.id = $1 AND mc.request_id = $2 AND tm.user_id = $3 AND mc.user_id = $4
  `, [commentId, requestId, userId, userId], agencyId);
  return result.rows[0] || null;
}

// ============================================
// ADMIN QUERIES
// ============================================

/**
 * Get all requests with filters (admin)
 * @param {Object} filters - Filter options
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of requests
 */
async function getAllRequestsWithFilters(filters, agencyId) {
  const { status, priority, category, propertyId, tenancyId, search, dateFrom, dateTo } = filters;

  let query = `
    SELECT
      mr.*,
      u.first_name as created_by_first_name,
      u.last_name as created_by_last_name,
      t.id as tenancy_id,
      p.id as property_id,
      p.address_line1,
      p.city,
      (SELECT COUNT(*) FROM maintenance_comments WHERE request_id = mr.id AND comment_type = 'comment') as comment_count
    FROM maintenance_requests mr
    JOIN users u ON mr.created_by_user_id = u.id
    JOIN tenancies t ON mr.tenancy_id = t.id
    JOIN properties p ON t.property_id = p.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND mr.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (priority) {
    query += ` AND mr.priority = $${paramIndex}`;
    params.push(priority);
    paramIndex++;
  }

  if (category) {
    query += ` AND mr.category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  if (propertyId) {
    query += ` AND p.id = $${paramIndex}`;
    params.push(propertyId);
    paramIndex++;
  }

  if (tenancyId) {
    query += ` AND t.id = $${paramIndex}`;
    params.push(tenancyId);
    paramIndex++;
  }

  if (search) {
    query += ` AND (mr.title ILIKE $${paramIndex} OR mr.description ILIKE $${paramIndex + 1} OR p.address_line1 ILIKE $${paramIndex + 2})`;
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
    paramIndex += 3;
  }

  if (dateFrom) {
    query += ` AND DATE(mr.created_at) >= $${paramIndex}`;
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    query += ` AND DATE(mr.created_at) <= $${paramIndex}`;
    params.push(dateTo);
    paramIndex++;
  }

  query += ` ORDER BY
    CASE mr.priority
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 3
    END,
    mr.created_at DESC
  `;

  const result = await db.query(query, params, agencyId);
  return result.rows;
}

/**
 * Get request statistics by status
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object>} Stats object
 */
async function getRequestStats(agencyId) {
  const [submittedResult, inProgressResult, completedResult, highResult] = await Promise.all([
    db.query(`SELECT COUNT(*) as count FROM maintenance_requests WHERE status = 'submitted' AND agency_id = $1`, [agencyId], agencyId),
    db.query(`SELECT COUNT(*) as count FROM maintenance_requests WHERE status = 'in_progress' AND agency_id = $1`, [agencyId], agencyId),
    db.query(`SELECT COUNT(*) as count FROM maintenance_requests WHERE status = 'completed' AND agency_id = $1`, [agencyId], agencyId),
    db.query(`SELECT COUNT(*) as count FROM maintenance_requests WHERE priority = 'high' AND status != 'completed' AND agency_id = $1`, [agencyId], agencyId)
  ]);

  return {
    submitted: submittedResult.rows[0].count,
    in_progress: inProgressResult.rows[0].count,
    completed: completedResult.rows[0].count,
    high: highResult.rows[0].count
  };
}

/**
 * Get request by ID for admin (detailed view)
 * @param {number} requestId - Request ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Request or null
 */
async function getRequestByIdAdmin(requestId, agencyId) {
  const result = await db.query(`
    SELECT
      mr.*,
      u.first_name as created_by_first_name,
      u.last_name as created_by_last_name,
      u.email as created_by_email,
      t.id as tenancy_id,
      t.status as tenancy_status,
      p.id as property_id,
      p.address_line1,
      p.city,
      p.postcode,
      p.landlord_id,
      l.name as landlord_name,
      l.email as landlord_email
    FROM maintenance_requests mr
    JOIN users u ON mr.created_by_user_id = u.id
    JOIN tenancies t ON mr.tenancy_id = t.id
    JOIN properties p ON t.property_id = p.id
    LEFT JOIN landlords l ON p.landlord_id = l.id
    WHERE mr.id = $1
  `, [requestId], agencyId);
  return result.rows[0] || null;
}

/**
 * Get tenants for a tenancy
 * @param {number} tenancyId - Tenancy ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of tenants
 */
async function getTenantsByTenancy(tenancyId, agencyId) {
  const result = await db.query(`
    SELECT tm.first_name, tm.surname, u.email
    FROM tenancy_members tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.tenancy_id = $1
  `, [tenancyId], agencyId);
  return result.rows;
}

/**
 * Get request by ID (simple)
 * @param {number} requestId - Request ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Request or null
 */
async function getRequestById(requestId, agencyId) {
  const result = await db.query(
    'SELECT * FROM maintenance_requests WHERE id = $1 AND agency_id = $2',
    [requestId, agencyId],
    agencyId
  );
  return result.rows[0] || null;
}

/**
 * Update request status/priority
 * @param {number} requestId - Request ID
 * @param {Object} updates - Fields to update
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object>} Updated request
 */
async function updateRequest(requestId, updates, agencyId) {
  const { status, priority } = updates;
  const updateParts = [];
  const params = [];
  let paramIndex = 1;

  if (status !== undefined) {
    updateParts.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (priority !== undefined) {
    updateParts.push(`priority = $${paramIndex}`);
    params.push(priority);
    paramIndex++;
  }

  updateParts.push('updated_at = CURRENT_TIMESTAMP');
  params.push(requestId);
  params.push(agencyId);

  await db.query(
    `UPDATE maintenance_requests SET ${updateParts.join(', ')} WHERE id = $${paramIndex} AND agency_id = $${paramIndex + 1}`,
    params,
    agencyId
  );

  return getRequestById(requestId, agencyId);
}

/**
 * Insert change comment (status/priority change record)
 * @param {Object} data - Change data
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object>} Created change record
 */
async function insertChangeComment({ requestId, userId, changeType, oldValue, newValue }, agencyId) {
  const result = await db.query(`
    INSERT INTO maintenance_comments (agency_id, request_id, user_id, comment_type, old_value, new_value)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [agencyId, requestId, userId, changeType, oldValue, newValue], agencyId);
  return result.rows[0];
}

/**
 * Validate comment for admin
 * @param {number} commentId - Comment ID
 * @param {number} requestId - Request ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Comment or null
 */
async function validateCommentForAdmin(commentId, requestId, agencyId) {
  const result = await db.query(`
    SELECT mc.* FROM maintenance_comments mc
    JOIN maintenance_requests mr ON mc.request_id = mr.id
    WHERE mc.id = $1 AND mc.request_id = $2 AND mr.agency_id = $3
  `, [commentId, requestId, agencyId], agencyId);
  return result.rows[0] || null;
}

/**
 * Get comment for admin (with agency check)
 * @param {number} commentId - Comment ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Comment or null
 */
async function getCommentForAdmin(commentId, agencyId) {
  const result = await db.query(`
    SELECT mc.* FROM maintenance_comments mc
    JOIN maintenance_requests mr ON mc.request_id = mr.id
    WHERE mc.id = $1 AND mr.agency_id = $2
  `, [commentId, agencyId], agencyId);
  return result.rows[0] || null;
}

/**
 * Get attachment by ID (with agency check)
 * @param {number} attachmentId - Attachment ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Attachment or null
 */
async function getAttachmentById(attachmentId, agencyId) {
  const result = await db.query(`
    SELECT mca.* FROM maintenance_attachments mca
    JOIN maintenance_comments mc ON mca.comment_id = mc.id
    JOIN maintenance_requests mr ON mc.request_id = mr.id
    WHERE mca.id = $1 AND mr.agency_id = $2
  `, [attachmentId, agencyId], agencyId);
  return result.rows[0] || null;
}

/**
 * Get attachments for a comment (with agency check)
 * @param {number} commentId - Comment ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of attachments
 */
async function getAttachmentsForComment(commentId, agencyId) {
  const result = await db.query(`
    SELECT mca.* FROM maintenance_attachments mca
    JOIN maintenance_comments mc ON mca.comment_id = mc.id
    JOIN maintenance_requests mr ON mc.request_id = mr.id
    WHERE mca.comment_id = $1 AND mr.agency_id = $2
  `, [commentId, agencyId], agencyId);
  return result.rows;
}

/**
 * Delete attachment
 * @param {number} attachmentId - Attachment ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<void>}
 */
async function deleteAttachment(attachmentId, agencyId) {
  await db.query(
    `DELETE FROM maintenance_attachments
     WHERE id = $1
     AND comment_id IN (
       SELECT mc.id FROM maintenance_comments mc
       INNER JOIN maintenance_requests mr ON mc.request_id = mr.id
       WHERE mr.agency_id = $2
     )`,
    [attachmentId, agencyId],
    agencyId
  );
}

/**
 * Delete attachments for a comment
 * @param {number} commentId - Comment ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<void>}
 */
async function deleteAttachmentsForComment(commentId, agencyId) {
  await db.query(
    `DELETE FROM maintenance_attachments
     WHERE comment_id = $1
     AND comment_id IN (
       SELECT mc.id FROM maintenance_comments mc
       INNER JOIN maintenance_requests mr ON mc.request_id = mr.id
       WHERE mr.agency_id = $2
     )`,
    [commentId, agencyId],
    agencyId
  );
}

/**
 * Delete comment
 * @param {number} commentId - Comment ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<void>}
 */
async function deleteComment(commentId, agencyId) {
  await db.query(
    `DELETE FROM maintenance_comments
     WHERE id = $1
     AND request_id IN (SELECT id FROM maintenance_requests WHERE agency_id = $2)`,
    [commentId, agencyId],
    agencyId
  );
}

/**
 * Get requests by tenancy ID (admin)
 * @param {number} tenancyId - Tenancy ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of requests
 */
async function getRequestsByTenancyId(tenancyId, agencyId) {
  const result = await db.query(`
    SELECT
      mr.*,
      u.first_name as created_by_first_name,
      u.last_name as created_by_last_name,
      (SELECT COUNT(*) FROM maintenance_comments WHERE request_id = mr.id AND comment_type = 'comment') as comment_count
    FROM maintenance_requests mr
    JOIN users u ON mr.created_by_user_id = u.id
    WHERE mr.tenancy_id = $1
    ORDER BY mr.created_at DESC
  `, [tenancyId], agencyId);
  return result.rows;
}

/**
 * Get all attachments for a request
 * @param {number} requestId - Request ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of attachments
 */
async function getAttachmentsForRequest(requestId, agencyId) {
  const result = await db.query(`
    SELECT mca.* FROM maintenance_attachments mca
    JOIN maintenance_comments mc ON mca.comment_id = mc.id
    JOIN maintenance_requests mr ON mc.request_id = mr.id
    WHERE mc.request_id = $1 AND mr.agency_id = $2
  `, [requestId, agencyId], agencyId);
  return result.rows;
}

/**
 * Delete request
 * @param {number} requestId - Request ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<void>}
 */
async function deleteRequest(requestId, agencyId) {
  await db.query(
    'DELETE FROM maintenance_requests WHERE id = $1 AND agency_id = $2',
    [requestId, agencyId],
    agencyId
  );
}

// ============================================
// NOTIFICATION HELPER QUERIES
// ============================================

/**
 * Get request details for notifications
 * @param {number} requestId - Request ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Request with property/landlord info
 */
async function getRequestForNotification(requestId, agencyId) {
  const result = await db.query(`
    SELECT
      mr.*,
      t.property_id,
      p.address_line1,
      p.city,
      p.postcode,
      p.landlord_id,
      l.name as landlord_name,
      l.email as landlord_email,
      l.receive_maintenance_notifications
    FROM maintenance_requests mr
    JOIN tenancies t ON mr.tenancy_id = t.id
    JOIN properties p ON t.property_id = p.id
    LEFT JOIN landlords l ON p.landlord_id = l.id
    WHERE mr.id = $1
  `, [requestId], agencyId);
  return result.rows[0] || null;
}

/**
 * Get admin email from settings
 * @param {number} agencyId - Agency context
 * @returns {Promise<string>} Admin email
 */
async function getAdminEmail(agencyId) {
  const result = await db.query(
    "SELECT setting_value FROM site_settings WHERE setting_key = 'email_address'",
    [],
    agencyId
  );
  return result.rows[0]?.setting_value || 'support@letably.com';
}

/**
 * Get tenants by tenancy ID (for notifications)
 * @param {number} tenancyId - Tenancy ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of tenants with email
 */
async function getTenantsByTenancyForNotification(tenancyId, agencyId) {
  const result = await db.query(`
    SELECT u.id, u.email, u.first_name, u.last_name
    FROM tenancy_members tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.tenancy_id = $1
  `, [tenancyId], agencyId);
  return result.rows;
}

module.exports = {
  // Attachment & Comment helpers
  getCommentAttachments,
  countRequestAttachments,
  getCommentsForRequest,

  // Tenant queries
  getUserActiveTenancy,
  getRequestsForTenancy,
  getRequestByIdForTenant,
  userHasAccessToRequest,
  createRequest,
  insertComment,
  insertAttachment,
  getCommentById,
  getUserById,
  validateCommentForTenant,

  // Admin queries
  getAllRequestsWithFilters,
  getRequestStats,
  getRequestByIdAdmin,
  getTenantsByTenancy,
  getRequestById,
  updateRequest,
  insertChangeComment,
  validateCommentForAdmin,
  getCommentForAdmin,
  getAttachmentById,
  getAttachmentsForComment,
  deleteAttachment,
  deleteAttachmentsForComment,
  deleteComment,
  getRequestsByTenancyId,
  getAttachmentsForRequest,
  deleteRequest,

  // Notification helpers
  getRequestForNotification,
  getAdminEmail,
  getTenantsByTenancyForNotification
};
