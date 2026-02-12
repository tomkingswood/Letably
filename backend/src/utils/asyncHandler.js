const handleError = require('./handleError');

/**
 * Wraps an Express route handler to eliminate try-catch boilerplate.
 * Catches both synchronous throws and async rejections, passing them to handleError.
 *
 * @param {Function} fn - Route handler (req, res, next) => any|Promise
 * @param {string} action - Description of the action (for error messages)
 * @returns {Function} Express route handler with error catching
 *
 * @example
 * // Before:
 * exports.getAll = async (req, res) => {
 *   try {
 *     const result = await db.query('SELECT ...');
 *     res.json(result.rows);
 *   } catch (err) {
 *     handleError(res, err, 'fetch items');
 *   }
 * };
 *
 * // After:
 * exports.getAll = asyncHandler(async (req, res) => {
 *   const result = await db.query('SELECT ...');
 *   res.json(result.rows);
 * }, 'fetch items');
 */
const asyncHandler = (fn, action) => (req, res, next) => {
  Promise.resolve().then(() => fn(req, res, next)).catch(err => handleError(res, err, action));
};

module.exports = asyncHandler;
