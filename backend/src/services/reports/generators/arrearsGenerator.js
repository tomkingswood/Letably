/**
 * Arrears Report Generator
 *
 * Generates arrears report showing tenants with overdue payments,
 * outstanding amounts, and contact information.
 *
 * SECURITY: Uses parameterized queries via QueryBuilder.
 * Landlord filtering enforced by validation layer.
 */

const db = require('../../../db');
const { ReportQueryBuilder } = require('../queryBuilder');

/**
 * Generate arrears report
 * @param {Object} request - Report request object
 * @param {Object} request.context - User context (role, landlordId)
 * @param {Object} request.filters - Applied filters
 * @param {Object} request.options - Report options
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Object} Arrears report data
 */
async function generate(request, agencyId) {
  const { filters, options } = request;
  const effectiveLandlordId = filters.landlordId || null;
  const propertyId = filters.propertyId || null;
  const includeLandlordInfo = options.includeLandlordInfo || false;

  const today = new Date().toISOString().split('T')[0];

  const arrears = await getArrearsData(effectiveLandlordId, propertyId, includeLandlordInfo, today, agencyId);

  // Calculate days overdue and format amounts
  const tenantsInArrears = arrears.map(a => ({
    ...a,
    total_arrears: Math.round((a.total_arrears || 0) * 100) / 100,
    days_overdue: Math.ceil(
      (new Date().getTime() - new Date(a.oldest_due_date).getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));

  // Calculate summary
  const totalArrears = tenantsInArrears.reduce((sum, t) => sum + t.total_arrears, 0);
  const totalOverduePayments = tenantsInArrears.reduce((sum, t) => sum + t.overdue_payments, 0);

  return {
    tenants: tenantsInArrears,
    summary: {
      tenantsInArrears: tenantsInArrears.length,
      totalArrears: Math.round(totalArrears * 100) / 100,
      totalOverduePayments,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Get arrears data with tenant contact info
 */
async function getArrearsData(landlordId, propertyId, includeLandlordInfo, today, agencyId) {
  const qb = new ReportQueryBuilder();

  // CTE for payment sums
  qb.withCTE('pay_sum', `
    SELECT payment_schedule_id, SUM(amount) as amount_paid
    FROM payments
    GROUP BY payment_schedule_id
  `);

  qb.select([
    'tm.id as member_id',
    "tm.first_name || ' ' || tm.surname as tenant_name",
    'u.email as tenant_email',
    'u.phone as tenant_phone',
    'p.address_line1 as property_address',
    'b.bedroom_name',
    't.id as tenancy_id',
    'COUNT(ps.id) as overdue_payments',
    'SUM(ps.amount_due - COALESCE(pay_sum.amount_paid, 0)) as total_arrears',
    'MIN(ps.due_date) as oldest_due_date',
  ])
    .from('tenancy_members', 'tm')
    .join('users', 'u', 'tm.user_id = u.id', 'INNER')
    .join('tenancies', 't', 'tm.tenancy_id = t.id', 'INNER')
    .join('properties', 'p', 't.property_id = p.id', 'INNER')
    .leftJoin('bedrooms', 'b', 'tm.bedroom_id = b.id')
    .join('payment_schedules', 'ps', 'tm.id = ps.tenancy_member_id', 'INNER')
    .leftJoin('pay_sum', 'pay_sum', 'ps.id = pay_sum.payment_schedule_id');

  if (includeLandlordInfo) {
    qb.leftJoin('landlords', 'l', 'p.landlord_id = l.id')
      .select(['l.id as landlord_id', 'l.name as landlord_name']);
  }

  qb.where("t.status = 'active'")
    .where("ps.status IN ('overdue', 'partial')")
    .where('ps.due_date < ?', today)
    .whereLandlord(landlordId)
    .whereProperty(propertyId)
    .groupBy('tm.id')
    .groupBy('tm.first_name')
    .groupBy('tm.surname')
    .groupBy('u.email')
    .groupBy('u.phone')
    .groupBy('p.address_line1')
    .groupBy('b.bedroom_name')
    .groupBy('t.id');

  if (includeLandlordInfo) {
    qb.groupBy('l.id')
      .groupBy('l.name');
  }

  qb.orderBy('total_arrears', 'DESC');

  const { sql, params } = qb.build();

  // Add HAVING clause to filter out zero arrears
  const sqlWithHaving = sql.replace(
    /ORDER BY/,
    'HAVING SUM(ps.amount_due - COALESCE(pay_sum.amount_paid, 0)) > 0\nORDER BY'
  );

  const result = await db.query(sqlWithHaving, params, agencyId);
  return result.rows;
}

module.exports = { generate };
