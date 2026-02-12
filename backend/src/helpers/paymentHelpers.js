const db = require('../db');

/**
 * Calculate total paid and status for a payment schedule
 * @param {number} scheduleId - Payment schedule ID
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Promise<{totalPaid: number, status: string}>}
 */
async function calculateScheduleStatus(scheduleId, agencyId) {
  try {
    // Get all payments for this schedule
    const paymentsResult = await db.query(`
      SELECT SUM(amount) as total_paid
      FROM payments
      WHERE payment_schedule_id = $1
    `, [scheduleId], agencyId);

    const payments = paymentsResult.rows[0];
    const totalPaid = payments?.total_paid || 0;

    // Get schedule details
    const scheduleResult = await db.query(`
      SELECT amount_due, due_date
      FROM payment_schedules
      WHERE id = $1
    `, [scheduleId], agencyId);

    const schedule = scheduleResult.rows[0];

    if (!schedule) return { totalPaid, status: 'pending' };

    // Determine status
    let status = 'pending';
    const balance = schedule.amount_due - totalPaid;

    // Check if fully paid (balance effectively zero)
    // Use small tolerance for floating point comparison (0.001 = 0.1 pence)
    if (Math.abs(balance) < 0.001) {
      status = 'paid';
    } else if (schedule.amount_due > 0 && totalPaid > 0 && totalPaid < schedule.amount_due) {
      // Partial payment only applies to positive amounts (money owed TO landlord)
      status = 'partial';
    } else if (schedule.amount_due < 0 && totalPaid < 0 && totalPaid > schedule.amount_due) {
      // Partial refund for negative amounts (money owed TO tenant)
      status = 'partial';
    } else {
      // Check if overdue (only for amounts not yet settled)
      const dueDate = new Date(schedule.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        status = 'overdue';
      }
    }

    return { totalPaid, status };
  } catch (error) {
    console.error('Error calculating schedule status:', error);
    throw error;
  }
}

/**
 * Get payment history for a schedule
 * @param {number} scheduleId - Payment schedule ID
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Promise<Array>} Array of payment records
 */
async function getPaymentHistory(scheduleId, agencyId) {
  try {
    const result = await db.query(`
      SELECT id, amount, payment_date, payment_reference, created_at
      FROM payments
      WHERE payment_schedule_id = $1
      ORDER BY payment_date DESC, created_at DESC
    `, [scheduleId], agencyId);

    return result.rows;
  } catch (error) {
    console.error('Error getting payment history:', error);
    throw error;
  }
}

/**
 * Update schedule status if it has changed
 * @param {number} scheduleId - Payment schedule ID
 * @param {string} newStatus - New status to set
 * @param {string} currentStatus - Current status
 * @param {number} agencyId - Agency ID for multi-tenancy
 */
async function updateScheduleStatus(scheduleId, newStatus, currentStatus, agencyId) {
  try {
    if (newStatus !== currentStatus) {
      await db.query(`
        UPDATE payment_schedules
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [newStatus, scheduleId], agencyId);
    }
  } catch (error) {
    console.error('Error updating schedule status:', error);
    throw error;
  }
}

/**
 * Enrich a schedule with calculated fields (amount_paid, payment_history)
 * This is the main helper function that combines all the logic
 * @param {Object} schedule - Payment schedule object
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Promise<Object>} Enriched schedule with amount_paid, status, payment_history
 */
async function enrichScheduleWithPayments(schedule, agencyId) {
  try {
    const paymentHistory = await getPaymentHistory(schedule.id, agencyId);
    const { totalPaid, status } = await calculateScheduleStatus(schedule.id, agencyId);

    // Update status if changed
    await updateScheduleStatus(schedule.id, status, schedule.status, agencyId);

    return {
      ...schedule,
      amount_paid: totalPaid,
      status: status,
      payment_history: paymentHistory
    };
  } catch (error) {
    console.error('Error enriching schedule with payments:', error);
    throw error;
  }
}

/**
 * Get schedules with member details for a tenancy
 * @param {number} tenancyId - Tenancy ID
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Promise<Array>} Array of payment schedules with member details
 */
async function getSchedulesWithMemberDetails(tenancyId, agencyId) {
  try {
    const result = await db.query(`
      SELECT
        ps.*,
        tm.rent_pppw,
        tm.deposit_amount,
        tm.payment_option,
        tm.first_name,
        tm.surname as last_name,
        u.email
      FROM payment_schedules ps
      INNER JOIN tenancy_members tm ON ps.tenancy_member_id = tm.id
      INNER JOIN users u ON tm.user_id = u.id
      WHERE ps.tenancy_id = $1
      ORDER BY ps.due_date ASC, tm.surname ASC
    `, [tenancyId], agencyId);

    return result.rows;
  } catch (error) {
    console.error('Error getting schedules with member details:', error);
    throw error;
  }
}

/**
 * Get schedules for a specific member
 * @param {number} tenancyId - Tenancy ID
 * @param {number} memberId - Member ID
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Promise<Array>} Array of payment schedules
 */
async function getSchedulesForMember(tenancyId, memberId, agencyId) {
  try {
    const result = await db.query(`
      SELECT *
      FROM payment_schedules
      WHERE tenancy_id = $1 AND tenancy_member_id = $2
      ORDER BY due_date ASC
    `, [tenancyId, memberId], agencyId);

    return result.rows;
  } catch (error) {
    console.error('Error getting schedules for member:', error);
    throw error;
  }
}

module.exports = {
  calculateScheduleStatus,
  getPaymentHistory,
  updateScheduleStatus,
  enrichScheduleWithPayments,
  getSchedulesWithMemberDetails,
  getSchedulesForMember
};
