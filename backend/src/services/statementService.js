const db = require('../db');

/**
 * Calculate estimated rent for rolling monthly tenancies that don't have payments generated yet
 * for a specific month.
 *
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @param {number|null} landlordId - Optional landlord filter (null = all, -1 = unassigned)
 * @param {number} agencyId - The agency ID for multi-tenancy
 * @returns {Promise<number>} Estimated rent amount
 */
async function calculateRollingMonthlyEstimate(year, month, landlordId = null, agencyId) {
  try {
    const paddedMonth = month.toString().padStart(2, '0');
    const monthStart = `${year}-${paddedMonth}-01`;

    // Calculate last day of month
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${paddedMonth}-${lastDay.toString().padStart(2, '0')}`;

    // Find all tenancy members from rolling monthly tenancies that:
    // 1. Have is_rolling_monthly = true and auto_generate_payments = true
    // 2. Are in active/approval status
    // 3. Started on or before the end of the target month
    // 4. Haven't ended before the start of the target month (or have no end date)
    // 5. Landlord has manage_rent = true (or no landlord)
    // 6. Don't already have a rent payment scheduled for this month

    let query = `
      SELECT
        tm.id as member_id,
        tm.rent_pppw,
        t.id as tenancy_id,
        t.start_date,
        t.end_date,
        p.id as property_id,
        p.landlord_id
      FROM tenancy_members tm
      INNER JOIN tenancies t ON tm.tenancy_id = t.id
      INNER JOIN properties p ON t.property_id = p.id
      LEFT JOIN landlords l ON p.landlord_id = l.id
      WHERE t.agency_id = $1
        AND t.is_rolling_monthly = true
        AND t.auto_generate_payments = true
        AND t.status IN ('active', 'approval')
        AND t.start_date <= $2
        AND (t.end_date IS NULL OR t.end_date >= $3)
        AND (l.manage_rent = true OR l.manage_rent IS NULL OR p.landlord_id IS NULL)
        AND tm.rent_pppw > 0
        AND NOT EXISTS (
          SELECT 1 FROM payment_schedules ps
          WHERE ps.tenancy_member_id = tm.id
            AND ps.agency_id = $1
            AND ps.payment_type = 'rent'
            AND EXTRACT(YEAR FROM ps.due_date) = $4
            AND EXTRACT(MONTH FROM ps.due_date) = $5
        )
    `;

    const params = [agencyId, monthEnd, monthStart, year, month];
    let paramIndex = 6;

    if (landlordId === -1) {
      query += ` AND p.landlord_id IS NULL`;
    } else if (landlordId) {
      query += ` AND p.landlord_id = $${paramIndex}`;
      params.push(landlordId);
      paramIndex++;
    }

    const result = await db.query(query, params, agencyId);
    const members = result.rows;

    // Calculate monthly rent for each member using PCM method: rent_pppw * 52 / 12
    let totalEstimate = 0;
    for (const member of members) {
      const monthlyRent = (parseFloat(member.rent_pppw) * 52) / 12;
      totalEstimate += monthlyRent;
    }

    return Math.round(totalEstimate * 100) / 100;
  } catch (error) {
    console.error('Error calculating rolling monthly estimate:', error);
    throw error;
  }
}

/**
 * Get landlord ID from user email
 * @param {string} email - The email address
 * @param {number} agencyId - The agency ID for multi-tenancy
 * @returns {Promise<Object|undefined>} The landlord object or undefined
 */
async function getLandlordByEmail(email, agencyId) {
  try {
    const result = await db.query(`
      SELECT id, name, legal_name, email, phone,
             address_line1, address_line2, city, postcode,
             bank_name, bank_account_name, sort_code, account_number
      FROM landlords
      WHERE LOWER(email) = LOWER($1)
    `, [email], agencyId);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting landlord by email:', error);
    throw error;
  }
}

/**
 * Generate statement data for a landlord for a specific month
 * @param {number} landlordId - The landlord ID
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @param {number} agencyId - The agency ID for multi-tenancy
 * @returns {Promise<Object>} The monthly statement data
 */
async function generateMonthlyStatement(landlordId, year, month, agencyId) {
  try {
    // Get all properties for this landlord
    const propertiesResult = await db.query(`
      SELECT id, address_line1, address_line2, city, postcode
      FROM properties
      WHERE landlord_id = $1
      ORDER BY address_line1
    `, [landlordId], agencyId);
    const properties = propertiesResult.rows;

    // Get all payment schedules for the month
    const paymentSchedulesResult = await db.query(`
      SELECT
        ps.id,
        ps.due_date,
        ps.amount_due,
        ps.status,
        ps.payment_type,
        ps.description,
        ps.covers_from,
        ps.covers_to,
        tm.first_name || ' ' || tm.surname as tenant_name,
        tm.id as member_id,
        t.id as tenancy_id,
        t.tenancy_type,
        p.id as property_id,
        p.address_line1 as property_address,
        b.bedroom_name,
        COALESCE(SUM(pay.amount), 0) as amount_paid
      FROM payment_schedules ps
      INNER JOIN tenancy_members tm ON ps.tenancy_member_id = tm.id
      INNER JOIN tenancies t ON ps.tenancy_id = t.id
      INNER JOIN properties p ON t.property_id = p.id
      LEFT JOIN bedrooms b ON tm.bedroom_id = b.id
      LEFT JOIN payments pay ON ps.id = pay.payment_schedule_id
      WHERE p.landlord_id = $1
        AND EXTRACT(YEAR FROM ps.due_date) = $2
        AND EXTRACT(MONTH FROM ps.due_date) = $3
      GROUP BY ps.id, ps.due_date, ps.amount_due, ps.status, ps.payment_type,
               ps.description, ps.covers_from, ps.covers_to, tm.first_name,
               tm.surname, tm.id, t.id, t.tenancy_type, p.id, p.address_line1, b.bedroom_name
      ORDER BY p.address_line1, ps.due_date ASC
    `, [landlordId, year, month], agencyId);
    const paymentSchedules = paymentSchedulesResult.rows;

    // Calculate totals
    let totalDue = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    const propertyBreakdown = {};

    paymentSchedules.forEach(schedule => {
      const amountDue = parseFloat(schedule.amount_due) || 0;
      const amountPaid = parseFloat(schedule.amount_paid) || 0;
      const outstanding = amountDue - amountPaid;

      totalDue += amountDue;
      totalPaid += amountPaid;
      totalOutstanding += outstanding > 0 ? outstanding : 0;

      // Group by property
      if (!propertyBreakdown[schedule.property_id]) {
        propertyBreakdown[schedule.property_id] = {
          property_id: schedule.property_id,
          address: schedule.property_address,
          tenancy_type: schedule.tenancy_type,
          totalDue: 0,
          totalPaid: 0,
          payments: []
        };
      }

      propertyBreakdown[schedule.property_id].totalDue += amountDue;
      propertyBreakdown[schedule.property_id].totalPaid += amountPaid;
      propertyBreakdown[schedule.property_id].payments.push({
        id: schedule.id,
        due_date: schedule.due_date,
        amount_due: amountDue,
        amount_paid: amountPaid,
        status: schedule.status,
        payment_type: schedule.payment_type,
        description: schedule.description,
        tenant_name: schedule.tenant_name,
        bedroom_name: schedule.bedroom_name
      });
    });

    return {
      period: {
        year: parseInt(year),
        month: parseInt(month),
        monthName: new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'long' })
      },
      summary: {
        totalDue: Math.round(totalDue * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        paymentCount: paymentSchedules.length,
        paidCount: paymentSchedules.filter(p => p.status === 'paid').length,
        pendingCount: paymentSchedules.filter(p => p.status === 'pending').length,
        overdueCount: paymentSchedules.filter(p => p.status === 'overdue' || p.status === 'partial').length
      },
      properties: Object.values(propertyBreakdown),
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating monthly statement:', error);
    throw error;
  }
}

/**
 * Generate annual summary for a landlord
 * @param {number} landlordId - The landlord ID
 * @param {number} year - The year
 * @param {number} agencyId - The agency ID for multi-tenancy
 * @returns {Promise<Object>} The annual summary data
 */
async function generateAnnualSummary(landlordId, year, agencyId) {
  try {
    const monthlySummaries = [];
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    for (let month = 1; month <= 12; month++) {
      const monthDataResult = await db.query(`
        SELECT
          COALESCE(SUM(ps.amount_due), 0) as total_due,
          COALESCE(SUM(COALESCE(pay_sum.amount_paid, 0)), 0) as total_paid,
          COUNT(ps.id) as payment_count,
          SUM(CASE WHEN ps.status = 'paid' THEN 1 ELSE 0 END) as paid_count,
          COALESCE(SUM(CASE WHEN ps.due_date <= $1 THEN ps.amount_due ELSE 0 END), 0) as currently_due,
          COALESCE(SUM(CASE WHEN ps.due_date > $1 THEN ps.amount_due ELSE 0 END), 0) as future_scheduled
        FROM payment_schedules ps
        INNER JOIN tenancy_members tm ON ps.tenancy_member_id = tm.id
        INNER JOIN tenancies t ON ps.tenancy_id = t.id
        INNER JOIN properties p ON t.property_id = p.id
        LEFT JOIN (
          SELECT payment_schedule_id, SUM(amount) as amount_paid
          FROM payments
          GROUP BY payment_schedule_id
        ) pay_sum ON ps.id = pay_sum.payment_schedule_id
        WHERE p.landlord_id = $2
          AND EXTRACT(YEAR FROM ps.due_date) = $3
          AND EXTRACT(MONTH FROM ps.due_date) = $4
      `, [today, landlordId, year, month], agencyId);
      const monthData = monthDataResult.rows[0];

      // Calculate estimated rolling monthly payments not yet generated
      const rollingEstimate = await calculateRollingMonthlyEstimate(year, month, landlordId, agencyId);

      monthlySummaries.push({
        month,
        monthName: new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'short' }),
        totalDue: Math.round((parseFloat(monthData.total_due) || 0) * 100) / 100,
        totalPaid: Math.round((parseFloat(monthData.total_paid) || 0) * 100) / 100,
        currentlyDue: Math.round((parseFloat(monthData.currently_due) || 0) * 100) / 100,
        futureScheduled: Math.round((parseFloat(monthData.future_scheduled) || 0) * 100) / 100,
        rollingEstimate,
        paymentCount: parseInt(monthData.payment_count) || 0,
        paidCount: parseInt(monthData.paid_count) || 0
      });
    }

    // Calculate annual totals
    const annualTotals = monthlySummaries.reduce((acc, month) => ({
      totalDue: acc.totalDue + month.totalDue,
      totalPaid: acc.totalPaid + month.totalPaid,
      currentlyDue: acc.currentlyDue + month.currentlyDue,
      futureScheduled: acc.futureScheduled + month.futureScheduled,
      rollingEstimate: acc.rollingEstimate + month.rollingEstimate,
      paymentCount: acc.paymentCount + month.paymentCount,
      paidCount: acc.paidCount + month.paidCount
    }), { totalDue: 0, totalPaid: 0, currentlyDue: 0, futureScheduled: 0, rollingEstimate: 0, paymentCount: 0, paidCount: 0 });

    // Outstanding = currently due - what's been paid (but not negative)
    const outstanding = Math.max(0, annualTotals.currentlyDue - annualTotals.totalPaid);

    return {
      year: parseInt(year),
      monthly: monthlySummaries,
      annual: {
        totalScheduled: Math.round(annualTotals.totalDue * 100) / 100,
        currentlyDue: Math.round(annualTotals.currentlyDue * 100) / 100,
        futureScheduled: Math.round(annualTotals.futureScheduled * 100) / 100,
        rollingEstimate: Math.round(annualTotals.rollingEstimate * 100) / 100,
        totalPaid: Math.round(annualTotals.totalPaid * 100) / 100,
        totalOutstanding: Math.round(outstanding * 100) / 100,
        paymentCount: annualTotals.paymentCount,
        paidCount: annualTotals.paidCount,
        collectionRate: annualTotals.currentlyDue > 0
          ? Math.round((annualTotals.totalPaid / annualTotals.currentlyDue) * 100)
          : 0
      },
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating annual summary:', error);
    throw error;
  }
}

/**
 * Get available statement periods for a landlord
 * @param {number} landlordId - The landlord ID
 * @param {number} agencyId - The agency ID for multi-tenancy
 * @returns {Promise<Array>} Array of available periods grouped by year
 */
async function getAvailablePeriods(landlordId, agencyId) {
  try {
    const result = await db.query(`
      SELECT DISTINCT
        EXTRACT(YEAR FROM ps.due_date)::integer as year,
        EXTRACT(MONTH FROM ps.due_date)::integer as month
      FROM payment_schedules ps
      INNER JOIN tenancy_members tm ON ps.tenancy_member_id = tm.id
      INNER JOIN tenancies t ON ps.tenancy_id = t.id
      INNER JOIN properties p ON t.property_id = p.id
      WHERE p.landlord_id = $1
      ORDER BY year DESC, month DESC
    `, [landlordId], agencyId);
    const periods = result.rows;

    // Group by year
    const grouped = {};
    periods.forEach(p => {
      if (!grouped[p.year]) {
        grouped[p.year] = [];
      }
      grouped[p.year].push(parseInt(p.month));
    });

    return Object.entries(grouped).map(([year, months]) => ({
      year: parseInt(year),
      months: months.sort((a, b) => b - a)
    })).sort((a, b) => b.year - a.year);
  } catch (error) {
    console.error('Error getting available periods:', error);
    throw error;
  }
}

// ============================================
// Admin Functions (All Landlords)
// ============================================

/**
 * Generate statement data for ALL properties for a specific month (Admin)
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @param {number|null} landlordId - Optional landlord filter (null = all, -1 = unassigned)
 * @param {number} agencyId - The agency ID for multi-tenancy
 * @returns {Promise<Object>} The monthly statement data
 */
async function generateMonthlyStatementAdmin(year, month, landlordId = null, agencyId) {
  try {
    let query = `
      SELECT
        ps.id,
        ps.due_date,
        ps.amount_due,
        ps.status,
        ps.payment_type,
        ps.description,
        ps.covers_from,
        ps.covers_to,
        tm.first_name || ' ' || tm.surname as tenant_name,
        tm.id as member_id,
        t.id as tenancy_id,
        t.tenancy_type,
        p.id as property_id,
        p.address_line1 as property_address,
        l.id as landlord_id,
        l.name as landlord_name,
        b.bedroom_name,
        COALESCE(SUM(pay.amount), 0) as amount_paid
      FROM payment_schedules ps
      INNER JOIN tenancy_members tm ON ps.tenancy_member_id = tm.id
      INNER JOIN tenancies t ON ps.tenancy_id = t.id
      INNER JOIN properties p ON t.property_id = p.id
      LEFT JOIN landlords l ON p.landlord_id = l.id
      LEFT JOIN bedrooms b ON tm.bedroom_id = b.id
      LEFT JOIN payments pay ON ps.id = pay.payment_schedule_id
      WHERE ps.agency_id = $1
        AND EXTRACT(YEAR FROM ps.due_date) = $2
        AND EXTRACT(MONTH FROM ps.due_date) = $3
    `;

    const params = [agencyId, year, month];
    let paramIndex = 4;

    if (landlordId === -1) {
      // Special case: filter for unassigned properties (no landlord)
      query += ` AND p.landlord_id IS NULL`;
    } else if (landlordId) {
      query += ` AND p.landlord_id = $${paramIndex}`;
      params.push(landlordId);
      paramIndex++;
    }

    query += ` GROUP BY ps.id, ps.due_date, ps.amount_due, ps.status, ps.payment_type,
               ps.description, ps.covers_from, ps.covers_to, tm.first_name, tm.surname,
               tm.id, t.id, t.tenancy_type, p.id, p.address_line1, l.id, l.name, b.bedroom_name
               ORDER BY l.name, p.address_line1, ps.due_date ASC`;

    const result = await db.query(query, params, agencyId);
    const paymentSchedules = result.rows;

    // Calculate totals
    let totalDue = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    const landlordBreakdown = {};

    paymentSchedules.forEach(schedule => {
      const amountDue = parseFloat(schedule.amount_due) || 0;
      const amountPaid = parseFloat(schedule.amount_paid) || 0;
      const outstanding = amountDue - amountPaid;

      totalDue += amountDue;
      totalPaid += amountPaid;
      totalOutstanding += outstanding > 0 ? outstanding : 0;

      const landlordKey = schedule.landlord_id || 'unassigned';
      if (!landlordBreakdown[landlordKey]) {
        landlordBreakdown[landlordKey] = {
          landlord_id: schedule.landlord_id,
          landlord_name: schedule.landlord_name || 'Unassigned',
          totalDue: 0,
          totalPaid: 0,
          properties: {}
        };
      }

      landlordBreakdown[landlordKey].totalDue += amountDue;
      landlordBreakdown[landlordKey].totalPaid += amountPaid;

      // Group by property within landlord
      if (!landlordBreakdown[landlordKey].properties[schedule.property_id]) {
        landlordBreakdown[landlordKey].properties[schedule.property_id] = {
          property_id: schedule.property_id,
          address: schedule.property_address,
          tenancy_type: schedule.tenancy_type,
          totalDue: 0,
          totalPaid: 0,
          payments: []
        };
      }

      landlordBreakdown[landlordKey].properties[schedule.property_id].totalDue += amountDue;
      landlordBreakdown[landlordKey].properties[schedule.property_id].totalPaid += amountPaid;
      landlordBreakdown[landlordKey].properties[schedule.property_id].payments.push({
        id: schedule.id,
        due_date: schedule.due_date,
        amount_due: amountDue,
        amount_paid: amountPaid,
        status: schedule.status,
        payment_type: schedule.payment_type,
        description: schedule.description,
        tenant_name: schedule.tenant_name,
        bedroom_name: schedule.bedroom_name
      });
    });

    // Convert properties objects to arrays
    const landlords = Object.values(landlordBreakdown).map(l => ({
      ...l,
      properties: Object.values(l.properties)
    }));

    return {
      period: {
        year: parseInt(year),
        month: parseInt(month),
        monthName: new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'long' })
      },
      summary: {
        totalDue: Math.round(totalDue * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        paymentCount: paymentSchedules.length,
        paidCount: paymentSchedules.filter(p => p.status === 'paid').length,
        pendingCount: paymentSchedules.filter(p => p.status === 'pending').length,
        overdueCount: paymentSchedules.filter(p => p.status === 'overdue' || p.status === 'partial').length,
        landlordCount: landlords.length
      },
      landlords,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating monthly statement (admin):', error);
    throw error;
  }
}

/**
 * Generate annual summary for ALL properties (Admin)
 * @param {number} year - The year
 * @param {number|null} landlordId - Optional landlord filter (null = all, -1 = unassigned)
 * @param {number} agencyId - The agency ID for multi-tenancy
 * @returns {Promise<Object>} The annual summary data
 */
async function generateAnnualSummaryAdmin(year, landlordId = null, agencyId) {
  try {
    const monthlySummaries = [];
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    for (let month = 1; month <= 12; month++) {
      let query = `
        SELECT
          COALESCE(SUM(ps.amount_due), 0) as total_due,
          COALESCE(SUM(COALESCE(pay_sum.amount_paid, 0)), 0) as total_paid,
          COUNT(ps.id) as payment_count,
          SUM(CASE WHEN ps.status = 'paid' THEN 1 ELSE 0 END) as paid_count,
          COALESCE(SUM(CASE WHEN ps.due_date <= $1 THEN ps.amount_due ELSE 0 END), 0) as currently_due,
          COALESCE(SUM(CASE WHEN ps.due_date > $1 THEN ps.amount_due ELSE 0 END), 0) as future_scheduled
        FROM payment_schedules ps
        INNER JOIN tenancy_members tm ON ps.tenancy_member_id = tm.id
        INNER JOIN tenancies t ON ps.tenancy_id = t.id
        INNER JOIN properties p ON t.property_id = p.id
        LEFT JOIN (
          SELECT payment_schedule_id, SUM(amount) as amount_paid
          FROM payments
          WHERE agency_id = $2
          GROUP BY payment_schedule_id
        ) pay_sum ON ps.id = pay_sum.payment_schedule_id
        WHERE ps.agency_id = $2
          AND EXTRACT(YEAR FROM ps.due_date) = $3
          AND EXTRACT(MONTH FROM ps.due_date) = $4
      `;

      const params = [today, agencyId, year, month];
      let paramIndex = 5;

      if (landlordId === -1) {
        // Special case: filter for unassigned properties (no landlord)
        query += ` AND p.landlord_id IS NULL`;
      } else if (landlordId) {
        query += ` AND p.landlord_id = $${paramIndex}`;
        params.push(landlordId);
        paramIndex++;
      }

      const monthDataResult = await db.query(query, params, agencyId);
      const monthData = monthDataResult.rows[0];

      // Calculate estimated rolling monthly payments not yet generated
      const rollingEstimate = await calculateRollingMonthlyEstimate(year, month, landlordId, agencyId);

      monthlySummaries.push({
        month,
        monthName: new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'short' }),
        totalDue: Math.round((parseFloat(monthData.total_due) || 0) * 100) / 100,
        totalPaid: Math.round((parseFloat(monthData.total_paid) || 0) * 100) / 100,
        currentlyDue: Math.round((parseFloat(monthData.currently_due) || 0) * 100) / 100,
        futureScheduled: Math.round((parseFloat(monthData.future_scheduled) || 0) * 100) / 100,
        rollingEstimate,
        paymentCount: parseInt(monthData.payment_count) || 0,
        paidCount: parseInt(monthData.paid_count) || 0
      });
    }

    // Calculate annual totals
    const annualTotals = monthlySummaries.reduce((acc, month) => ({
      totalDue: acc.totalDue + month.totalDue,
      totalPaid: acc.totalPaid + month.totalPaid,
      currentlyDue: acc.currentlyDue + month.currentlyDue,
      futureScheduled: acc.futureScheduled + month.futureScheduled,
      rollingEstimate: acc.rollingEstimate + month.rollingEstimate,
      paymentCount: acc.paymentCount + month.paymentCount,
      paidCount: acc.paidCount + month.paidCount
    }), { totalDue: 0, totalPaid: 0, currentlyDue: 0, futureScheduled: 0, rollingEstimate: 0, paymentCount: 0, paidCount: 0 });

    // Outstanding = currently due - what's been paid (but not negative)
    const outstanding = Math.max(0, annualTotals.currentlyDue - annualTotals.totalPaid);

    return {
      year: parseInt(year),
      monthly: monthlySummaries,
      annual: {
        totalScheduled: Math.round(annualTotals.totalDue * 100) / 100,
        currentlyDue: Math.round(annualTotals.currentlyDue * 100) / 100,
        futureScheduled: Math.round(annualTotals.futureScheduled * 100) / 100,
        rollingEstimate: Math.round(annualTotals.rollingEstimate * 100) / 100,
        totalPaid: Math.round(annualTotals.totalPaid * 100) / 100,
        totalOutstanding: Math.round(outstanding * 100) / 100,
        paymentCount: annualTotals.paymentCount,
        paidCount: annualTotals.paidCount,
        collectionRate: annualTotals.currentlyDue > 0
          ? Math.round((annualTotals.totalPaid / annualTotals.currentlyDue) * 100)
          : 0
      },
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating annual summary (admin):', error);
    throw error;
  }
}

/**
 * Get available statement periods for ALL properties (Admin)
 * @param {number} agencyId - The agency ID for multi-tenancy
 * @returns {Promise<Array>} Array of available periods grouped by year
 */
async function getAvailablePeriodsAdmin(agencyId) {
  try {
    const result = await db.query(`
      SELECT DISTINCT
        EXTRACT(YEAR FROM ps.due_date)::integer as year,
        EXTRACT(MONTH FROM ps.due_date)::integer as month
      FROM payment_schedules ps
      WHERE ps.agency_id = $1
      ORDER BY year DESC, month DESC
    `, [agencyId], agencyId);
    const periods = result.rows;

    // Group by year
    const grouped = {};
    periods.forEach(p => {
      if (!grouped[p.year]) {
        grouped[p.year] = [];
      }
      grouped[p.year].push(parseInt(p.month));
    });

    return Object.entries(grouped).map(([year, months]) => ({
      year: parseInt(year),
      months: months.sort((a, b) => b - a)
    })).sort((a, b) => b.year - a.year);
  } catch (error) {
    console.error('Error getting available periods (admin):', error);
    throw error;
  }
}

/**
 * Get list of all landlords for filtering
 * @param {number} agencyId - The agency ID for multi-tenancy
 * @returns {Promise<Array>} Array of landlords
 */
async function getAllLandlords(agencyId) {
  try {
    const result = await db.query(`
      SELECT id, name, legal_name
      FROM landlords
      WHERE agency_id = $1
      ORDER BY name
    `, [agencyId], agencyId);
    return result.rows;
  } catch (error) {
    console.error('Error getting all landlords:', error);
    throw error;
  }
}

module.exports = {
  getLandlordByEmail,
  generateMonthlyStatement,
  generateAnnualSummary,
  getAvailablePeriods,
  // Admin functions
  generateMonthlyStatementAdmin,
  generateAnnualSummaryAdmin,
  getAvailablePeriodsAdmin,
  getAllLandlords
};
