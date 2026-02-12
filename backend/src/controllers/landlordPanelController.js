const db = require('../db');
const statementService = require('../services/statementService');
const PDFDocument = require('pdfkit');
const path = require('path');
const { getAgencyBranding } = require('../services/brandingService');
const handleError = require('../utils/handleError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get landlord info - uses req.landlord from attachLandlord middleware
 */
exports.getLandlordInfo = asyncHandler(async (req, res) => {
  // req.landlord is attached by attachLandlord middleware
  res.json({ landlord: req.landlord });
}, 'fetch landlord information');

/**
 * Get all active tenancies for landlord's properties
 */
exports.getLandlordTenancies = asyncHandler(async (req, res) => {
  const landlordId = req.landlord.id;
  const agencyId = req.agencyId;

  // Get all active tenancies for this landlord's properties
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(`
    SELECT
      t.id,
      t.start_date,
      t.end_date,
      t.status,
      t.tenancy_type,
      p.address_line1,
      p.address_line2,
      p.city,
      p.postcode,
      p.location as property_location,
      COUNT(DISTINCT tm.id) as tenant_count
    FROM tenancies t
    JOIN properties p ON t.property_id = p.id
    LEFT JOIN tenancy_members tm ON t.id = tm.tenancy_id
    WHERE p.landlord_id = $1 AND t.status = 'active' AND p.agency_id = $2
    GROUP BY t.id, t.start_date, t.end_date, t.status, t.tenancy_type,
             p.address_line1, p.address_line2, p.city, p.postcode, p.location
    ORDER BY t.start_date DESC
  `, [landlordId, agencyId], agencyId);

  res.json({ tenancies: result.rows });
}, 'fetch tenancies');

/**
 * Get payment schedules for landlord's properties
 */
exports.getPaymentSchedules = asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  const landlordId = req.landlord.id;
  const agencyId = req.agencyId;

  // Get all payment schedules for this landlord's properties
  // Defense-in-depth: explicit agency_id filtering
  let query = `
    SELECT
      ps.*,
      tm.first_name || ' ' || tm.surname as tenant_name,
      t.id as tenancy_id,
      p.address_line1 as property_address,
      t.status as tenancy_status,
      COALESCE(SUM(pay.amount), 0) as amount_paid
    FROM payment_schedules ps
    INNER JOIN tenancy_members tm ON ps.tenancy_member_id = tm.id
    INNER JOIN tenancies t ON ps.tenancy_id = t.id
    INNER JOIN properties p ON t.property_id = p.id
    LEFT JOIN payments pay ON ps.id = pay.payment_schedule_id
    WHERE p.landlord_id = $1 AND p.agency_id = $2
  `;

  const params = [landlordId, agencyId];
  let paramIndex = 3;

  // Filter by year and month if provided
  if (year && month) {
    query += ` AND EXTRACT(YEAR FROM ps.due_date) = $${paramIndex} AND EXTRACT(MONTH FROM ps.due_date) = $${paramIndex + 1}`;
    params.push(parseInt(year), parseInt(month));
    paramIndex += 2;
  }

  query += ` GROUP BY ps.id, tm.first_name, tm.surname, t.id, p.address_line1, t.status ORDER BY ps.due_date ASC`;

  const result = await db.query(query, params, agencyId);
  const schedules = result.rows;

  // Calculate summary statistics
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let overdueCount = 0;
  let overdueAmount = 0;
  let overduePreviousMonths = 0;

  const currentMonth = year && month ? parseInt(month) : today.getMonth() + 1;
  const currentYear = year && month ? parseInt(year) : today.getFullYear();

  schedules.forEach(schedule => {
    const dueDate = new Date(schedule.due_date);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate < today && schedule.status !== 'paid') {
      overdueCount++;
      overdueAmount += (schedule.amount_due - schedule.amount_paid);

      // Check if it's from previous months
      const scheduleMonth = dueDate.getMonth() + 1;
      const scheduleYear = dueDate.getFullYear();

      if (scheduleYear < currentYear || (scheduleYear === currentYear && scheduleMonth < currentMonth)) {
        overduePreviousMonths++;
      }
    }
  });

  res.json({
    schedules,
    summary: {
      overdue: overdueCount,
      overduePreviousMonths,
      overdueAmount
    }
  });
}, 'fetch payment schedules');

/**
 * Get tenancy details with tenant information
 */
