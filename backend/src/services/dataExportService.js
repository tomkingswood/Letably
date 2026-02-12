/**
 * Data Export Service
 *
 * Handles queuing and processing of data export jobs.
 * Follows the email queue pattern for async processing.
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');
const { streamCSV } = require('../utils/csvGenerator');
const { streamXML } = require('../utils/xmlGenerator');
const { queueEmail } = require('./emailService');

// Import entity exporters
const propertiesExport = require('../exports/propertiesExport');
const tenanciesExport = require('../exports/tenanciesExport');
const tenantsExport = require('../exports/tenantsExport');
const applicationsExport = require('../exports/applicationsExport');
const landlordsExport = require('../exports/landlordsExport');
const paymentsExport = require('../exports/paymentsExport');
const maintenanceExport = require('../exports/maintenanceExport');

// Entity exporter registry
const exporters = {
  properties: propertiesExport,
  tenancies: tenanciesExport,
  tenants: tenantsExport,
  applications: applicationsExport,
  landlords: landlordsExport,
  payments: paymentsExport,
  maintenance: maintenanceExport,
};

// Export directory
const EXPORTS_DIR = path.join(__dirname, '../../uploads/exports');

// Ensure exports directory exists
const ensureExportsDir = () => {
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }
};

/**
 * Queue a new export job
 * @param {object} exportData - Export configuration
 * @param {string} exportData.entity_type - Entity type to export
 * @param {string} exportData.export_format - Export format (csv, xml)
 * @param {object} exportData.filters - Filter options
 * @param {boolean} exportData.include_related - Include related data
 * @param {number} agencyId - Agency ID
 * @param {number} userId - User ID who requested the export
 * @returns {Promise<number>} - Export job ID
 */
