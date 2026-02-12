const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Consolidated upload middleware factory
 * Creates multer upload instances with flexible configuration
 *
 * @param {Object} options - Upload configuration options
 * @param {string} options.destination - Upload destination directory (default: 'uploads')
 * @param {Array<string>} options.allowedTypes - Allowed file extensions (e.g., ['jpg', 'png', 'pdf'])
 * @param {Array<string>} options.allowedMimeTypes - Allowed MIME types (e.g., ['image/jpeg', 'application/pdf'])
 * @param {number} options.maxSize - Maximum file size in MB (default: 10)
 * @param {boolean} options.preserveFilename - Whether to keep original filename (default: false)
 * @param {string} options.errorMessage - Custom error message for invalid file types
 * @returns {multer.Multer} Configured multer instance
 *
 * @example
 * // Image upload
 * const imageUpload = createUploadMiddleware({
 *   allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
 *   allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
 *   maxSize: 5,
 *   errorMessage: 'Only image files are allowed!'
 * });
 *
 * @example
 * // PDF upload
 * const pdfUpload = createUploadMiddleware({
 *   allowedTypes: ['pdf'],
 *   allowedMimeTypes: ['application/pdf'],
 *   maxSize: 10,
 *   errorMessage: 'Only PDF files are allowed!'
 * });
 */
function createUploadMiddleware(options = {}) {
  const {
    destination = 'uploads',
    allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'],
    allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
    maxSize = 10, // MB
    preserveFilename = false,
    errorMessage = 'File type not allowed!',
  } = options;

  // Resolve upload directory path
  const uploadsDir = path.join(__dirname, '../../', destination);

  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Configure storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      if (preserveFilename) {
        // Keep original filename
        cb(null, file.originalname);
      } else {
        // Generate unique filename with timestamp and random number
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      }
    },
  });

  // File filter
  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().substring(1); // Remove the dot
    const isValidExtension = allowedTypes.includes(ext);
    const isValidMimeType = allowedMimeTypes.includes(file.mimetype);

    if (isValidExtension && isValidMimeType) {
      return cb(null, true);
    } else {
      cb(new Error(errorMessage));
    }
  };

  // Create and return multer instance
  return multer({
    storage,
    limits: {
      fileSize: maxSize * 1024 * 1024, // Convert MB to bytes
    },
    fileFilter,
  });
}

// ============================================
// Shared attachment upload configuration
// ============================================

// Comprehensive blocked extensions list (superset from all attachment routes)
const BLOCKED_EXTENSIONS = /\.(exe|bat|cmd|sh|php|js|py|pl|rb|ps1|vbs|msi|jar|com|scr|pif|application|gadget|msc|hta|cpl|msp|inf|reg|ws|wsf|wsc|wsh|lnk|dll|cgi)$/i;

// Allowed MIME types for attachment uploads (images + documents)
const ATTACHMENT_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/**
 * Creates an attachment upload middleware with error handling.
 * Used for maintenance, communication, and landlord panel file uploads.
 *
 * @param {Object} options
 * @param {string} options.destination - Upload directory relative to backend root (e.g. 'uploads/maintenance')
 * @param {string} [options.filePrefix=''] - Prefix for generated filenames (e.g. 'maintenance-')
 * @param {number} [options.maxFiles=10] - Maximum files per request
 * @param {number} [options.maxSizeMB=10] - Maximum file size in MB
 * @param {string} [options.fieldName='attachments'] - Form field name for files
 * @returns {Function} Express middleware (req, res, next)
 */
function createAttachmentUpload(options = {}) {
  const {
    destination,
    filePrefix = '',
    maxFiles = 10,
    maxSizeMB = 10,
    fieldName = 'attachments',
  } = options;

  const uploadsDir = path.join(__dirname, '../../', destination);

  // Ensure directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `${filePrefix}${uniqueSuffix}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: maxSizeMB * 1024 * 1024,
      files: maxFiles,
    },
    fileFilter: (req, file, cb) => {
      if (BLOCKED_EXTENSIONS.test(file.originalname)) {
        return cb(new Error('File type not allowed for security reasons'));
      }
      if (ATTACHMENT_MIME_TYPES.includes(file.mimetype)) {
        return cb(null, true);
      }
      cb(new Error('Only images and documents (PDF, Word, Excel) are allowed'));
    },
  });

  const handleUpload = upload.array(fieldName, maxFiles);

  // Return error-handling middleware
  return (req, res, next) => {
    handleUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: `File too large. Maximum size is ${maxSizeMB}MB per file.` });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: `Too many files. Maximum ${maxFiles} files per upload.` });
        }
        return res.status(400).json({ error: err.message });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  };
}

// Pre-configured upload instances for common use cases

/**
 * Image upload middleware (JPEG, PNG, GIF, WebP)
 * Max size: 5MB
 */
const imageUpload = createUploadMiddleware({
  allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  maxSize: 5,
  preserveFilename: false,
  errorMessage: 'Only image files (JPEG, PNG, GIF, WebP) are allowed!',
});

/**
 * PDF document upload middleware
 * Max size: 10MB
 */
const pdfUpload = createUploadMiddleware({
  allowedTypes: ['pdf'],
  allowedMimeTypes: ['application/pdf'],
  maxSize: 10,
  preserveFilename: false,
  errorMessage: 'Only PDF files are allowed!',
});

/**
 * Legal document upload middleware (PDF and images)
 * Max size: 10MB
 * Preserves original filename
 */
const legalDocumentUpload = createUploadMiddleware({
  allowedTypes: ['pdf', 'jpg', 'jpeg', 'png'],
  allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  maxSize: 10,
  preserveFilename: true,
  errorMessage: 'Only PDF and image files (JPG, PNG) are allowed!',
});

/**
 * ID document upload middleware (Images only)
 * Max size: 10MB
 */
const idDocumentUpload = createUploadMiddleware({
  allowedTypes: ['jpg', 'jpeg', 'png'],
  allowedMimeTypes: ['image/jpeg', 'image/png'],
  maxSize: 10,
  preserveFilename: false,
  errorMessage: 'Only image files (JPG, PNG) are allowed for ID documents!',
});

module.exports = {
  createUploadMiddleware,
  createAttachmentUpload,
  imageUpload,
  pdfUpload,
  legalDocumentUpload,
  idDocumentUpload,
  BLOCKED_EXTENSIONS,
  ATTACHMENT_MIME_TYPES,
};