exports.getTenancyDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const landlordId = req.landlord.id;
  const agencyId = req.agencyId;

  // Get tenancy details
  // Defense-in-depth: explicit agency_id filtering
  const tenancyResult = await db.query(`
    SELECT
      t.*,
      p.address_line1,
      p.address_line2,
      p.city,
      p.postcode,
      p.location as property_location
    FROM tenancies t
    JOIN properties p ON t.property_id = p.id
    WHERE t.id = $1 AND p.landlord_id = $2 AND p.agency_id = $3
  `, [id, landlordId, agencyId], agencyId);

  const tenancy = tenancyResult.rows[0];

  if (!tenancy) {
    return res.status(404).json({ error: 'Tenancy or you do not have access not found' });
  }

  // Get tenant members with payment info
  // Defense-in-depth: explicit agency_id filtering
  const membersResult = await db.query(`
    SELECT
      tm.id,
      tm.first_name,
      tm.surname,
      tm.rent_pppw,
      tm.deposit_amount,
      tm.payment_option,
      u.email,
      u.phone,
      b.bedroom_name
    FROM tenancy_members tm
    JOIN users u ON tm.user_id = u.id
    LEFT JOIN bedrooms b ON tm.bedroom_id = b.id
    WHERE tm.tenancy_id = $1 AND tm.agency_id = $2
    ORDER BY tm.first_name ASC
  `, [id, agencyId], agencyId);

  const members = membersResult.rows;

  // Get payment schedules for each member
  // Defense-in-depth: explicit agency_id filtering
  const membersWithPayments = await Promise.all(members.map(async member => {
    const paymentSchedulesResult = await db.query(`
      SELECT
        ps.id,
        ps.due_date,
        ps.amount_due,
        ps.status,
        ps.payment_type,
        ps.description,
        COALESCE(SUM(p.amount), 0) as amount_paid
      FROM payment_schedules ps
      LEFT JOIN payments p ON ps.id = p.payment_schedule_id
      WHERE ps.tenancy_member_id = $1 AND ps.agency_id = $2
      GROUP BY ps.id, ps.due_date, ps.amount_due, ps.status, ps.payment_type, ps.description
      ORDER BY ps.due_date ASC
    `, [member.id, agencyId], agencyId);

    return {
      ...member,
      payment_schedules: paymentSchedulesResult.rows
    };
  }));

  res.json({
    tenancy,
    members: membersWithPayments
  });
}, 'fetch tenancy details');

/**
 * Helper function to get attachments for a comment
 */
async function getCommentAttachments(commentId, agencyId) {
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(`
    SELECT id, comment_id, file_path, original_filename, file_type, file_size, created_at
    FROM maintenance_attachments
    WHERE comment_id = $1 AND agency_id = $2
    ORDER BY created_at ASC
  `, [commentId, agencyId], agencyId);
  return result.rows;
}

/**
 * Helper function to get comments with attachments
 * Landlords can see ALL comments including private ones
 */
async function getCommentsWithAttachments(requestId, agencyId) {
  // Landlords can see all comments including private (is_private = true)
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(`
    SELECT
      mc.*,
      u.first_name,
      u.last_name,
      u.role
    FROM maintenance_comments mc
    JOIN users u ON mc.user_id = u.id
    WHERE mc.request_id = $1 AND mc.agency_id = $2
    ORDER BY mc.created_at ASC
  `, [requestId, agencyId], agencyId);

  const comments = result.rows;

  const commentsWithAttachments = await Promise.all(comments.map(async comment => ({
    ...comment,
    user_name: `${comment.first_name} ${comment.last_name}`,
    user_role: comment.role,
    attachments: await getCommentAttachments(comment.id, agencyId)
  })));

  return commentsWithAttachments;
}

/**
 * Helper function to count attachments for a request
 */
async function countRequestAttachments(requestId, agencyId) {
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(`
    SELECT COUNT(*) as count
    FROM maintenance_attachments mca
    JOIN maintenance_comments mc ON mca.comment_id = mc.id
    WHERE mc.request_id = $1 AND mca.agency_id = $2
  `, [requestId, agencyId], agencyId);
  return result.rows[0] ? parseInt(result.rows[0].count) : 0;
}

/**
 * Get all maintenance requests for landlord's properties
 */