const queueExport = async (exportData, agencyId, userId) => {
  const {
    entity_type,
    export_format = 'csv',
    filters = {},
    include_related = true,
  } = exportData;

  // Validate entity type
  if (!exporters[entity_type]) {
    throw new Error(`Invalid entity type: ${entity_type}`);
  }

  // Validate format
  if (!['csv', 'xml'].includes(export_format)) {
    throw new Error(`Invalid export format: ${export_format}`);
  }

  try {
    const result = await db.query(
      `INSERT INTO export_jobs (
        agency_id, entity_type, export_format, filters, include_related, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        agencyId,
        entity_type,
        export_format,
        JSON.stringify(filters),
        include_related,
        userId
      ],
      agencyId
    );

    return result.rows[0];
  } catch (err) {
    console.error('Error queuing export:', err);
    throw err;
  }
};

/**
 * Update export job status and progress
 * @param {number} jobId - Export job ID
 * @param {object} updates - Fields to update
 * @param {number} agencyId - Agency ID
 */
const updateExportJob = async (jobId, updates, agencyId) => {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = $${paramIndex++}`);
    values.push(value);
  }

  fields.push(`updated_at = NOW()`);
  values.push(jobId);

  await db.query(
    `UPDATE export_jobs SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
    values,
    agencyId
  );
};

/**
 * Process a single export job
 * @param {number} jobId - Export job ID
 * @param {number} agencyId - Agency ID
 * @returns {Promise<object>} - Processing result
 */
const processExport = async (jobId, agencyId) => {
  ensureExportsDir();

  try {
    // Get job details
    const jobResult = await db.query(
      'SELECT * FROM export_jobs WHERE id = $1 AND agency_id = $2',
      [jobId, agencyId],
      agencyId
    );
    const job = jobResult.rows[0];

    if (!job) {
      throw new Error('Export job not found');
    }

    if (job.status === 'completed') {
      throw new Error('Export job already completed');
    }

    // Mark as processing
    await updateExportJob(jobId, {
      status: 'processing',
      started_at: new Date().toISOString(),
      progress: 0,
    }, agencyId);

    // Get the exporter for this entity type
    const exporter = exporters[job.entity_type];
    if (!exporter) {
      throw new Error(`No exporter found for entity type: ${job.entity_type}`);
    }

    // Fetch data
    const filters = typeof job.filters === 'string' ? JSON.parse(job.filters) : job.filters;
    const data = await exporter.fetchData(agencyId, filters, job.include_related);

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `${job.entity_type}_${timestamp}.${job.export_format}`;
    const filePath = path.join(EXPORTS_DIR, `agency_${agencyId}`, filename);

    // Ensure agency subdirectory exists
    const agencyDir = path.dirname(filePath);
    if (!fs.existsSync(agencyDir)) {
      fs.mkdirSync(agencyDir, { recursive: true });
    }

    // Create write stream
    const writeStream = fs.createWriteStream(filePath);

    // Progress callback
    const onProgress = async (progress) => {
      await updateExportJob(jobId, { progress }, agencyId);
    };

    // Generate export file
    if (job.export_format === 'csv') {
      await streamCSV(writeStream, data, exporter.columns, onProgress);
    } else {
      await streamXML(
        writeStream,
        data,
        exporter.xmlSchema.rootElement,
        exporter.xmlSchema.rowElement,
        exporter.xmlSchema.fields,
        onProgress
      );
    }

    // Close stream and wait for it to finish
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      writeStream.end();
    });

    // Get file stats
    const stats = fs.statSync(filePath);
    const relativeFilePath = path.relative(path.join(__dirname, '../../uploads'), filePath);

    // Mark as completed
    await updateExportJob(jobId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      file_path: relativeFilePath,
      file_size: stats.size,
      row_count: data.length,
      progress: 100,
    }, agencyId);

    // Send completion email to the user
    await sendCompletionEmail(job, data.length, agencyId);

    return {
      success: true,
      jobId,
      filePath: relativeFilePath,
      rowCount: data.length,
      fileSize: stats.size,
    };

  } catch (error) {
    console.error(`Error processing export job ${jobId}:`, error);

    // Get current retry count
    const jobResult = await db.query(
      'SELECT retry_count FROM export_jobs WHERE id = $1',
      [jobId],
      agencyId
    );
    const job = jobResult.rows[0];

    if (job) {
      const retryCount = (job.retry_count || 0) + 1;
      const maxRetries = 3;
      const status = retryCount >= maxRetries ? 'failed' : 'pending';

      await updateExportJob(jobId, {
        status,
        retry_count: retryCount,
        error_message: error.message,
        progress: 0,
      }, agencyId);
    }

    throw error;
  }
};

/**
 * Send completion email to the user who requested the export
 * @param {object} job - Export job
 * @param {number} rowCount - Number of rows exported
 * @param {number} agencyId - Agency ID
 */
const sendCompletionEmail = async (job, rowCount, agencyId) => {
  if (!job.created_by) return;

  try {
    // Get user email
    const userResult = await db.query(
      'SELECT email, first_name FROM users WHERE id = $1',
      [job.created_by],
      agencyId
    );
    const user = userResult.rows[0];

    if (!user) return;

    const entityName = job.entity_type.charAt(0).toUpperCase() + job.entity_type.slice(1);

    await queueEmail({
      to_email: user.email,
      to_name: user.first_name,
      subject: `Your ${entityName} Export is Ready`,
      html_body: `
        <h2>Export Complete</h2>
        <p>Hi ${user.first_name || 'there'},</p>
        <p>Your <strong>${entityName}</strong> export has been completed successfully.</p>
        <ul>
          <li><strong>Format:</strong> ${job.export_format.toUpperCase()}</li>
          <li><strong>Records:</strong> ${rowCount}</li>
        </ul>
        <p>You can download your export file from the Data Export section in the admin panel.</p>
        <p>Please note that export files are automatically deleted after 7 days.</p>
      `,
      text_body: `Your ${entityName} export is ready. Format: ${job.export_format.toUpperCase()}, Records: ${rowCount}. Download from the Data Export section in admin panel.`,
      priority: 3,
    }, agencyId);
  } catch (error) {
    console.error('Error sending export completion email:', error);
    // Don't throw - email failure shouldn't fail the export
  }
};

/**
 * Process pending export jobs (for cron job)
 * @param {number} limit - Maximum jobs to process
 * @returns {Promise<Array>} - Processing results
 */
const processQueue = async (limit = 3) => {
  const results = [];

  try {
    // Get pending jobs across all agencies (system query)
    const pendingResult = await db.systemQuery(
      `SELECT id, agency_id FROM export_jobs
       WHERE status = 'pending'
       AND retry_count < 3
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );
    const pendingJobs = pendingResult.rows;

    for (const job of pendingJobs) {
      try {
        const result = await processExport(job.id, job.agency_id);
        results.push({ id: job.id, success: true, ...result });
      } catch (error) {
        results.push({ id: job.id, success: false, error: error.message });
      }
    }

    return results;
  } catch (err) {
    console.error('Error processing export queue:', err);
    throw err;
  }
};

