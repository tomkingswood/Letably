/**
 * Payment Repository
 * Centralized database queries for payment-related data
 */

const db = require('../db');

/**
 * Get tenancy by ID (basic check)
 * @param {number} tenancyId - Tenancy ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Tenancy record or null
 */
async function getTenancyById(tenancyId, agencyId) {
  const result = await db.query(
    'SELECT id FROM tenancies WHERE id = $1 AND agency_id = $2',
    [tenancyId, agencyId],
    agencyId
  );
  return result.rows[0] || null;
}

/**
 * Get tenancy with status
 * @param {number} tenancyId - Tenancy ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Tenancy with status or null
 */
async function getTenancyWithStatus(tenancyId, agencyId) {
  const result = await db.query(
    'SELECT id, status FROM tenancies WHERE id = $1 AND agency_id = $2',
    [tenancyId, agencyId],
    agencyId
  );
  return result.rows[0] || null;
}

/**
 * Get payment schedule by ID
 * @param {number} scheduleId - Payment schedule ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Payment schedule or null
 */
async function getPaymentScheduleById(scheduleId, agencyId) {
  const result = await db.query(
    'SELECT * FROM payment_schedules WHERE id = $1 AND agency_id = $2',
    [scheduleId, agencyId],
    agencyId
  );
  return result.rows[0] || null;
}

/**
 * Get payment schedule with tenancy status
 * @param {number} scheduleId - Payment schedule ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Payment schedule with tenancy_status or null
 */
async function getPaymentScheduleWithTenancy(scheduleId, agencyId) {
  const result = await db.query(`
    SELECT ps.*, t.status as tenancy_status
    FROM payment_schedules ps
    INNER JOIN tenancies t ON ps.tenancy_id = t.id
    WHERE ps.id = $1 AND ps.agency_id = $2
  `, [scheduleId, agencyId], agencyId);
  return result.rows[0] || null;
}

/**
 * Create a payment record
 * @param {Object} data - Payment data
 * @param {number} data.agencyId - Agency ID
 * @param {number} data.paymentScheduleId - Payment schedule ID
 * @param {number} data.amount - Payment amount
 * @param {string} data.paymentDate - Payment date
 * @param {string|null} data.paymentReference - Optional payment reference
 * @returns {Promise<Object>} Created payment record
 */
