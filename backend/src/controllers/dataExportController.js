/**
 * Data Export Controller
 *
 * Handles API requests for data export jobs.
 */

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const db = require('../db');
const {
  queueExport,
  processExport,
  processQueue,
  getExportOptions,
} = require('../services/dataExportService');
const asyncHandler = require('../utils/asyncHandler');
const { paginatedQuery } = require('../utils/queryHelpers');

/**
 * Get export job statistics
 */
exports.getStats = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM export_jobs
    WHERE agency_id = $1
  `, [agencyId], agencyId);

  const stats = result.rows[0];

  res.json({
    total: parseInt(stats.total) || 0,
    pending: parseInt(stats.pending) || 0,
    processing: parseInt(stats.processing) || 0,
    completed: parseInt(stats.completed) || 0,
    failed: parseInt(stats.failed) || 0,
  });
}, 'fetch export statistics');

/**
 * Get all export jobs with filtering and pagination
 */
exports.getAllExports = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { status, entity_type, limit = 50, offset = 0 } = req.query;

  const filters = [];
  if (status) filters.push({ clause: 'ej.status = $N', value: status });
  if (entity_type) filters.push({ clause: 'ej.entity_type = $N', value: entity_type });

  const { rows: exports, pagination } = await paginatedQuery({
    baseQuery: `
      SELECT
        ej.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM export_jobs ej
      LEFT JOIN users u ON ej.created_by = u.id`,
    countQuery: 'SELECT COUNT(*) as total FROM export_jobs ej',
    orderBy: 'ej.created_at DESC',
    baseWhere: 'ej.agency_id = $1',
    baseParams: [agencyId],
    filters,
    limit,
    offset,
    agencyId,
  });

  res.json({ exports, pagination });
}, 'fetch exports');

/**
 * Get export options (entity types and filters)
 */
exports.getOptions = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const options = getExportOptions();

  // Fetch additional filter data from database
  // Defense-in-depth: explicit agency_id filtering
  const [landlords, properties, locations] = await Promise.all([
    db.query('SELECT id, name FROM landlords WHERE agency_id = $1 ORDER BY name', [agencyId], agencyId),
    db.query('SELECT id, title, address_line1, city FROM properties WHERE agency_id = $1 ORDER BY title', [agencyId], agencyId),
    db.query('SELECT DISTINCT location FROM properties WHERE agency_id = $1 AND location IS NOT NULL ORDER BY location', [agencyId], agencyId),
  ]);

  res.json({
    ...options,
    filterValues: {
      landlords: landlords.rows,
      properties: properties.rows.map(p => ({
        id: p.id,
        name: p.title || `${p.address_line1}, ${p.city}`,
      })),
      locations: locations.rows.map(row => ({ name: row.location })),
      statuses: {
        properties: ['draft', 'available', 'let', 'maintenance'],
        tenancies: ['pending', 'awaiting_signature', 'active', 'ending_soon', 'expired', 'cancelled'],
        applications: ['pending', 'in_progress', 'completed', 'approved', 'rejected', 'withdrawn'],
        payments: ['pending', 'partial', 'paid', 'overdue'],
        maintenance: ['submitted', 'in_progress', 'pending_approval', 'resolved', 'closed'],
      },
      priorities: ['low', 'medium', 'high', 'urgent'],
      categories: ['plumbing', 'electrical', 'heating', 'appliances', 'structural', 'pest_control', 'general', 'other'],
      tenancy_types: ['room_only', 'whole_house'],
      application_types: ['student', 'professional'],
      payment_types: ['rent', 'deposit', 'admin_fee', 'other'],
    },
  });
}, 'fetch export options');

/**
 * Create a new export job
 */
exports.createExport = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const userId = req.user.id;
  const { entity_type, export_format, filters, include_related } = req.body;

  if (!entity_type) {
    return res.status(400).json({ error: 'Entity type is required' });
  }

  const job = await queueExport(
    { entity_type, export_format, filters, include_related },
    agencyId,
    userId
  );

  res.status(201).json({
    message: 'Export job created successfully',
    job,
  });
}, 'create export job');

/**
 * Get single export job details
 */
exports.getExportById = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(`
    SELECT
      ej.*,
      u.first_name || ' ' || u.last_name as created_by_name
    FROM export_jobs ej
    LEFT JOIN users u ON ej.created_by = u.id
    WHERE ej.id = $1 AND ej.agency_id = $2
  `, [id, agencyId], agencyId);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Export job not found' });
  }

  res.json(result.rows[0]);
}, 'fetch export job');

/**
 * Download completed export file
 */
exports.downloadExport = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    'SELECT * FROM export_jobs WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Export job not found' });
  }

  const job = result.rows[0];

  if (job.status !== 'completed') {
    return res.status(400).json({ error: 'Export is not ready for download' });
  }

  if (!job.file_path) {
    return res.status(404).json({ error: 'Export file not found' });
  }

  const filePath = path.join(__dirname, '../../uploads', job.file_path);

  try {
    await fsp.access(filePath);
  } catch {
    return res.status(404).json({ error: 'Export file no longer exists' });
  }

  // Set appropriate content type
  const contentType = job.export_format === 'csv'
    ? 'text/csv; charset=utf-8'
    : 'application/xml; charset=utf-8';

  // Generate filename
  const filename = `${job.entity_type}_export_${job.id}.${job.export_format}`;

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', job.file_size);

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
}, 'download export file');

/**
 * Retry a failed export job
 */
exports.retryExport = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    'SELECT * FROM export_jobs WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Export job not found' });
  }

  const job = result.rows[0];

  if (job.status === 'completed') {
    return res.status(400).json({ error: 'Export job already completed' });
  }

  if (job.status === 'processing') {
    return res.status(400).json({ error: 'Export job is currently processing' });
  }

  // Reset status to pending
  // Defense-in-depth: explicit agency_id filtering
  await db.query(`
    UPDATE export_jobs
    SET status = 'pending',
        error_message = NULL,
        progress = 0,
        started_at = NULL,
        completed_at = NULL,
        updated_at = NOW()
    WHERE id = $1 AND agency_id = $2
  `, [id, agencyId], agencyId);

  res.json({ message: 'Export job queued for retry' });
}, 'retry export job');

/**
 * Delete an export job
 */
exports.deleteExport = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Get job to find file path
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    'SELECT file_path FROM export_jobs WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Export job not found' });
  }

  const job = result.rows[0];

  // Delete file if exists
  if (job.file_path) {
    const filePath = path.join(__dirname, '../../uploads', job.file_path);
    await fsp.unlink(filePath).catch(() => {});
  }

  // Delete job record
  // Defense-in-depth: explicit agency_id filtering
  await db.query(
    'DELETE FROM export_jobs WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );

  res.json({ message: 'Export job deleted successfully' });
}, 'delete export job');

/**
 * Manually trigger queue processing (for testing)
 */
exports.processQueueManually = asyncHandler(async (req, res) => {
  const { limit = 3 } = req.query;
  const results = await processQueue(parseInt(limit));

  res.json({
    message: 'Export queue processed',
    results,
    processed: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
  });
}, 'process export queue');
