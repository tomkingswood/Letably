/**
 * Email Template Utilities
 *
 * Provides consistent email templates with dynamic agency branding
 * All emails use the same styling structure with customizable branding
 */

/**
 * SECURITY: Escape HTML entities to prevent XSS in email templates
 * @param {string} str - String to escape
 * @returns {string} HTML-escaped string
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Default Brand Colors (can be overridden by agency settings)
const COLORS = {
  primary: '#1E3A5F',        // Default Letably Blue
  primaryHover: '#152d4a',   // Darker blue for hover
  text: '#1f2937',           // Dark gray text
  textLight: '#6b7280',      // Light gray text
  border: '#e5e7eb',         // Light gray border
  background: '#f9fafb',     // Off-white background
  success: '#10b981',        // Green
  warning: '#f59e0b',        // Amber
  danger: '#ef4444',         // Red
  info: '#3b82f6'            // Blue
};

/**
 * Default branding (used when no agency branding provided)
 */
const DEFAULT_BRANDING = {
  companyName: 'Letably',
  tagline: 'Property Management Platform',
  email: 'support@letably.com',
  phone: '',
  website: 'letably.com',
  logoUrl: null,
  primaryColor: COLORS.primary,
};

/**
 * Get base email styles
 * @param {string} primaryColor - Primary brand color
 */
function getBaseStyles(primaryColor = COLORS.primary) {
  return `
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      background-color: ${COLORS.background};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-header {
      background-color: ${primaryColor};
      padding: 30px 20px;
      text-align: center;
    }
    .email-header-text {
      color: #ffffff;
      font-size: 24px;
      font-weight: bold;
      margin: 0;
    }
    .email-logo {
      max-width: 120px;
      height: auto;
    }
    .email-body {
      padding: 30px 20px;
      color: ${COLORS.text};
      line-height: 1.6;
    }
    .email-footer {
      background-color: ${COLORS.background};
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: ${COLORS.textLight};
      border-top: 1px solid ${COLORS.border};
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background-color: ${primaryColor};
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
      margin: 20px 0;
    }
    .info-box {
      background-color: ${COLORS.background};
      border-left: 4px solid ${primaryColor};
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .warning-box {
      background-color: #FEF3C7;
      border-left: 4px solid ${COLORS.warning};
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .success-box {
      background-color: #D1FAE5;
      border-left: 4px solid ${COLORS.success};
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .danger-box {
      background-color: #FEE2E2;
      border-left: 4px solid ${COLORS.danger};
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    h1 {
      margin: 0 0 20px 0;
      color: ${COLORS.text};
      font-size: 24px;
      font-weight: bold;
    }
    h2 {
      margin: 20px 0 10px 0;
      color: ${COLORS.text};
      font-size: 20px;
      font-weight: bold;
    }
    p {
      margin: 10px 0;
    }
    .text-small {
      font-size: 14px;
    }
    .text-muted {
      color: ${COLORS.textLight};
    }
    hr {
      border: none;
      border-top: 1px solid ${COLORS.border};
      margin: 20px 0;
    }
  `;
}

/**
 * Get email header with logo or text
 * @param {Object} branding - Branding options
 */
function getEmailHeader(branding = {}) {
  const { companyName, logoUrl, primaryColor } = { ...DEFAULT_BRANDING, ...branding };

  if (logoUrl) {
    return `
      <div class="email-header" style="background-color: ${primaryColor || COLORS.primary};">
        <img src="${logoUrl}" alt="${escapeHtml(companyName)}" class="email-logo" />
      </div>
    `;
  }

  return `
    <div class="email-header" style="background-color: ${primaryColor || COLORS.primary};">
      <p class="email-header-text">${escapeHtml(companyName)}</p>
    </div>
  `;
}

/**
 * Get email footer
 * @param {Object} branding - Branding options
 */
