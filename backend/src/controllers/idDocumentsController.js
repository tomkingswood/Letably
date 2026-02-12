/**
 * ID Documents Controller
 *
 * Handles secure upload/download of encrypted ID documents
 * - Student ID documents (during application)
 * - Guarantor ID documents (via token link)
 */

const db = require('../db');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { encryptFile, decryptFile } = require('../utils/encryption');
const { validateFile } = require('../utils/fileValidation');
const handleError = require('../utils/handleError');
const asyncHandler = require('../utils/asyncHandler');

// Secure documents directory (outside web root)
const SECURE_DOCS_DIR = path.join(__dirname, '../../../secure-documents');
const APPLICANT_DOCS_DIR = path.join(SECURE_DOCS_DIR, 'applicants');
const GUARANTOR_DOCS_DIR = path.join(SECURE_DOCS_DIR, 'guarantors');

/**
 * Ensure secure documents directories exist
 */
async function ensureDirectories() {
  await fs.mkdir(APPLICANT_DOCS_DIR, { recursive: true });
  await fs.mkdir(GUARANTOR_DOCS_DIR, { recursive: true });
}

// Initialize directories
ensureDirectories().catch(err => {
  console.error('Failed to create secure documents directories:', err);
});

/**
 * Upload applicant ID document
 * POST /api/applications/:id/upload-id
 * Requires authentication, user must own the application
 */
exports.uploadApplicantId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const agencyId = req.agencyId;

  // Check if file was uploaded
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Validate file
  const validation = validateFile(req.file);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  // Verify user owns this application
  const applicationResult = await db.query(
    'SELECT * FROM applications WHERE id = $1 AND user_id = $2',
    [id, userId],
    agencyId
  );
  const application = applicationResult.rows[0];

  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Check if ID already uploaded
  // Defense-in-depth: explicit agency_id filtering
  const existingResult = await db.query(
    'SELECT * FROM id_documents WHERE application_id = $1 AND document_type = $2 AND application_id IN (SELECT id FROM applications WHERE agency_id = $3)',
    [id, 'applicant_id', agencyId],
    agencyId
  );
  const existing = existingResult.rows[0];

  if (existing) {
    return res.status(400).json({ error: 'ID document already uploaded. Only one upload allowed.' });
  }

  // Generate unique filename
  const storedFilename = `${uuidv4()}.enc`;
  const filePath = path.join(APPLICANT_DOCS_DIR, storedFilename);

  // Encrypt and save file
  const encryptedData = encryptFile(req.file.buffer);
  await fs.writeFile(filePath, encryptedData);

  // Save metadata to database
  await db.query(
    `INSERT INTO id_documents (
      agency_id, application_id, document_type, file_path, original_filename,
      stored_filename, file_size, mime_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      agencyId,
      id,
      'applicant_id',
      `uploads/id-documents/${storedFilename}`,
      req.file.originalname,
      storedFilename,
      req.file.size,
      req.file.mimetype
    ],
    agencyId
  );

  res.json({
    message: 'ID document uploaded successfully',
    filename: req.file.originalname
  });
}, 'upload applicant ID');

/**
 * Upload guarantor ID document
 * POST /api/applications/guarantor/:token/upload-id
 * Public access via guarantor token
 */
exports.uploadGuarantorId = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const agencyId = req.agencyId;

  // Check if file was uploaded
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Validate file
  const validation = validateFile(req.file);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  // Find application by guarantor token
  const applicationResult = await db.query(
    'SELECT * FROM applications WHERE guarantor_token = $1',
    [token],
    agencyId
  );
  const application = applicationResult.rows[0];

  if (!application) {
    return res.status(404).json({ error: 'Token not found' });
  }

  // Check if token expired
  if (new Date(application.guarantor_token_expires_at) < new Date()) {
    return res.status(403).json({ error: 'Token has expired' });
  }

  // Check if ID already uploaded
  // Defense-in-depth: explicit agency_id filtering
  const existingResult = await db.query(
    'SELECT * FROM id_documents WHERE application_id = $1 AND document_type = $2 AND application_id IN (SELECT id FROM applications WHERE agency_id = $3)',
    [application.id, 'guarantor_id', agencyId],
    agencyId
  );
  const existing = existingResult.rows[0];

  if (existing) {
    return res.status(400).json({ error: 'ID document already uploaded. Only one upload allowed.' });
  }

  // Generate unique filename
  const storedFilename = `${uuidv4()}.enc`;
  const filePath = path.join(GUARANTOR_DOCS_DIR, storedFilename);

  // Encrypt and save file
  const encryptedData = encryptFile(req.file.buffer);
  await fs.writeFile(filePath, encryptedData);

  // Save metadata to database
  await db.query(
    `INSERT INTO id_documents (
      agency_id, application_id, document_type, file_path, original_filename,
      stored_filename, file_size, mime_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      agencyId,
      application.id,
      'guarantor_id',
      `uploads/guarantor-documents/${storedFilename}`,
      req.file.originalname,
      storedFilename,
      req.file.size,
      req.file.mimetype
    ],
    agencyId
  );

  res.json({
    message: 'ID document uploaded successfully',
    filename: req.file.originalname
  });
}, 'upload guarantor ID');

