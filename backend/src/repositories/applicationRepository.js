/**
 * Application Repository
 * Centralized database queries for application-related data
 */

const db = require('../db');

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
 * @returns {Promise<Object>} Created application
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
  return result.rows[0];
}

/**
 * Get all applications with filters
 * @param {Object} filters - Filter options
 * @param {string|null} filters.status - Status filter
 * @param {string|null} filters.applicationType - Application type filter
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of applications
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
  return result.rows;
}

/**
 * Get user's applications
 * @param {number} userId - User ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of applications
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
  return result.rows;
}

/**
 * Get application by ID with user details
 * @param {number} applicationId - Application ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Application with user details or null
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
  return result.rows[0] || null;
}

/**
 * Get application by ID (basic)
 * @param {number} applicationId - Application ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Application or null
 */
async function getApplicationById(applicationId, agencyId) {
  const result = await db.query(
    'SELECT * FROM applications WHERE id = $1 AND agency_id = $2',
    [applicationId, agencyId],
    agencyId
  );
  return result.rows[0] || null;
}

/**
 * Update application fields
 * @param {number} applicationId - Application ID
 * @param {Object} data - Fields to update
 * @param {number} agencyId - Agency context
 * @returns {Promise<void>}
 */
async function updateApplication(applicationId, data, agencyId) {
  const {
    title, title_other, date_of_birth, first_name, middle_name, surname, email, phone,
    residential_status, residential_status_other, period_years, period_months,
    current_address,
    landlord_name, landlord_address, landlord_email, landlord_phone,
    address_history,
    id_type,
    payment_method, payment_plan, university, year_of_study, course, student_number,
    employment_type, company_name, employment_start_date,
    contact_name, contact_job_title, contact_email, contact_phone,
    company_address,
    guarantor_name, guarantor_dob, guarantor_email, guarantor_phone,
    guarantor_address, guarantor_relationship,
    declaration_name, declaration_agreed,
    status, completed_at, guarantor_token, guarantor_token_expires_at
  } = data;

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
      residential_status = $9,
      residential_status_other = $10,
      period_years = $11,
      period_months = $12,
      current_address = $13,
      landlord_name = $14,
      landlord_address = $15,
      landlord_email = $16,
      landlord_phone = $17,
      address_history = $18,
      id_type = $19,
      payment_method = $20,
      payment_plan = $21,
      university = $22,
      year_of_study = $23,
      course = $24,
      student_number = $25,
      employment_type = $26,
      company_name = $27,
      employment_start_date = $28,
      contact_name = $29,
      contact_job_title = $30,
      contact_email = $31,
      contact_phone = $32,
      company_address = $33,
      guarantor_name = $34,
      guarantor_dob = $35,
      guarantor_email = $36,
      guarantor_phone = $37,
      guarantor_address = $38,
      guarantor_relationship = $39,
      declaration_name = $40,
      declaration_agreed = $41,
      declaration_date = CASE WHEN $42 = true THEN CURRENT_TIMESTAMP ELSE declaration_date END,
      status = $43,
      completed_at = $44,
      guarantor_token = $45,
      guarantor_token_expires_at = $46,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $47 AND agency_id = $48`,
    [
      title, title_other, date_of_birth, first_name, middle_name, surname, email, phone,
      residential_status, residential_status_other, period_years, period_months,
      current_address,
      landlord_name, landlord_address, landlord_email, landlord_phone,
      address_history,
      id_type,
      payment_method, payment_plan, university, year_of_study, course, student_number,
      employment_type, company_name, employment_start_date,
      contact_name, contact_job_title, contact_email, contact_phone,
      company_address,
      guarantor_name, guarantor_dob, guarantor_email, guarantor_phone,
      guarantor_address, guarantor_relationship,
      declaration_name, declaration_agreed,
      declaration_agreed,
      status,
      completed_at,
      guarantor_token,
      guarantor_token_expires_at,
      applicationId,
      agencyId
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
 * @returns {Promise<Object|null>} Application or null
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
  return result.rows[0] || null;
}

/**
 * Get application by guarantor token (basic)
 * @param {string} token - Guarantor token
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Application or null
 */
async function getApplicationByGuarantorTokenBasic(token, agencyId) {
  const result = await db.query(
    'SELECT * FROM applications WHERE guarantor_token = $1 AND agency_id = $2',
    [token, agencyId],
    agencyId
  );
  return result.rows[0] || null;
}

/**
 * Update guarantor information
 * @param {string} token - Guarantor token
 * @param {Object} data - Guarantor data
 * @param {number} agencyId - Agency context
 * @returns {Promise<void>}
 */
async function updateGuarantorInfo(token, data, agencyId) {
  const {
    guarantor_name, guarantor_dob, guarantor_email, guarantor_phone,
    guarantor_address, guarantor_relationship, guarantor_id_type,
    guarantor_signature_name, guarantor_signature_agreed
  } = data;

  await db.query(
    `UPDATE applications SET
      guarantor_name = $1,
      guarantor_dob = $2,
      guarantor_email = $3,
      guarantor_phone = $4,
      guarantor_address = $5,
      guarantor_relationship = $6,
      guarantor_id_type = $7,
      guarantor_signature_name = $8,
      guarantor_signature_agreed = $9,
      guarantor_completed_at = CURRENT_TIMESTAMP,
      status = 'submitted',
      updated_at = CURRENT_TIMESTAMP
    WHERE guarantor_token = $10 AND agency_id = $11`,
    [
      guarantor_name, guarantor_dob, guarantor_email, guarantor_phone,
      guarantor_address, guarantor_relationship, guarantor_id_type,
      guarantor_signature_name, guarantor_signature_agreed,
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
