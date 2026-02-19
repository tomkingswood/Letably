const db = require('../db');
const path = require('path');
const fs = require('fs');
const { queueEmail } = require('../services/emailService');
const { createEmailTemplate, createButton, createInfoBox, escapeHtml } = require('../utils/emailTemplates');
const { getAgencyBranding } = require('../services/brandingService');
const asyncHandler = require('../utils/asyncHandler');
const handleError = require('../utils/handleError');

/**
 * Send notifications for new tenancy communication messages
 * @param {number} tenancyId - The tenancy ID
 * @param {object} actingUser - The user sending the message
 * @param {string} messageContent - The message content
 * @param {boolean} isPrivate - If true, only notify landlord and admin (skip tenants)
 * @param {string} agencyId - The agency ID for database queries
 */
async function sendCommunicationNotifications(tenancyId, actingUser, messageContent, isPrivate = false, agencyId) {
  try {
    // Get branding
    const branding = await getAgencyBranding(agencyId);
    const brandName = branding.companyName || 'Letably';

    // Get tenancy details with property and landlord info
    const tenancyResult = await db.query(`
      SELECT
        t.*,
        p.address_line1,
        p.city,
        p.postcode,
        p.landlord_id,
        l.name as landlord_name,
        l.email as landlord_email,
        l.receive_tenancy_communications
      FROM tenancies t
      JOIN properties p ON t.property_id = p.id
      LEFT JOIN landlords l ON p.landlord_id = l.id
      WHERE t.id = $1
    `, [tenancyId], agencyId);

    const tenancy = tenancyResult.rows[0];

    if (!tenancy) return;

    // Get admin email from settings
    const settingsResult = await db.query(
      'SELECT setting_value FROM site_settings WHERE setting_key = $1',
      ['email_address'],
      agencyId
    );
    const adminEmail = settingsResult.rows[0]?.setting_value || 'support@letably.com';

    // Get all tenants in this tenancy
    // Defense-in-depth: explicit agency_id filtering
    const tenantsResult = await db.query(`
      SELECT u.id, u.email, u.first_name, u.last_name
      FROM tenancy_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.tenancy_id = $1 AND tm.tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $2)
    `, [tenancyId, agencyId], agencyId);

    const tenants = tenantsResult.rows;

    const propertyAddress = `${tenancy.address_line1}, ${tenancy.city}`;

    // Truncate message for preview
    const messagePreview = messageContent.length > 300
      ? messageContent.substring(0, 300) + '...'
      : messageContent;

    // Differentiate internal/private messages from public ones
    const internalBadge = isPrivate
      ? '<span style="background: #7c3aed; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">INTERNAL</span>'
      : '';
    const internalBanner = isPrivate
      ? `<div style="background: #f5f3ff; border: 1px solid #c4b5fd; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
          <p style="margin: 0; color: #5b21b6; font-size: 14px;">
            <strong>Internal Message</strong> - This message is only visible to landlords and ${brandName}. Tenants cannot see this.
          </p>
        </div>`
      : '';

    const subject = isPrivate
      ? `[Internal] Message: ${propertyAddress}`
      : `New Message: ${propertyAddress}`;

    const messageBoxStyle = isPrivate
      ? 'background: #f5f3ff; border: 1px solid #c4b5fd; padding: 15px; border-radius: 8px;'
      : 'background: #f9fafb; padding: 15px; border-radius: 8px;';

    const htmlContent = `
      ${internalBanner}
      <p>A new ${isPrivate ? 'internal ' : ''}message has been posted for the tenancy at ${escapeHtml(propertyAddress)}:${internalBadge}</p>
      ${createInfoBox([
        `<strong>From:</strong> ${escapeHtml(actingUser.first_name)} ${escapeHtml(actingUser.last_name)}`,
      ].join('<br>'))}
      <p><strong>Message:</strong></p>
      <p style="${messageBoxStyle}">${escapeHtml(messagePreview).replace(/\n/g, '<br>')}</p>
    `;
    const textContent = `${isPrivate ? '[INTERNAL] ' : ''}New message for ${propertyAddress}\nFrom: ${actingUser.first_name} ${actingUser.last_name}\n\n${messagePreview}${isPrivate ? `\n\nThis is an internal message - only visible to landlords and ${brandName}.` : ''}`;

    // Build recipient list
    const recipients = [];

    // Add admin (unless they are the sender)
    if (actingUser.role !== 'admin') {
      recipients.push({
        email: adminEmail,
        name: brandName,
        isAdmin: true
      });
    }

    // Add landlord if they want notifications and aren't the sender
    if (tenancy.landlord_email && tenancy.receive_tenancy_communications) {
      const isLandlordSender = actingUser.email?.toLowerCase() === tenancy.landlord_email?.toLowerCase();
      if (!isLandlordSender) {
        recipients.push({
          email: tenancy.landlord_email,
          name: tenancy.landlord_name,
          isLandlord: true
        });
      }
    }

    // Add all tenants except the sender (skip for private messages)
    if (!isPrivate) {
      for (const tenant of tenants) {
        if (tenant.id === actingUser.id) continue;
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
        viewUrl = `${frontendUrl}/${slug}/admin/tenancies/${tenancyId}/communication`;
      } else if (recipient.isLandlord) {
        viewUrl = `${frontendUrl}/${slug}/landlord/communication/${tenancyId}`;
      } else {
        viewUrl = `${frontendUrl}/${slug}/tenancy/communication`;
      }

      const buttonHtml = createButton(viewUrl, 'View Messages');

      const emailHtml = createEmailTemplate(
        subject,
        `<p>Hi ${recipient.name.split(' ')[0]},</p>${htmlContent}<div style="text-align: center;">${buttonHtml}</div>`
      );

      await queueEmail({
        to_email: recipient.email,
        to_name: recipient.name,
        subject: subject,
        html_body: emailHtml,
        text_body: `${textContent}\n\nView messages: ${viewUrl}`,
        priority: 3
      }, agencyId);
    }
  } catch (error) {
    console.error('Error sending communication notifications:', error);
    // Don't throw - notifications failing shouldn't break the main operation
  }
}