/**
 * Download/view applicant ID document
 * GET /api/applications/:id/id-document?type=applicant_id
 * Requires authentication, user must own application or be admin
 */
exports.downloadApplicantId = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const agencyId = req.agencyId;

    const documentType = type || 'applicant_id';

    // Verify user owns application or is admin
    if (!isAdmin) {
      const applicationResult = await db.query(
        'SELECT * FROM applications WHERE id = $1 AND user_id = $2',
        [id, userId],
        agencyId
      );
      const application = applicationResult.rows[0];

      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }
    }

    // Get document metadata
    // Defense-in-depth: explicit agency_id filtering
    const documentResult = await db.query(
      'SELECT * FROM id_documents WHERE application_id = $1 AND document_type = $2 AND application_id IN (SELECT id FROM applications WHERE agency_id = $3)',
      [id, documentType, agencyId],
      agencyId
    );
    const document = documentResult.rows[0];

    if (!document) {
      return res.status(404).json({ error: 'ID document not found' });
    }

    // Determine directory based on document type
    const directory = documentType === 'applicant_id' ? APPLICANT_DOCS_DIR : GUARANTOR_DOCS_DIR;
    const filePath = path.join(directory, document.stored_filename);

    // Read and decrypt file
    const encryptedData = await fs.readFile(filePath);
    const decryptedData = decryptFile(encryptedData);

    // Set headers for file download/viewing
    res.setHeader('Content-Type', document.mime_type);
    res.setHeader('Content-Length', decryptedData.length);

    // Allow inline viewing for images and PDFs
    if (document.mime_type.startsWith('image/') || document.mime_type === 'application/pdf') {
      res.setHeader('Content-Disposition', `inline; filename="${document.original_filename}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${document.original_filename}"`);
    }

    res.send(decryptedData);

  } catch (err) {
    if (err.message.includes('decrypt')) {
      return handleError(res, err, 'decrypt ID - file may be corrupted');
    }
    handleError(res, err, 'retrieve ID document');
  }
};

/**
 * Download/view guarantor ID document (via token)
 * GET /api/applications/guarantor/:token/id-document
 * Public access via guarantor token
 */
