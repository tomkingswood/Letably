const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { encryptFile, decryptFile } = require('../utils/encryption');
const handleError = require('../utils/handleError');
const asyncHandler = require('../utils/asyncHandler');

// Secure documents directory (outside web root, same level as ID documents)
const SECURE_DOCS_DIR = path.join(__dirname, '../../../secure-documents');
const TENANT_DOCS_DIR = path.join(SECURE_DOCS_DIR, 'tenant-documents');

/**
 * Ensure tenant documents directory exists
 */
async function ensureDirectory() {
  await fs.mkdir(TENANT_DOCS_DIR, { recursive: true });
}

// Initialize directory
ensureDirectory().catch(err => {
  console.error('Failed to create tenant documents directory:', err);
});

// Configure multer for memory storage (files will be encrypted before saving)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Only allow PDF files for personal documents
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF files are allowed for personal documents.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

/**
 * Upload a document for a tenant member (Admin only)
 */
exports.uploadDocument = [
  upload.single('document'),
  asyncHandler(async (req, res) => {
    const { tenancy_member_id, document_type } = req.body;
    const adminId = req.user.id;
    const agencyId = req.agencyId;

    // Validate inputs
    if (!tenancy_member_id || !document_type) {
      return res.status(400).json({ error: 'tenancy_member_id and document_type are required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Defense-in-depth: explicit agency_id filtering
    // Verify tenant member exists and tenancy is active
    const memberResult = await db.query(`
      SELECT tm.id, t.status as tenancy_status
      FROM tenancy_members tm
      INNER JOIN tenancies t ON tm.tenancy_id = t.id
      WHERE tm.id = $1 AND t.agency_id = $2
    `, [tenancy_member_id, agencyId], agencyId);

    const member = memberResult.rows[0];

    if (!member) {
      return res.status(404).json({ error: 'Tenant member not found' });
    }

    // Only allow document uploads for active tenancies
    if (member.tenancy_status !== 'active') {
      return res.status(400).json({ error: 'Documents can only be uploaded for active tenancies' });
    }

    // Generate unique encrypted filename
    const storedFilename = `${uuidv4()}.enc`;
    const filePath = path.join(TENANT_DOCS_DIR, storedFilename);

    // Encrypt and save file
    const encryptedData = encryptFile(req.file.buffer);
    await fs.writeFile(filePath, encryptedData);

    // Defense-in-depth: explicit agency_id filtering
    // Insert document record
    const insertResult = await db.query(`
      INSERT INTO tenant_documents (
        agency_id, tenancy_member_id, document_type, original_filename,
        file_path, file_size, mime_type, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      agencyId,
      tenancy_member_id,
      document_type,
      req.file.originalname,
      `uploads/tenant-documents/${storedFilename}`,
      req.file.size,
      req.file.mimetype,
      adminId
    ], agencyId);

    const document = insertResult.rows[0];

    res.status(201).json({
      document,
      message: 'Document uploaded successfully'
    });
  }, 'upload document')
];

/**
 * Get documents for a specific tenant member (Admin only)
 */
exports.getMemberDocuments = asyncHandler(async (req, res) => {
  const { memberId } = req.params;
  const agencyId = req.agencyId;

  // Defense-in-depth: explicit agency_id filtering
  // Verify member exists
  const memberResult = await db.query(`
    SELECT tm.id FROM tenancy_members tm
    INNER JOIN tenancies t ON tm.tenancy_id = t.id
    WHERE tm.id = $1 AND t.agency_id = $2
  `, [memberId, agencyId], agencyId);
  if (memberResult.rows.length === 0) {
    return res.status(404).json({ error: 'Tenant member not found' });
  }

  // Defense-in-depth: explicit agency_id filtering
  // Get documents
  const documentsResult = await db.query(`
    SELECT td.*, u.first_name, u.last_name, u.email
    FROM tenant_documents td
    LEFT JOIN users u ON td.uploaded_by = u.id
    INNER JOIN tenancy_members tm ON td.tenancy_member_id = tm.id
    INNER JOIN tenancies t ON tm.tenancy_id = t.id
    WHERE td.tenancy_member_id = $1 AND t.agency_id = $2
    ORDER BY td.created_at DESC
  `, [memberId, agencyId], agencyId);

  res.json({ documents: documentsResult.rows });
}, 'fetch member documents');

/**
 * Get my documents as a tenant (Tenant only)
 */
exports.getMyDocuments = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const agencyId = req.agencyId;

  // Defense-in-depth: explicit agency_id filtering
  // Find tenant member ID for this user
  const memberResult = await db.query(`
    SELECT tm.id
    FROM tenancy_members tm
    INNER JOIN tenancies t ON tm.tenancy_id = t.id
    WHERE tm.user_id = $1 AND t.status = 'active' AND t.agency_id = $2
  `, [userId, agencyId], agencyId);

  const member = memberResult.rows[0];

  if (!member) {
    return res.json({ documents: [] });
  }

  // Defense-in-depth: explicit agency_id filtering
  // Get documents (only return safe fields for tenants)
  const documentsResult = await db.query(`
    SELECT td.id, td.document_type, td.original_filename, td.created_at
    FROM tenant_documents td
    INNER JOIN tenancy_members tm ON td.tenancy_member_id = tm.id
    INNER JOIN tenancies t ON tm.tenancy_id = t.id
    WHERE td.tenancy_member_id = $1 AND t.agency_id = $2
    ORDER BY td.created_at DESC
  `, [member.id, agencyId], agencyId);

  res.json({ documents: documentsResult.rows });
}, 'fetch my documents');

/**
 * Download/view a document (Admin or owner tenant)
 */
exports.downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const agencyId = req.agencyId;

    // Defense-in-depth: explicit agency_id filtering
    // Get document
    const documentResult = await db.query(`
      SELECT td.* FROM tenant_documents td
      INNER JOIN tenancy_members tm ON td.tenancy_member_id = tm.id
      INNER JOIN tenancies t ON tm.tenancy_id = t.id
      WHERE td.id = $1 AND t.agency_id = $2
    `, [id, agencyId], agencyId);
    const document = documentResult.rows[0];
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Defense-in-depth: explicit agency_id filtering
    // If not admin, verify this document belongs to the user
    if (!isAdmin) {
      const memberResult = await db.query(`
        SELECT tm.id
        FROM tenancy_members tm
        INNER JOIN tenancies t ON tm.tenancy_id = t.id
        WHERE tm.id = $1 AND tm.user_id = $2 AND t.agency_id = $3
      `, [document.tenancy_member_id, userId, agencyId], agencyId);

      if (memberResult.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Read and decrypt file
    const filePath = path.join(TENANT_DOCS_DIR, path.basename(document.file_path));
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
      return res.status(500).json({ error: 'File corrupted or tampered with' });
    }

    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found on server not found' });
    }

    handleError(res, err, 'download document');
  }
};

/**
 * Delete a document (Admin only)
 */
exports.deleteDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;

  // Defense-in-depth: explicit agency_id filtering
  // Get document with tenancy status
  const documentResult = await db.query(`
    SELECT td.*, t.status as tenancy_status
    FROM tenant_documents td
    INNER JOIN tenancy_members tm ON td.tenancy_member_id = tm.id
    INNER JOIN tenancies t ON tm.tenancy_id = t.id
    WHERE td.id = $1 AND t.agency_id = $2
  `, [id, agencyId], agencyId);

  const document = documentResult.rows[0];

  if (!document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Only allow document deletion for active tenancies
  if (document.tenancy_status !== 'active') {
    return res.status(400).json({ error: 'Documents can only be deleted for active tenancies' });
  }

  // Delete file from filesystem
  const filePath = path.join(TENANT_DOCS_DIR, document.stored_filename);
  try {
    await fs.unlink(filePath);
  } catch (fileError) {
    console.error('Error deleting file from disk:', fileError);
    // Continue with database deletion even if file not found
  }

  // Defense-in-depth: explicit agency_id filtering
  // Delete from database (explicit agency check via tenancy join for defense-in-depth)
  await db.query(
    `DELETE FROM tenant_documents
     WHERE id = $1
     AND tenancy_member_id IN (
       SELECT tm.id FROM tenancy_members tm
       INNER JOIN tenancies t ON tm.tenancy_id = t.id
       WHERE t.agency_id = $2
     )`,
    [id, agencyId],
    agencyId
  );

  res.json({ message: 'Document deleted successfully' });
}, 'delete document');
