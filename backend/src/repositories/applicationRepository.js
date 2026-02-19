/**
 * Application Repository
 * Centralized database queries for application-related data
 *
 * Uses the form_data hybrid pattern:
 *   - Core columns: always-present fields stored as SQL columns
 *   - JSONB form_data: conditional fields (varies by application_type / residential_status)
 *   - All read functions return hydrated rows where form_data fields are
 *     spread onto the object with safe defaults (see helpers/formData.js)
 */

const db = require('../db');
const { hydrateApplication, hydrateApplications, extractFormData } = require('../helpers/formData');

/**
 * Get user by ID
 * @param {number} userId - User ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} User record or null
 */
async function getUserById(userId, agencyId) {
  const result = await db.query(
    'SELECT id, email, first_name, last_name, phone FROM users WHERE id = $1 AND agency_id = $2',
    [userId, agencyId],
    agencyId
  );
  return result.rows[0] || null;
}

/**
 * Get user's in-progress application
 * @param {number} userId - User ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Application or null
 */
async function getUserInProgressApplication(userId, agencyId) {
  const result = await db.query(
    `SELECT id, status FROM applications
     WHERE user_id = $1 AND status IN ('pending', 'awaiting_guarantor') AND agency_id = $2`,
    [userId, agencyId],
    agencyId
  );
  return result.rows[0] || null;
}

/**
 * Create a new application
 * @param {Object} data - Application data
 * @param {number} data.agencyId - Agency ID
 * @param {number} data.userId - User ID
 * @param {string} data.applicationType - Application type (student/professional)
 * @param {boolean} data.guarantorRequired - Whether guarantor is required
 * @returns {Promise<Object>} Created application (hydrated)
 */
async function createApplication({ agencyId, userId, applicationType, guarantorRequired, firstName, surname }) {
  const result = await db.query(
    `INSERT INTO applications (
      agency_id, user_id, application_type, guarantor_required, status,
      first_name, surname
    ) VALUES ($1, $2, $3, $4, 'pending', $5, $6)
    RETURNING *`,
    [agencyId, userId, applicationType, guarantorRequired, firstName || null, surname || null],
    agencyId
  );
  return hydrateApplication(result.rows[0]);
}

/**
 * Get all applications with filters
 * @param {Object} filters - Filter options
 * @param {string|null} filters.status - Status filter
 * @param {string|null} filters.applicationType - Application type filter
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of hydrated applications
 */
