/**
 * Spam and malicious input detection utilities
 */

// SQL injection patterns to detect
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|FETCH|DECLARE|TRUNCATE)\b)/i,
  /(\b(OR|AND)\s+[\d\w]+\s*=\s*[\d\w]+)/i, // OR 1=1, AND 1=1
  /('|\"|;|--|\*|\/\*|\*\/)/,  // SQL comment/quote patterns
  /(DBMS_PIPE|CHR\(|CHAR\(|CONCAT\(|SLEEP\(|BENCHMARK\(|WAITFOR\s+DELAY)/i,
  /(\|\||&&)/,  // Oracle concatenation or shell operators
  /(0x[0-9a-f]+)/i, // Hex encoding
  /(\\x[0-9a-f]{2})/i, // Escaped hex
];

// XSS patterns to detect
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/i,
  /on\w+\s*=/i, // onclick=, onerror=, etc.
  /<\s*iframe/i,
  /<\s*object/i,
  /<\s*embed/i,
  /<\s*img[^>]+onerror/i,
  /expression\s*\(/i,
  /url\s*\([^)]*javascript/i,
];

// Obviously fake/test data patterns
const SPAM_PATTERNS = [
  /testing@example\.com/i,
  /test@test\.(com|org|net)/i,
  /555-\d{3}-\d{4}/, // US fake phone format
  /123-?456-?789/,
  /000-?000-?0000/,
  /pHqghUme/i, // Common scanner test value
  /1234567890/,
  /%27|%22|%3C|%3E|%00/i, // URL encoded special chars
  /@@\w+/, // Email with @@ pattern
];

// Invalid email patterns (appended injection attempts)
const INVALID_EMAIL_PATTERNS = [
  /['"`\\|;]/, // Quotes, pipes, semicolons in email
  /\s/, // Whitespace in email
  /@.*@/, // Multiple @ signs
  /\.(com|org|net|co\.uk)[^$]/, // Characters after TLD (e.g., .com' OR...)
  /SLEEP\(/i,
  /PG_SLEEP/i,
  /waitfor\s+delay/i,
  /sysdate\(\)/i,
  /XOR\(/i,
];

/**
 * Check if a string contains SQL injection attempts
 * @param {string} input
 * @returns {boolean}
 */
const containsSqlInjection = (input) => {
  if (!input || typeof input !== 'string') return false;
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
};

/**
 * Check if a string contains XSS attempts
 * @param {string} input
 * @returns {boolean}
 */
const containsXss = (input) => {
  if (!input || typeof input !== 'string') return false;
  return XSS_PATTERNS.some(pattern => pattern.test(input));
};

/**
 * Check if input looks like spam/test data
 * @param {string} input
 * @returns {boolean}
 */
const containsSpamPatterns = (input) => {
  if (!input || typeof input !== 'string') return false;
  return SPAM_PATTERNS.some(pattern => pattern.test(input));
};

/**
 * Validate email is properly formatted and not an injection attempt
 * @param {string} email
 * @returns {{ isValid: boolean, reason?: string }}
 */
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, reason: 'Email is required' };
  }

  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, reason: 'Invalid email format' };
  }

  // Check for injection attempts in email
  for (const pattern of INVALID_EMAIL_PATTERNS) {
    if (pattern.test(email)) {
      console.log(`Invalid email pattern detected: ${email.substring(0, 50)}`);
      return { isValid: false, reason: 'Invalid email format' };
    }
  }

  // Check for SQL injection
  if (containsSqlInjection(email)) {
    console.log(`SQL injection in email detected: ${email.substring(0, 50)}`);
    return { isValid: false, reason: 'Invalid email format' };
  }

  // Check length
  if (email.length > 254) {
    return { isValid: false, reason: 'Email is too long' };
  }

  return { isValid: true };
};

/**
 * Validate all fields of a form submission
 * @param {Object} fields - Object with field names and values
 * @returns {{ isValid: boolean, reason?: string }}
 */
const validateFormSubmission = (fields) => {
  const allValues = Object.values(fields).filter(v => typeof v === 'string');
  const allText = allValues.join(' ');

  // Check for SQL injection
  for (const [fieldName, value] of Object.entries(fields)) {
    if (typeof value === 'string' && containsSqlInjection(value)) {
      console.log(`SQL injection detected in ${fieldName}: ${value.substring(0, 100)}`);
      return { isValid: false, reason: 'Invalid characters detected' };
    }
  }

  // Check for XSS
  for (const [fieldName, value] of Object.entries(fields)) {
    if (typeof value === 'string' && containsXss(value)) {
      console.log(`XSS attempt detected in ${fieldName}: ${value.substring(0, 100)}`);
      return { isValid: false, reason: 'Invalid content detected' };
    }
  }

  // Check for spam patterns
  const spamFieldCount = Object.values(fields).filter(
    v => typeof v === 'string' && containsSpamPatterns(v)
  ).length;

  // If multiple fields match spam patterns, likely a scanner
  if (spamFieldCount >= 2) {
    console.log(`Spam patterns detected in ${spamFieldCount} fields`);
    return { isValid: false, reason: 'Submission rejected' };
  }

  return { isValid: true };
};

/**
 * Check honeypot field - should be empty for valid submissions
 * @param {string} honeypotValue
 * @returns {boolean} - true if valid (empty), false if bot filled it
 */
const validateHoneypot = (honeypotValue) => {
  // Honeypot should be empty - bots fill it, humans don't see it
  if (honeypotValue && honeypotValue.trim() !== '') {
    console.log(`Honeypot triggered with value: ${honeypotValue.substring(0, 50)}`);
    return false;
  }
  return true;
};

module.exports = {
  containsSqlInjection,
  containsXss,
  containsSpamPatterns,
  validateFormSubmission,
  validateHoneypot,
  validateEmail
};
