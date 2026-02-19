/**
 * File Cleanup Service
 *
 * Scheduled service that runs daily to identify and delete orphaned files:
 * - ID documents (applicants & guarantors) not linked to any application
 * - Tenant documents not linked to any tenancy member
 * - Uploaded files (images, certificates) not referenced in database
 *
 * GDPR Compliance: Ensures personal data is not retained beyond its
 * legitimate purpose and orphaned files are properly deleted.
 */

const db = require('../db');
const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');

const SECURE_DOCS_DIR = path.join(__dirname, '../../../secure-documents');
const APPLICANT_DOCS_DIR = path.join(SECURE_DOCS_DIR, 'applicants');
const GUARANTOR_DOCS_DIR = path.join(SECURE_DOCS_DIR, 'guarantors');
const TENANT_DOCS_DIR = path.join(SECURE_DOCS_DIR, 'tenant-documents');
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * Scan and cleanup orphaned ID document files
 * @param {number} agencyId - Agency ID for multi-tenancy
 */
async function cleanupOrphanedFiles(agencyId) {
  try {
    console.log('\n[File Cleanup] Starting orphaned file cleanup...');

    // Get all stored filenames from database (extract filename from file_path)
    const dbFilesResult = await db.query(
      'SELECT file_path FROM id_documents WHERE agency_id = $1',
      [agencyId],
      agencyId
    );
    const dbFilenames = new Set(dbFilesResult.rows.map(f => path.basename(f.file_path)));

    console.log(`[File Cleanup] Database contains ${dbFilenames.size} registered ID documents`);

    let totalOrphaned = 0;
    let totalDeleted = 0;

    // Check applicant ID files
    try {
      const applicantFiles = await fs.readdir(APPLICANT_DOCS_DIR);
      console.log(`[File Cleanup] Scanning ${applicantFiles.length} applicant ID files...`);

      for (const file of applicantFiles) {
        if (!dbFilenames.has(file)) {
          totalOrphaned++;
          const filePath = path.join(APPLICANT_DOCS_DIR, file);

          try {
            await fs.unlink(filePath);
            console.log(`[File Cleanup] Deleted orphaned applicant ID: ${file}`);
            totalDeleted++;
          } catch (deleteError) {
            console.error(`[File Cleanup] Failed to delete ${file}:`, deleteError.message);
          }
        }
      }
    } catch (error) {
      console.error('[File Cleanup] Error reading applicant directory:', error.message);
    }

    // Check guarantor ID files
    try {
      const guarantorFiles = await fs.readdir(GUARANTOR_DOCS_DIR);
      console.log(`[File Cleanup] Scanning ${guarantorFiles.length} guarantor ID files...`);

      for (const file of guarantorFiles) {
        if (!dbFilenames.has(file)) {
          totalOrphaned++;
          const filePath = path.join(GUARANTOR_DOCS_DIR, file);

          try {
            await fs.unlink(filePath);
            console.log(`[File Cleanup] Deleted orphaned guarantor ID: ${file}`);
            totalDeleted++;
          } catch (deleteError) {
            console.error(`[File Cleanup] Failed to delete ${file}:`, deleteError.message);
          }
        }
      }
    } catch (error) {
      console.error('[File Cleanup] Error reading guarantor directory:', error.message);
    }

    // Check tenant documents
    try {
      // Get all tenant document filenames from database
      const tenantDocsResult = await db.query(
        'SELECT stored_filename FROM tenant_documents WHERE agency_id = $1',
        [agencyId],
        agencyId
      );
      const tenantDocFilenames = new Set(tenantDocsResult.rows.map(d => d.stored_filename));

      const tenantDocFiles = await fs.readdir(TENANT_DOCS_DIR);
      console.log(`[File Cleanup] Scanning ${tenantDocFiles.length} tenant document files...`);

      for (const file of tenantDocFiles) {
        if (!tenantDocFilenames.has(file)) {
          totalOrphaned++;
          const filePath = path.join(TENANT_DOCS_DIR, file);

          try {
            await fs.unlink(filePath);
            console.log(`[File Cleanup] Deleted orphaned tenant document: ${file}`);
            totalDeleted++;
          } catch (deleteError) {
            console.error(`[File Cleanup] Failed to delete ${file}:`, deleteError.message);
          }
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[File Cleanup] Tenant documents directory does not exist yet (will be created on first upload)');
      } else {
        console.error('[File Cleanup] Error reading tenant documents directory:', error.message);
      }
    }

    // Summary
    if (totalOrphaned === 0) {
      console.log('[File Cleanup] No orphaned files found. All files properly linked.');
    } else {
      console.log(`[File Cleanup] Cleanup complete: ${totalDeleted}/${totalOrphaned} orphaned files deleted`);
    }

  } catch (error) {
    console.error('[File Cleanup] Error during cleanup:', error);
  }
}

/**
 * Recursively get all files in a directory
 */
async function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = await fs.readdir(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      arrayOfFiles = await getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }

  return arrayOfFiles;
}

/**
 * Scan and cleanup orphaned files in uploads folder
 * These are images, certificates, and documents not referenced in the database
 *
 * Scans:
 * - backend/uploads/ (property images, EPC files, floor plans, site documents)
 * - backend/uploads/certificates/ (property certificate PDFs)
 * - Any other subdirectories
 *
 * @param {number} agencyId - Agency ID for multi-tenancy
 */