exports.getMaintenanceRequests = asyncHandler(async (req, res) => {
  const landlordId = req.landlord.id;
  const agencyId = req.agencyId;
  const { status, tenancy_id } = req.query;

  // Defense-in-depth: explicit agency_id filtering
  let query = `
    SELECT
      mr.id,
      mr.tenancy_id,
      mr.title,
      mr.description,
      mr.category,
      mr.priority,
      mr.status,
      mr.created_at,
      mr.updated_at,
      p.address_line1,
      p.address_line2,
      p.city,
      p.postcode,
      u.first_name as created_by_first_name,
      u.last_name as created_by_last_name,
      (SELECT COUNT(*) FROM maintenance_comments WHERE request_id = mr.id AND comment_type = 'comment') as comment_count
    FROM maintenance_requests mr
    JOIN tenancies t ON mr.tenancy_id = t.id
    JOIN properties p ON t.property_id = p.id
    JOIN users u ON mr.created_by_user_id = u.id
    WHERE p.landlord_id = $1 AND p.agency_id = $2
  `;

  const params = [landlordId, agencyId];
  let paramIndex = 3;

  if (status && status !== 'all') {
    query += ` AND mr.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (tenancy_id) {
    query += ` AND mr.tenancy_id = $${paramIndex}`;
    params.push(tenancy_id);
    paramIndex++;
  }

  query += ` ORDER BY mr.created_at DESC`;

  const result = await db.query(query, params, agencyId);
  const requests = result.rows;

  // Add attachment counts
  const requestsWithAttachments = await Promise.all(requests.map(async req => ({
    ...req,
    attachment_count: await countRequestAttachments(req.id, agencyId)
  })));

  // Get summary counts
  // Defense-in-depth: explicit agency_id filtering
  const summaryResult = await db.query(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN mr.status = 'submitted' THEN 1 ELSE 0 END) as submitted,
      SUM(CASE WHEN mr.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN mr.status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN mr.priority = 'high' AND mr.status != 'completed' THEN 1 ELSE 0 END) as high_priority
    FROM maintenance_requests mr
    JOIN tenancies t ON mr.tenancy_id = t.id
    JOIN properties p ON t.property_id = p.id
    WHERE p.landlord_id = $1 AND p.agency_id = $2
  `, [landlordId, agencyId], agencyId);

  const summary = summaryResult.rows[0];

  res.json({ requests: requestsWithAttachments, summary });
}, 'fetch maintenance requests');

/**
 * Get maintenance request details for landlord
 */
exports.getMaintenanceRequestById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const landlordId = req.landlord.id;
  const agencyId = req.agencyId;

  // Get request with property verification
  // Defense-in-depth: explicit agency_id filtering
  const requestResult = await db.query(`
    SELECT
      mr.*,
      p.address_line1,
      p.address_line2,
      p.city,
      p.postcode,
      p.location as property_location,
      u.first_name as created_by_first_name,
      u.last_name as created_by_last_name,
      u.email as created_by_email
    FROM maintenance_requests mr
    JOIN tenancies t ON mr.tenancy_id = t.id
    JOIN properties p ON t.property_id = p.id
    JOIN users u ON mr.created_by_user_id = u.id
    WHERE mr.id = $1 AND p.landlord_id = $2 AND p.agency_id = $3
  `, [id, landlordId, agencyId], agencyId);

  const request = requestResult.rows[0];

  if (!request) {
    return res.status(404).json({ error: 'Maintenance request or you do not have access not found' });
  }

  // Get comments with attachments (landlords can see all including private)
  const comments = await getCommentsWithAttachments(id, agencyId);

  // Landlords always have has_landlord = true (they ARE the landlord)
  res.json({ request, comments, has_landlord: true });
}, 'fetch maintenance request');

/**
 * Add comment to maintenance request (landlord) with optional file attachments
 */
