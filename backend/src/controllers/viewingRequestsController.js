const db = require('../db');
const { queueEmail } = require('../services/emailService');
const { getReminderRecipient } = require('../services/reminderEmailService');
const { createEmailTemplate, createButton, COLORS, escapeHtml } = require('../utils/emailTemplates');
const { formatDate } = require('../utils/dateFormatter');
const { validateFormSubmission, validateHoneypot } = require('../utils/spamDetection');
const { getAgencyBranding } = require('../services/brandingService');
const asyncHandler = require('../utils/asyncHandler');
const { getFrontendBaseUrl } = require('../utils/urlBuilder');

const formatFullAddress = (row) => {
  return [row.address_line1, row.address_line2, row.city, row.postcode]
    .filter(Boolean)
    .join(', ') || 'Property';
};

/**
 * Generate email notification for new viewing request
 */
const generateNewViewingRequestEmail = (viewingRequest, propertyAddress, recipientEmail, agencySlug) => {
  const frontendUrl = getFrontendBaseUrl();
  const adminUrl = `${frontendUrl}/${agencySlug || ''}/admin?section=viewing-requests`;

  const bodyContent = `
    <h1>New Viewing Request</h1>
    <p style="font-size: 14px; color: ${COLORS.textLight}; margin-bottom: 20px;">Someone just requested a property viewing</p>

    <div style="background-color: #FEF3C7; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #F59E0B;">
      <h2 style="margin: 0 0 15px 0; color: #92400E; font-size: 18px;">Contact Details</h2>
      <p style="margin: 8px 0; color: #78350F;"><strong>Name:</strong> ${escapeHtml(viewingRequest.name)}</p>
      <p style="margin: 8px 0; color: #78350F;"><strong>Email:</strong> <a href="mailto:${escapeHtml(viewingRequest.email)}" style="color: #CF722F; text-decoration: none;">${escapeHtml(viewingRequest.email)}</a></p>
      <p style="margin: 8px 0; color: #78350F;"><strong>Phone:</strong> <a href="tel:${escapeHtml(viewingRequest.phone)}" style="color: #CF722F; text-decoration: none;">${escapeHtml(viewingRequest.phone)}</a></p>
    </div>

    <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Property</h3>
      <p style="margin: 0; font-weight: 600; color: #555;">${escapeHtml(propertyAddress)}</p>
    </div>

    ${viewingRequest.preferred_date ? `
    <div style="background-color: #f0f9ff; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #0284c7;">
      <h3 style="margin: 0 0 10px 0; color: #0c4a6e; font-size: 16px;">Viewing Date & Time</h3>
      <p style="margin: 0; color: #0c4a6e; font-weight: 600;">${formatDate(viewingRequest.preferred_date, 'full')}${viewingRequest.preferred_time ? ` at ${viewingRequest.preferred_time}` : ''}</p>
    </div>
    ` : ''}

    ${viewingRequest.internal_notes ? `
    <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Notes</h3>
      <p style="margin: 0; color: #555; white-space: pre-wrap;">${escapeHtml(viewingRequest.internal_notes)}</p>
    </div>
    ` : ''}

    <div style="margin-top: 25px; padding: 20px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">
        Manage this viewing request in the admin panel:
      </p>
      ${createButton(`${adminUrl}`, 'View All Viewing Requests')}
    </div>

    <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
      This is an automated notification from our property management system.
    </p>
  `;

  const emailHtml = createEmailTemplate('New Viewing Request', bodyContent);

  const textParts = [
    'NEW VIEWING REQUEST',
    '',
    'Someone just requested a property viewing!',
    '',
    'CONTACT DETAILS:',
    `Name: ${viewingRequest.name}`,
    `Email: ${viewingRequest.email}`,
    `Phone: ${viewingRequest.phone}`,
    '',
    `PROPERTY: ${propertyAddress}`,
    ''
  ];

  if (viewingRequest.preferred_date) {
    const timeStr = viewingRequest.preferred_time ? ` at ${viewingRequest.preferred_time}` : '';
    textParts.push(`VIEWING DATE: ${formatDate(viewingRequest.preferred_date, 'full')}${timeStr}`);
    textParts.push('');
  }

  if (viewingRequest.internal_notes) {
    textParts.push('NOTES:');
    textParts.push(viewingRequest.internal_notes);
    textParts.push('');
  }

  textParts.push('---');
  textParts.push(`Manage viewing requests: ${adminUrl}`);

  return {
    to: recipientEmail,
    subject: `New Viewing Request - ${propertyAddress}`,
    html: emailHtml,
    text: textParts.join('\n')
  };
};

/**
 * Generate confirmation email sent to the visitor when an admin creates a viewing request
 */
