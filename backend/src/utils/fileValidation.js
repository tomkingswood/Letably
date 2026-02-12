/**
 * File Validation Utilities
 *
 * Validates uploaded files for security:
 * - Checks actual file type (magic bytes), not just extension
 * - Enforces file size limits
 * - Allows only safe file types
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Allowed MIME types for ID documents
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg', // Some browsers use this variant
  'image/png',
  'application/pdf'
];

// Magic bytes (file signatures) for allowed file types
const FILE_SIGNATURES = {
  'image/jpeg': [
    [0xFF, 0xD8] // JPEG (all variants: JFIF, EXIF, etc.)
  ],
  'image/jpg': [
    [0xFF, 0xD8] // JPEG (all variants: JFIF, EXIF, etc.)
  ],
  'image/png': [
    [0x89, 0x50, 0x4E, 0x47] // PNG
  ],
  'application/pdf': [
    [0x25, 0x50, 0x44, 0x46] // PDF (%PDF)
  ]
};

/**
 * Validate file size
 * @param {number} size - File size in bytes
 * @returns {Object} {valid: boolean, error?: string}
 */
function validateFileSize(size) {
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
    };
  }
  return { valid: true };
}

/**
 * Validate MIME type
 * @param {string} mimeType - File MIME type
 * @returns {Object} {valid: boolean, error?: string}
 */
function validateMimeType(mimeType) {
  // Allow any image/* MIME type or PDF
  const isImage = mimeType && mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';

  if (!isImage && !isPdf) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: Images (JPEG, PNG, etc.) or PDF`
    };
  }
  return { valid: true };
}

/**
 * Validate file content by checking magic bytes
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - Claimed MIME type
 * @returns {Object} {valid: boolean, error?: string}
 */
function validateFileContent(buffer, mimeType) {
  // Check if buffer exists and has data
  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      error: 'File upload failed - no file data received'
    };
  }

  // For image/* MIME types, check against common image signatures
  const isImageMime = mimeType && mimeType.startsWith('image/');
  const isPdfMime = mimeType === 'application/pdf';

  if (isPdfMime) {
    // Validate PDF signature
    const pdfSignature = [0x25, 0x50, 0x44, 0x46]; // %PDF
    const isValidPdf = pdfSignature.every((byte, index) => buffer[index] === byte);

    if (!isValidPdf) {
      return {
        valid: false,
        error: 'File content does not match claimed file type. Possible security risk.'
      };
    }
    return { valid: true };
  }

  if (isImageMime) {
    // Check against all known image signatures
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46; // GIF
    const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50; // WEBP
    const isBmp = buffer[0] === 0x42 && buffer[1] === 0x4D; // BMP

    if (isJpeg || isPng || isGif || isWebp || isBmp) {
      return { valid: true };
    }

    return {
      valid: false,
      error: 'Unrecognized image format. Please upload JPEG, PNG, GIF, WEBP, or BMP.'
    };
  }

  // Unknown MIME type
  return {
    valid: false,
    error: 'Unknown file type'
  };
}

/**
 * Comprehensive file validation
 * @param {Object} file - Multer file object
 * @returns {Object} {valid: boolean, error?: string}
 */
function validateFile(file) {
  // Check size
  const sizeValidation = validateFileSize(file.size);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  // Check MIME type
  const mimeValidation = validateMimeType(file.mimetype);
  if (!mimeValidation.valid) {
    return mimeValidation;
  }

  // Check file content (magic bytes)
  const contentValidation = validateFileContent(file.buffer, file.mimetype);
  if (!contentValidation.valid) {
    return contentValidation;
  }

  return { valid: true };
}

module.exports = {
  validateFile,
  validateFileSize,
  validateMimeType,
  validateFileContent,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES
};