async function cleanupOrphanedUploads(agencyId) {
  try {
    console.log('\n[Uploads Cleanup] Starting orphaned uploads cleanup...');

    // Get all files in uploads directory (including subdirectories)
    const uploadFilePaths = await getAllFiles(UPLOADS_DIR);
    console.log(`[Uploads Cleanup] Found ${uploadFilePaths.length} files in uploads folder (including subdirectories)`);

    // Get all file references from database
    const referencedFiles = new Set();

    // 1. Images table (property images)
    const imagesResult = await db.query(
      'SELECT file_path FROM images WHERE agency_id = $1',
      [agencyId],
      agencyId
    );
    imagesResult.rows.forEach(img => {
      referencedFiles.add(path.basename(img.file_path));
    });

    // 2. Properties table - columns removed during refactoring
    // (epc_file and floor_plan_file were moved to property_certificates table)

    // 3. Certificates (stored in uploads/certificates/ subdirectory)
    const certificatesResult = await db.query(
      'SELECT file_path FROM certificates WHERE agency_id = $1',
      [agencyId],
      agencyId
    );
    certificatesResult.rows.forEach(cert => {
      if (cert.file_path) {
        // Certificate paths might be stored as "uploads/certificates/filename.pdf" or just "filename.pdf"
        referencedFiles.add(path.basename(cert.file_path));
      }
    });

    // 4. Site settings (Privacy Policy, PRS cert, CMP cert, ICO logo, etc.)
    const settingsResult = await db.query(
      'SELECT setting_value FROM site_settings WHERE agency_id = $1',
      [agencyId],
      agencyId
    );
    settingsResult.rows.forEach(setting => {
      if (setting.setting_value &&
          (setting.setting_value.startsWith('/uploads/') ||
           setting.setting_value.startsWith('uploads/'))) {
        referencedFiles.add(path.basename(setting.setting_value));
      }
    });

    // 5. Maintenance comment attachments (stored in uploads/maintenance/ subdirectory)
    const maintenanceAttachmentsResult = await db.query(
      'SELECT file_path FROM maintenance_attachments WHERE agency_id = $1',
      [agencyId],
      agencyId
    );
    maintenanceAttachmentsResult.rows.forEach(attachment => {
      if (attachment.file_path) {
        referencedFiles.add(path.basename(attachment.file_path));
      }
    });

    console.log(`[Uploads Cleanup] Database references ${referencedFiles.size} files`);

    let totalOrphaned = 0;
    let totalDeleted = 0;

    // Files to always keep (even if not in database)
    const keepFiles = new Set(['.gitkeep', '.gitignore', 'README.md']);

    for (const filePath of uploadFilePaths) {
      const fileName = path.basename(filePath);
      const relativePath = path.relative(UPLOADS_DIR, filePath);

      // Skip files that should always be kept
      if (keepFiles.has(fileName)) {
        continue;
      }

      // Delete if not referenced in database
      if (!referencedFiles.has(fileName)) {
        totalOrphaned++;

        try {
          await fs.unlink(filePath);
          console.log(`[Uploads Cleanup] Deleted orphaned file: ${relativePath}`);
          totalDeleted++;
        } catch (deleteError) {
          console.error(`[Uploads Cleanup] Failed to delete ${relativePath}:`, deleteError.message);
        }
      }
    }

    // Summary
    if (totalOrphaned === 0) {
      console.log('[Uploads Cleanup] No orphaned files found in uploads. All files properly referenced.');
    } else {
      console.log(`[Uploads Cleanup] Cleanup complete: ${totalDeleted}/${totalOrphaned} orphaned files deleted`);
    }

  } catch (error) {
    console.error('[Uploads Cleanup] Error during cleanup:', error);
  }
}

/**
 * Run all cleanup tasks
 * @param {number} agencyId - Agency ID for multi-tenancy
 */
async function runAllCleanupTasks(agencyId) {
  console.log('\n===============================================================');
  console.log('   FILE CLEANUP SERVICE - Starting scheduled cleanup');
  console.log('===============================================================\n');

  await cleanupOrphanedFiles(agencyId);
  await cleanupOrphanedUploads(agencyId);

  console.log('\n===============================================================');
  console.log('   FILE CLEANUP SERVICE - All cleanup tasks complete');
  console.log('===============================================================\n');
}

/**
 * Initialize the file cleanup scheduler
 * Runs daily at 2:00 AM UK time
 * @param {number} agencyId - Agency ID for multi-tenancy
 */
function initializeFileCleanupScheduler(agencyId) {
  // Schedule for 2:00 AM daily (UK timezone)
  // Cron format: minute hour day month day-of-week
  // '0 2 * * *' = Every day at 2:00 AM
  const schedule = '0 2 * * *';

  cron.schedule(schedule, () => {
    console.log('[File Cleanup] Scheduled cleanup triggered');
    runAllCleanupTasks(agencyId);
  }, {
    timezone: 'Europe/London'
  });

  console.log('File cleanup scheduler activated (daily at 2:00 AM UK time)');
  console.log('   - ID documents cleanup (secure-documents/applicants & guarantors)');
  console.log('   - Tenant documents cleanup (secure-documents/tenant-documents)');
  console.log('   - Uploads cleanup (backend/uploads/)');
  console.log('   - Maintenance photos cleanup (backend/uploads/maintenance/)');

  // Optional: Run on startup for testing (comment out in production)
  // console.log('[File Cleanup] Running initial cleanup on startup...');
  // runAllCleanupTasks(agencyId);
}

module.exports = {
  initializeFileCleanupScheduler,
  cleanupOrphanedFiles, // Export for manual testing/admin use
  cleanupOrphanedUploads, // Export for manual testing/admin use
  runAllCleanupTasks // Export for manual testing/admin use
};
