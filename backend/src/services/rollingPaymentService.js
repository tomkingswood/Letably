/**
 * Rolling Monthly Payment Service
 *
 * Generates monthly rent payments for rolling tenancies.
 * Runs daily at 1:30 AM UK time (after overdue checker at 1:00 AM).
 *
 * This service is IDEMPOTENT - safe to run multiple times without creating duplicates.
 * It checks if a payment already exists for the current month before creating one.
 *
 * Logic:
 * 1. Find all rolling tenancies that need payment generation
 * 2. For each tenancy member, check if current month's payment exists
 * 3. If not, generate the payment using Calendar Month (PCM) method
 * 4. Handle terminating tenancies (end_date set) - only generate if current month <= end month
 */

const db = require('../db');
const cron = require('node-cron');
const { calculateCalendarMonth } = require('../helpers/rentCalculations');
const {
  formatDateISO: formatDate,
  calculateDays,
  getMonthName
} = require('../utils/dateFormatter');
const { generateFirstMonthPayment } = require('./paymentService');

/**
 * Calculate rent amount for a given number of days using PCM method
 */
function calculateRentForDays(days, rentPPPW, daysInMonth) {
  const monthlyRate = calculateCalendarMonth(rentPPPW);

  if (days === daysInMonth) {
    return parseFloat(monthlyRate.toFixed(2));
  } else {
    return parseFloat(((days / daysInMonth) * monthlyRate).toFixed(2));
  }
}

/**
 * Generate monthly payment for a rolling tenancy member
 *
 * @param {number} year - Year (e.g., 2025)
 * @param {number} month - Month (0-11)
 * @param {string} tenancyStartDate - Tenancy start date
 * @param {string|null} tenancyEndDate - Tenancy end date (null for ongoing rolling)
 * @param {number} rentPPPW - Rent per person per week
 * @returns {object|null} - Payment details or null if no payment needed
 */
function generateMonthlyPayment(year, month, tenancyStartDate, tenancyEndDate, rentPPPW) {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0); // Last day of month
  const tenancyStart = new Date(tenancyStartDate);

  // Don't generate if this month is before the tenancy started
  if (monthEnd < tenancyStart) {
    return null;
  }

  // Determine the effective period for this month
  let effectiveStart = monthStart;
  let effectiveEnd = monthEnd;

  // Adjust for tenancy start (if tenancy started mid-month)
  if (monthStart < tenancyStart) {
    effectiveStart = tenancyStart;
  }

  // Adjust for tenancy end (if terminating)
  if (tenancyEndDate) {
    const tenancyEnd = new Date(tenancyEndDate);

    // Don't generate if this month is entirely after tenancy end
    if (monthStart > tenancyEnd) {
      return null;
    }

    // Adjust effective end if tenancy ends mid-month
    if (monthEnd > tenancyEnd) {
      effectiveEnd = tenancyEnd;
    }
  }

  // Calculate days and amount
  const days = calculateDays(effectiveStart, effectiveEnd);
  const daysInMonth = calculateDays(monthStart, monthEnd);
  const amount = calculateRentForDays(days, rentPPPW, daysInMonth);

  if (amount <= 0) {
    return null;
  }

  // For rolling monthly, due date is ALWAYS the 1st of the month
  // (First payment is handled separately by generateFirstMonthPayment in paymentService.js)
  const dueDate = monthStart;

  // Generate description
  const description = `Rent - ${getMonthName(month)} ${year}`;

  return {
    due_date: formatDate(dueDate),
    amount_due: amount,
    description,
    days,
    covers_from: formatDate(effectiveStart),
    covers_to: formatDate(effectiveEnd)
  };
}

/**
 * Check if a rent payment already exists for a member in a specific month
 */
async function paymentExistsForMonth(tenancyId, memberId, year, month, agencyId) {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  const result = await db.query(`
    SELECT id FROM payment_schedules
    WHERE tenancy_id = $1
      AND tenancy_member_id = $2
      AND payment_type = 'rent'
      AND due_date >= $3
      AND due_date <= $4
  `, [tenancyId, memberId, formatDate(monthStart), formatDate(monthEnd)], agencyId);

  return result.rows.length > 0;
}

/**
 * Check if a month is already covered by an existing first payment (for mid-month starts)
 *
 * For rolling tenancies that start mid-month:
 * - First payment is due on 1st of NEXT month
 * - It covers: partial start month + full next month
 * - So we should NOT generate payments for either of those months via cron IF the first payment exists
 *
 * @param {number} tenancyId - Tenancy ID
 * @param {number} memberId - Member ID
 * @param {number} year - Year to check
 * @param {number} month - Month to check (0-11)
 * @param {string} tenancyStartDate - Tenancy start date
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Promise<boolean>} - True if this month is covered by an existing first payment
 */