async function getAllApplications({ status, applicationType }, agencyId) {
  let query = `
    SELECT
      a.*,
      u.first_name || ' ' || u.last_name as user_name,
      u.email as user_email
    FROM applications a
    JOIN users u ON a.user_id = u.id
    WHERE a.agency_id = $1
  `;

  const params = [agencyId];
  let paramIndex = 2;

  if (status) {
    query += ` AND a.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (applicationType) {
    query += ` AND a.application_type = $${paramIndex}`;
    params.push(applicationType);
  }

  query += ' ORDER BY a.created_at DESC';

  const result = await db.query(query, params, agencyId);
  return hydrateApplications(result.rows);
}

/**
 * Get user's applications
 * @param {number} userId - User ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of hydrated applications
 */
async function getUserApplications(userId, agencyId) {
  const result = await db.query(
    `SELECT a.*
     FROM applications a
     WHERE a.user_id = $1 AND a.agency_id = $2
     ORDER BY a.created_at DESC`,
    [userId, agencyId],
    agencyId
  );
  return hydrateApplications(result.rows);
}

/**
 * Get application by ID with user details
 * @param {number} applicationId - Application ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Hydrated application with user details or null
 */
async function getApplicationByIdWithUser(applicationId, agencyId) {
  const result = await db.query(
    `SELECT
      a.*,
      u.first_name || ' ' || u.last_name as user_name,
      u.email as user_email,
      u.phone as user_phone
    FROM applications a
    JOIN users u ON a.user_id = u.id
    WHERE a.id = $1 AND a.agency_id = $2`,
    [applicationId, agencyId],
    agencyId
  );
  return hydrateApplication(result.rows[0]);
}

/**
 * Get application by ID (basic)
 * @param {number} applicationId - Application ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Hydrated application or null
 */
async function getApplicationById(applicationId, agencyId) {
  const result = await db.query(
    'SELECT * FROM applications WHERE id = $1 AND agency_id = $2',
    [applicationId, agencyId],
    agencyId
  );
  return hydrateApplication(result.rows[0]);
}

/**
 * Update application fields
 *
 * Core columns are written directly. Conditional fields (residential_status,
 * landlord_*, student fields, professional fields, address_history) are
 * stored in the JSONB form_data column.
 *
 * @param {number} applicationId - Application ID
 * @param {Object} data - Fields to update (flat object with all fields)
 * @param {number} agencyId - Agency context
 * @returns {Promise<void>}
 */
async function updateApplication(applicationId, data, agencyId) {
  // Extract conditional fields (including guarantor personal info) into form_data JSONB
  const formData = extractFormData(data);

  // PostgreSQL rejects empty strings for date/timestamptz columns — coerce to null
  const dateOrNull = (v) => (v === '' || v === undefined) ? null : v;

  const {
    title, title_other, first_name, middle_name, surname, email, phone,
    current_address, id_type, payment_method,
    declaration_name, declaration_agreed,
    status, guarantor_token
  } = data;

  const date_of_birth = dateOrNull(data.date_of_birth);
  const completed_at = dateOrNull(data.completed_at);
  const guarantor_token_expires_at = dateOrNull(data.guarantor_token_expires_at);

  await db.query(
    `UPDATE applications SET
      title = COALESCE($1, title),
      title_other = $2,
      date_of_birth = $3,
      first_name = COALESCE($4, first_name),
      middle_name = $5,
      surname = COALESCE($6, surname),
      email = COALESCE($7, email),
      phone = COALESCE($8, phone),
      current_address = $9,
      id_type = $10,
      payment_method = $11,
      declaration_name = $12,
      declaration_agreed = $13,
      declaration_date = CASE WHEN $14 = true THEN CURRENT_TIMESTAMP ELSE declaration_date END,
      status = $15,
      completed_at = $16,
      guarantor_token = $17,
      guarantor_token_expires_at = $18,
      form_data = $19,
      form_version = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $20 AND agency_id = $21`,
    [
      title, title_other, date_of_birth, first_name, middle_name, surname, email, phone,
      current_address, id_type, payment_method,
      declaration_name, declaration_agreed,
      declaration_agreed, // $14: for the CASE WHEN (same value)
      status, completed_at, guarantor_token, guarantor_token_expires_at,
      JSON.stringify(formData),
      applicationId, agencyId
    ],
    agencyId
  );
}

/**
 * Get ID documents for an application
 * @param {number} applicationId - Application ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of ID documents
 */
async function getIdDocumentsForApplication(applicationId, agencyId) {
  const result = await db.query(
    `SELECT * FROM id_documents
     WHERE application_id = $1
     AND application_id IN (SELECT id FROM applications WHERE agency_id = $2)`,
    [applicationId, agencyId],
    agencyId
  );
  return result.rows;
}

/**
 * Delete an application
 * @param {number} applicationId - Application ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<void>}
 */
async function deleteApplication(applicationId, agencyId) {
  await db.query(
    'DELETE FROM applications WHERE id = $1 AND agency_id = $2',
    [applicationId, agencyId],
    agencyId
  );
}

/**
 * Get application by guarantor token
 * @param {string} token - Guarantor token
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Hydrated application or null
 */
async function getApplicationByGuarantorToken(token, agencyId) {
  const result = await db.query(
    `SELECT
      a.*,
      u.first_name || ' ' || u.last_name as applicant_name
    FROM applications a
    JOIN users u ON a.user_id = u.id
    WHERE a.guarantor_token = $1 AND a.agency_id = $2`,
    [token, agencyId],
    agencyId
  );
  return hydrateApplication(result.rows[0]);
}

/**
 * Get application by guarantor token (basic)
 * @param {string} token - Guarantor token
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Hydrated application or null
 */
async function getApplicationByGuarantorTokenBasic(token, agencyId) {
  const result = await db.query(
    'SELECT * FROM applications WHERE guarantor_token = $1 AND agency_id = $2',
    [token, agencyId],
    agencyId
  );
  return hydrateApplication(result.rows[0]);
}

/**
 * Update guarantor information
 * Guarantor personal fields are stored in form_data (conditional on guarantor_required).
 * Merges into existing form_data using JSONB || operator.
 * Workflow columns (guarantor_completed_at, status) stay as core columns.
 *
 * @param {string} token - Guarantor token
 * @param {Object} data - Guarantor data
 * @param {number} agencyId - Agency context
 * @returns {Promise<void>}
 */
async function updateGuarantorInfo(token, data, agencyId) {
  const guarantorFormData = {
    guarantor_name: data.guarantor_name,
    guarantor_dob: data.guarantor_dob,
    guarantor_email: data.guarantor_email,
    guarantor_phone: data.guarantor_phone,
    guarantor_address: data.guarantor_address,
    guarantor_relationship: data.guarantor_relationship,
    guarantor_id_type: data.guarantor_id_type,
    guarantor_signature_name: data.guarantor_signature_name,
    guarantor_signature_agreed: data.guarantor_signature_agreed,
  };

  await db.query(
    `UPDATE applications SET
      form_data = COALESCE(form_data, '{}')::jsonb || $1::jsonb,
      guarantor_completed_at = CURRENT_TIMESTAMP,
      status = 'submitted',
      updated_at = CURRENT_TIMESTAMP
    WHERE guarantor_token = $2 AND agency_id = $3`,
    [
      JSON.stringify(guarantorFormData),
      token, agencyId
    ],
    agencyId
  );
}

/**
 * Update guarantor token
 * @param {number} applicationId - Application ID
 * @param {string} token - New token
 * @param {string} expiresAt - Token expiry date
 * @param {number} agencyId - Agency context
 * @returns {Promise<void>}
 */
async function updateGuarantorToken(applicationId, token, expiresAt, agencyId) {
  await db.query(
    `UPDATE applications SET
      guarantor_token = $1,
      guarantor_token_expires_at = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3 AND agency_id = $4`,
    [token, expiresAt, applicationId, agencyId],
    agencyId
  );
}

/**
 * Update application status
 * @param {number} applicationId - Application ID
 * @param {string} status - New status
 * @param {number} agencyId - Agency context
 * @returns {Promise<void>}
 */
async function updateApplicationStatus(applicationId, status, agencyId) {
  await db.query(
    `UPDATE applications SET
      status = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND agency_id = $3`,
    [status, applicationId, agencyId],
    agencyId
  );
}

/**
 * Check if application ID exists
 * @param {number} applicationId - Application ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<boolean>} True if exists
 */
async function applicationExists(applicationId, agencyId) {
  const result = await db.query(
    'SELECT id FROM applications WHERE id = $1 AND agency_id = $2',
    [applicationId, agencyId],
    agencyId
  );
  return result.rows.length > 0;
}

module.exports = {
  getUserById,
  getUserInProgressApplication,
  createApplication,
  getAllApplications,
  getUserApplications,
  getApplicationByIdWithUser,
  getApplicationById,
  updateApplication,
  getIdDocumentsForApplication,
  deleteApplication,
  getApplicationByGuarantorToken,
  getApplicationByGuarantorTokenBasic,
  updateGuarantorInfo,
  updateGuarantorToken,
  updateApplicationStatus,
  applicationExists
};
