/**
 * Holding Deposit Repository
 * Centralized database queries for holding deposit data
 */

const db = require('../db');

/**
 * Create a holding deposit as 'awaiting_payment' (at application creation time)
 * @param {Object} data - Deposit data
 * @param {number} data.agencyId - Agency ID
 * @param {number} data.applicationId - Application ID
 * @param {number} data.amount - Deposit amount
 * @param {number|null} data.bedroomId - Bedroom ID for reservation
 * @param {number|null} data.propertyId - Property ID for reservation
 * @param {number|null} data.reservationDays - Number of days for reservation
 * @param {string|null} data.reservationExpiresAt - Reservation expiry timestamp
 * @returns {Promise<Object>} Created deposit record
 */
async function createAwaitingPayment({ agencyId, applicationId, amount, bedroomId, propertyId, reservationDays, reservationExpiresAt }) {
  const result = await db.query(`
    INSERT INTO holding_deposits (
      agency_id, application_id, amount,
      bedroom_id, property_id, reservation_days, reservation_expires_at,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'awaiting_payment')
    RETURNING *
  `, [
    agencyId, applicationId, amount,
    bedroomId || null, propertyId || null, reservationDays || null,
    reservationExpiresAt || null
  ], agencyId);
  return result.rows[0];
}

/**
 * Record payment for an awaiting_payment deposit (transitions to 'held')
 * @param {number} id - Deposit ID
 * @param {Object} data - Payment data
 * @param {string|null} data.paymentReference - Payment reference
 * @param {string} data.dateReceived - Date deposit was received
 * @param {number} data.changedByUserId - User ID recording the payment
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Updated deposit or null
 */
async function recordPayment(id, { paymentReference, dateReceived, changedByUserId }, agencyId) {
  const result = await db.query(`
    UPDATE holding_deposits
    SET status = 'held', payment_reference = $1, date_received = $2,
        status_changed_at = NOW(), status_changed_by = $3, updated_at = NOW()
    WHERE id = $4 AND agency_id = $5 AND status = 'awaiting_payment'
    RETURNING *
  `, [paymentReference || null, dateReceived, changedByUserId, id, agencyId], agencyId);
  return result.rows[0] || null;
}

/**
 * Create a holding deposit record (immediate 'held' status, for approval flow)
 * @param {Object} data - Deposit data
 * @param {number} data.agencyId - Agency ID
 * @param {number} data.applicationId - Application ID
 * @param {number} data.amount - Deposit amount
 * @param {string|null} data.paymentReference - Payment reference
 * @param {string} data.dateReceived - Date deposit was received
 * @param {number|null} data.bedroomId - Bedroom ID for reservation
 * @param {number|null} data.propertyId - Property ID for reservation
 * @param {number|null} data.reservationDays - Number of days for reservation
 * @param {string|null} data.reservationExpiresAt - Reservation expiry timestamp
 * @param {number} data.statusChangedBy - User ID who created the deposit
 * @returns {Promise<Object>} Created deposit record
 */
async function create({ agencyId, applicationId, amount, paymentReference, dateReceived, bedroomId, propertyId, reservationDays, reservationExpiresAt, statusChangedBy }) {
  const result = await db.query(`
    INSERT INTO holding_deposits (
      agency_id, application_id, amount, payment_reference, date_received,
      bedroom_id, property_id, reservation_days, reservation_expires_at,
      status, status_changed_at, status_changed_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'held', NOW(), $10)
    RETURNING *
  `, [
    agencyId, applicationId, amount, paymentReference || null, dateReceived,
    bedroomId || null, propertyId || null, reservationDays || null,
    reservationExpiresAt || null, statusChangedBy
  ], agencyId);
  return result.rows[0];
}

/**
 * Get holding deposit by ID
 * @param {number} id - Deposit ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Deposit record or null
 */
async function getById(id, agencyId) {
  const result = await db.query(`
    SELECT hd.*,
      a.first_name as applicant_first_name,
      a.surname as applicant_surname,
      a.email as applicant_email,
      b.bedroom_name,
      p.address_line1 as property_address,
      u.first_name as changed_by_first_name,
      u.last_name as changed_by_last_name
    FROM holding_deposits hd
    LEFT JOIN applications a ON hd.application_id = a.id
    LEFT JOIN bedrooms b ON hd.bedroom_id = b.id
    LEFT JOIN properties p ON hd.property_id = p.id
    LEFT JOIN users u ON hd.status_changed_by = u.id
    WHERE hd.id = $1 AND hd.agency_id = $2
  `, [id, agencyId], agencyId);
  return result.rows[0] || null;
}

