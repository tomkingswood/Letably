/**
 * Payment Schedule Generation Service
 *
 * Generates payment schedules for tenancies based on:
 * - Payment option (monthly, quarterly, monthly_to_quarterly, upfront)
 * - Rent PPPW (per person per week)
 * - Tenancy start and end dates
 * - Uses Calendar Month (PCM) calculation method - UK industry standard
 */

const db = require('../db');
const { calculateRent, getDaysBetween, calculateCalendarMonth } = require('../helpers/rentCalculations');
const {
  formatDate: formatDateForDisplay,
  formatDateISO: formatDate,
  calculateDays,
  getMonthName
} = require('../utils/dateFormatter');

/**
 * Calculate rent amount based on exact days using Calendar Month (PCM) method
 * @param {number} days - Number of days
 * @param {number} rentPPPW - Rent per person per week
 * @param {number} daysInMonth - Total days in the calendar month
 * @returns {object} - { days, weeks (for display), amount }
 */
function calculateRentForDays(days, rentPPPW, daysInMonth) {
  const weeks = Math.ceil(days / 7);

  // Calendar Month: Use proportional calendar month calculation
  const monthlyRate = calculateCalendarMonth(rentPPPW);

  let amount;
  if (days === daysInMonth) {
    // Full calendar month - use fixed monthly rate
    amount = parseFloat(monthlyRate.toFixed(2));
  } else {
    // Partial month - use proportional calculation (industry standard)
    // Formula: (Days in period / Days in month) × Monthly rate
    amount = parseFloat(((days / daysInMonth) * monthlyRate).toFixed(2));
  }

  return { days, weeks, amount };
}

/**
 * Calculate rent for a specific month using Calendar Month (PCM) method
 */
function calculateMonthRent(year, month, tenancyStart, tenancyEnd, rentPPPW) {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0); // Last day of month

  // Adjust for tenancy boundaries
  const effectiveStart = monthStart < new Date(tenancyStart) ? new Date(tenancyStart) : monthStart;
  const effectiveEnd = monthEnd > new Date(tenancyEnd) ? new Date(tenancyEnd) : monthEnd;

  if (effectiveStart > effectiveEnd) return { days: 0, weeks: 0, amount: 0 };

  const days = calculateDays(effectiveStart, effectiveEnd);
  const daysInMonth = calculateDays(monthStart, monthEnd);

  return calculateRentForDays(days, rentPPPW, daysInMonth);
}

/**
 * Calculate rent for multiple months using Calendar Month (PCM) method
 * Sums up individual month calculations for industry-standard PCM billing
 */
function calculateMultiMonthRent(startDate, endDate, rentPPPW) {
  // Break into individual months and sum
  const monthlyRate = calculateCalendarMonth(rentPPPW);
  let totalAmount = 0;
  let totalDays = 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  let currentDate = new Date(start);

  while (currentDate <= end) {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    // Adjust for period boundaries
    const periodStart = monthStart < start ? start : monthStart;
    const periodEnd = monthEnd > end ? end : monthEnd;

    if (periodStart <= periodEnd) {
      const daysInThisMonth = calculateDays(periodStart, periodEnd);
      const daysInFullMonth = monthEnd.getDate();

      const monthRent = calculateRentForDays(daysInThisMonth, rentPPPW, daysInFullMonth);
      totalAmount += monthRent.amount;
      totalDays += daysInThisMonth;
    }

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
    currentDate.setDate(1);
  }

  return {
    days: totalDays,
    weeks: Math.ceil(totalDays / 7),
    amount: parseFloat(totalAmount.toFixed(2))
  };
}

/**
 * Calculate rent for a quarter (3-month period) using Calendar Month (PCM) method
 */
function calculateQuarterRent(startMonth, year, tenancyStart, tenancyEnd, rentPPPW) {
  const quarterStart = new Date(year, startMonth, 1);
  const quarterEnd = new Date(year, startMonth + 3, 0); // Last day of 3rd month

  // Adjust for tenancy boundaries
  const effectiveStart = quarterStart < new Date(tenancyStart) ? new Date(tenancyStart) : quarterStart;
  const effectiveEnd = quarterEnd > new Date(tenancyEnd) ? new Date(tenancyEnd) : quarterEnd;

  if (effectiveStart > effectiveEnd) return { days: 0, weeks: 0, amount: 0 };

  // Use month-by-month calculation
  return calculateMultiMonthRent(effectiveStart, effectiveEnd, rentPPPW);
}