exports.downloadGuarantorId = async (req, res) => {
  try {
    const { token } = req.params;
    const agencyId = req.agencyId;

    // Find application by guarantor token
    const applicationResult = await db.query(
      'SELECT * FROM applications WHERE guarantor_token = $1',
      [token],
      agencyId
    );
    const application = applicationResult.rows[0];

    if (!application) {
      return res.status(404).json({ error: 'Token not found' });
    }

    // Check if token expired
    if (new Date(application.guarantor_token_expires_at) < new Date()) {
      return res.status(403).json({ error: 'Token has expired' });
    }

    // Get document metadata
    // Defense-in-depth: explicit agency_id filtering
    const documentResult = await db.query(
      'SELECT * FROM id_documents WHERE application_id = $1 AND document_type = $2 AND application_id IN (SELECT id FROM applications WHERE agency_id = $3)',
      [application.id, 'guarantor_id', agencyId],
      agencyId
    );
    const document = documentResult.rows[0];

    if (!document) {
      return res.status(404).json({ error: 'ID document not found' });
    }

    // Read and decrypt file
    const filePath = path.join(GUARANTOR_DOCS_DIR, document.stored_filename);
    const encryptedData = await fs.readFile(filePath);
    const decryptedData = decryptFile(encryptedData);

    // Set headers for file download/viewing
    res.setHeader('Content-Type', document.mime_type);
    res.setHeader('Content-Length', decryptedData.length);
    res.setHeader('Content-Disposition', `inline; filename="${document.original_filename}"`);

    res.send(decryptedData);

  } catch (err) {
    if (err.message.includes('decrypt')) {
      return handleError(res, err, 'decrypt guarantor ID - file may be corrupted');
    }
    handleError(res, err, 'retrieve guarantor ID document');
  }
};

/**
 * Check if guarantor ID document exists
 * GET /api/applications/guarantor/:token/id-document/status
 * Public access via guarantor token
 */
exports.checkGuarantorIdDocumentStatus = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const agencyId = req.agencyId;

  // Find application by guarantor token
  const applicationResult = await db.query(
    'SELECT * FROM applications WHERE guarantor_token = $1',
    [token],
    agencyId
  );
  const application = applicationResult.rows[0];

  if (!application) {
    return res.status(404).json({ error: 'Token not found' });
  }

  // Check if token expired
  if (new Date(application.guarantor_token_expires_at) < new Date()) {
    return res.status(403).json({ error: 'Token has expired' });
  }

  // Check if document exists
  // Defense-in-depth: explicit agency_id filtering
  const documentResult = await db.query(
    'SELECT id, original_filename, file_size, mime_type, uploaded_at FROM id_documents WHERE application_id = $1 AND document_type = $2 AND application_id IN (SELECT id FROM applications WHERE agency_id = $3)',
    [application.id, 'guarantor_id', agencyId],
    agencyId
  );
  const document = documentResult.rows[0];

  if (document) {
    res.json({
      uploaded: true,
      filename: document.original_filename,
      size: document.file_size,
      type: document.mime_type,
      uploadedAt: document.uploaded_at
    });
  } else {
    res.json({ uploaded: false });
  }
}, 'check guarantor ID status');

/**
 * Check if ID document exists
 * GET /api/applications/:id/id-document/status?type=applicant_id
 */
exports.checkIdDocumentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type } = req.query;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  const agencyId = req.agencyId;

  const documentType = type || 'applicant_id';

  // Verify user owns application or is admin
  if (!isAdmin) {
    const applicationResult = await db.query(
      'SELECT * FROM applications WHERE id = $1 AND user_id = $2',
      [id, userId],
      agencyId
    );
    const application = applicationResult.rows[0];

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
  }

  // Check if document exists
  // Defense-in-depth: explicit agency_id filtering
  const documentResult = await db.query(
    'SELECT id, original_filename, file_size, mime_type, uploaded_at FROM id_documents WHERE application_id = $1 AND document_type = $2 AND application_id IN (SELECT id FROM applications WHERE agency_id = $3)',
    [id, documentType, agencyId],
    agencyId
  );
  const document = documentResult.rows[0];

  if (document) {
    res.json({
      uploaded: true,
      filename: document.original_filename,
      size: document.file_size,
      type: document.mime_type,
      uploadedAt: document.uploaded_at
    });
  } else {
    res.json({ uploaded: false });
  }
}, 'check ID document status');

/**
 * Delete applicant ID document
 * DELETE /api/applications/:id/delete-id?type=applicant_id
 * Requires authentication, user must own the application
 * Only allowed if application status is pending (not yet submitted)
 */
