const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const handleError = require('../utils/handleError');
const asyncHandler = require('../utils/asyncHandler');

// Configure multer for certificate uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/certificates');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `cert-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// PDF-only filter for property certificates
const pdfUpload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Broader filter for agency documents (PDF + images)
const docUpload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and image files are allowed.'));
    }
  }
});

// Get all certificates for an entity (property, agency, etc.)
exports.getByEntity = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const agencyId = req.agencyId;

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(`
    SELECT
      c.*,
      ct.name as type_name,
      ct.display_name as type_display_name,
      ct.has_expiry as type_has_expiry
    FROM certificates c
    JOIN certificate_types ct ON c.certificate_type_id = ct.id
    WHERE c.entity_type = $1 AND c.entity_id = $2 AND c.agency_id = $3
    ORDER BY ct.display_order ASC, ct.display_name ASC
  `, [entityType, entityId, agencyId], agencyId);

  res.json({ certificates: result.rows });
}, 'fetch certificates');

// Upload certificate - uses appropriate multer based on entity type
exports.uploadCertificate = [
  (req, res, next) => {
    const { entityType } = req.params;
    const uploadHandler = entityType === 'agency' ? docUpload : pdfUpload;
    uploadHandler.single('certificate')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ error: err.message });
        }
        return res.status(400).json({ error: err.message });
      }
      // Also check for 'file' field name (used by agency documents)
      if (!req.file) {
        docUpload.single('file')(req, res, (err2) => {
          if (err2) {
            return res.status(400).json({ error: err2.message });
          }
          next();
        });
      } else {
        next();
      }
    });
  },
  async (req, res) => {
    try {
      const { entityType, entityId, typeId } = req.params;
      const { expiry_date } = req.body;
      const agencyId = req.agencyId;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Validate entity type
      if (!['property', 'agency'].includes(entityType)) {
        await fsp.unlink(req.file.path);
        return res.status(400).json({ error: 'Invalid entity type' });
      }

      // For property entities, verify the property exists
      if (entityType === 'property') {
        // Defense-in-depth: explicit agency_id filtering
        const propertyResult = await db.query('SELECT id FROM properties WHERE id = $1 AND agency_id = $2', [entityId, agencyId], agencyId);
        if (!propertyResult.rows[0]) {
          await fsp.unlink(req.file.path);
          return res.status(404).json({ error: 'Property not found' });
        }
      }

      // Check if certificate type exists and matches entity type
      // Defense-in-depth: explicit agency_id filtering
      const certificateTypeResult = await db.query('SELECT * FROM certificate_types WHERE id = $1 AND agency_id = $2', [typeId, agencyId], agencyId);
      if (!certificateTypeResult.rows[0]) {
        await fsp.unlink(req.file.path);
        return res.status(404).json({ error: 'Certificate type not found' });
      }

      const certType = certificateTypeResult.rows[0];

      // Validate expiry date if the type requires it
      if (certType.has_expiry && !expiry_date) {
        await fsp.unlink(req.file.path);
        return res.status(400).json({ error: 'Expiry date is required for this document type' });
      }

      const filePath = `certificates/${req.file.filename}`;

      // Check if certificate already exists for this entity and type
      // Defense-in-depth: explicit agency_id filtering
      const existingResult = await db.query(`
        SELECT * FROM certificates
        WHERE entity_type = $1 AND entity_id = $2 AND certificate_type_id = $3 AND agency_id = $4
      `, [entityType, entityId, typeId, agencyId], agencyId);

      const existing = existingResult.rows[0];

      if (existing) {
        // Delete old file if it exists
        const oldFilePath = path.join(__dirname, '../../uploads', existing.file_path);
        await fsp.unlink(oldFilePath).catch(() => {});

        // Update existing certificate
        // Defense-in-depth: explicit agency_id filtering
        const updateResult = await db.query(`
          UPDATE certificates
          SET file_path = $1,
              expiry_date = $2,
              file_size = $3,
              original_filename = $4,
              filename = $5,
              mime_type = $6,
              updated_at = CURRENT_TIMESTAMP
          WHERE entity_type = $7 AND entity_id = $8 AND certificate_type_id = $9 AND agency_id = $10
          RETURNING *
        `, [filePath, expiry_date || null, req.file.size || null, req.file.originalname, req.file.filename, req.file.mimetype,
            entityType, entityId, typeId, agencyId], agencyId);

        res.json({
          message: 'Certificate updated successfully',
          certificate: updateResult.rows[0],
          filePath
        });
      } else {
        // Insert new certificate
        const insertResult = await db.query(`
          INSERT INTO certificates (agency_id, entity_type, entity_id, certificate_type_id, file_path, original_filename, filename, mime_type, expiry_date, file_size)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `, [agencyId, entityType, entityId, typeId, filePath, req.file.originalname, req.file.filename, req.file.mimetype,
            expiry_date || null, req.file.size || null], agencyId);

        res.status(201).json({
          message: 'Certificate uploaded successfully',
          certificate: insertResult.rows[0],
          filePath
        });
      }
    } catch (err) {
      // Clean up file if it was uploaded
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      handleError(res, err, 'upload certificate');
    }
  }
];