/**
 * Get the first day of the month (or tenancy start if later)
 */
function getPaymentDate(year, month, tenancyStart) {
  const firstOfMonth = new Date(year, month, 1);
  const tenancyStartDate = new Date(tenancyStart);
  return firstOfMonth > tenancyStartDate ? firstOfMonth : tenancyStartDate;
}

/**
 * Generate monthly payment schedule using Calendar Month (PCM) method
 */
function generateMonthlySchedule(startDate, endDate, rentPPPW) {
  const payments = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let currentDate = new Date(start.getFullYear(), start.getMonth(), 1);

  // If tenancy starts after 1st of month, first payment is partial month
  if (start.getDate() > 1) {
    const rent = calculateMonthRent(start.getFullYear(), start.getMonth(), startDate, endDate, rentPPPW);
    if (rent.amount > 0) {
      const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      const effectiveEnd = monthEnd > end ? end : monthEnd;
      payments.push({
        due_date: formatDate(start),
        amount_due: rent.amount,
        weeks: rent.weeks,
        period_description: `${formatDateForDisplay(start, 'month_year')} (partial)`,
        covers_from: formatDate(start),
        covers_to: formatDate(effectiveEnd)
      });
    }
    // Move to next month
    currentDate = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  }

  // Generate payments for each month
  while (currentDate <= end) {
    const rent = calculateMonthRent(currentDate.getFullYear(), currentDate.getMonth(), startDate, endDate, rentPPPW);

    if (rent.amount > 0) {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const effectiveStart = monthStart < start ? start : monthStart;
      const effectiveEnd = monthEnd > end ? end : monthEnd;
      payments.push({
        due_date: formatDate(currentDate),
        amount_due: rent.amount,
        weeks: rent.weeks,
        period_description: formatDateForDisplay(currentDate, 'month_year'),
        covers_from: formatDate(effectiveStart),
        covers_to: formatDate(effectiveEnd)
      });
    }

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return payments;
}

/**
 * Generate quarterly payment schedule using Calendar Month (PCM) method
 * Quarters: July-Sep, Oct-Dec, Jan-Mar, Apr-Jun
 */
function generateQuarterlySchedule(startDate, endDate, rentPPPW) {
  const payments = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Quarter start months: 6=July, 9=October, 0=January, 3=April
  const quarterMonths = [6, 9, 0, 3]; // July, Oct, Jan, Apr

  let currentYear = start.getFullYear();
  let startMonth = start.getMonth();
  let startDay = start.getDate();

  // Find the first quarter that includes or starts after the tenancy start
  // Need to handle chronological order, not numeric (Jan=0, but comes after Oct=9 in academic year)
  let firstQuarterMonth;

  if (startMonth >= 6 && startMonth < 9) {
    // July-Sep quarter
    // If starts on 1st of July, use July quarter, otherwise use October
    firstQuarterMonth = (startMonth === 6 && startDay === 1) ? 6 : 9;
  } else if (startMonth >= 9 && startMonth < 12) {
    // Oct-Dec quarter
    // If starts on 1st of October, November, or December, use October quarter
    // Otherwise use January next year
    if (startMonth === 9 && startDay === 1) {
      firstQuarterMonth = 9;  // October quarter
    } else if ((startMonth === 10 || startMonth === 11) && startDay === 1) {
      firstQuarterMonth = 9;  // Still October quarter (Nov/Dec are part of it)
    } else {
      firstQuarterMonth = 0;  // January next year
      currentYear++;
    }
  } else if (startMonth >= 0 && startMonth < 3) {
    // Jan-Mar quarter
    // If starts on 1st of January, use January quarter, otherwise use April
    firstQuarterMonth = (startMonth === 0 && startDay === 1) ? 0 : 3;
  } else {
    // Apr-Jun quarter
    // If starts on 1st of April, use April quarter, otherwise use July
    firstQuarterMonth = (startMonth === 3 && startDay === 1) ? 3 : 6;
  }

  // Handle first payment if tenancy doesn't start on quarter boundary
  const firstQuarterStart = new Date(currentYear, firstQuarterMonth, 1);
  if (start < firstQuarterStart) {
    // Payment from start to day before quarter start (or tenancy end if earlier)
    const calculatedPeriodEnd = new Date(firstQuarterStart.getTime() - 1);
    const periodEnd = calculatedPeriodEnd < end ? calculatedPeriodEnd : end;

    // Use month-by-month calculation
    const rent = calculateMultiMonthRent(start, periodEnd, rentPPPW);

    if (rent.amount > 0) {
      payments.push({
        due_date: formatDate(start),
        amount_due: rent.amount,
        weeks: rent.weeks,
        period_description: 'Until quarter start',
        covers_from: formatDate(start),
        covers_to: formatDate(periodEnd)
      });
    }
  }

  // Generate quarterly payments
  let paymentDate = firstQuarterStart;
  let isFirstPayment = true;

  while (paymentDate <= end) {
    const month = paymentDate.getMonth();
    const year = paymentDate.getFullYear();
    const rent = calculateQuarterRent(month, year, startDate, endDate, rentPPPW);

    if (rent.amount > 0) {
      const quarterName = month === 6 ? 'July-September' :
                         month === 9 ? 'October-December' :
                         month === 0 ? 'January-March' : 'April-June';

      // For the first payment, use the later of quarter start or tenancy start as due date
      const actualDueDate = isFirstPayment && start > paymentDate ? start : paymentDate;

      // Calculate quarter boundaries for coverage period
      const quarterStart = new Date(year, month, 1);
      const quarterEnd = new Date(year, month + 3, 0); // Last day of 3rd month
      const effectiveStart = quarterStart < start ? start : quarterStart;
      const effectiveEnd = quarterEnd > end ? end : quarterEnd;

      payments.push({
        due_date: formatDate(actualDueDate),
        amount_due: rent.amount,
        weeks: rent.weeks,
        period_description: `${quarterName} ${year}`,
        covers_from: formatDate(effectiveStart),
        covers_to: formatDate(effectiveEnd)
      });

      isFirstPayment = false;
    }

    // Move to next quarter
    const nextQuarterIndex = (quarterMonths.indexOf(month) + 1) % 4;
    const nextMonth = quarterMonths[nextQuarterIndex];
    const nextYear = nextMonth === 0 && month !== 0 ? year + 1 : year;
    paymentDate = new Date(nextYear, nextMonth, 1);
  }

  return payments;
}

/**
 * Generate monthly-to-quarterly schedule using Calendar Month (PCM) method
 * July, August, September = Monthly
 * October, January, April = Quarterly (3 months each)
 */
function generateMonthlyToQuarterlySchedule(startDate, endDate, rentPPPW) {
  const payments = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let currentDate = new Date(start);

  // Handle partial first payment if starting mid-month
  if (start.getDate() > 1) {
    const month = start.getMonth();
    const rent = calculateMonthRent(start.getFullYear(), month, startDate, endDate, rentPPPW);
    if (rent.amount > 0) {
      const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      const effectiveEnd = monthEnd > end ? end : monthEnd;
      payments.push({
        due_date: formatDate(start),
        amount_due: rent.amount,
        weeks: rent.weeks,
        period_description: `${formatDateForDisplay(start, 'month_year')} (partial)`,
        covers_from: formatDate(start),
        covers_to: formatDate(effectiveEnd)
      });
    }
    // Move to next month
    currentDate = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  } else {
    currentDate = new Date(start.getFullYear(), start.getMonth(), 1);
  }

  while (currentDate <= end) {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();

    // Monthly months: July (6), August (7), September (8)
    // Quarterly months: October (9), January (0), April (3)
    if (month === 6 || month === 7 || month === 8) {
      // Monthly payment
      const rent = calculateMonthRent(year, month, startDate, endDate, rentPPPW);
      if (rent.amount > 0) {
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);
        const effectiveStart = monthStart < start ? start : monthStart;
        const effectiveEnd = monthEnd > end ? end : monthEnd;
        payments.push({
          due_date: formatDate(currentDate),
          amount_due: rent.amount,
          weeks: rent.weeks,
          period_description: currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
          covers_from: formatDate(effectiveStart),
          covers_to: formatDate(effectiveEnd)
        });
      }
      currentDate.setMonth(month + 1);
    } else if (month === 9 || month === 0 || month === 3) {
      // Quarterly payment
      const rent = calculateQuarterRent(month, year, startDate, endDate, rentPPPW);
      if (rent.amount > 0) {
        const quarterName = month === 9 ? 'October-December' :
                           month === 0 ? 'January-March' : 'April-June';
        const quarterStart = new Date(year, month, 1);
        const quarterEnd = new Date(year, month + 3, 0);
        const effectiveStart = quarterStart < start ? start : quarterStart;
        const effectiveEnd = quarterEnd > end ? end : quarterEnd;
        payments.push({
          due_date: formatDate(currentDate),
          amount_due: rent.amount,
          weeks: rent.weeks,
          period_description: `${quarterName} ${year}`,
          covers_from: formatDate(effectiveStart),
          covers_to: formatDate(effectiveEnd)
        });
      }
      currentDate.setMonth(month + 3);
    } else {
      // Skip non-payment months
      currentDate.setMonth(month + 1);
    }
  }

  return payments;
}

