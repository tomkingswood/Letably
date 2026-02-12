const { ValidationError } = require('../middleware/errorHandler');

/**
 * Validation utilities to replace repetitive validation code
 */

/**
 * Validates that required fields are present in the request body
 * @param {Object} data - Data to validate
 * @param {Array<string>} requiredFields - Array of required field names
 * @throws {ValidationError} If any required field is missing
 *
 * @example
 * validateRequiredFields(req.body, ['email', 'password', 'name']);
 */
function validateRequiredFields(data, requiredFields) {
  const missingFields = requiredFields.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  if (missingFields.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missingFields.join(', ')}`
    );
  }
}

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @throws {ValidationError} If email format is invalid
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }
}

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @param {Object} options - Validation options
 * @throws {ValidationError} If password doesn't meet requirements
 */
function validatePassword(password, options = {}) {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecialChars = false,
  } = options;

  if (password.length < minLength) {
    throw new ValidationError(`Password must be at least ${minLength} characters long`);
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    throw new ValidationError('Password must contain at least one uppercase letter');
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    throw new ValidationError('Password must contain at least one lowercase letter');
  }

  if (requireNumbers && !/[0-9]/.test(password)) {
    throw new ValidationError('Password must contain at least one number');
  }

  if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    throw new ValidationError('Password must contain at least one special character');
  }
}

/**
 * Validates that a value is a positive integer
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field (for error message)
 * @throws {ValidationError} If value is not a positive integer
 */
function validatePositiveInteger(value, fieldName) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new ValidationError(`${fieldName} must be a positive integer`);
  }
}

/**
 * Validates that a value is one of the allowed values
 * @param {any} value - Value to validate
 * @param {Array} allowedValues - Array of allowed values
 * @param {string} fieldName - Name of the field (for error message)
 * @throws {ValidationError} If value is not in allowed values
 */
function validateEnum(value, allowedValues, fieldName) {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`
    );
  }
}

/**
 * Validates that a date string is valid
 * @param {string} dateString - Date string to validate
 * @param {string} fieldName - Name of the field (for error message)
 * @throws {ValidationError} If date is invalid
 */
function validateDate(dateString, fieldName) {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid date`);
  }
}

/**
 * Sanitizes string input by trimming whitespace
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.trim();
}

/**
 * Sanitizes object by trimming all string values
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj) {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = typeof value === 'string' ? value.trim() : value;
  }
  return sanitized;
}

module.exports = {
  validateRequiredFields,
  validateEmail,
  validatePassword,
  validatePositiveInteger,
  validateEnum,
  validateDate,
  sanitizeString,
  sanitizeObject,
};