// ============================================
// TENANT ENDPOINTS
// ============================================

/**
 * Get messages for tenant's active tenancy (paginated)
 */
exports.getMyThread = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const agencyId = req.agencyId;
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Find user's active tenancy
  const tenancyResult = await db.query(`
    SELECT t.*, p.address_line1, p.city, p.postcode
    FROM tenancies t
    JOIN tenancy_members tm ON t.id = tm.tenancy_id
    JOIN properties p ON t.property_id = p.id
    WHERE tm.user_id = $1 AND t.status IN ('active', 'signed', 'awaiting_signatures')
    ORDER BY t.created_at DESC
    LIMIT 1
  `, [userId], agencyId);

  const tenancy = tenancyResult.rows[0];

  if (!tenancy) {
    return res.status(404).json({ error: 'No active tenancy not found' });
  }

  // Get messages with user info
  // SECURITY: Tenants can only see public messages (is_private = false or NULL)
  // Defense-in-depth: explicit agency_id filtering
  const messagesResult = await db.query(`
    SELECT
      tm.*,
      u.first_name,
      u.last_name,
      u.role
    FROM tenancy_messages tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.tenancy_id = $1 AND (tm.is_private = false OR tm.is_private IS NULL) AND tm.tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $4)
    ORDER BY tm.created_at DESC
    LIMIT $2 OFFSET $3
  `, [tenancy.id, parseInt(limit), offset, agencyId], agencyId);

  const messages = messagesResult.rows;

  // Get attachments for these messages
  // Defense-in-depth: explicit agency_id filtering
  const messageIds = messages.map(m => m.id);
  let attachments = [];
  if (messageIds.length > 0) {
    const placeholders = messageIds.map((_, i) => `$${i + 1}`).join(',');
    const attachmentsResult = await db.query(`
      SELECT tma.* FROM tenancy_message_attachments tma
      INNER JOIN tenancy_messages tm ON tma.message_id = tm.id
      WHERE tma.message_id IN (${placeholders}) AND tm.tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $${messageIds.length + 1})
    `, [...messageIds, agencyId], agencyId);
    attachments = attachmentsResult.rows;
  }

  // Attach attachments to messages
  const messagesWithAttachments = messages.map(msg => ({
    ...msg,
    user_name: `${msg.first_name} ${msg.last_name}`,
    user_role: msg.role,
    attachments: attachments.filter(a => a.message_id === msg.id)
  }));

  // Get total count for pagination (only public messages for tenants)
  // Defense-in-depth: explicit agency_id filtering
  const countResult = await db.query(`
    SELECT COUNT(*) as count FROM tenancy_messages WHERE tenancy_id = $1 AND (is_private = false OR is_private IS NULL) AND tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $2)
  `, [tenancy.id, agencyId], agencyId);
  const totalCount = parseInt(countResult.rows[0].count);

  res.json({
    tenancy: {
      id: tenancy.id,
      address: `${tenancy.address_line1}, ${tenancy.city}`
    },
    messages: messagesWithAttachments.reverse(), // Return in chronological order
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      hasMore: offset + messages.length < totalCount
    }
  });
}, 'get messages');