const generateViewingConfirmationEmail = (viewingRequest, propertyAddress, branding) => {
  const agencyName = branding?.company_name || 'Our Agency';
  const agencyPhone = branding?.phone_number || '';
  const agencyEmail = branding?.email_address || '';

  const contactLines = [];
  if (agencyPhone) contactLines.push(`<p style="margin: 4px 0; color: #555;">Phone: <a href="tel:${escapeHtml(agencyPhone)}" style="color: #CF722F; text-decoration: none;">${escapeHtml(agencyPhone)}</a></p>`);
  if (agencyEmail) contactLines.push(`<p style="margin: 4px 0; color: #555;">Email: <a href="mailto:${escapeHtml(agencyEmail)}" style="color: #CF722F; text-decoration: none;">${escapeHtml(agencyEmail)}</a></p>`);

  const bodyContent = `
    <h1>Viewing Confirmation</h1>
    <p style="font-size: 14px; color: ${COLORS.textLight}; margin-bottom: 20px;">Your viewing request has been confirmed</p>

    <p style="font-size: 14px; color: #333; margin-bottom: 20px;">
      Hi ${escapeHtml(viewingRequest.visitor_name)}, your viewing for the following property has been confirmed.
    </p>

    <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Property</h3>
      <p style="margin: 0; font-weight: 600; color: #555;">${escapeHtml(propertyAddress)}</p>
    </div>

    ${viewingRequest.preferred_date ? `
    <div style="background-color: #f0f9ff; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #0284c7;">
      <h3 style="margin: 0 0 10px 0; color: #0c4a6e; font-size: 16px;">Viewing Date & Time</h3>
      <p style="margin: 0; color: #0c4a6e; font-weight: 600;">${formatDate(viewingRequest.preferred_date, 'full')}${viewingRequest.preferred_time ? ` at ${viewingRequest.preferred_time}` : ''}</p>
    </div>
    ` : ''}

    ${contactLines.length > 0 ? `
    <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Contact Us</h3>
      <p style="margin: 0 0 5px 0; font-weight: 600; color: #555;">${escapeHtml(agencyName)}</p>
      ${contactLines.join('\n      ')}
    </div>
    ` : ''}

    <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
      This is an automated confirmation from ${escapeHtml(agencyName)}.
    </p>
  `;

  const emailHtml = createEmailTemplate('Viewing Confirmation', bodyContent);

  const textParts = [
    'VIEWING CONFIRMATION',
    '',
    `Hi ${viewingRequest.visitor_name}, your viewing for the following property has been confirmed.`,
    '',
    `PROPERTY: ${propertyAddress}`,
    ''
  ];

  if (viewingRequest.preferred_date) {
    const timeStr = viewingRequest.preferred_time ? ` at ${viewingRequest.preferred_time}` : '';
    textParts.push(`VIEWING DATE: ${formatDate(viewingRequest.preferred_date, 'full')}${timeStr}`);
    textParts.push('');
  }

  if (agencyPhone || agencyEmail) {
    textParts.push('CONTACT US:');
    textParts.push(agencyName);
    if (agencyPhone) textParts.push(`Phone: ${agencyPhone}`);
    if (agencyEmail) textParts.push(`Email: ${agencyEmail}`);
    textParts.push('');
  }

  return {
    to: viewingRequest.visitor_email,
    subject: `Viewing Confirmation - ${propertyAddress}`,
    html: emailHtml,
    text: textParts.join('\n')
  };
};

// Create viewing request (admin - no rate limiting, no spam checks)
exports.createViewingRequestAdmin = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { property_id, visitor_name, visitor_email, visitor_phone, internal_notes, preferred_date, preferred_time } = req.body;

  // Validate required fields
  if (!property_id || !visitor_name || !visitor_email) {
    return res.status(400).json({ error: 'Property, visitor name, and visitor email are required' });
  }

  // Look up property (with agency_id filter)
  const propertyResult = await db.query(
    'SELECT id, address_line1, address_line2, city, postcode FROM properties WHERE agency_id = $1 AND id = $2',
    [agencyId, property_id],
    agencyId
  );
  const property = propertyResult.rows[0];

  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }

  // Insert with status = 'confirmed' (admin-created = pre-confirmed)
  const result = await db.query(
    `INSERT INTO viewing_requests (agency_id, property_id, visitor_name, visitor_email, visitor_phone, internal_notes, preferred_date, preferred_time, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed')
     RETURNING *`,
    [agencyId, property_id, visitor_name, visitor_email, visitor_phone || null, internal_notes || null, preferred_date || null, preferred_time || null],
    agencyId
  );

  const insertedRow = result.rows[0];

  // Send confirmation email to the visitor
  try {
    const branding = await getAgencyBranding(agencyId);

    const viewingData = {
      visitor_name,
      visitor_email,
      preferred_date,
      preferred_time
    };

    const fullAddress = formatFullAddress(property);
    const emailContent = generateViewingConfirmationEmail(
      viewingData,
      fullAddress,
      branding
    );

    await queueEmail({
      to_email: emailContent.to,
      subject: emailContent.subject,
      html_body: emailContent.html,
      text_body: emailContent.text,
      priority: 2
    }, agencyId);

    console.log(`Queued viewing confirmation email for ${fullAddress}`);
  } catch (emailError) {
    console.error('Error queuing viewing confirmation email:', emailError);
  }

  res.status(201).json({ message: 'Viewing request created successfully', id: insertedRow.id });
}, 'create viewing request (admin)');

