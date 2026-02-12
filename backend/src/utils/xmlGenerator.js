/**
 * XML Generator Utility
 *
 * Generates XML files from data with proper escaping and formatting.
 */

/**
 * Escape a value for XML content
 * @param {any} value - The value to escape
 * @returns {string} - Escaped XML value
 */
const escapeXML = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Convert a string to a valid XML element name
 * @param {string} name - Original name
 * @returns {string} - Valid XML element name
 */
const toXMLName = (name) => {
  // Replace invalid characters with underscores
  let xmlName = String(name)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^[0-9-]/, '_$&');

  // Ensure it doesn't start with "xml" (reserved)
  if (xmlName.toLowerCase().startsWith('xml')) {
    xmlName = '_' + xmlName;
  }

  return xmlName || '_element';
};

/**
 * Format a date value for XML
 * @param {string|Date} value - Date value
 * @param {boolean} includeTime - Whether to include time
 * @returns {string} - Formatted date string (ISO format)
 */
const formatDate = (value, includeTime = false) => {
  if (!value) return '';

  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);

  if (includeTime) {
    return date.toISOString();
  }

  return date.toISOString().substring(0, 10);
};

/**
 * Generate XML element
 * @param {string} name - Element name
 * @param {any} value - Element value
 * @param {object} attributes - Element attributes
 * @param {number} indent - Indentation level
 * @returns {string} - XML element string
 */
const createElement = (name, value, attributes = {}, indent = 0) => {
  const padding = '  '.repeat(indent);
  const safeName = toXMLName(name);

  // Build attributes string
  const attrs = Object.entries(attributes)
    .map(([key, val]) => `${toXMLName(key)}="${escapeXML(val)}"`)
    .join(' ');
  const attrsStr = attrs ? ' ' + attrs : '';

  // Handle empty/null values
  if (value === null || value === undefined || value === '') {
    return `${padding}<${safeName}${attrsStr} />`;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    const items = value
      .map(item => createElement('item', item, {}, indent + 1))
      .join('\n');
    return `${padding}<${safeName}${attrsStr}>\n${items}\n${padding}</${safeName}>`;
  }

  // Handle objects
  if (typeof value === 'object' && !(value instanceof Date)) {
    const children = Object.entries(value)
      .map(([key, val]) => createElement(key, val, {}, indent + 1))
      .join('\n');
    return `${padding}<${safeName}${attrsStr}>\n${children}\n${padding}</${safeName}>`;
  }

  // Handle primitive values
  return `${padding}<${safeName}${attrsStr}>${escapeXML(value)}</${safeName}>`;
};

/**
 * Generate XML content from rows
 * @param {Array<object>} rows - Data rows
 * @param {string} rootElement - Root element name
 * @param {string} rowElement - Row element name
 * @param {Array<{key: string, xmlName: string, transform?: Function}>} schema - XML schema
 * @returns {string} - XML content
 */
const generateXML = (rows, rootElement, rowElement, schema) => {
  const lines = [];

  // XML declaration
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');

  // Root element start
  lines.push(`<${toXMLName(rootElement)}>`);

  // Row elements
  for (const row of rows) {
    lines.push(`  <${toXMLName(rowElement)}>`);

    for (const field of schema) {
      let value = row[field.key];

      // Apply transform if provided
      if (field.transform) {
        value = field.transform(value, row);
      }

      const xmlName = field.xmlName || toXMLName(field.key);
      lines.push(createElement(xmlName, value, {}, 2));
    }

    lines.push(`  </${toXMLName(rowElement)}>`);
  }

  // Root element end
  lines.push(`</${toXMLName(rootElement)}>`);

  return lines.join('\n');
};

/**
 * Stream XML content to a writable stream
 * @param {WritableStream} stream - Output stream
 * @param {Array<object>} rows - Data rows
 * @param {string} rootElement - Root element name
 * @param {string} rowElement - Row element name
 * @param {Array<{key: string, xmlName: string, transform?: Function}>} schema - XML schema
 * @param {Function} onProgress - Progress callback (percentage)
 */
const streamXML = async (stream, rows, rootElement, rowElement, schema, onProgress) => {
  // XML declaration
  stream.write('<?xml version="1.0" encoding="UTF-8"?>\n');

  // Root element start
  stream.write(`<${toXMLName(rootElement)}>\n`);

  // Row elements with progress updates
  const total = rows.length;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    stream.write(`  <${toXMLName(rowElement)}>\n`);

    for (const field of schema) {
      let value = row[field.key];

      // Apply transform if provided
      if (field.transform) {
        value = field.transform(value, row);
      }

      const xmlName = field.xmlName || toXMLName(field.key);
      stream.write(createElement(xmlName, value, {}, 2) + '\n');
    }

    stream.write(`  </${toXMLName(rowElement)}>\n`);

    // Report progress every 100 rows
    if (onProgress && (i + 1) % 100 === 0) {
      onProgress(Math.round(((i + 1) / total) * 100));
    }
  }

  // Root element end
  stream.write(`</${toXMLName(rootElement)}>\n`);

  if (onProgress) {
    onProgress(100);
  }
};

module.exports = {
  escapeXML,
  toXMLName,
  formatDate,
  createElement,
  generateXML,
  streamXML,
};
