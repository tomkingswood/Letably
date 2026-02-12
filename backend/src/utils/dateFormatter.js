/**
 * Centralized date formatting utilities for backend
 * Ensures consistent date output across all services, controllers, and emails
 *
 * Replaces 50+ instances of inline `.toLocaleDateString('en-GB')` calls
 * Matches frontend dateUtils.ts for consistency
 */

/**
 * Format date for UK display
 *
 * @param {string|Date} dateString - The date to format
 * @param {string} format - Format type: 'short' (DD/MM/YYYY), 'long' (DD Month YYYY), 'full' (DD Month YYYY with day)
 * @returns {string} Formatted date string or empty string if invalid
 *
 * @example
 * formatDate('2025-12-01', 'short')  // "01/12/2025"
 * formatDate('2025-12-01', 'long')   // "01 December 2025"
 * formatDate('2025-12-01', 'full')   // "Monday, 01 December 2025"
 */
function formatDate(dateString, format = 'short') {
  if (!dateString) return '';

  const date = new Date(dateString);

  // Check if date is valid
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date provided to formatDate: ${dateString}`);
    return '';
  }

  switch(format) {
    case 'short':
      // DD/MM/YYYY
      return date.toLocaleDateString('en-GB');

    case 'long':
      // DD Month YYYY (e.g., "01 December 2025")
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

    case 'medium':
      // DD Mon YYYY (e.g., "01 Dec 2025")
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

    case 'full':
      // Weekday, DD Month YYYY (e.g., "Monday, 01 December 2025")
      return date.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

    case 'month_year':
      // Month YYYY (e.g., "December 2025") - used for payment periods
      return date.toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric'
      });

    default:
      return date.toLocaleDateString('en-GB');
  }
}

/**
 * Format date and time for UK display
 *
 * @param {string|Date} dateString - The date to format
 * @returns {string} Formatted date-time string (DD/MM/YYYY HH:MM)
 *
 * @example
 * formatDateTime('2025-12-01T14:30:00') // "01/12/2025 14:30"
 */
function formatDateTime(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    console.warn(`Invalid date provided to formatDateTime: ${dateString}`);
    return '';
  }

  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format date range (e.g., "01/12/2025 - 30/11/2026")
 *
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @param {string} format - Format type (same as formatDate)
 * @returns {string} Formatted date range
 *
 * @example
 * formatDateRange('2025-12-01', '2026-11-30') // "01/12/2025 - 30/11/2026"
 */
function formatDateRange(startDate, endDate, format = 'short') {
  const formattedStart = formatDate(startDate, format);
  const formattedEnd = formatDate(endDate, format);

  if (!formattedStart || !formattedEnd) return '';

  return `${formattedStart} - ${formattedEnd}`;
}

/**
 * Check if a date is in the past
 *
 * @param {string|Date} dateString - The date to check
 * @returns {boolean} True if date is in the past
 */
function isPast(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date < new Date();
}

/**
 * Check if a date is in the future
 *
 * @param {string|Date} dateString - The date to check
 * @returns {boolean} True if date is in the future
 */
function isFuture(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date > new Date();
}

/**
 * Format date as YYYY-MM-DD without timezone conversion
 * Used for database storage and API responses
 *
 * @param {Date} date - The date to format
 * @returns {string} Date in YYYY-MM-DD format
 *
 * @example
 * formatDateISO(new Date(2025, 11, 1)) // "2025-12-01"
 */
function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate number of days between two dates (inclusive)
 * Normalizes to UTC midnight to avoid DST issues
 *
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {number} Number of days (inclusive)
 *
 * @example
 * calculateDays('2025-12-01', '2025-12-01') // 1 (same day = 1 day)
 * calculateDays('2025-12-01', '2025-12-31') // 31
 */
function calculateDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Normalize to UTC midnight to avoid DST issues
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

  const diffTime = Math.abs(endUTC - startUTC);
  // Add 1 day to make it inclusive (Nov 1 to Nov 1 = 1 day)
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Get the last day of a month
 *
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @returns {Date} Date object representing last day of month
 */
function getLastDayOfMonth(year, month) {
  return new Date(year, month + 1, 0);
}

/**
 * Get month name from month index
 *
 * @param {number} month - Month (0-11)
 * @returns {string} Full month name
 */
function getMonthName(month) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return monthNames[month];
}

module.exports = {
  formatDate,
  formatDateTime,
  formatDateRange,
  formatDateISO,
  calculateDays,
  getLastDayOfMonth,
  getMonthName,
  isPast,
  isFuture
};