async function isMonthCoveredByFirstPayment(tenancyId, memberId, year, month, tenancyStartDate, agencyId) {
  const tenancyStart = new Date(tenancyStartDate);
  const tenancyStartYear = tenancyStart.getFullYear();
  const tenancyStartMonth = tenancyStart.getMonth();
  const tenancyStartDay = tenancyStart.getDate();

  // If tenancy started on the 1st, first payment only covers that month
  // Let the normal due_date check handle it
  if (tenancyStartDay === 1) {
    return false;
  }

  // Tenancy started mid-month
  // First payment covers: start month (partial) + next month (full)

  // Check if current month is one that SHOULD be covered by first payment
  const isStartMonth = (year === tenancyStartYear && month === tenancyStartMonth);
  const nextMonth = (tenancyStartMonth + 1) % 12;
  const nextMonthYear = tenancyStartMonth === 11 ? tenancyStartYear + 1 : tenancyStartYear;
  const isNextMonth = (year === nextMonthYear && month === nextMonth);

  if (!isStartMonth && !isNextMonth) {
    return false; // Not a month that would be covered by first payment
  }

  // This month SHOULD be covered by first payment - but check if it actually EXISTS
  // First payment due date is 1st of next month after tenancy start
  const firstPaymentDueDate = new Date(nextMonthYear, nextMonth, 1);

  const result = await db.query(`
    SELECT id FROM payment_schedules
    WHERE tenancy_id = $1
      AND tenancy_member_id = $2
      AND payment_type = 'rent'
      AND due_date = $3
  `, [tenancyId, memberId, formatDate(firstPaymentDueDate)], agencyId);

  return result.rows.length > 0; // Only skip if payment actually exists
}

/**
 * Main function: Generate monthly payments for all rolling tenancies
 * This is idempotent - it only creates payments that don't already exist
 *
 * Payments are generated IN ADVANCE - when run in February, it generates
 * the March payment (due March 1st) so tenants can see upcoming payments.
 *
 * @param {number} agencyId - Agency ID for multi-tenancy
 */
exports.generateRollingMonthlyPayments = async (agencyId) => {
  try {
    const today = new Date();
    // Generate payment for NEXT month (so tenants see it in advance)
    const nextMonth = today.getMonth() + 1;
    const targetYear = nextMonth > 11 ? today.getFullYear() + 1 : today.getFullYear();
    const targetMonth = nextMonth % 12;

    console.log(`[Rolling Payments] Generating payments for ${targetYear}-${String(targetMonth + 1).padStart(2, '0')} (due ${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01)...`);

    // Get all rolling tenancies that need payment generation
    // Criteria:
    // - is_rolling_monthly = true
    // - auto_generate_payments = true
    // - status is 'approval' or 'active'
    // - end_date is NULL (ongoing) OR end_date >= start of target month (not yet ended)
    const targetMonthStart = formatDate(new Date(targetYear, targetMonth, 1));

    const tenanciesResult = await db.query(`
      SELECT t.id, t.start_date, t.end_date, t.status, l.manage_rent
      FROM tenancies t
      INNER JOIN properties p ON t.property_id = p.id
      LEFT JOIN landlords l ON p.landlord_id = l.id
      WHERE t.is_rolling_monthly = true
        AND t.auto_generate_payments = true
        AND t.status IN ('approval', 'active')
        AND (t.end_date IS NULL OR t.end_date >= $1)
    `, [targetMonthStart], agencyId);

    const tenancies = tenanciesResult.rows;

    if (tenancies.length === 0) {
      console.log('[Rolling Payments] No rolling tenancies found that need payment generation');
      return {
        success: true,
        tenanciesProcessed: 0,
        paymentsCreated: 0,
        paymentsSkipped: 0
      };
    }

    let totalPaymentsCreated = 0;
    let totalPaymentsSkipped = 0;
    let tenanciesProcessed = 0;

    for (const tenancy of tenancies) {
      // Skip if landlord doesn't manage rent
      const manageRent = tenancy.manage_rent !== undefined ? tenancy.manage_rent : true;
      if (!manageRent) {
        console.log(`[Rolling Payments] Tenancy ${tenancy.id}: Landlord doesn't manage rent, skipping`);
        continue;
      }

      // Get all members for this tenancy
      const membersResult = await db.query(`
        SELECT id, rent_pppw, payment_option
        FROM tenancy_members
        WHERE tenancy_id = $1
      `, [tenancy.id], agencyId);

      const members = membersResult.rows;

      let tenancyPaymentsCreated = 0;

      for (const member of members) {
        if (!member.rent_pppw || member.rent_pppw <= 0) {
          console.log(`[Rolling Payments] Tenancy ${tenancy.id}, Member ${member.id}: No rent amount, skipping`);
          continue;
        }

        // Check if this month is already covered by an existing first payment (for mid-month starts)
        if (await isMonthCoveredByFirstPayment(tenancy.id, member.id, targetYear, targetMonth, tenancy.start_date, agencyId)) {
          console.log(`[Rolling Payments] Tenancy ${tenancy.id}, Member ${member.id}: Month already covered by existing first payment, skipping`);
          totalPaymentsSkipped++;
          continue;
        }

        // Check if payment already exists for this month
        if (await paymentExistsForMonth(tenancy.id, member.id, targetYear, targetMonth, agencyId)) {
          totalPaymentsSkipped++;
          continue;
        }

        // Check if we need to generate the first payment (for mid-month starts)
        const tenancyStart = new Date(tenancy.start_date);
        const tenancyStartDay = tenancyStart.getDate();
        const tenancyStartMonth = tenancyStart.getMonth();
        const tenancyStartYear = tenancyStart.getFullYear();
        const monthAfterStart = (tenancyStartMonth + 1) % 12;
        const yearAfterStart = tenancyStartMonth === 11 ? tenancyStartYear + 1 : tenancyStartYear;

        // If tenancy started mid-month and target month is start month or month after, use first payment logic
        const isFirstPaymentNeeded = tenancyStartDay > 1 &&
          ((targetYear === tenancyStartYear && targetMonth === tenancyStartMonth) ||
           (targetYear === yearAfterStart && targetMonth === monthAfterStart));

        let payment;
        if (isFirstPaymentNeeded) {
          // Use the combined first payment logic (partial month + full next month)
          console.log(`[Rolling Payments] Tenancy ${tenancy.id}, Member ${member.id}: Generating first payment (combined partial + full month)`);
          payment = generateFirstMonthPayment(tenancy.start_date, member.rent_pppw);
        } else {
          // Generate standard monthly payment
          payment = generateMonthlyPayment(
            targetYear,
            targetMonth,
            tenancy.start_date,
            tenancy.end_date,
            member.rent_pppw
          );
        }

        if (payment) {
          await db.query(`
            INSERT INTO payment_schedules (
              agency_id, tenancy_id, tenancy_member_id, payment_type, description, due_date, amount_due, status, schedule_type, covers_from, covers_to
            ) VALUES ($1, $2, $3, 'rent', $4, $5, $6, 'pending', 'automated', $7, $8)
            RETURNING *
          `, [
            agencyId,
            tenancy.id,
            member.id,
            payment.description,
            payment.due_date,
            payment.amount_due,
            payment.covers_from,
            payment.covers_to
          ], agencyId);
          totalPaymentsCreated++;
          tenancyPaymentsCreated++;
        }
      }

      if (tenancyPaymentsCreated > 0) {
        console.log(`[Rolling Payments] Tenancy ${tenancy.id}: Created ${tenancyPaymentsCreated} payment(s)`);
      }

      tenanciesProcessed++;
    }

    console.log(`[Rolling Payments] Complete: ${totalPaymentsCreated} created, ${totalPaymentsSkipped} skipped (already exist)`);

    return {
      success: true,
      tenanciesProcessed,
      paymentsCreated: totalPaymentsCreated,
      paymentsSkipped: totalPaymentsSkipped
    };
  } catch (error) {
    console.error('[Rolling Payments] Error generating rolling monthly payments:', error);
    return {
      success: false,
      error: error.message,
      tenanciesProcessed: 0,
      paymentsCreated: 0,
      paymentsSkipped: 0
    };
  }
};