/**
 * Generate upfront payment schedule (single payment) using Calendar Month (PCM) method
 */
function generateUpfrontSchedule(startDate, endDate, rentPPPW) {
  // Use month-by-month calculation
  const rent = calculateMultiMonthRent(startDate, endDate, rentPPPW);

  return [{
    due_date: startDate,
    amount_due: rent.amount,
    weeks: rent.weeks,
    period_description: 'Full tenancy (upfront)',
    covers_from: startDate,
    covers_to: endDate
  }];
}

/**
 * Main function to generate payment schedule using Calendar Month (PCM) method
 */
exports.generatePaymentSchedule = (tenancyStartDate, tenancyEndDate, paymentOption, rentPPPW) => {
  switch (paymentOption) {
    case 'monthly':
      return generateMonthlySchedule(tenancyStartDate, tenancyEndDate, rentPPPW);

    case 'quarterly':
      return generateQuarterlySchedule(tenancyStartDate, tenancyEndDate, rentPPPW);

    case 'monthly_to_quarterly':
      return generateMonthlyToQuarterlySchedule(tenancyStartDate, tenancyEndDate, rentPPPW);

    case 'upfront':
      return generateUpfrontSchedule(tenancyStartDate, tenancyEndDate, rentPPPW);

    default:
      throw new Error(`Unknown payment option: ${paymentOption}`);
  }
};