/**
 * Send message to tenant's tenancy thread (with optional attachments)
 */
exports.sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const agencyId = req.agencyId;
    const { content } = req.body;
    const files = req.files || [];

    // Validate that we have either content or files
    if ((!content || !content.trim()) && files.length === 0) {
      return res.status(400).json({ error: 'Message content or attachments required' });
    }

    // Find user's active tenancy
    const tenancyResult = await db.query(`
      SELECT t.id
      FROM tenancies t
      JOIN tenancy_members tm ON t.id = tm.tenancy_id
      WHERE tm.user_id = $1 AND t.status IN ('active', 'signed', 'awaiting_signatures')
      ORDER BY t.created_at DESC
      LIMIT 1
    `, [userId], agencyId);

    const tenancy = tenancyResult.rows[0];

    if (!tenancy) {
      // Clean up any uploaded files
      for (const file of files) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
      return res.status(404).json({ error: 'No active tenancy not found' });
    }

    // Insert message
    const insertResult = await db.query(`
      INSERT INTO tenancy_messages (tenancy_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [tenancy.id, userId, (content || '').trim()], agencyId);

    const messageId = insertResult.rows[0].id;

    // Process attachments if any
    const attachments = [];
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const fileType = imageExts.includes(ext) ? 'image' : 'document';

      const attachResult = await db.query(`
        INSERT INTO tenancy_message_attachments (message_id, file_path, original_filename, file_type, file_size)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [messageId, file.filename, file.originalname, fileType, file.size], agencyId);

      attachments.push(attachResult.rows[0]);
    }

    // Get the created message with user info
    // Defense-in-depth: explicit agency_id filtering
    const messageResult = await db.query(`
      SELECT tm.*, u.first_name, u.last_name, u.role
      FROM tenancy_messages tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.id = $1 AND tm.tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $2)
    `, [messageId, agencyId], agencyId);

    const message = messageResult.rows[0];

    // Get acting user info for notification
    const actingUserResult = await db.query(`SELECT id, first_name, last_name, email, role FROM users WHERE id = $1`, [userId], agencyId);
    const actingUser = actingUserResult.rows[0];

    // Send notifications
    await sendCommunicationNotifications(tenancy.id, actingUser, (content || '').trim(), false, agencyId);

    res.status(201).json({
      messageId: message.id,
      message: {
        ...message,
        user_name: `${message.first_name} ${message.last_name}`,
        user_role: message.role,
        attachments
      }
    });
  } catch (err) {
    // Clean up any uploaded files on error
    if (req.files) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    }
    handleError(res, err, 'send message');
  }
};


// ============================================
// LANDLORD ENDPOINTS
// ============================================

