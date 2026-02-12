/**
 * Portfolio Report Generator
 *
 * Generates portfolio overview with property counts, room occupancy,
 * and tenancy statistics.
 *
 * SECURITY: Uses parameterized queries via QueryBuilder.
 * Landlord filtering enforced by validation layer.
 */

const db = require('../../../db');
const { ReportQueryBuilder, QueryBuilderFactory } = require('../queryBuilder');

/**
 * Generate portfolio overview report
 * @param {Object} request - Report request object
 * @param {Object} request.context - User context (role, landlordId)
 * @param {Object} request.filters - Applied filters
 * @param {Object} request.options - Report options
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Object} Portfolio report data
 */
async function generate(request, agencyId) {
  const { context, filters, options } = request;
  const effectiveLandlordId = filters.landlordId || null;
  const includeLandlordInfo = options.includeLandlordInfo || false;

  const today = new Date().toISOString().split('T')[0];

  // Property summary query
  const propertySummary = await getPropertySummary(effectiveLandlordId, agencyId);

  // Tenancy stats query
  const tenancyStats = await getTenancyStats(effectiveLandlordId, agencyId);

  // Room occupancy with optional landlord info
  const roomOccupancy = await getRoomOccupancy(effectiveLandlordId, includeLandlordInfo, today, agencyId);

  // Calculate occupancy metrics
  const occupiedRooms = roomOccupancy.filter(r => r.is_occupied).length;
  const totalRooms = roomOccupancy.length || propertySummary.total_rooms || 0;
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  const result = {
    properties: propertySummary.total_properties || 0,
    bedrooms: totalRooms,
    occupiedBedrooms: occupiedRooms,
    vacantBedrooms: totalRooms - occupiedRooms,
    occupancyRate,
    activeTenancies: tenancyStats.active_tenancies || 0,
    totalTenants: tenancyStats.total_tenants || 0,
    generatedAt: new Date().toISOString(),
  };

  // Include landlord count for admin viewing all
  if (!effectiveLandlordId && context.userRole === 'admin') {
    result.landlordCount = propertySummary.total_landlords || 0;
  }

  // Include bedroom details if requested
  if (options.includeRoomDetails !== false) {
    result.bedroomDetails = roomOccupancy;
  }

  return result;
}

/**
 * Get property summary counts
 */
async function getPropertySummary(landlordId, agencyId) {
  const qb = new ReportQueryBuilder();

  qb.select([
    'COUNT(DISTINCT p.id) as total_properties',
  ])
    .from('properties', 'p');

  if (landlordId) {
    qb.where('p.landlord_id = ?', landlordId);
    // Subquery for bedrooms count filtered by landlord
    qb.select([
      `(SELECT COUNT(*) FROM bedrooms b WHERE b.property_id IN (SELECT id FROM properties WHERE landlord_id = ?)) as total_rooms`,
    ]);
    const { sql, params } = qb.build();
    // Need to add landlordId param for subquery
    const result = await db.query(sql, [...params, landlordId], agencyId);
    return result.rows[0];
  } else {
    qb.select([
      '(SELECT COUNT(*) FROM bedrooms) as total_rooms',
      'COUNT(DISTINCT p.landlord_id) as total_landlords',
    ]);
    const { sql, params } = qb.build();
    const result = await db.query(sql, params, agencyId);
    return result.rows[0];
  }
}

/**
 * Get tenancy statistics
 */
async function getTenancyStats(landlordId, agencyId) {
  const qb = new ReportQueryBuilder();

  qb.select([
    'COUNT(DISTINCT t.id) as active_tenancies',
    'COUNT(DISTINCT tm.id) as total_tenants',
  ])
    .from('tenancies', 't')
    .leftJoin('tenancy_members', 'tm', 't.id = tm.tenancy_id')
    .where("t.status = 'active'");

  if (landlordId) {
    qb.join('properties', 'p', 't.property_id = p.id', 'INNER')
      .where('p.landlord_id = ?', landlordId);
  }

  const { sql, params } = qb.build();
  const result = await db.query(sql, params, agencyId);
  return result.rows[0];
}

/**
 * Get room occupancy details with current tenant
 */
async function getRoomOccupancy(landlordId, includeLandlordInfo, today, agencyId) {
  const qb = new ReportQueryBuilder();

  // CTE for current tenant (most recent active tenancy per bedroom that has started)
  qb.withCTE('current_tenant', `
    SELECT
      t.id as tenancy_id,
      t.bedroom_id,
      u.first_name,
      u.last_name,
      t.end_date,
      ROW_NUMBER() OVER (PARTITION BY t.bedroom_id ORDER BY t.start_date DESC) as rn
    FROM tenancies t
    INNER JOIN tenancy_members tm ON tm.tenancy_id = t.id
    INNER JOIN users u ON tm.user_id = u.id
    WHERE t.status = 'active' AND t.start_date <= ? AND t.bedroom_id IS NOT NULL
  `, [today]);

  qb.select([
    'b.id',
    'b.bedroom_name',
    'p.address_line1',
    "CASE WHEN ct.tenancy_id IS NOT NULL THEN true ELSE false END as is_occupied",
    "ct.first_name || ' ' || ct.last_name as tenant_name",
    'ct.end_date as tenancy_end_date',
  ])
    .from('bedrooms', 'b')
    .join('properties', 'p', 'b.property_id = p.id', 'INNER')
    .leftJoin('current_tenant', 'ct', 'b.id = ct.bedroom_id AND ct.rn = 1');

  if (includeLandlordInfo) {
    qb.leftJoin('landlords', 'l', 'p.landlord_id = l.id')
      .select(['l.name as landlord_name']);
  }

  qb.whereLandlord(landlordId);

  if (includeLandlordInfo) {
    qb.orderBy('l.name').orderBy('p.address_line1').orderBy('b.id');
  } else {
    qb.orderBy('p.address_line1').orderBy('b.id');
  }

  const { sql, params } = qb.build();
  const result = await db.query(sql, params, agencyId);
  return result.rows;
}

module.exports = { generate };
