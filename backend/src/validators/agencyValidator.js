/**
 * Agency Validator
 *
 * Validation utilities for agency data.
 */

/**
 * Validate hex color format
 */
function isValidHexColor(color) {
  if (!color) return true; // Optional field
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Validate URL format
 */
function isValidUrl(url) {
  if (!url) return true; // Optional field
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate agency slug format
 */
function isValidSlug(slug) {
  // Alphanumeric and hyphens, 3-50 characters
  return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug);
}

/**
 * Reserved slugs that cannot be used
 */
const RESERVED_SLUGS = [
  'api',
  'admin',
  'signup',
  'login',
  'register',
  'guarantor',
  'public',
  'static',
  'assets',
  '_next',
  'letably',
  'support',
  'help',
  'docs',
  'app',
  'dashboard'
];

/**
 * Check if slug is reserved
 */
function isReservedSlug(slug) {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}

/**
 * Validate agency registration data
 */
function validateRegistration(data) {
  const errors = [];

  // Agency fields
  if (!data.agency_name || data.agency_name.length < 2) {
    errors.push('Agency name must be at least 2 characters');
  }
  if (data.agency_name && data.agency_name.length > 100) {
    errors.push('Agency name must be less than 100 characters');
  }

  if (!data.agency_email) {
    errors.push('Agency email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.agency_email)) {
    errors.push('Invalid agency email format');
  }

  // Admin fields
  if (!data.admin_email) {
    errors.push('Admin email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.admin_email)) {
    errors.push('Invalid admin email format');
  }

  if (!data.admin_password) {
    errors.push('Admin password is required');
  } else if (data.admin_password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!data.admin_first_name || data.admin_first_name.length < 1) {
    errors.push('Admin first name is required');
  }

  if (!data.admin_last_name || data.admin_last_name.length < 1) {
    errors.push('Admin last name is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate branding data
 */
function validateBranding(data) {
  const errors = [];

  if (data.logo_url && !isValidUrl(data.logo_url)) {
    errors.push('Invalid logo URL format');
  }

  if (data.primary_color && !isValidHexColor(data.primary_color)) {
    errors.push('Invalid primary color format. Use hex format: #RRGGBB');
  }

  if (data.secondary_color && !isValidHexColor(data.secondary_color)) {
    errors.push('Invalid secondary color format. Use hex format: #RRGGBB');
  }

  if (data.show_powered_by !== undefined && typeof data.show_powered_by !== 'boolean') {
    errors.push('show_powered_by must be a boolean');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate domain format
 */
function isValidDomain(domain) {
  // Basic domain validation
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

module.exports = {
  isValidHexColor,
  isValidUrl,
  isValidSlug,
  isReservedSlug,
  validateRegistration,
  validateBranding,
  isValidDomain,
  RESERVED_SLUGS
};