/**
 * Get holding deposit by application ID
 * @param {number} applicationId - Application ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Deposit record or null
 */
async function getByApplicationId(applicationId, agencyId) {
  const result = await db.query(`
    SELECT hd.*,
      b.bedroom_name,
      p.address_line1 as property_address
    FROM holding_deposits hd
    LEFT JOIN bedrooms b ON hd.bedroom_id = b.id
    LEFT JOIN properties p ON hd.property_id = p.id
    WHERE hd.application_id = $1 AND hd.agency_id = $2
    ORDER BY hd.created_at DESC
    LIMIT 1
  `, [applicationId, agencyId], agencyId);
  return result.rows[0] || null;
}

/**
 * Update holding deposit status
 * @param {number} id - Deposit ID
 * @param {string} status - New status
 * @param {number} changedByUserId - User making the change
 * @param {string|null} notes - Optional notes
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Updated deposit or null
 */
async function updateStatus(id, status, changedByUserId, notes, agencyId) {
  const result = await db.query(`
    UPDATE holding_deposits
    SET status = $1, status_changed_at = NOW(), status_changed_by = $2,
        notes = COALESCE($3, notes), updated_at = NOW()
    WHERE id = $4 AND agency_id = $5
    RETURNING *
  `, [status, changedByUserId, notes, id, agencyId], agencyId);
  return result.rows[0] || null;
}

/**
 * Apply holding deposit to a tenancy
 * @param {number} id - Deposit ID
 * @param {number} tenancyId - Tenancy to apply to
 * @param {string} status - 'applied_to_rent' or 'applied_to_deposit'
 * @param {number} changedByUserId - User making the change
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Updated deposit or null
 */
async function applyToTenancy(id, tenancyId, status, changedByUserId, agencyId) {
  const result = await db.query(`
    UPDATE holding_deposits
    SET status = $1, applied_to_tenancy_id = $2,
        status_changed_at = NOW(), status_changed_by = $3, updated_at = NOW()
    WHERE id = $4 AND agency_id = $5
    RETURNING *
  `, [status, tenancyId, changedByUserId, id, agencyId], agencyId);
  return result.rows[0] || null;
}

/**
 * Get active reservation for a bedroom
 * @param {number} bedroomId - Bedroom ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Active reservation or null
 */
async function getActiveReservationForBedroom(bedroomId, agencyId) {
  const result = await db.query(`
    SELECT hd.*, a.first_name as applicant_first_name, a.surname as applicant_surname
    FROM holding_deposits hd
    LEFT JOIN applications a ON hd.application_id = a.id
    WHERE hd.bedroom_id = $1
      AND hd.agency_id = $2
      AND hd.status = 'held'
      AND hd.reservation_released = FALSE
      AND hd.reservation_expires_at > NOW()
  `, [bedroomId, agencyId], agencyId);
  return result.rows[0] || null;
}

/**
 * Release expired reservations for an agency
 * @param {number} agencyId - Agency context
 * @returns {Promise<number>} Number of released reservations
 */
async function releaseExpiredReservations(agencyId) {
  const result = await db.query(`
    UPDATE holding_deposits
    SET reservation_released = TRUE, updated_at = NOW()
    WHERE agency_id = $1
      AND status = 'held'
      AND reservation_released = FALSE
      AND reservation_expires_at IS NOT NULL
      AND reservation_expires_at <= NOW()
  `, [agencyId], agencyId);
  return result.rowCount;
}

/**
 * Get all holding deposits with optional filters
 * @param {Object} filters - Optional filters
 * @param {string} filters.status - Filter by status
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of deposit records
 */
async function getAll(filters, agencyId) {
  let query = `
    SELECT hd.*,
      a.first_name as applicant_first_name,
      a.surname as applicant_surname,
      a.email as applicant_email,
      b.bedroom_name,
      p.address_line1 as property_address
    FROM holding_deposits hd
    LEFT JOIN applications a ON hd.application_id = a.id
    LEFT JOIN bedrooms b ON hd.bedroom_id = b.id
    LEFT JOIN properties p ON hd.property_id = p.id
    WHERE hd.agency_id = $1
  `;
  const params = [agencyId];

  if (filters?.status) {
    params.push(filters.status);
    query += ` AND hd.status = $${params.length}`;
  }

  query += ' ORDER BY hd.created_at DESC';

  const result = await db.query(query, params, agencyId);
  return result.rows;
}

module.exports = {
  create,
  createAwaitingPayment,
  recordPayment,
  getById,
  getByApplicationId,
  updateStatus,
  applyToTenancy,
  getActiveReservationForBedroom,
  releaseExpiredReservations,
  getAll
};