/**
 * Initialize the rolling payment scheduler
 * Runs daily at 1:30 AM UK time
 *
 * @param {number} agencyId - Agency ID for multi-tenancy
 */
exports.initializeRollingPaymentScheduler = (agencyId) => {
  // Run daily at 1:30 AM UK time (after overdue checker at 1:00 AM)
  cron.schedule('30 1 * * *', async () => {
    console.log('\n[Rolling Payments] Running scheduled rolling monthly payment generation...');
    try {
      const result = await exports.generateRollingMonthlyPayments(agencyId);
      if (result.success) {
        if (result.paymentsCreated > 0) {
          console.log(`[Rolling Payments] Rolling payment generation complete: ${result.paymentsCreated} payment(s) created`);
        } else {
          console.log('[Rolling Payments] Rolling payment generation complete: No new payments needed');
        }
      } else {
        console.error(`[Rolling Payments] Rolling payment generation failed: ${result.error}`);
      }
    } catch (error) {
      console.error('[Rolling Payments] Error in scheduled rolling payment generation:', error.message);
    }
  }, {
    timezone: "Europe/London" // UK timezone for Sheffield
  });

  console.log('[Rolling Payments] Rolling payment scheduler activated (daily at 1:30 AM UK time)');
};

/**
 * Get summary of rolling tenancies for monitoring
 *
 * @param {number} agencyId - Agency ID for multi-tenancy
 */
exports.getRollingTenanciesSummary = async (agencyId) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_rolling,
        SUM(CASE WHEN end_date IS NULL THEN 1 ELSE 0 END) as ongoing,
        SUM(CASE WHEN end_date IS NOT NULL THEN 1 ELSE 0 END) as terminating,
        SUM(CASE WHEN auto_generate_payments = true THEN 1 ELSE 0 END) as auto_generate_enabled
      FROM tenancies
      WHERE is_rolling_monthly = true
        AND status IN ('approval', 'active')
    `, [], agencyId);

    return result.rows[0];
  } catch (error) {
    console.error('[Rolling Payments] Error getting summary:', error);
    return null;
  }
};
