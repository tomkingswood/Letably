/**
 * Handle common controller errors
 * Logs the error and sends appropriate response
 * @param {object} res - Express response object
 * @param {Error} err - The error object
 * @param {string} action - Description of the action that failed
 */
const handleError = (res, err, action = 'perform operation') => {
  console.error(`Error during ${action}:`, err);

  // Check for known error types
  if (err.code === '23505') {
    // PostgreSQL unique violation
    return res.status(409).json({ error: 'A record with this value already exists' });
  }
  if (err.code === '23503') {
    // PostgreSQL foreign key violation
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }

  res.status(500).json({ error: `Failed to ${action}` });
};

module.exports = handleError;
