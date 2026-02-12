/**
 * Upcoming Endings Report Generator
 *
 * Generates report of tenancies ending within a specified time period,
 * with tenant details and potential rent loss calculations.
 *
 * SECURITY: Uses parameterized queries via QueryBuilder.
 * Landlord filtering enforced by validation layer.
 */

const db = require('../../../db');
const { ReportQueryBuilder } = require('../queryBuilder');

/**
 * Generate upcoming endings report
 * @param {Object} request - Report request object
 * @param {Object} request.context - User context (role, landlordId)
 * @param {Object} request.filters - Applied filters (daysAhead, landlordId, propertyId)
 * @param {Object} request.options - Report options
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Object} Upcoming endings report data
 */
async function generate(request, agencyId) {
  const { filters, options } = request;
  const effectiveLandlordId = filters.landlordId || null;
  const propertyId = filters.propertyId || null;
  const daysAhead = filters.daysAhead || 90;
  const includeLandlordInfo = options.includeLandlordInfo || false;

  const endings = await getEndingsData(effectiveLandlordId, propertyId, daysAhead, includeLandlordInfo, agencyId);

  // Calculate days until end and format rent
  const tenanciesEnding = endings.map(e => ({
    ...e,
    days_until_end: Math.ceil(
      (new Date(e.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    ),
    total_weekly_rent: Math.round((e.total_weekly_rent || 0) * 100) / 100,
  }));

  // Calculate summary
  const potentialRentLoss = tenanciesEnding.reduce((sum, e) => sum + e.total_weekly_rent, 0);

  return {
    tenancies: tenanciesEnding,
    summary: {
      endingCount: tenanciesEnding.length,
      potentialRentLoss: Math.round(potentialRentLoss * 100) / 100,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Get upcoming tenancy endings data
 */
async function getEndingsData(landlordId, propertyId, daysAhead, includeLandlordInfo, agencyId) {
  const qb = new ReportQueryBuilder();

  qb.select([
    't.id as tenancy_id',
    't.end_date',
    't.status',
    't.is_rolling_monthly',
    'p.address_line1 as property_address',
    'p.id as property_id',
    "STRING_AGG(tm.first_name || ' ' || tm.surname, ', ') as tenants",
    'COUNT(tm.id) as tenant_count',
    'SUM(tm.rent_pppw) as total_weekly_rent',
  ])
    .from('tenancies', 't')
    .join('properties', 'p', 't.property_id = p.id', 'INNER')
    .join('tenancy_members', 'tm', 't.id = tm.tenancy_id', 'INNER');

  if (includeLandlordInfo) {
    qb.leftJoin('landlords', 'l', 'p.landlord_id = l.id')
      .select(['l.id as landlord_id', 'l.name as landlord_name']);
  }

  qb.where("t.status = 'active'")
    .whereLandlord(landlordId)
    .whereProperty(propertyId)
    .whereDaysAhead('t.end_date', daysAhead)
    .groupBy('t.id')
    .groupBy('t.end_date')
    .groupBy('t.status')
    .groupBy('t.is_rolling_monthly')
    .groupBy('p.address_line1')
    .groupBy('p.id');

  if (includeLandlordInfo) {
    qb.groupBy('l.id')
      .groupBy('l.name');
  }

  qb.orderBy('t.end_date', 'ASC');

  const { sql, params } = qb.build();
  const result = await db.query(sql, params, agencyId);
  return result.rows;
}

module.exports = { generate };