// Create viewing request
exports.createViewingRequest = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { property_id, name, email, phone, message: internal_notes, preferred_date, preferred_time, website } = req.body;

  // Honeypot check - 'website' field should be empty (hidden from real users)
  if (!validateHoneypot(website)) {
    // Silently reject but return success to not tip off bots
    console.log(`Honeypot triggered - rejecting viewing request from ${req.ip}`);
    return res.status(201).json({
      message: 'Viewing request submitted successfully',
      id: 0
    });
  }

  // Spam/injection detection
  const validation = validateFormSubmission({ name, email, phone, message: internal_notes });
  if (!validation.isValid) {
    console.log(`Spam detected in viewing request from ${req.ip}: ${validation.reason}`);
    return res.status(400).json({ error: validation.reason });
  }

  // Validation
  if (!property_id || !name || !email || !phone) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  // Check if property exists and get address
  const propertyResult = await db.query(
    'SELECT id, address_line1, address_line2, city, postcode FROM properties WHERE id = $1',
    [property_id],
    agencyId
  );
  const property = propertyResult.rows[0];

  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }

  // Validate preferred date against minimum days setting
  if (preferred_date) {
    const minDaysResult = await db.query(
      "SELECT setting_value FROM site_settings WHERE setting_key = $1",
      ['viewing_min_days_advance'],
      agencyId
    );
    const minDaysSetting = minDaysResult.rows[0];
    const minDays = minDaysSetting ? parseInt(minDaysSetting.setting_value, 10) : 2;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() + minDays);

    const requestedDate = new Date(preferred_date);
    requestedDate.setHours(0, 0, 0, 0);

    if (requestedDate < minDate) {
      return res.status(400).json({ error: `Viewings must be booked at least ${minDays} day${minDays !== 1 ? 's' : ''} in advance` });
    }
  }

  // Insert viewing request
  const result = await db.query(
    `INSERT INTO viewing_requests (agency_id, property_id, visitor_name, visitor_email, visitor_phone, internal_notes, preferred_date, preferred_time, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
     RETURNING *`,
    [agencyId, property_id, name, email, phone, internal_notes || null, preferred_date || null, preferred_time || null],
    agencyId
  );

  const insertedRow = result.rows[0];

  // Queue immediate email notification (don't block on email failure)
  try {
    const recipientEmail = getReminderRecipient();
    if (recipientEmail) {
      const viewingRequestData = {
        name,
        email,
        phone,
        internal_notes,
        preferred_date,
        preferred_time
      };

      const fullAddress = formatFullAddress(property);
      const emailContent = generateNewViewingRequestEmail(
        viewingRequestData,
        fullAddress,
        recipientEmail,
        req.agency?.slug
      );

      queueEmail({
        to_email: emailContent.to,
        subject: emailContent.subject,
        html_body: emailContent.html,
        text_body: emailContent.text,
        priority: 2 // High priority (1 = critical, 2 = high, 3 = medium, 5 = low)
      }, agencyId);

      console.log(`Queued new viewing request notification email for ${fullAddress}`);
    } else {
      console.log('No recipient email configured - skipping viewing request notification');
    }
  } catch (emailError) {
    // Log but don't fail the request if email fails
    console.error('Error queuing viewing request notification email:', emailError);
  }

  res.status(201).json({ message: 'Viewing request submitted successfully', id: insertedRow.id });
}, 'create viewing request');

// Get all viewing requests (admin only)
exports.getAllViewingRequests = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    `SELECT vr.*, p.address_line1
     FROM viewing_requests vr
     LEFT JOIN properties p ON vr.property_id = p.id
     WHERE vr.agency_id = $1
     ORDER BY vr.created_at DESC`,
    [agencyId],
    agencyId
  );

  res.json({ requests: result.rows });
}, 'fetch viewing requests');

// Get pending viewing requests count (admin only)
exports.getPendingCount = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    `SELECT COUNT(*) as count
     FROM viewing_requests
     WHERE status = 'pending' AND agency_id = $1`,
    [agencyId],
    agencyId
  );

  res.json({ count: parseInt(result.rows[0].count, 10) });
}, 'fetch pending count');