/**
 * Generate and save payment schedules for all members of a tenancy
 * Uses Calendar Month (PCM) calculation method - UK industry standard
 *
 * For rolling monthly tenancies:
 * - Only generates the first month's rent payment
 * - Subsequent months are generated by the daily cron job (rollingPaymentService)
 *
 * @param {number} tenancyId - Tenancy ID
 * @param {string} agencyId - Agency ID for multi-tenancy
 * @returns {object} - Result summary
 */
exports.generatePaymentSchedulesForTenancy = async (tenancyId, agencyId) => {
  try {
    // Get tenancy details with landlord's manage_rent setting and rolling monthly flag
    // Using LEFT JOIN for landlord since it's optional
    const tenancyResult = await db.query(`
      SELECT t.start_date, t.end_date, t.is_rolling_monthly, t.auto_generate_payments, l.manage_rent
      FROM tenancies t
      INNER JOIN properties p ON t.property_id = p.id
      LEFT JOIN landlords l ON p.landlord_id = l.id
      WHERE t.id = $1
    `, [tenancyId], agencyId);

    const tenancy = tenancyResult.rows[0];

    if (!tenancy) {
      throw new Error(`Tenancy ${tenancyId} not found`);
    }

    // Check if landlord manages rent (default to true if no landlord or not set)
    const manageRent = tenancy.manage_rent !== null && tenancy.manage_rent !== undefined ? tenancy.manage_rent : true;
    const isRollingMonthly = tenancy.is_rolling_monthly === true;

    // Get all members
    const membersResult = await db.query(`
      SELECT id, rent_pppw, payment_option, deposit_amount
      FROM tenancy_members
      WHERE tenancy_id = $1
    `, [tenancyId], agencyId);

    const members = membersResult.rows;

    let totalPaymentsCreated = 0;

    // Calculate deposit due date (7 days before tenancy start)
    const startDate = new Date(tenancy.start_date);
    const depositDueDate = new Date(startDate);
    depositDueDate.setDate(depositDueDate.getDate() - 7);
    const depositDueDateStr = formatDate(depositDueDate);

    // Generate schedules for each member using Calendar Month method
    for (const member of members) {
      if (!member.payment_option) {
        console.warn(`Member ${member.id} has no payment option, skipping`);
        continue;
      }

      // Create deposit payment (due 7 days before start date)
      // Deposit payments are ALWAYS created regardless of manage_rent setting
      if (member.deposit_amount && member.deposit_amount > 0) {
        await db.query(`
          INSERT INTO payment_schedules (
            agency_id, tenancy_id, tenancy_member_id, payment_type, description, due_date, amount_due, status, schedule_type, covers_from, covers_to
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'automated', $8, $9)
          RETURNING *
        `, [
          agencyId,
          tenancyId,
          member.id,
          'deposit',
          'Security Deposit',
          depositDueDateStr,
          member.deposit_amount,
          null, // covers_from - deposits don't have coverage periods
          null  // covers_to
        ], agencyId);
        totalPaymentsCreated++;
      }

      // Generate rent payment schedule ONLY if landlord manages rent
      if (manageRent) {
        if (isRollingMonthly) {
          // For rolling monthly tenancies, only generate the first month's payment
          // Subsequent months are handled by the daily cron job
          const firstMonthPayment = exports.generateFirstMonthPayment(
            tenancy.start_date,
            member.rent_pppw
          );

          if (firstMonthPayment) {
            await db.query(`
              INSERT INTO payment_schedules (
                agency_id, tenancy_id, tenancy_member_id, payment_type, description, due_date, amount_due, status, schedule_type, covers_from, covers_to
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'automated', $8, $9)
              RETURNING *
            `, [
              agencyId,
              tenancyId,
              member.id,
              'rent',
              firstMonthPayment.description || 'Rent Payment',
              firstMonthPayment.due_date,
              firstMonthPayment.amount_due,
              firstMonthPayment.covers_from || null,
              firstMonthPayment.covers_to || null
            ], agencyId);
            totalPaymentsCreated++;
          }
        } else {
          // For fixed-term tenancies, generate the full schedule
          const schedule = exports.generatePaymentSchedule(
            tenancy.start_date,
            tenancy.end_date,
            member.payment_option,
            member.rent_pppw
          );

          // Insert each rent payment
          for (const payment of schedule) {
            // Use period_description with "Rent - " prefix for consistency with rolling payments
            const description = payment.period_description
              ? `Rent - ${payment.period_description}`
              : (payment.description || 'Rent Payment');
            await db.query(`
              INSERT INTO payment_schedules (
                agency_id, tenancy_id, tenancy_member_id, payment_type, description, due_date, amount_due, status, schedule_type, covers_from, covers_to
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'automated', $8, $9)
              RETURNING *
            `, [
              agencyId,
              tenancyId,
              member.id,
              'rent',
              description,
              payment.due_date,
              payment.amount_due,
              payment.covers_from || null,
              payment.covers_to || null
            ], agencyId);
            totalPaymentsCreated++;
          }
        }
      }

      // Deposit return is now created manually when keys are returned
      // (removed automatic generation)
    }

    return {
      success: true,
      membersProcessed: members.length,
      paymentsCreated: totalPaymentsCreated,
      isRollingMonthly
    };
  } catch (error) {
    console.error('Error generating payment schedules for tenancy:', error);
    throw error;
  }
};