async function createPayment({ agencyId, paymentScheduleId, amount, paymentDate, paymentReference }) {
  const result = await db.query(`
    INSERT INTO payments (agency_id, payment_schedule_id, amount, payment_date, payment_reference)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [agencyId, paymentScheduleId, amount, paymentDate, paymentReference || null], agencyId);
  return result.rows[0];
}

/**
 * Delete all payments for a schedule
 * @param {number} scheduleId - Payment schedule ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<number>} Number of deleted payments
 */
async function deletePaymentsForSchedule(scheduleId, agencyId) {
  const result = await db.query(
    'DELETE FROM payments WHERE payment_schedule_id = $1 AND agency_id = $2 RETURNING *',
    [scheduleId, agencyId],
    agencyId
  );
  return result.rows.length;
}

/**
 * Reset payment schedule status to pending
 * @param {number} scheduleId - Payment schedule ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object>} Updated schedule
 */
async function resetPaymentScheduleStatus(scheduleId, agencyId) {
  const result = await db.query(`
    UPDATE payment_schedules
    SET status = 'pending', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND agency_id = $2
    RETURNING *
  `, [scheduleId, agencyId], agencyId);
  return result.rows[0];
}

/**
 * Update payment schedule details
 * @param {Object} data - Update data
 * @param {number} data.scheduleId - Payment schedule ID
 * @param {number} data.amountDue - Amount due
 * @param {string} data.dueDate - Due date
 * @param {string} data.paymentType - Payment type
 * @param {string} data.description - Description
 * @param {string} data.scheduleType - Schedule type (manual/automated)
 * @param {number} data.agencyId - Agency context
 * @returns {Promise<Object>} Updated schedule
 */
async function updatePaymentSchedule({ scheduleId, amountDue, dueDate, paymentType, description, scheduleType, agencyId }) {
  const result = await db.query(`
    UPDATE payment_schedules
    SET amount_due = $1, due_date = $2, payment_type = $3, description = $4, schedule_type = $5, updated_at = CURRENT_TIMESTAMP
    WHERE id = $6 AND agency_id = $7
    RETURNING *
  `, [amountDue, dueDate, paymentType, description, scheduleType, scheduleId, agencyId], agencyId);
  return result.rows[0];
}

/**
 * Delete a payment schedule
 * @param {number} scheduleId - Payment schedule ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<void>}
 */
async function deletePaymentSchedule(scheduleId, agencyId) {
  await db.query(
    'DELETE FROM payment_schedules WHERE id = $1 AND agency_id = $2',
    [scheduleId, agencyId],
    agencyId
  );
}

/**
 * Check if a tenancy member exists
 * @param {number} memberId - Member ID
 * @param {number} tenancyId - Tenancy ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Member record or null
 */
async function getMemberByTenancy(memberId, tenancyId, agencyId) {
  const result = await db.query(
    'SELECT id FROM tenancy_members WHERE id = $1 AND tenancy_id = $2 AND agency_id = $3',
    [memberId, tenancyId, agencyId],
    agencyId
  );
  return result.rows[0] || null;
}

/**
 * Create a payment schedule
 * @param {Object} data - Schedule data
 * @param {number} data.agencyId - Agency ID
 * @param {number} data.tenancyId - Tenancy ID
 * @param {number} data.memberId - Member ID
 * @param {string} data.paymentType - Payment type
 * @param {string|null} data.description - Optional description
 * @param {string} data.dueDate - Due date
 * @param {number} data.amountDue - Amount due
 * @returns {Promise<Object>} Created schedule
 */
async function createPaymentSchedule({ agencyId, tenancyId, memberId, paymentType, description, dueDate, amountDue }) {
  const result = await db.query(`
    INSERT INTO payment_schedules (agency_id, tenancy_id, tenancy_member_id, payment_type, description, due_date, amount_due, status, schedule_type)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'manual')
    RETURNING *
  `, [agencyId, tenancyId, memberId, paymentType, description || null, dueDate, amountDue], agencyId);
  return result.rows[0];
}

/**
 * Get a single payment record
 * @param {number} paymentId - Payment ID
 * @param {number} scheduleId - Payment schedule ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Payment record or null
 */
async function getPaymentRecord(paymentId, scheduleId, agencyId) {
  const result = await db.query(
    'SELECT * FROM payments WHERE id = $1 AND payment_schedule_id = $2 AND agency_id = $3',
    [paymentId, scheduleId, agencyId],
    agencyId
  );
  return result.rows[0] || null;
}

/**
 * Delete a single payment record
 * @param {number} paymentId - Payment ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<void>}
 */
async function deletePaymentRecord(paymentId, agencyId) {
  await db.query(
    'DELETE FROM payments WHERE id = $1 AND agency_id = $2',
    [paymentId, agencyId],
    agencyId
  );
}

/**
 * Get total of other payments for a schedule (excluding one payment)
 * @param {number} scheduleId - Payment schedule ID
 * @param {number} excludePaymentId - Payment ID to exclude
 * @param {number} agencyId - Agency context
 * @returns {Promise<number>} Total amount of other payments
 */
async function getOtherPaymentsTotal(scheduleId, excludePaymentId, agencyId) {
  const result = await db.query(`
    SELECT SUM(amount) as total_paid
    FROM payments
    WHERE payment_schedule_id = $1 AND id != $2 AND agency_id = $3
  `, [scheduleId, excludePaymentId, agencyId], agencyId);
  return result.rows[0].total_paid || 0;
}

/**
 * Update a single payment record
 * @param {Object} data - Update data
 * @param {number} data.paymentId - Payment ID
 * @param {number} data.amount - New amount
 * @param {string} data.paymentDate - New payment date
 * @param {string|null} data.paymentReference - New payment reference
 * @param {number} data.agencyId - Agency context
 * @returns {Promise<Object>} Updated payment record
 */
async function updatePaymentRecord({ paymentId, amount, paymentDate, paymentReference, agencyId }) {
  const result = await db.query(`
    UPDATE payments
    SET amount = $1, payment_date = $2, payment_reference = $3
    WHERE id = $4 AND agency_id = $5
    RETURNING *
  `, [amount, paymentDate, paymentReference || null, paymentId, agencyId], agencyId);
  return result.rows[0];
}

/**
 * Get payment statistics for a tenancy
 * @param {number} tenancyId - Tenancy ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object>} Statistics object
 */
async function getPaymentStats(tenancyId, agencyId) {
  const result = await db.query(`
    SELECT
      COUNT(*) as total_payments,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
      SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial_count,
      SUM(amount_due) as total_due
    FROM payment_schedules
    WHERE tenancy_id = $1 AND agency_id = $2
  `, [tenancyId, agencyId], agencyId);
  return result.rows[0];
}

/**
 * Get payment schedule IDs for a tenancy
 * @param {number} tenancyId - Tenancy ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of schedule IDs
 */
async function getPaymentScheduleIds(tenancyId, agencyId) {
  const result = await db.query(
    'SELECT id FROM payment_schedules WHERE tenancy_id = $1 AND agency_id = $2',
    [tenancyId, agencyId],
    agencyId
  );
  return result.rows;
}

/**
 * Get all payment schedules with filters and pagination
 * @param {Object} filters - Filter options
 * @param {number|null} filters.year - Year filter
 * @param {number|null} filters.month - Month filter
 * @param {number|null} filters.propertyId - Property filter
 * @param {number|null} filters.landlordId - Landlord filter
 * @param {number} filters.limit - Results per page
 * @param {number} filters.offset - Offset for pagination
 * @param {number} agencyId - Agency context
 * @returns {Promise<{schedules: Array, total: number}>} Schedules and total count
 */
async function getPaymentSchedulesWithFilters({ year, month, propertyId, landlordId, limit, offset }, agencyId) {
  let baseQuery = `
    FROM payment_schedules ps
    INNER JOIN tenancy_members tm ON ps.tenancy_member_id = tm.id
    INNER JOIN tenancies t ON ps.tenancy_id = t.id
    INNER JOIN properties p ON t.property_id = p.id
  `;

  const params = [agencyId];
  const whereClauses = ['ps.agency_id = $1'];
  let paramIndex = 2;

  if (year && month) {
    whereClauses.push(`EXTRACT(YEAR FROM ps.due_date) = $${paramIndex} AND EXTRACT(MONTH FROM ps.due_date) = $${paramIndex + 1}`);
    params.push(parseInt(year), parseInt(month));
    paramIndex += 2;
  }

  if (propertyId) {
    whereClauses.push(`t.property_id = $${paramIndex}`);
    params.push(propertyId);
    paramIndex++;
  }

  if (landlordId) {
    whereClauses.push(`p.landlord_id = $${paramIndex}`);
    params.push(landlordId);
    paramIndex++;
  }

  const whereClause = ` WHERE ${whereClauses.join(' AND ')}`;

  // Get total count
  const countQuery = `SELECT COUNT(*) as total ${baseQuery}${whereClause}`;
  const countResult = await db.query(countQuery, params, agencyId);
  const total = parseInt(countResult.rows[0].total);

  // Get paginated results
  const selectQuery = `
    SELECT
      ps.*,
      tm.first_name || ' ' || tm.surname as tenant_name,
      t.id as tenancy_id,
      p.address_line1 as property_address,
      t.status as tenancy_status
    ${baseQuery}${whereClause}
    ORDER BY ps.due_date ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const schedulesResult = await db.query(selectQuery, [...params, limit, offset], agencyId);

  return {
    schedules: schedulesResult.rows,
    total
  };
}

