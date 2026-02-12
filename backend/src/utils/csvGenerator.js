/**
 * CSV Generator Utility
 *
 * Generates CSV files from data with proper escaping and formatting.
 */

/**
 * Escape a value for CSV format
 * @param {any} value - The value to escape
 * @returns {string} - Escaped CSV value
 */
const escapeCSV = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If contains comma, quote, newline, or starts/ends with whitespace, wrap in quotes
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r') ||
    stringValue !== stringValue.trim()
  ) {
    // Escape quotes by doubling them
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }

  return stringValue;
};

/**
 * Format a date value for CSV
 * @param {string|Date} value - Date value
 * @param {boolean} includeTime - Whether to include time
 * @returns {string} - Formatted date string
 */
const formatDate = (value, includeTime = false) => {
  if (!value) return '';

  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);

  if (includeTime) {
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }

  return date.toISOString().substring(0, 10);
};

/**
 * Format a currency value for CSV
 * @param {number|string} value - Currency value
 * @returns {string} - Formatted currency string
 */
const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '';

  const num = parseFloat(value);
  if (isNaN(num)) return String(value);

  return num.toFixed(2);
};

/**
 * Generate CSV content from rows
 * @param {Array<object>} rows - Data rows
 * @param {Array<{key: string, label: string, transform?: Function}>} columns - Column definitions
 * @returns {string} - CSV content
 */
const generateCSV = (rows, columns) => {
  const lines = [];

  // Header row
  const headers = columns.map(col => escapeCSV(col.label));
  lines.push(headers.join(','));

  // Data rows
  for (const row of rows) {
    const values = columns.map(col => {
      let value = row[col.key];

      // Apply transform if provided
      if (col.transform) {
        value = col.transform(value, row);
      }

      return escapeCSV(value);
    });
    lines.push(values.join(','));
  }

  return lines.join('\r\n');
};

/**
 * Stream CSV content to a writable stream
 * @param {WritableStream} stream - Output stream
 * @param {Array<object>} rows - Data rows
 * @param {Array<{key: string, label: string, transform?: Function}>} columns - Column definitions
 * @param {Function} onProgress - Progress callback (percentage)
 */
const streamCSV = async (stream, rows, columns, onProgress) => {
  // Write BOM for Excel compatibility
  stream.write('\ufeff');

  // Header row
  const headers = columns.map(col => escapeCSV(col.label));
  stream.write(headers.join(',') + '\r\n');

  // Data rows with progress updates
  const total = rows.length;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const values = columns.map(col => {
      let value = row[col.key];

      // Apply transform if provided
      if (col.transform) {
        value = col.transform(value, row);
      }

      return escapeCSV(value);
    });
    stream.write(values.join(',') + '\r\n');

    // Report progress every 100 rows
    if (onProgress && (i + 1) % 100 === 0) {
      onProgress(Math.round(((i + 1) / total) * 100));
    }
  }

  if (onProgress) {
    onProgress(100);
  }
};

module.exports = {
  escapeCSV,
  formatDate,
  formatCurrency,
  generateCSV,
  streamCSV,
};