/**
 * Get messages for a landlord's tenancy (paginated)
 */
exports.getLandlordThread = asyncHandler(async (req, res) => {
  const userEmail = req.user.email;
  const agencyId = req.agencyId;
  const { tenancyId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Verify tenancy belongs to landlord's property
  const tenancyResult = await db.query(`
    SELECT t.*, p.address_line1, p.city, p.postcode
    FROM tenancies t
    JOIN properties p ON t.property_id = p.id
    JOIN landlords l ON p.landlord_id = l.id
    WHERE t.id = $1 AND LOWER(l.email) = LOWER($2)
  `, [tenancyId, userEmail], agencyId);

  const tenancy = tenancyResult.rows[0];

  if (!tenancy) {
    return res.status(404).json({ error: 'Tenancy not found or access denied' });
  }

  // Get messages with user info
  // Defense-in-depth: explicit agency_id filtering
  const messagesResult = await db.query(`
    SELECT
      tm.*,
      u.first_name,
      u.last_name,
      u.role
    FROM tenancy_messages tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.tenancy_id = $1 AND tm.tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $4)
    ORDER BY tm.created_at DESC
    LIMIT $2 OFFSET $3
  `, [tenancyId, parseInt(limit), offset, agencyId], agencyId);

  const messages = messagesResult.rows;

  // Get attachments for these messages
  // Defense-in-depth: explicit agency_id filtering
  const messageIds = messages.map(m => m.id);
  let attachments = [];
  if (messageIds.length > 0) {
    const placeholders = messageIds.map((_, i) => `$${i + 1}`).join(',');
    const attachmentsResult = await db.query(`
      SELECT tma.* FROM tenancy_message_attachments tma
      INNER JOIN tenancy_messages tm ON tma.message_id = tm.id
      WHERE tma.message_id IN (${placeholders}) AND tm.tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $${messageIds.length + 1})
    `, [...messageIds, agencyId], agencyId);
    attachments = attachmentsResult.rows;
  }

  // Attach attachments to messages
  const messagesWithAttachments = messages.map(msg => ({
    ...msg,
    user_name: `${msg.first_name} ${msg.last_name}`,
    user_role: msg.role,
    attachments: attachments.filter(a => a.message_id === msg.id)
  }));

  // Get total count for pagination
  // Defense-in-depth: explicit agency_id filtering
  const countResult = await db.query(`
    SELECT COUNT(*) as count FROM tenancy_messages WHERE tenancy_id = $1 AND tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $2)
  `, [tenancyId, agencyId], agencyId);
  const totalCount = parseInt(countResult.rows[0].count);

  res.json({
    tenancy: {
      id: tenancy.id,
      address: `${tenancy.address_line1}, ${tenancy.city}`,
      status: tenancy.status
    },
    messages: messagesWithAttachments.reverse(),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      hasMore: offset + messages.length < totalCount
    },
    // Landlords always have has_landlord = true (they ARE the landlord)
    has_landlord: true
  });
}, 'get messages');

/**
 * Send message as landlord (with optional attachments)
 */
