const db = require('../db');
const { sendEmail, processQueue } = require('../services/emailService');
const asyncHandler = require('../utils/asyncHandler');
const { paginatedQuery } = require('../utils/queryHelpers');

// Get all emails from queue with filtering and pagination
exports.getAllEmails = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { status, limit = 50, offset = 0 } = req.query;

  const filters = [];
  if (status) filters.push({ clause: 'status = $N', value: status });

  const { rows: emails, pagination } = await paginatedQuery({
    baseQuery: 'SELECT * FROM email_queue',
    countQuery: 'SELECT COUNT(*) as total FROM email_queue',
    orderBy: 'created_at DESC',
    baseWhere: 'agency_id = $1',
    baseParams: [agencyId],
    filters,
    limit,
    offset,
    agencyId,
  });

  res.json({ emails, pagination });
}, 'fetch emails');

// Get single email details
exports.getEmailById = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    'SELECT * FROM email_queue WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );
  const email = result.rows[0];

  if (!email) {
    return res.status(404).json({ error: 'Email not found' });
  }

  res.json(email);
}, 'fetch email');

// Preview email HTML
exports.previewEmail = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    'SELECT html_body FROM email_queue WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );
  const email = result.rows[0];

  if (!email) {
    return res.status(404).json({ error: 'Email not found' });
  }

  // Return HTML content type so it renders in browser
  res.setHeader('Content-Type', 'text/html');
  res.send(email.html_body);
}, 'preview email');

// Retry failed email
exports.retryEmail = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    'SELECT * FROM email_queue WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );
  const email = result.rows[0];

  if (!email) {
    return res.status(404).json({ error: 'Email not found' });
  }

  if (email.status === 'sent') {
    return res.status(400).json({ error: 'Email already sent successfully' });
  }

  // Reset retry count and status
  // Defense-in-depth: explicit agency_id filtering
  await db.query(`
    UPDATE email_queue
    SET status = 'pending',
        retry_count = 0,
        error_message = NULL
    WHERE id = $1 AND agency_id = $2
  `, [id, agencyId], agencyId);

  // Try to send immediately
  const sendResult = await sendEmail(id);

  res.json({
    message: 'Email retry successful',
    result: sendResult,
  });
}, 'retry email');

// Delete email from queue
exports.deleteEmail = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    'DELETE FROM email_queue WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Email not found' });
  }

  res.json({ message: 'Email deleted successfully' });
}, 'delete email');

// Process email queue manually
exports.processEmailQueue = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const results = await processQueue(parseInt(limit));

  res.json({
    message: 'Email queue processed',
    results,
    processed: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
  });
}, 'process email queue');

// Get queue statistics
exports.getQueueStats = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;

  // Defense-in-depth: explicit agency_id filtering
  const totalResult = await db.query(
    'SELECT COUNT(*) as count FROM email_queue WHERE agency_id = $1',
    [agencyId],
    agencyId
  );
  // Defense-in-depth: explicit agency_id filtering
  const pendingResult = await db.query(
    'SELECT COUNT(*) as count FROM email_queue WHERE agency_id = $1 AND status = $2',
    [agencyId, 'pending'],
    agencyId
  );
  // Defense-in-depth: explicit agency_id filtering
  const sentResult = await db.query(
    'SELECT COUNT(*) as count FROM email_queue WHERE agency_id = $1 AND status = $2',
    [agencyId, 'sent'],
    agencyId
  );
  // Defense-in-depth: explicit agency_id filtering
  const failedResult = await db.query(
    'SELECT COUNT(*) as count FROM email_queue WHERE agency_id = $1 AND status = $2',
    [agencyId, 'failed'],
    agencyId
  );

  const stats = {
    total: parseInt(totalResult.rows[0].count),
    pending: parseInt(pendingResult.rows[0].count),
    sent: parseInt(sentResult.rows[0].count),
    failed: parseInt(failedResult.rows[0].count),
  };

  res.json(stats);
}, 'fetch queue statistics');

// Get processor status
exports.getProcessorStatus = asyncHandler(async (req, res) => {
  if (global.getEmailQueueProcessorStatus) {
    const status = global.getEmailQueueProcessorStatus();
    res.json(status);
  } else {
    res.json({
      isRunning: false,
      startedAt: null,
      lastProcessedAt: null,
      nextScheduledAt: null,
      intervalSeconds: null,
    });
  }
}, 'fetch processor status');

// Delete all sent and failed emails for this agency
exports.deleteAllProcessed = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;

  // Only delete sent and failed emails for THIS agency
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(`
    DELETE FROM email_queue
    WHERE agency_id = $1 AND status IN ('sent', 'failed')
  `, [agencyId], agencyId);

  res.json({
    message: `Deleted ${result.rowCount} processed emails`,
    deleted: result.rowCount
  });
}, 'delete processed emails');

// Delete ALL emails for this agency including pending
exports.deleteAll = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;

  // Get counts before deletion for the response
  // Defense-in-depth: explicit agency_id filtering
  const statsResult = await db.query(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM email_queue
    WHERE agency_id = $1
  `, [agencyId], agencyId);
  const stats = statsResult.rows[0];

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    'DELETE FROM email_queue WHERE agency_id = $1',
    [agencyId],
    agencyId
  );

  res.json({
    message: `Deleted ${result.rowCount} emails (${stats.pending} pending, ${stats.sent} sent, ${stats.failed} failed)`,
    deleted: result.rowCount,
    breakdown: {
      pending: parseInt(stats.pending) || 0,
      sent: parseInt(stats.sent) || 0,
      failed: parseInt(stats.failed) || 0
    }
  });
}, 'delete emails');