function getEmailFooter(branding = {}) {
  const { companyName, tagline, email, phone, website } = { ...DEFAULT_BRANDING, ...branding };

  const contactParts = [];
  if (email) {
    contactParts.push(`<a href="mailto:${escapeHtml(email)}" style="color: ${COLORS.textLight};">${escapeHtml(email)}</a>`);
  }
  if (phone) {
    contactParts.push(`<a href="tel:${escapeHtml(phone.replace(/\s/g, ''))}" style="color: ${COLORS.textLight};">${escapeHtml(phone)}</a>`);
  }

  return `
    <div class="email-footer">
      <p style="margin: 0 0 10px 0;"><strong>${escapeHtml(companyName)}</strong></p>
      ${tagline ? `<p style="margin: 0 0 10px 0;">${escapeHtml(tagline)}</p>` : ''}
      ${contactParts.length > 0 ? `<p style="margin: 0 0 10px 0;">${contactParts.join(' | ')}</p>` : ''}
      ${website ? `<p style="margin: 0 0 10px 0;"><a href="https://${escapeHtml(website.replace(/^https?:\/\//, ''))}" style="color: ${COLORS.textLight};">www.${escapeHtml(website.replace(/^(https?:\/\/)?(www\.)?/, ''))}</a></p>` : ''}
      <hr style="border: none; border-top: 1px solid ${COLORS.border}; margin: 15px 0;" />
      <p style="margin: 5px 0; font-size: 11px; color: #9ca3af;">
        This is an automated email from ${escapeHtml(companyName)}. Please do not reply to this email.
      </p>
      <p style="margin: 5px 0; font-size: 11px; color: #9ca3af;">
        &copy; ${new Date().getFullYear()} ${escapeHtml(companyName)}. All rights reserved.
      </p>
    </div>
  `;
}

/**
 * Create a complete HTML email template
 *
 * @param {string} subject - Email subject
 * @param {string} bodyContent - HTML content for the email body
 * @param {Object} branding - Optional branding options
 * @param {string} branding.companyName - Company name
 * @param {string} branding.tagline - Company tagline
 * @param {string} branding.email - Contact email
 * @param {string} branding.phone - Contact phone
 * @param {string} branding.website - Company website
 * @param {string} branding.logoUrl - Logo URL
 * @param {string} branding.primaryColor - Primary brand color (hex)
 * @returns {string} Complete HTML email
 */
function createEmailTemplate(subject, bodyContent, branding = {}) {
  const mergedBranding = { ...DEFAULT_BRANDING, ...branding };
  const primaryColor = mergedBranding.primaryColor || COLORS.primary;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    ${getBaseStyles(primaryColor)}
  </style>
</head>
<body>
  <div class="email-container">
    ${getEmailHeader(mergedBranding)}
    <div class="email-body">
      ${bodyContent}
    </div>
    ${getEmailFooter(mergedBranding)}
  </div>
</body>
</html>
  `.trim();
}

/**
 * Create a button
 *
 * @param {string} url - Button URL
 * @param {string} text - Button text
 * @param {string} primaryColor - Button color (optional)
 * @param {string} style - Additional inline styles (optional)
 * @returns {string} Button HTML
 */
function createButton(url, text, primaryColor = COLORS.primary, style = '') {
  const inlineStyles = `display: inline-block; padding: 14px 28px; background-color: ${primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; ${style}`;
  return `
    <a href="${url}" class="button" style="${inlineStyles}">${escapeHtml(text)}</a>
  `;
}

/**
 * Create an info box
 *
 * @param {string} content - HTML content for the box
 * @param {string} type - Box type: 'info' (default), 'warning', 'success', 'danger'
 * @returns {string} Info box HTML
 */
function createInfoBox(content, type = 'info') {
  const classMap = {
    info: 'info-box',
    warning: 'warning-box',
    success: 'success-box',
    danger: 'danger-box'
  };

  return `
    <div class="${classMap[type] || 'info-box'}">
      ${content}
    </div>
  `;
}

module.exports = {
  COLORS,
  DEFAULT_BRANDING,
  escapeHtml,
  createEmailTemplate,
  createButton,
  createInfoBox,
  getBaseStyles,
  getEmailHeader,
  getEmailFooter
};
