/**
 * File Encryption Utilities
 *
 * Provides AES-256-GCM encryption/decryption for sensitive files
 *
 * Security features:
 * - AES-256-GCM authenticated encryption
 * - Unique IV (Initialization Vector) per file
 * - Authentication tag prevents tampering
 * - Key stored in environment variable
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment
 * @returns {Buffer} 32-byte encryption key
 */
function getEncryptionKey() {
  const key = process.env.FILE_ENCRYPTION_KEY;

  if (!key) {
    throw new Error('FILE_ENCRYPTION_KEY not set in environment variables');
  }

  // Key should be 64 hex characters (32 bytes)
  if (key.length !== 64) {
    throw new Error('FILE_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a file buffer
 * @param {Buffer} buffer - File data to encrypt
 * @returns {Buffer} Encrypted data (IV + Auth Tag + Encrypted Data)
 */
function encryptFile(buffer) {
  try {
    const key = getEncryptionKey();

    // Generate random IV for this file
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the data
    const encrypted = Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Return: IV (16 bytes) + Auth Tag (16 bytes) + Encrypted Data
    return Buffer.concat([iv, authTag, encrypted]);

  } catch (error) {
    console.error('Encryption error:', error.message);
    throw new Error('Failed to encrypt file');
  }
}

/**
 * Decrypt a file buffer
 * @param {Buffer} encryptedBuffer - Encrypted data (IV + Auth Tag + Encrypted Data)
 * @returns {Buffer} Decrypted file data
 */
function decryptFile(encryptedBuffer) {
  try {
    const key = getEncryptionKey();

    // Extract IV (first 16 bytes)
    const iv = encryptedBuffer.slice(0, IV_LENGTH);

    // Extract Auth Tag (next 16 bytes)
    const authTag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);

    // Extract encrypted data (remaining bytes)
    const encrypted = encryptedBuffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the data
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted;

  } catch (error) {
    console.error('Decryption error:', error.message);
    throw new Error('Failed to decrypt file - file may be corrupted or tampered with');
  }
}

/**
 * Generate a new encryption key (for initial setup)
 * @returns {string} 64-character hex string (32 bytes)
 */
function generateEncryptionKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

module.exports = {
  encryptFile,
  decryptFile,
  generateEncryptionKey
};