exports.deleteApplicantId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type } = req.query;
  const userId = req.user.id;
  const agencyId = req.agencyId;

  const documentType = type || 'applicant_id';

  // Verify user owns this application
  const applicationResult = await db.query(
    'SELECT * FROM applications WHERE id = $1 AND user_id = $2',
    [id, userId],
    agencyId
  );
  const application = applicationResult.rows[0];

  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Check if application is still pending
  if (application.status !== 'pending') {
    return res.status(403).json({ error: 'Cannot delete ID document after application has been submitted' });
  }

  // Get document metadata
  // Defense-in-depth: explicit agency_id filtering
  const documentResult = await db.query(
    'SELECT * FROM id_documents WHERE application_id = $1 AND document_type = $2 AND application_id IN (SELECT id FROM applications WHERE agency_id = $3)',
    [id, documentType, agencyId],
    agencyId
  );
  const document = documentResult.rows[0];

  if (!document) {
    return res.status(404).json({ error: 'ID document not found' });
  }

  // Determine directory based on document type
  const directory = documentType === 'applicant_id' ? APPLICANT_DOCS_DIR : GUARANTOR_DOCS_DIR;
  const filePath = path.join(directory, document.stored_filename);

  // Delete file from disk
  try {
    await fs.unlink(filePath);
  } catch (fileError) {
    console.error('Error deleting file from disk:', fileError);
    // Continue with database deletion even if file not found
  }

  // Delete from database (explicit agency check via application join for defense-in-depth)
  // Defense-in-depth: explicit agency_id filtering
  await db.query(
    `DELETE FROM id_documents
     WHERE id = $1
     AND application_id IN (SELECT id FROM applications WHERE agency_id = $2)`,
    [document.id, agencyId],
    agencyId
  );

  res.json({ message: 'ID document deleted successfully' });
}, 'delete applicant ID');

/**
 * Delete guarantor ID document
 * DELETE /api/applications/guarantor/:token/delete-id
 * Public access via guarantor token
 * Only allowed if guarantor hasn't completed their submission yet
 */
exports.deleteGuarantorId = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const agencyId = req.agencyId;

  // Find application by guarantor token
  const applicationResult = await db.query(
    'SELECT * FROM applications WHERE guarantor_token = $1',
    [token],
    agencyId
  );
  const application = applicationResult.rows[0];

  if (!application) {
    return res.status(404).json({ error: 'Token not found' });
  }

  // Check if token expired
  if (new Date(application.guarantor_token_expires_at) < new Date()) {
    return res.status(403).json({ error: 'Token has expired' });
  }

  // Check if guarantor has already submitted
  if (application.guarantor_completed_at) {
    return res.status(403).json({ error: 'Cannot delete ID document after guarantor form has been submitted' });
  }

  // Get document metadata
  // Defense-in-depth: explicit agency_id filtering
  const documentResult = await db.query(
    'SELECT * FROM id_documents WHERE application_id = $1 AND document_type = $2 AND application_id IN (SELECT id FROM applications WHERE agency_id = $3)',
    [application.id, 'guarantor_id', agencyId],
    agencyId
  );
  const document = documentResult.rows[0];

  if (!document) {
    return res.status(404).json({ error: 'ID document not found' });
  }

  // Delete file from disk
  const filePath = path.join(GUARANTOR_DOCS_DIR, document.stored_filename);
  try {
    await fs.unlink(filePath);
  } catch (fileError) {
    console.error('Error deleting file from disk:', fileError);
    // Continue with database deletion even if file not found
  }

  // Delete from database (explicit agency check via application join for defense-in-depth)
  // Defense-in-depth: explicit agency_id filtering
  await db.query(
    `DELETE FROM id_documents
     WHERE id = $1
     AND application_id IN (SELECT id FROM applications WHERE agency_id = $2)`,
    [document.id, agencyId],
    agencyId
  );

  res.json({ message: 'ID document deleted successfully' });
}, 'delete guarantor ID');