// Update certificate expiry date
exports.updateExpiryDate = asyncHandler(async (req, res) => {
  const { entityType, entityId, typeId } = req.params;
  const { expiry_date } = req.body;
  const agencyId = req.agencyId;

  // Check if certificate exists
  // Defense-in-depth: explicit agency_id filtering
  const existingResult = await db.query(`
    SELECT * FROM certificates
    WHERE entity_type = $1 AND entity_id = $2 AND certificate_type_id = $3 AND agency_id = $4
  `, [entityType, entityId, typeId, agencyId], agencyId);

  if (!existingResult.rows[0]) {
    return res.status(404).json({ error: 'Certificate not found' });
  }

  // Defense-in-depth: explicit agency_id filtering
  const updateResult = await db.query(`
    UPDATE certificates
    SET expiry_date = $1, updated_at = CURRENT_TIMESTAMP
    WHERE entity_type = $2 AND entity_id = $3 AND certificate_type_id = $4 AND agency_id = $5
    RETURNING *
  `, [expiry_date || null, entityType, entityId, typeId, agencyId], agencyId);

  res.json({ message: 'Expiry date updated successfully', certificate: updateResult.rows[0] });
}, 'update expiry date');

// Delete certificate
exports.deleteCertificate = asyncHandler(async (req, res) => {
  const { entityType, entityId, typeId } = req.params;
  const agencyId = req.agencyId;

  // Get certificate info
  // Defense-in-depth: explicit agency_id filtering
  const certificateResult = await db.query(`
    SELECT * FROM certificates
    WHERE entity_type = $1 AND entity_id = $2 AND certificate_type_id = $3 AND agency_id = $4
  `, [entityType, entityId, typeId, agencyId], agencyId);

  const certificate = certificateResult.rows[0];

  if (!certificate) {
    return res.status(404).json({ error: 'Certificate not found' });
  }

  // Delete file
  const filePath = path.join(__dirname, '../../uploads', certificate.file_path);
  await fsp.unlink(filePath).catch(() => {});

  // Delete database record - defense-in-depth: explicit agency_id filtering
  await db.query(`
    DELETE FROM certificates
    WHERE entity_type = $1 AND entity_id = $2 AND certificate_type_id = $3 AND agency_id = $4
  `, [entityType, entityId, typeId, agencyId], agencyId);

  res.json({ message: 'Certificate deleted successfully' });
}, 'delete certificate');

// Download/view a certificate
exports.download = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    'SELECT * FROM certificates WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );
  const cert = result.rows[0];
  if (!cert) {
    return res.status(404).json({ error: 'Certificate not found' });
  }

  const filePath = path.join(__dirname, '../../uploads', cert.file_path);

  // Check if file exists
  try {
    await fsp.access(filePath);
  } catch {
    return res.status(404).json({ error: 'File not found on server' });
  }

  // Set headers for download
  const mimeType = cert.mime_type || 'application/pdf';
  const originalName = cert.original_filename || cert.filename || 'certificate.pdf';
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${originalName}"`);

  // Stream file
  fs.createReadStream(filePath).pipe(res);
}, 'download certificate');

// Get certificate types with their latest documents for a given entity type (e.g., for agency docs settings page)
exports.getWithTypes = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { entityType } = req.params;

  // Defense-in-depth: explicit agency_id filtering
  // Get all certificate types for this entity type
  const typesResult = await db.query(`
    SELECT * FROM certificate_types
    WHERE is_active = true AND agency_id = $1 AND type = $2
    ORDER BY display_order ASC, display_name ASC
  `, [agencyId, entityType], agencyId);

  // Get the latest certificate for each type
  const certsResult = await db.query(`
    SELECT DISTINCT ON (certificate_type_id)
      c.*,
      ct.name as type_name,
      ct.has_expiry as type_has_expiry
    FROM certificates c
    JOIN certificate_types ct ON c.certificate_type_id = ct.id
    WHERE c.entity_type = $1 AND c.agency_id = $2
    ORDER BY certificate_type_id, c.uploaded_at DESC
  `, [entityType, agencyId], agencyId);

  // Create a map of type_id -> latest certificate
  const certsByType = {};
  for (const cert of certsResult.rows) {
    certsByType[cert.certificate_type_id] = cert;
  }

  // Combine types with their documents
  const combined = typesResult.rows.map(type => ({
    ...type,
    document: certsByType[type.id] || null
  }));

  res.json({ documentTypes: combined });
}, 'fetch certificates with types');