/**
 * Delete old export files (cleanup)
 * @param {number} daysOld - Delete files older than this many days
 */
const cleanupOldExports = async (daysOld = 7) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Get old completed exports
    const result = await db.systemQuery(
      `SELECT id, agency_id, file_path FROM export_jobs
       WHERE status = 'completed'
       AND completed_at < $1
       AND file_path IS NOT NULL`,
      [cutoffDate.toISOString()]
    );

    for (const job of result.rows) {
      try {
        // Delete file
        const fullPath = path.join(__dirname, '../../uploads', job.file_path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }

        // Delete job record - defense-in-depth: include agency_id even for system cleanup
        await db.systemQuery(
          'DELETE FROM export_jobs WHERE id = $1 AND agency_id = $2',
          [job.id, job.agency_id]
        );
      } catch (error) {
        console.error(`Error cleaning up export job ${job.id}:`, error);
      }
    }

    return result.rows.length;
  } catch (error) {
    console.error('Error in cleanup:', error);
    throw error;
  }
};

/**
 * Get available entity types and their filter options
 * @returns {object} - Entity types and filter options
 */
const getExportOptions = () => {
  return {
    entityTypes: [
      {
        id: 'properties',
        name: 'Properties',
        description: 'Export all properties with address, pricing, and status',
        filters: ['landlord_id', 'is_live'],
      },
      {
        id: 'tenancies',
        name: 'Tenancies',
        description: 'Export tenancies with dates, rent, and tenant information',
        filters: ['status', 'tenancy_type', 'property_id', 'start_date_from', 'start_date_to', 'end_date_from', 'end_date_to'],
      },
      {
        id: 'tenants',
        name: 'Tenants',
        description: 'Export tenant details including contact info and tenancy status',
        filters: ['tenancy_status', 'property_id', 'has_signed'],
      },
      {
        id: 'applications',
        name: 'Applications',
        description: 'Export tenant applications with status and form data',
        filters: ['status', 'application_type', 'created_from', 'created_to'],
      },
      {
        id: 'landlords',
        name: 'Landlords',
        description: 'Export landlord contact details and property counts',
        filters: ['has_properties'],
      },
      {
        id: 'payments',
        name: 'Payments',
        description: 'Export payment schedules with amounts and status',
        filters: ['status', 'payment_type', 'due_date_from', 'due_date_to'],
      },
      {
        id: 'maintenance',
        name: 'Maintenance Requests',
        description: 'Export maintenance requests with status and priority',
        filters: ['status', 'priority', 'category', 'created_from', 'created_to'],
      },
    ],
    formats: [
      { id: 'csv', name: 'CSV', description: 'Comma-separated values, compatible with Excel' },
      { id: 'xml', name: 'XML', description: 'Extensible Markup Language' },
    ],
  };
};

module.exports = {
  queueExport,
  processExport,
  processQueue,
  cleanupOldExports,
  getExportOptions,
  updateExportJob,
};
