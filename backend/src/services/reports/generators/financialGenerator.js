/**
 * Financial Report Generator
 *
 * Generates financial summary with monthly breakdown, annual totals,
 * and optional property-level breakdown.
 *
 * SECURITY: Uses parameterized queries via QueryBuilder.
 * Landlord filtering enforced by validation layer.
 */

const db = require('../../../db');
const { ReportQueryBuilder } = require('../queryBuilder');

/**
 * Generate financial report
 * @param {Object} request - Report request object
 * @param {Object} request.context - User context (role, landlordId)
 * @param {Object} request.filters - Applied filters (year, month, landlordId, propertyId)
 * @param {Object} request.options - Report options
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Object} Financial report data
 */
async function generate(request, agencyId) {
  const { filters, options } = request;
  const effectiveLandlordId = filters.landlordId || null;
  const year = filters.year || new Date().getFullYear();
  const specificMonth = filters.month || null;
  const propertyId = filters.propertyId || null;
  const includeLandlordInfo = options.includeLandlordInfo || false;
  const groupByProperty = options.groupByProperty !== false;

  // If specific month is requested, return just that month's data
  if (specificMonth) {
    const monthData = await getMonthlyData(effectiveLandlordId, propertyId, year, specificMonth, agencyId);
    return {
      year,
      month: specificMonth,
      data: monthData,
      generatedAt: new Date().toISOString(),
    };
  }

  // Full year breakdown
  const monthlyData = [];
  for (let month = 1; month <= 12; month++) {
    monthlyData.push(await getMonthlyData(effectiveLandlordId, propertyId, year, month, agencyId));
  }

  // Calculate annual totals
  const annual = monthlyData.reduce((acc, m) => ({
    totalDue: acc.totalDue + m.totalDue,
    totalPaid: acc.totalPaid + m.totalPaid,
    paymentCount: acc.paymentCount + m.paymentCount,
    paidCount: acc.paidCount + m.paidCount,
    overdueCount: acc.overdueCount + m.overdueCount,
  }), { totalDue: 0, totalPaid: 0, paymentCount: 0, paidCount: 0, overdueCount: 0 });

  annual.outstanding = Math.round((annual.totalDue - annual.totalPaid) * 100) / 100;
  annual.collectionRate = annual.totalDue > 0 ? Math.round((annual.totalPaid / annual.totalDue) * 100) : 0;
  annual.totalDue = Math.round(annual.totalDue * 100) / 100;
  annual.totalPaid = Math.round(annual.totalPaid * 100) / 100;

  const result = {
    year,
    monthly: monthlyData,
    annual,
    generatedAt: new Date().toISOString(),
  };

  // Add property breakdown if requested
  if (groupByProperty) {
    result.byProperty = await getPropertyBreakdown(effectiveLandlordId, year, includeLandlordInfo, agencyId);
  }

  return result;
}

/**
 * Get monthly financial data
 */
async function getMonthlyData(landlordId, propertyId, year, month, agencyId) {
  const qb = new ReportQueryBuilder();

  // CTE for payment sums
  qb.withCTE('pay_sum', `
    SELECT payment_schedule_id, SUM(amount) as amount_paid
    FROM payments
    GROUP BY payment_schedule_id
  `);

  qb.select([
    'COALESCE(SUM(ps.amount_due), 0) as total_due',
    'COALESCE(SUM(COALESCE(pay_sum.amount_paid, 0)), 0) as total_paid',
    'COUNT(ps.id) as payment_count',
    "SUM(CASE WHEN ps.status = 'paid' THEN 1 ELSE 0 END) as paid_count",
    "SUM(CASE WHEN ps.status = 'overdue' OR (ps.status != 'paid' AND ps.due_date < CURRENT_DATE) THEN 1 ELSE 0 END) as overdue_count",
  ])
    .from('payment_schedules', 'ps')
    .join('tenancy_members', 'tm', 'ps.tenancy_member_id = tm.id', 'INNER')
    .join('tenancies', 't', 'ps.tenancy_id = t.id', 'INNER')
    .join('properties', 'p', 't.property_id = p.id', 'INNER')
    .leftJoin('pay_sum', 'pay_sum', 'ps.id = pay_sum.payment_schedule_id')
    .whereLandlord(landlordId)
    .whereProperty(propertyId)
    .whereYearMonth('ps.due_date', year, month);

  const { sql, params } = qb.build();
  const result = await db.query(sql, params, agencyId);
  const data = result.rows[0];

  const totalDue = parseFloat(data.total_due) || 0;
  const totalPaid = parseFloat(data.total_paid) || 0;

  return {
    month,
    monthName: new Date(year, month - 1, 1).toLocaleString('en-GB', { month: 'short' }),
    totalDue: Math.round(totalDue * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    outstanding: Math.round((totalDue - totalPaid) * 100) / 100,
    paymentCount: parseInt(data.payment_count) || 0,
    paidCount: parseInt(data.paid_count) || 0,
    overdueCount: parseInt(data.overdue_count) || 0,
    collectionRate: totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0,
  };
}

/**
 * Get property breakdown for the year
 */
async function getPropertyBreakdown(landlordId, year, includeLandlordInfo, agencyId) {
  const qb = new ReportQueryBuilder();

  // CTE for payment sums
  qb.withCTE('pay_sum', `
    SELECT payment_schedule_id, SUM(amount) as amount_paid
    FROM payments
    GROUP BY payment_schedule_id
  `);

  qb.select([
    'p.id',
    'p.address_line1 as address',
    'COALESCE(SUM(ps.amount_due), 0) as total_due',
    'COALESCE(SUM(COALESCE(pay_sum.amount_paid, 0)), 0) as total_paid',
    'COUNT(DISTINCT tm.id) as tenant_count',
  ])
    .from('properties', 'p')
    .leftJoin('tenancies', 't', 't.property_id = p.id')
    .leftJoin('tenancy_members', 'tm', 'tm.tenancy_id = t.id')
    .leftJoin('payment_schedules', 'ps', "ps.tenancy_member_id = tm.id AND EXTRACT(YEAR FROM ps.due_date) = ?");

  // Add year param for the LEFT JOIN condition - insert at beginning of params
  qb.params.splice(0, 0, year);

  qb.leftJoin('pay_sum', 'pay_sum', 'ps.id = pay_sum.payment_schedule_id');

  if (includeLandlordInfo) {
    qb.leftJoin('landlords', 'l', 'p.landlord_id = l.id')
      .select(['l.id as landlord_id', 'l.name as landlord_name']);
  }

  qb.whereLandlord(landlordId)
    .groupBy('p.id')
    .groupBy('p.address_line1');

  if (includeLandlordInfo) {
    qb.groupBy('l.id')
      .groupBy('l.name');
  }

  qb.orderBy('total_due', 'DESC');

  const { sql, params } = qb.build();
  const result = await db.query(sql, params, agencyId);

  return result.rows.map(p => ({
    ...p,
    total_due: Math.round((parseFloat(p.total_due) || 0) * 100) / 100,
    total_paid: Math.round((parseFloat(p.total_paid) || 0) * 100) / 100,
    outstanding: Math.round(((parseFloat(p.total_due) || 0) - (parseFloat(p.total_paid) || 0)) * 100) / 100,
  }));
}

module.exports = { generate };