exports.addMaintenanceComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, is_private } = req.body;
  const userId = req.user.id;
  const landlordId = req.landlord.id;
  const agencyId = req.agencyId;
  const files = req.files || [];

  // Handle is_private parameter (normalize to boolean)
  const isPrivate = is_private === true || is_private === 'true' || is_private === 1 || is_private === '1';

  // Must have either content or files
  if ((!content || !content.trim()) && files.length === 0) {
    return res.status(400).json({ error: 'Message content or attachments are required' });
  }

  // Verify landlord has access to this request
  // Defense-in-depth: explicit agency_id filtering
  const requestResult = await db.query(`
    SELECT mr.id
    FROM maintenance_requests mr
    JOIN tenancies t ON mr.tenancy_id = t.id
    JOIN properties p ON t.property_id = p.id
    WHERE mr.id = $1 AND p.landlord_id = $2 AND p.agency_id = $3
  `, [id, landlordId, agencyId], agencyId);

  if (requestResult.rows.length === 0) {
    return res.status(404).json({ error: 'Maintenance request or you do not have access not found' });
  }

  // Add comment with is_private flag
  const commentResult = await db.query(`
    INSERT INTO maintenance_comments (agency_id, request_id, user_id, comment_type, content, is_private)
    VALUES ($1, $2, $3, 'comment', $4, $5)
    RETURNING *
  `, [agencyId, id, userId, content ? content.trim() : null, isPrivate], agencyId);

  const commentId = commentResult.rows[0].id;

  // Add attachments if any files were uploaded
  if (files.length > 0) {
    for (const file of files) {
      const fileType = file.mimetype.startsWith('image/') ? 'image' : 'document';
      await db.query(`
        INSERT INTO maintenance_attachments (agency_id, comment_id, file_path, original_filename, file_type, file_size)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        agencyId,
        commentId,
        `uploads/maintenance/${file.filename}`,
        file.originalname,
        fileType,
        file.size
      ], agencyId);
    }
  }

  // Update request updated_at
  // Defense-in-depth: explicit agency_id filtering
  await db.query('UPDATE maintenance_requests SET updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND agency_id = $2 RETURNING *', [id, agencyId], agencyId);

  res.status(201).json({
    message: 'Comment added successfully',
    commentId: commentId
  });
}, 'add comment');

/**
 * Update maintenance request status/priority (landlord)
 */
exports.updateMaintenanceRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, priority } = req.body;
  const userId = req.user.id;
  const landlordId = req.landlord.id;
  const agencyId = req.agencyId;

  // Validate status
  const validStatuses = ['submitted', 'in_progress', 'completed'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  // Validate priority
  const validPriorities = ['low', 'medium', 'high'];
  if (priority && !validPriorities.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority value' });
  }

  // Verify landlord has access to this request and get current values
  // Defense-in-depth: explicit agency_id filtering
  const requestResult = await db.query(`
    SELECT mr.*
    FROM maintenance_requests mr
    JOIN tenancies t ON mr.tenancy_id = t.id
    JOIN properties p ON t.property_id = p.id
    WHERE mr.id = $1 AND p.landlord_id = $2 AND p.agency_id = $3
  `, [id, landlordId, agencyId], agencyId);

  const request = requestResult.rows[0];

  if (!request) {
    return res.status(404).json({ error: 'Maintenance request or you do not have access not found' });
  }

  // Update status if provided and changed
  if (status && status !== request.status) {
    // Update the request
    // Defense-in-depth: explicit agency_id filtering
    await db.query('UPDATE maintenance_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND agency_id = $3 RETURNING *',
      [status, id, agencyId], agencyId);

    // Log status change as a comment
    await db.query(`
      INSERT INTO maintenance_comments (agency_id, request_id, user_id, comment_type, old_value, new_value)
      VALUES ($1, $2, $3, 'status_change', $4, $5)
      RETURNING *
    `, [agencyId, id, userId, request.status, status], agencyId);
  }

  // Update priority if provided and changed
  if (priority && priority !== request.priority) {
    // Update the request
    // Defense-in-depth: explicit agency_id filtering
    await db.query('UPDATE maintenance_requests SET priority = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND agency_id = $3 RETURNING *',
      [priority, id, agencyId], agencyId);

    // Log priority change as a comment
    await db.query(`
      INSERT INTO maintenance_comments (agency_id, request_id, user_id, comment_type, old_value, new_value)
      VALUES ($1, $2, $3, 'priority_change', $4, $5)
      RETURNING *
    `, [agencyId, id, userId, request.priority, priority], agencyId);
  }

  res.json({ message: 'Maintenance request updated successfully' });
}, 'update maintenance request');

// ============================================
// Statement & Reports Endpoints
// ============================================

/**
 * Get available statement periods for landlord
 */
exports.getStatementPeriods = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const periods = await statementService.getAvailablePeriods(req.landlord.id, agencyId);
  res.json({ periods });
}, 'fetch statement periods');

/**
 * Get monthly statement data
 */
exports.getMonthlyStatement = asyncHandler(async (req, res) => {
  const { year, month } = req.params;
  const landlord = req.landlord;
  const agencyId = req.agencyId;

  if (!year || !month) {
    return res.status(400).json({ error: 'Year and month are required' });
  }

  const statement = await statementService.generateMonthlyStatement(landlord.id, year, month, agencyId);
  res.json({ statement, landlord: { name: landlord.name, legal_name: landlord.legal_name } });
}, 'generate monthly statement');

/**
 * Get annual summary
 */
exports.getAnnualSummary = asyncHandler(async (req, res) => {
  const { year } = req.params;
  const landlord = req.landlord;
  const agencyId = req.agencyId;

  if (!year) {
    return res.status(400).json({ error: 'Year is required' });
  }

  const summary = await statementService.generateAnnualSummary(landlord.id, year, agencyId);
  res.json({ summary, landlord: { name: landlord.name, legal_name: landlord.legal_name } });
}, 'generate annual summary');

/**
 * Generate PDF statement for a month
 */
exports.downloadMonthlyStatementPDF = async (req, res) => {
  try {
    const { year, month } = req.params;
    const landlord = req.landlord;
    const agencyId = req.agencyId;

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const statement = await statementService.generateMonthlyStatement(landlord.id, year, month, agencyId);

    // Get branding
    const branding = await getAgencyBranding(agencyId);
    const brandName = branding.companyName || 'Letably';
    const brandColor = branding.primaryColor || '#CF722F';

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    // Set response headers
    const filename = `Statement-${year}-${month.toString().padStart(2, '0')}-${landlord.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Helper function for formatting currency
    const formatCurrency = (amount) => `£${amount.toFixed(2)}`;

    // Header
    doc.fontSize(20).fillColor(brandColor).text(brandName, { align: 'center' });
    doc.fontSize(10).fillColor('#666666').text('Landlord Statement', { align: 'center' });
    doc.moveDown(0.5);

    // Statement period
    doc.fontSize(14).fillColor('#333333')
      .text(`${statement.period.monthName} ${statement.period.year}`, { align: 'center' });
    doc.moveDown(1);

    // Landlord info box
    doc.rect(50, doc.y, 495, 60).fill('#f5f5f5');
    const landlordBoxY = doc.y + 10;
    doc.fillColor('#333333').fontSize(10);
    doc.text(`Landlord: ${landlord.legal_name || landlord.name}`, 60, landlordBoxY);
    if (landlord.email) {
      doc.text(`Email: ${landlord.email}`, 60, landlordBoxY + 15);
    }
    doc.text(`Statement Date: ${new Date().toLocaleDateString('en-GB')}`, 350, landlordBoxY);
    doc.text(`Reference: ${year}${month.toString().padStart(2, '0')}-${landlord.id}`, 350, landlordBoxY + 15);
    doc.y = landlordBoxY + 50;
    doc.moveDown(1);

    // Summary section
    doc.fontSize(12).fillColor(brandColor).text('Summary', { underline: true });
    doc.moveDown(0.5);

    // Summary table
    const summaryData = [
      ['Total Rent Due', formatCurrency(statement.summary.totalDue)],
      ['Total Collected', formatCurrency(statement.summary.totalPaid)],
      ['Outstanding', formatCurrency(statement.summary.totalOutstanding)]
    ];

    let summaryY = doc.y;
    doc.fontSize(10).fillColor('#333333');
    summaryData.forEach(([label, value], i) => {
      doc.text(label, 60, summaryY + (i * 18));
      doc.text(value, 200, summaryY + (i * 18), { width: 100, align: 'right' });
    });

    // Collection stats on right side
    doc.text('Payments:', 350, summaryY);
    doc.text(`${statement.summary.paidCount} of ${statement.summary.paymentCount} collected`, 420, summaryY);
    if (statement.summary.overdueCount > 0) {
      doc.fillColor('#dc2626').text(`${statement.summary.overdueCount} overdue`, 350, summaryY + 18);
      doc.fillColor('#333333');
    }

    doc.y = summaryY + 70;
    doc.moveDown(1);

    // Property breakdown
    if (statement.properties.length > 0) {
      doc.fontSize(12).fillColor(brandColor).text('Property Breakdown', { underline: true });
      doc.moveDown(0.5);

      statement.properties.forEach((property, propIndex) => {
        // Check if we need a new page
        if (doc.y > 700) {
          doc.addPage();
        }

        // Property header
        doc.fontSize(11).fillColor('#333333').text(property.address, { continued: false });
        doc.fontSize(9).fillColor('#666666')
          .text(`Due: ${formatCurrency(property.totalDue)} | Collected: ${formatCurrency(property.totalPaid)}`);
        doc.moveDown(0.3);

        // Payment table header
        const tableTop = doc.y;
        const col1 = 60;   // Date
        const col2 = 130;  // Tenant
        const col3 = 280;  // Description
        const col4 = 380;  // Due
        const col5 = 440;  // Paid
        const col6 = 500;  // Status

        doc.fontSize(8).fillColor('#666666');
        doc.text('Date', col1, tableTop);
        doc.text('Tenant', col2, tableTop);
        doc.text('Description', col3, tableTop);
        doc.text('Due', col4, tableTop);
        doc.text('Paid', col5, tableTop);
        doc.text('Status', col6, tableTop);

        doc.moveTo(50, tableTop + 12).lineTo(545, tableTop + 12).stroke('#dddddd');

        let rowY = tableTop + 18;
        doc.fontSize(8).fillColor('#333333');

        property.payments.forEach(payment => {
          if (rowY > 750) {
            doc.addPage();
            rowY = 50;
          }

          const dueDate = new Date(payment.due_date).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short'
          });

          doc.text(dueDate, col1, rowY);
          doc.text(payment.tenant_name.substring(0, 20), col2, rowY);
          doc.text((payment.bedroom_name || payment.payment_type || 'Rent').substring(0, 15), col3, rowY);
          doc.text(formatCurrency(payment.amount_due), col4, rowY);
          doc.text(formatCurrency(payment.amount_paid), col5, rowY);

          // Status with color
          const statusColors = {
            paid: '#16a34a',
            pending: '#ca8a04',
            overdue: '#dc2626',
            partial: brandColor
          };
          doc.fillColor(statusColors[payment.status] || '#666666')
            .text(payment.status.charAt(0).toUpperCase() + payment.status.slice(1), col6, rowY);
          doc.fillColor('#333333');

          rowY += 14;
        });

        doc.y = rowY + 10;
        doc.moveDown(0.5);
      });
    }

    // Footer
    doc.fontSize(8).fillColor('#999999');
    const footerY = doc.page.height - 40;
    doc.text(
      `Generated by ${brandName} on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`,
      50, footerY, { align: 'center', width: 495 }
    );

    doc.end();
  } catch (err) {
    console.error('Generate PDF statement error:', err);
    if (!res.headersSent) {
      handleError(res, err, 'generate PDF statement');
    }
  }
};