/**
 * Generate first month payment for rolling monthly tenancy
 * For rolling tenancies, payments are ALWAYS due on the 1st of the month.
 * If tenancy starts mid-month, the first payment is due on the 1st of the NEXT month
 * and includes pro-rata for the partial first month PLUS the full next month.
 *
 * @param {string} tenancyStartDate - Start date of tenancy (YYYY-MM-DD)
 * @param {number} rentPPPW - Rent per person per week
 * @returns {object|null} - Payment object with due_date, amount_due, description
 */
exports.generateFirstMonthPayment = (tenancyStartDate, rentPPPW) => {
  const start = new Date(tenancyStartDate);
  const year = start.getFullYear();
  const month = start.getMonth();
  const dayOfMonth = start.getDate();

  // Check if tenancy starts on the 1st of the month
  const startsOnFirst = dayOfMonth === 1;

  if (startsOnFirst) {
    // Starts on 1st: Full month payment, due on 1st
    const monthEnd = new Date(year, month + 1, 0); // Last day of month
    const monthEndStr = formatDate(monthEnd);

    const rentDetails = calculateMonthRent(year, month, tenancyStartDate, monthEndStr, rentPPPW);

    if (rentDetails.amount <= 0) {
      return null;
    }

    return {
      due_date: tenancyStartDate,
      amount_due: rentDetails.amount,
      description: `Rent - ${getMonthName(month)} ${year}`,
      weeks: rentDetails.weeks,
      days: rentDetails.days,
      covers_from: tenancyStartDate,
      covers_to: monthEndStr
    };
  } else {
    // Starts mid-month: Combined partial month + full next month, due on 1st of next month
    const currentMonthEnd = new Date(year, month + 1, 0); // Last day of current month
    const nextMonthStart = new Date(year, month + 1, 1); // 1st of next month
    const nextMonthEnd = new Date(year, month + 2, 0); // Last day of next month

    // Calculate partial current month (start date to end of month)
    const partialMonthRent = calculateMonthRent(year, month, tenancyStartDate, formatDate(currentMonthEnd), rentPPPW);

    // Calculate full next month
    const nextMonth = (month + 1) % 12;
    const nextMonthYear = month === 11 ? year + 1 : year;
    const fullMonthRent = calculateMonthRent(nextMonthYear, nextMonth, formatDate(nextMonthStart), formatDate(nextMonthEnd), rentPPPW);

    const totalAmount = partialMonthRent.amount + fullMonthRent.amount;
    const totalDays = partialMonthRent.days + fullMonthRent.days;

    if (totalAmount <= 0) {
      return null;
    }

    // Due date is 1st of next month
    const dueDate = formatDate(nextMonthStart);

    // Description shows both months
    const currentMonthName = getMonthName(month);
    const nextMonthName = getMonthName(nextMonth);
    const description = `Rent - ${currentMonthName} ${year} (partial) & ${nextMonthName} ${nextMonthYear}`;

    return {
      due_date: dueDate,
      amount_due: parseFloat(totalAmount.toFixed(2)),
      description,
      weeks: Math.round(totalDays / 7 * 100) / 100,
      days: totalDays,
      covers_from: tenancyStartDate,
      covers_to: formatDate(nextMonthEnd)
    };
  }
};