exports.sendMessageLandlord = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const agencyId = req.agencyId;
    const { tenancyId } = req.params;
    const { content, is_private } = req.body;
    const files = req.files || [];

    // Handle is_private parameter (normalize to boolean)
    const isPrivate = is_private === true || is_private === 'true' || is_private === 1 || is_private === '1';

    // Validate that we have either content or files
    if ((!content || !content.trim()) && files.length === 0) {
      return res.status(400).json({ error: 'Message content or attachments required' });
    }

    // Verify tenancy belongs to landlord's property
    const tenancyResult = await db.query(`
      SELECT t.id
      FROM tenancies t
      JOIN properties p ON t.property_id = p.id
      JOIN landlords l ON p.landlord_id = l.id
      WHERE t.id = $1 AND LOWER(l.email) = LOWER($2)
    `, [tenancyId, userEmail], agencyId);

    const tenancy = tenancyResult.rows[0];

    if (!tenancy) {
      // Clean up any uploaded files
      for (const file of files) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
      return res.status(404).json({ error: 'Tenancy not found or access denied' });
    }

    // Insert message with is_private flag
    const insertResult = await db.query(`
      INSERT INTO tenancy_messages (tenancy_id, user_id, content, is_private)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [tenancyId, userId, (content || '').trim(), isPrivate], agencyId);

    const messageId = insertResult.rows[0].id;

    // Process attachments if any
    const attachments = [];
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const fileType = imageExts.includes(ext) ? 'image' : 'document';

      const attachResult = await db.query(`
        INSERT INTO tenancy_message_attachments (message_id, file_path, original_filename, file_type, file_size)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [messageId, file.filename, file.originalname, fileType, file.size], agencyId);

      attachments.push(attachResult.rows[0]);
    }

    // Get the created message with user info
    // Defense-in-depth: explicit agency_id filtering
    const messageResult = await db.query(`
      SELECT tm.*, u.first_name, u.last_name, u.role
      FROM tenancy_messages tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.id = $1 AND tm.tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $2)
    `, [messageId, agencyId], agencyId);

    const message = messageResult.rows[0];

    // Get acting user info for notification
    const actingUserResult = await db.query(`SELECT id, first_name, last_name, email, role FROM users WHERE id = $1`, [userId], agencyId);
    const actingUser = actingUserResult.rows[0];

    // Send notifications (pass isPrivate to skip tenants if private message)
    await sendCommunicationNotifications(tenancyId, actingUser, (content || '').trim(), isPrivate, agencyId);

    res.status(201).json({
      messageId: message.id,
      message: {
        ...message,
        user_name: `${message.first_name} ${message.last_name}`,
        user_role: message.role,
        attachments
      }
    });
  } catch (err) {
    // Clean up any uploaded files on error
    if (req.files) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    }
    handleError(res, err, 'send landlord message');
  }
};


/**
 * Get all tenancies with communication for landlord
 */
exports.getLandlordTenancies = asyncHandler(async (req, res) => {
  const userEmail = req.user.email;
  const agencyId = req.agencyId;

  // Get all tenancies for landlord's properties with message counts
  // Defense-in-depth: explicit agency_id filtering
  const tenanciesResult = await db.query(`
    SELECT
      t.id,
      t.status,
      t.start_date,
      t.end_date,
      p.address_line1,
      p.city,
      p.postcode,
      (SELECT COUNT(*) FROM tenancy_messages WHERE tenancy_id = t.id) as message_count,
      (SELECT MAX(created_at) FROM tenancy_messages WHERE tenancy_id = t.id) as last_message_at
    FROM tenancies t
    JOIN properties p ON t.property_id = p.id
    JOIN landlords l ON p.landlord_id = l.id
    WHERE LOWER(l.email) = LOWER($1) AND t.status IN ('active', 'signed', 'awaiting_signatures') AND t.agency_id = $2
    ORDER BY last_message_at DESC NULLS LAST, t.created_at DESC
  `, [userEmail, agencyId], agencyId);

  const tenancies = tenanciesResult.rows;

  // Get tenant names for each tenancy
  // Defense-in-depth: explicit agency_id filtering
  const tenanciesWithTenants = [];
  for (const t of tenancies) {
    const tenantsResult = await db.query(`
      SELECT u.first_name, u.last_name
      FROM tenancy_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.tenancy_id = $1 AND tm.tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $2)
    `, [t.id, agencyId], agencyId);

    tenanciesWithTenants.push({
      ...t,
      property_address: `${t.address_line1}, ${t.city}`,
      tenant_names: tenantsResult.rows.map(tenant => `${tenant.first_name} ${tenant.last_name}`)
    });
  }

  res.json({ tenancies: tenanciesWithTenants });
}, 'get tenancies');

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * Get all tenancies with communication for admin (with filtering)
 */