// Update viewing request status (admin only)
exports.updateViewingRequestStatus = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  // Fetch full viewing request (need previous status + visitor details for email)
  const requestResult = await db.query(
    `SELECT vr.*, p.address_line1, p.address_line2, p.city, p.postcode
     FROM viewing_requests vr
     LEFT JOIN properties p ON vr.property_id = p.id
     WHERE vr.id = $1 AND vr.agency_id = $2`,
    [id, agencyId],
    agencyId
  );

  if (requestResult.rows.length === 0) {
    return res.status(404).json({ error: 'Viewing request not found' });
  }

  const viewingRequest = requestResult.rows[0];

  // Defense-in-depth: explicit agency_id filtering
  // Update the status
  await db.query(
    'UPDATE viewing_requests SET status = $1 WHERE id = $2 AND agency_id = $3',
    [status, id, agencyId],
    agencyId
  );

  // Send confirmation email when moving to 'confirmed'
  if (status === 'confirmed' && viewingRequest.status !== 'confirmed' && viewingRequest.visitor_email) {
    try {
      const branding = await getAgencyBranding(agencyId);

      const fullAddress = formatFullAddress(viewingRequest);
      const emailContent = generateViewingConfirmationEmail(
        viewingRequest,
        fullAddress,
        branding
      );

      await queueEmail({
        to_email: emailContent.to,
        subject: emailContent.subject,
        html_body: emailContent.html,
        text_body: emailContent.text,
        priority: 2
      }, agencyId);

      console.log(`Queued viewing confirmation email to ${viewingRequest.visitor_email}`);
    } catch (emailError) {
      console.error('Error queuing viewing confirmation email:', emailError);
    }
  }

  res.json({ message: 'Status updated successfully' });
}, 'update viewing request');

// Update viewing request date and time
exports.updateViewingDate = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  const { preferred_date, preferred_time } = req.body;

  // Check if viewing request exists
  const requestResult = await db.query(
    'SELECT id FROM viewing_requests WHERE id = $1',
    [id],
    agencyId
  );

  if (requestResult.rows.length === 0) {
    return res.status(404).json({ error: 'Viewing request not found' });
  }

  // Defense-in-depth: explicit agency_id filtering
  // Update the date and time (can be null/empty to clear them)
  await db.query(
    'UPDATE viewing_requests SET preferred_date = $1, preferred_time = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND agency_id = $4',
    [preferred_date || null, preferred_time || null, id, agencyId],
    agencyId
  );

  res.json({ message: 'Viewing date and time updated successfully' });
}, 'update viewing date');

// Update viewing request internal notes (admin only)
exports.updateViewingNotes = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  const { internal_notes } = req.body;

  const requestResult = await db.query(
    'SELECT id FROM viewing_requests WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );

  if (requestResult.rows.length === 0) {
    return res.status(404).json({ error: 'Viewing request not found' });
  }

  await db.query(
    'UPDATE viewing_requests SET internal_notes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND agency_id = $3',
    [internal_notes || null, id, agencyId],
    agencyId
  );

  res.json({ message: 'Internal notes updated successfully' });
}, 'update viewing notes');

// Get viewing requests by date range (for calendar view)
exports.getViewingsByDateRange = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { start_date, end_date } = req.query;

  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date are required' });
  }

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    `SELECT vr.*, p.address_line1
     FROM viewing_requests vr
     LEFT JOIN properties p ON vr.property_id = p.id
     WHERE vr.preferred_date >= $1 AND vr.preferred_date <= $2
     AND vr.status NOT IN ('cancelled')
     AND vr.agency_id = $3
     ORDER BY vr.preferred_date, vr.preferred_time`,
    [start_date, end_date, agencyId],
    agencyId
  );

  res.json({ requests: result.rows });
}, 'fetch viewings by date range');

// Delete a single viewing request (admin only)
exports.deleteViewingRequest = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  const requestResult = await db.query(
    'SELECT id FROM viewing_requests WHERE id = $1',
    [id],
    agencyId
  );

  if (requestResult.rows.length === 0) {
    return res.status(404).json({ error: 'Viewing request not found' });
  }

  await db.query(
    'DELETE FROM viewing_requests WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );

  res.json({ message: 'Viewing request deleted successfully' });
}, 'delete viewing request');

// Bulk delete viewing requests (admin only)
exports.bulkDeleteViewingRequests = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }

  const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
  const result = await db.query(
    `DELETE FROM viewing_requests WHERE id IN (${placeholders}) AND agency_id = $${ids.length + 1}`,
    [...ids, agencyId],
    agencyId
  );

  res.json({ message: `${result.rowCount} viewing request(s) deleted successfully`, deleted: result.rowCount });
}, 'delete viewing requests');