/**
 * Create deposit return schedules for all members of a tenancy
 * Called when keys are returned
 * @param {number} tenancyId - Tenancy ID
 * @param {string} keyReturnDate - Key return date (YYYY-MM-DD)
 * @param {string} agencyId - Agency ID for multi-tenancy
 * @returns {object} - Result summary
 */
exports.createDepositReturnSchedules = async (tenancyId, keyReturnDate, agencyId) => {
  try {
    // Get all members with deposit amounts
    const membersResult = await db.query(`
      SELECT id, deposit_amount
      FROM tenancy_members
      WHERE tenancy_id = $1 AND deposit_amount > 0
    `, [tenancyId], agencyId);

    const members = membersResult.rows;

    if (members.length === 0) {
      return {
        success: true,
        message: 'No members with deposits found',
        schedulesCreated: 0
      };
    }

    // Calculate deposit return date (14 days after key return)
    const returnDate = new Date(keyReturnDate);
    returnDate.setDate(returnDate.getDate() + 14);
    const depositReturnDateStr = formatDate(returnDate);

    // Check if deposit return schedules already exist
    const existingSchedulesResult = await db.query(`
      SELECT COUNT(*) as count
      FROM payment_schedules
      WHERE tenancy_id = $1 AND payment_type = 'deposit' AND description = 'Deposit Return'
    `, [tenancyId], agencyId);

    const existingSchedules = existingSchedulesResult.rows[0];

    if (parseInt(existingSchedules.count) > 0) {
      throw new Error('Deposit return schedules already exist for this tenancy');
    }

    let schedulesCreated = 0;

    // Create deposit return payment for each member
    for (const member of members) {
      await db.query(`
        INSERT INTO payment_schedules (
          agency_id, tenancy_id, tenancy_member_id, payment_type, description, due_date, amount_due, status, schedule_type, covers_from, covers_to
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'automated', $8, $9)
        RETURNING *
      `, [
        agencyId,
        tenancyId,
        member.id,
        'deposit',
        'Deposit Return',
        depositReturnDateStr,
        -member.deposit_amount,  // Negative amount for return
        null, // covers_from - deposits don't have coverage periods
        null  // covers_to
      ], agencyId);
      schedulesCreated++;
    }

    return {
      success: true,
      schedulesCreated,
      depositReturnDate: depositReturnDateStr
    };
  } catch (error) {
    console.error('Error creating deposit return schedules:', error);
    throw error;
  }
};