exports.getAllTenanciesWithCommunication = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { property_id, status, has_messages } = req.query;

  let whereConditions = ['1=1'];
  const params = [];
  let paramIndex = 1;

  if (property_id) {
    whereConditions.push(`t.property_id = $${paramIndex}`);
    params.push(property_id);
    paramIndex++;
  }

  if (status) {
    whereConditions.push(`t.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  // Get all tenancies with message counts
  // Defense-in-depth: explicit agency_id filtering
  whereConditions.push(`t.agency_id = $${paramIndex}`);
  params.push(agencyId);

  const tenanciesResult = await db.query(`
    SELECT
      t.id,
      t.status,
      t.start_date,
      t.end_date,
      t.property_id,
      p.address_line1,
      p.city,
      p.postcode,
      l.name as landlord_name,
      (SELECT COUNT(*) FROM tenancy_messages WHERE tenancy_id = t.id) as message_count,
      (SELECT MAX(created_at) FROM tenancy_messages WHERE tenancy_id = t.id) as last_message_at,
      (SELECT content FROM tenancy_messages WHERE tenancy_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message_preview
    FROM tenancies t
    JOIN properties p ON t.property_id = p.id
    LEFT JOIN landlords l ON p.landlord_id = l.id
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY last_message_at DESC NULLS LAST, t.created_at DESC
  `, params, agencyId);

  const tenancies = tenanciesResult.rows;

  // Get tenant names for each tenancy
  // Defense-in-depth: explicit agency_id filtering
  const tenanciesWithTenants = [];
  for (const t of tenancies) {
    const tenantsResult = await db.query(`
      SELECT u.first_name, u.last_name
      FROM tenancy_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.tenancy_id = $1 AND tm.tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $2)
    `, [t.id, agencyId], agencyId);

    tenanciesWithTenants.push({
      ...t,
      property_address: `${t.address_line1}, ${t.city}`,
      tenant_names: tenantsResult.rows.map(tenant => `${tenant.first_name} ${tenant.last_name}`),
      last_message_preview: t.last_message_preview
        ? (t.last_message_preview.length > 100 ? t.last_message_preview.substring(0, 100) + '...' : t.last_message_preview)
        : null
    });
  }

  // Filter by has_messages if specified
  let filteredTenancies = tenanciesWithTenants;
  if (has_messages === 'true') {
    filteredTenancies = tenanciesWithTenants.filter(t => parseInt(t.message_count) > 0);
  } else if (has_messages === 'false') {
    filteredTenancies = tenanciesWithTenants.filter(t => parseInt(t.message_count) === 0);
  }

  // Calculate summary
  const summary = {
    total: filteredTenancies.length,
    with_messages: filteredTenancies.filter(t => parseInt(t.message_count) > 0).length,
    total_messages: filteredTenancies.reduce((sum, t) => sum + parseInt(t.message_count), 0)
  };

  res.json({
    tenancies: filteredTenancies,
    summary
  });
}, 'get tenancies with communication');

/**
 * Get messages for any tenancy (admin)
 */
exports.getAdminThread = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { tenancyId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Get tenancy info (include landlord_id to determine has_landlord)
  // Defense-in-depth: explicit agency_id filtering
  const tenancyResult = await db.query(`
    SELECT t.*, p.address_line1, p.city, p.postcode, p.landlord_id,
           l.name as landlord_name, l.email as landlord_email
    FROM tenancies t
    JOIN properties p ON t.property_id = p.id
    LEFT JOIN landlords l ON p.landlord_id = l.id
    WHERE t.id = $1 AND t.agency_id = $2
  `, [tenancyId, agencyId], agencyId);

  const tenancy = tenancyResult.rows[0];

  if (!tenancy) {
    return res.status(404).json({ error: 'Tenancy not found' });
  }

  // Get messages with user info
  // Defense-in-depth: explicit agency_id filtering
  const messagesResult = await db.query(`
    SELECT
      tm.*,
      u.first_name,
      u.last_name,
      u.role
    FROM tenancy_messages tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.tenancy_id = $1 AND tm.tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $4)
    ORDER BY tm.created_at DESC
    LIMIT $2 OFFSET $3
  `, [tenancyId, parseInt(limit), offset, agencyId], agencyId);

  const messages = messagesResult.rows;

  // Get attachments for these messages
  // Defense-in-depth: explicit agency_id filtering
  const messageIds = messages.map(m => m.id);
  let attachments = [];
  if (messageIds.length > 0) {
    const placeholders = messageIds.map((_, i) => `$${i + 1}`).join(',');
    const attachmentsResult = await db.query(`
      SELECT tma.* FROM tenancy_message_attachments tma
      INNER JOIN tenancy_messages tm ON tma.message_id = tm.id
      WHERE tma.message_id IN (${placeholders}) AND tm.tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $${messageIds.length + 1})
    `, [...messageIds, agencyId], agencyId);
    attachments = attachmentsResult.rows;
  }

  // Attach attachments to messages
  const messagesWithAttachments = messages.map(msg => ({
    ...msg,
    user_name: `${msg.first_name} ${msg.last_name}`,
    user_role: msg.role,
    attachments: attachments.filter(a => a.message_id === msg.id)
  }));

  // Get total count for pagination
  // Defense-in-depth: explicit agency_id filtering
  const countResult = await db.query(`
    SELECT COUNT(*) as count FROM tenancy_messages WHERE tenancy_id = $1 AND tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $2)
  `, [tenancyId, agencyId], agencyId);
  const totalCount = parseInt(countResult.rows[0].count);

  // Get tenants in this tenancy
  // Defense-in-depth: explicit agency_id filtering
  const tenantsResult = await db.query(`
    SELECT u.first_name, u.last_name, u.email, u.id as user_id
    FROM tenancy_members tm
    LEFT JOIN users u ON tm.user_id = u.id
    WHERE tm.tenancy_id = $1 AND tm.tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $2)
  `, [tenancyId, agencyId], agencyId);

  res.json({
    tenancy: {
      id: tenancy.id,
      address: `${tenancy.address_line1}, ${tenancy.city}`,
      status: tenancy.status,
      landlord_name: tenancy.landlord_name,
      landlord_email: tenancy.landlord_email,
      tenants: tenantsResult.rows
    },
    messages: messagesWithAttachments.reverse(),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      hasMore: offset + messages.length < totalCount
    },
    // has_landlord is true if the property has a landlord assigned
    has_landlord: !!tenancy.landlord_id
  });
}, 'get admin thread');

/**
 * Send message as admin (with optional attachments)
 */
exports.sendMessageAdmin = async (req, res) => {
  try {
    const userId = req.user.id;
    const agencyId = req.agencyId;
    const { tenancyId } = req.params;
    const { content, is_private } = req.body;
    const files = req.files || [];

    // Handle is_private parameter (normalize to boolean)
    const isPrivate = is_private === true || is_private === 'true' || is_private === 1 || is_private === '1';

    // Validate that we have either content or files
    if ((!content || !content.trim()) && files.length === 0) {
      return res.status(400).json({ error: 'Message content or attachments required' });
    }

    // Verify tenancy exists
    // Defense-in-depth: explicit agency_id filtering
    const tenancyResult = await db.query(`SELECT id FROM tenancies WHERE id = $1 AND agency_id = $2`, [tenancyId, agencyId], agencyId);
    const tenancy = tenancyResult.rows[0];
    if (!tenancy) {
      // Clean up any uploaded files
      for (const file of files) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
      return res.status(404).json({ error: 'Tenancy not found' });
    }

    // Insert message with is_private flag
    const insertResult = await db.query(`
      INSERT INTO tenancy_messages (tenancy_id, user_id, content, is_private)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [tenancyId, userId, (content || '').trim(), isPrivate], agencyId);

    const messageId = insertResult.rows[0].id;

    // Process attachments if any
    const attachments = [];
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const fileType = imageExts.includes(ext) ? 'image' : 'document';

      const attachResult = await db.query(`
        INSERT INTO tenancy_message_attachments (message_id, file_path, original_filename, file_type, file_size)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [messageId, file.filename, file.originalname, fileType, file.size], agencyId);

      attachments.push(attachResult.rows[0]);
    }

    // Get the created message with user info
    // Defense-in-depth: explicit agency_id filtering
    const messageResult = await db.query(`
      SELECT tm.*, u.first_name, u.last_name, u.role
      FROM tenancy_messages tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.id = $1 AND tm.tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $2)
    `, [messageId, agencyId], agencyId);

    const message = messageResult.rows[0];

    // Get acting user info for notification
    const actingUserResult = await db.query(`SELECT id, first_name, last_name, email, role FROM users WHERE id = $1`, [userId], agencyId);
    const actingUser = actingUserResult.rows[0];

    // Send notifications (pass isPrivate to skip tenants if private message)
    await sendCommunicationNotifications(tenancyId, actingUser, (content || '').trim(), isPrivate, agencyId);

    res.status(201).json({
      messageId: message.id,
      message: {
        ...message,
        user_name: `${message.first_name} ${message.last_name}`,
        user_role: message.role,
        attachments
      }
    });
  } catch (err) {
    // Clean up any uploaded files on error
    if (req.files) {
      for (const file of req.files) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    }
    handleError(res, err, 'send admin message');
  }
};

/**
 * Delete message (admin only)
 */
exports.deleteMessage = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { messageId } = req.params;

  // Get message to check it exists and get file paths
  // Defense-in-depth: explicit agency_id filtering
  const messageResult = await db.query(`
    SELECT tm.* FROM tenancy_messages tm
    WHERE tm.id = $1 AND tm.tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $2)
  `, [messageId, agencyId], agencyId);
  const message = messageResult.rows[0];
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  // Get attachments to delete files
  // Defense-in-depth: explicit agency_id filtering
  const attachmentsResult = await db.query(`
    SELECT tma.* FROM tenancy_message_attachments tma
    INNER JOIN tenancy_messages tm ON tma.message_id = tm.id
    WHERE tma.message_id = $1 AND tm.tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $2)
  `, [messageId, agencyId], agencyId);
  const attachments = attachmentsResult.rows;

  // Delete attachment files
  for (const attachment of attachments) {
    const filePath = path.join(__dirname, '../../uploads/tenancy-communications', attachment.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // Delete message (explicit agency check via tenancy join for defense-in-depth; cascades to attachments)
  await db.query(
    `DELETE FROM tenancy_messages
     WHERE id = $1
     AND tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $2)`,
    [messageId, agencyId],
    agencyId
  );

  res.json({ message: 'Message deleted' });
}, 'delete message');

/**
 * Delete attachment (admin only)
 */
exports.deleteAttachment = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { attachmentId } = req.params;

  // Get attachment
  // Defense-in-depth: explicit agency_id filtering
  const attachmentResult = await db.query(`
    SELECT tma.* FROM tenancy_message_attachments tma
    INNER JOIN tenancy_messages tm ON tma.message_id = tm.id
    WHERE tma.id = $1 AND tm.tenancy_id IN (SELECT id FROM tenancies WHERE agency_id = $2)
  `, [attachmentId, agencyId], agencyId);
  const attachment = attachmentResult.rows[0];
  if (!attachment) {
    return res.status(404).json({ error: 'Attachment not found' });
  }

  // Delete file
  const filePath = path.join(__dirname, '../../uploads/tenancy-communications', attachment.file_path);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Delete record (explicit agency check via joins for defense-in-depth)
  await db.query(
    `DELETE FROM tenancy_message_attachments
     WHERE id = $1
     AND message_id IN (
       SELECT tm.id FROM tenancy_messages tm
       INNER JOIN tenancies t ON tm.tenancy_id = t.id
       WHERE t.agency_id = $2
     )`,
    [attachmentId, agencyId],
    agencyId
  );

  res.json({ message: 'Attachment deleted' });
}, 'delete attachment');
