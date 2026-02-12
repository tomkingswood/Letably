/**
 * Safely parse a JSON string field on an object, replacing it in-place.
 * If parsing fails, sets the field to the provided default value.
 *
 * @param {object} obj - The object containing the field
 * @param {string} field - The field name to parse
 * @param {*} [defaultValue=[]] - Value to use if parsing fails or field is falsy
 */
function parseJsonField(obj, field, defaultValue = []) {
  if (!obj[field]) return;
  try {
    obj[field] = JSON.parse(obj[field]);
  } catch (e) {
    obj[field] = defaultValue;
  }
}

/**
 * Parse JSON fields on each object in an array.
 *
 * @param {object[]} items - Array of objects
 * @param {string} field - The field name to parse on each object
 * @param {*} [defaultValue=[]] - Value to use if parsing fails
 */
function parseJsonFields(items, field, defaultValue = []) {
  items.forEach(item => parseJsonField(item, field, defaultValue));
}

module.exports = { parseJsonField, parseJsonFields };
