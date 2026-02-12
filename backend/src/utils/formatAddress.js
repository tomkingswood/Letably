/**
 * Format an address by filtering out null, undefined, empty strings, and the string 'null'
 * @param {...string} parts - Address parts to join
 * @returns {string} Formatted address
 */
function formatAddress(...parts) {
  return parts
    .filter(val => val && val !== 'null' && val !== 'undefined')
    .join(', ');
}

module.exports = { formatAddress };