/**
 * Generate PDF annual summary
 */
exports.downloadAnnualStatementPDF = async (req, res) => {
  try {
    const { year } = req.params;
    const landlord = req.landlord;
    const agencyId = req.agencyId;

    if (!year) {
      return res.status(400).json({ error: 'Year is required' });
    }

    const summary = await statementService.generateAnnualSummary(landlord.id, year, agencyId);

    // Get branding
    const branding = await getAgencyBranding(agencyId);
    const brandName = branding.companyName || 'Letably';
    const brandColor = branding.primaryColor || '#CF722F';

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    // Set response headers
    const filename = `Annual-Statement-${year}-${landlord.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Helper function for formatting currency
    const formatCurrency = (amount) => `£${amount.toFixed(2)}`;

    // Header
    doc.fontSize(20).fillColor(brandColor).text(brandName, { align: 'center' });
    doc.fontSize(10).fillColor('#666666').text('Annual Landlord Statement', { align: 'center' });
    doc.moveDown(0.5);

    // Year
    doc.fontSize(16).fillColor('#333333').text(`${year} Annual Summary`, { align: 'center' });
    doc.moveDown(1);

    // Landlord info box
    doc.rect(50, doc.y, 495, 60).fill('#f5f5f5');
    const landlordBoxY = doc.y + 10;
    doc.fillColor('#333333').fontSize(10);
    doc.text(`Landlord: ${landlord.legal_name || landlord.name}`, 60, landlordBoxY);
    if (landlord.email) {
      doc.text(`Email: ${landlord.email}`, 60, landlordBoxY + 15);
    }
    doc.text(`Statement Date: ${new Date().toLocaleDateString('en-GB')}`, 350, landlordBoxY);
    doc.text(`Reference: ${year}-ANNUAL-${landlord.id}`, 350, landlordBoxY + 15);
    doc.y = landlordBoxY + 50;
    doc.moveDown(1);

    // Annual Summary Section
    doc.fontSize(12).fillColor(brandColor).text('Annual Totals', { underline: true });
    doc.moveDown(0.5);

    // Summary cards as a table
    const summaryY = doc.y;
    doc.fontSize(10).fillColor('#333333');

    // Left column
    doc.text('Total Rent Due:', 60, summaryY);
    doc.text(formatCurrency(summary.annual.totalDue), 180, summaryY);

    doc.text('Total Collected:', 60, summaryY + 18);
    doc.fillColor('#16a34a').text(formatCurrency(summary.annual.totalPaid), 180, summaryY + 18);

    doc.fillColor('#333333').text('Outstanding:', 60, summaryY + 36);
    doc.fillColor('#ca8a04').text(formatCurrency(summary.annual.totalOutstanding), 180, summaryY + 36);

    // Right column
    doc.fillColor('#333333').text('Total Payments:', 320, summaryY);
    doc.text(`${summary.annual.paymentCount}`, 440, summaryY);

    doc.text('Payments Collected:', 320, summaryY + 18);
    doc.text(`${summary.annual.paidCount}`, 440, summaryY + 18);

    doc.text('Collection Rate:', 320, summaryY + 36);
    doc.fillColor('#2563eb').text(`${summary.annual.collectionRate}%`, 440, summaryY + 36);

    doc.y = summaryY + 70;
    doc.moveDown(1.5);

    // Monthly Breakdown Table
    doc.fillColor(brandColor).fontSize(12).text('Monthly Breakdown', { underline: true });
    doc.moveDown(0.5);

    // Table header
    const tableTop = doc.y;
    const colMonth = 60;
    const colDue = 180;
    const colCollected = 280;
    const colOutstanding = 380;
    const colPayments = 480;

    doc.fontSize(9).fillColor('#666666');
    doc.text('Month', colMonth, tableTop);
    doc.text('Due', colDue, tableTop);
    doc.text('Collected', colCollected, tableTop);
    doc.text('Outstanding', colOutstanding, tableTop);
    doc.text('Payments', colPayments, tableTop);

    doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).stroke('#dddddd');

    // Table rows
    let rowY = tableTop + 20;
    doc.fontSize(9);

    summary.monthly.forEach(month => {
      const outstanding = month.totalDue - month.totalPaid;
      const hasData = month.paymentCount > 0;

      if (hasData) {
        doc.fillColor('#333333');
      } else {
        doc.fillColor('#999999');
      }

      doc.text(month.monthName, colMonth, rowY);
      doc.text(formatCurrency(month.totalDue), colDue, rowY);

      if (hasData) {
        doc.fillColor('#16a34a');
      }
      doc.text(formatCurrency(month.totalPaid), colCollected, rowY);

      if (outstanding > 0) {
        doc.fillColor('#ca8a04');
      } else {
        doc.fillColor('#333333');
      }
      doc.text(formatCurrency(outstanding > 0 ? outstanding : 0), colOutstanding, rowY);

      doc.fillColor('#333333');
      doc.text(`${month.paidCount}/${month.paymentCount}`, colPayments, rowY);

      rowY += 16;
    });

    // Totals row
    doc.moveTo(50, rowY).lineTo(545, rowY).stroke('#dddddd');
    rowY += 6;

    doc.fontSize(10).fillColor('#333333').font('Helvetica-Bold');
    doc.text('Total', colMonth, rowY);
    doc.text(formatCurrency(summary.annual.totalDue), colDue, rowY);
    doc.fillColor('#16a34a').text(formatCurrency(summary.annual.totalPaid), colCollected, rowY);
    doc.fillColor('#ca8a04').text(formatCurrency(summary.annual.totalOutstanding), colOutstanding, rowY);
    doc.fillColor('#333333').text(`${summary.annual.paidCount}/${summary.annual.paymentCount}`, colPayments, rowY);
    doc.font('Helvetica');

    // Footer
    doc.fontSize(8).fillColor('#999999');
    const footerY = doc.page.height - 40;
    doc.text(
      `Generated by ${brandName} on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`,
      50, footerY, { align: 'center', width: 495 }
    );

    doc.end();
  } catch (err) {
    console.error('Generate annual PDF statement error:', err);
    if (!res.headersSent) {
      handleError(res, err, 'generate annual PDF statement');
    }
  }
};