/**
 * Get all overdue payment schedules (past due date)
 * @param {number} agencyId - Agency context
 * @returns {Promise<Array>} Array of overdue schedules
 */
async function getOverduePaymentSchedules(agencyId) {
  const result = await db.query(`
    SELECT
      ps.*,
      tm.first_name || ' ' || tm.surname as tenant_name,
      t.id as tenancy_id,
      p.address_line1 as property_address,
      t.status as tenancy_status
    FROM payment_schedules ps
    INNER JOIN tenancy_members tm ON ps.tenancy_member_id = tm.id
    INNER JOIN tenancies t ON ps.tenancy_id = t.id
    INNER JOIN properties p ON t.property_id = p.id
    WHERE ps.due_date < CURRENT_DATE AND ps.agency_id = $1
    ORDER BY ps.due_date ASC
  `, [agencyId], agencyId);
  return result.rows;
}

/**
 * Get user's active tenancy membership
 * @param {number} userId - User ID
 * @param {number} agencyId - Agency context
 * @returns {Promise<Object|null>} Member info with tenancy or null
 */
async function getUserActiveMembership(userId, agencyId) {
  const result = await db.query(`
    SELECT tm.id as member_id, tm.tenancy_id, t.status as tenancy_status
    FROM tenancy_members tm
    INNER JOIN tenancies t ON tm.tenancy_id = t.id
    WHERE tm.user_id = $1 AND t.status = 'active' AND t.agency_id = $2
  `, [userId, agencyId], agencyId);
  return result.rows[0] || null;
}

module.exports = {
  getTenancyById,
  getTenancyWithStatus,
  getPaymentScheduleById,
  getPaymentScheduleWithTenancy,
  createPayment,
  deletePaymentsForSchedule,
  resetPaymentScheduleStatus,
  updatePaymentSchedule,
  deletePaymentSchedule,
  getMemberByTenancy,
  createPaymentSchedule,
  getPaymentRecord,
  deletePaymentRecord,
  getOtherPaymentsTotal,
  updatePaymentRecord,
  getPaymentStats,
  getPaymentScheduleIds,
  getPaymentSchedulesWithFilters,
  getOverduePaymentSchedules,
  getUserActiveMembership
};
