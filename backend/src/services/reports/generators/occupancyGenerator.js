/**
 * Occupancy Report Generator
 *
 * Generates detailed occupancy report with room-level tenant information,
 * including current tenant, next tenant, and whole house tenancy data.
 *
 * SECURITY: Uses parameterized queries via QueryBuilder.
 * Landlord filtering enforced by validation layer.
 */

const db = require('../../../db');
const { ReportQueryBuilder } = require('../queryBuilder');

/**
 * Generate occupancy report
 * @param {Object} request - Report request object
 * @param {Object} request.context - User context (role, landlordId)
 * @param {Object} request.filters - Applied filters
 * @param {Object} request.options - Report options
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Object} Occupancy report data
 */
async function generate(request, agencyId) {
  const { filters, options } = request;
  const effectiveLandlordId = filters.landlordId || null;
  const includeLandlordInfo = options.includeLandlordInfo || false;
  const includeNextTenant = options.includeNextTenant !== false;

  const today = new Date().toISOString().split('T')[0];

  // Get properties
  const properties = await getProperties(effectiveLandlordId, includeLandlordInfo, agencyId);

  // Process each property with room and tenancy details
  const propertyDetails = await Promise.all(properties.map(async (property) => {
    const rooms = await getRoomOccupancy(property.id, today, includeNextTenant, agencyId);
    const wholeHouseTenancy = await getWholeHouseTenancy(property.id, today, agencyId);
    const nextWholeHouseTenancy = includeNextTenant
      ? await getNextWholeHouseTenancy(property.id, today, agencyId)
      : null;

    const roomsWithOccupancy = rooms.map(room => ({
      id: room.id,
      name: room.bedroom_name,
      baseRent: room.price_pppw,
      isOccupied: room.member_id !== null,
      tenant: room.member_id ? {
        name: `${room.first_name} ${room.surname}`,
        rentPPPW: room.rent_pppw,
        tenancyStart: room.start_date,
        tenancyEnd: room.end_date,
      } : null,
      nextTenant: room.next_member_id ? {
        name: `${room.next_first_name} ${room.next_surname}`,
        rentPPPW: room.next_rent_pppw,
        tenancyStart: room.next_start_date,
        tenancyEnd: room.next_end_date,
      } : null,
    }));

    const occupiedCount = wholeHouseTenancy
      ? roomsWithOccupancy.length
      : roomsWithOccupancy.filter(r => r.isOccupied).length;
    const totalRooms = roomsWithOccupancy.length;

    const result = {
      id: property.id,
      address: `${property.address_line1}${property.address_line2 ? ', ' + property.address_line2 : ''}`,
      city: property.city,
      postcode: property.postcode,
      location: property.location,
      bedrooms: roomsWithOccupancy,
      wholeHouseTenancy: wholeHouseTenancy ? {
        id: wholeHouseTenancy.id,
        tenants: wholeHouseTenancy.tenants,
        tenantCount: wholeHouseTenancy.tenant_count,
        totalRent: Math.round((wholeHouseTenancy.total_rent_pppw || 0) * 100) / 100,
        startDate: wholeHouseTenancy.start_date,
        endDate: wholeHouseTenancy.end_date,
      } : null,
      nextWholeHouseTenancy: nextWholeHouseTenancy ? {
        id: nextWholeHouseTenancy.id,
        tenants: nextWholeHouseTenancy.tenants,
        tenantCount: nextWholeHouseTenancy.tenant_count,
        totalRent: Math.round((nextWholeHouseTenancy.total_rent_pppw || 0) * 100) / 100,
        startDate: nextWholeHouseTenancy.start_date,
        endDate: nextWholeHouseTenancy.end_date,
      } : null,
      occupancy: {
        occupied: occupiedCount,
        total: totalRooms,
        rate: totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0,
      },
    };

    if (includeLandlordInfo) {
      result.landlord_id = property.landlord_id;
      result.landlord_name = property.landlord_name || 'Unassigned';
    }

    return result;
  }));

  // Calculate summary
  const totals = propertyDetails.reduce((acc, prop) => ({
    properties: acc.properties + 1,
    bedrooms: acc.bedrooms + prop.occupancy.total,
    occupied: acc.occupied + prop.occupancy.occupied,
  }), { properties: 0, bedrooms: 0, occupied: 0 });

  return {
    properties: propertyDetails,
    summary: {
      ...totals,
      vacant: totals.bedrooms - totals.occupied,
      occupancyRate: totals.bedrooms > 0 ? Math.round((totals.occupied / totals.bedrooms) * 100) : 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Get properties with optional landlord info
 */
async function getProperties(landlordId, includeLandlordInfo, agencyId) {
  const qb = new ReportQueryBuilder();

  qb.select([
    'p.id',
    'p.address_line1',
    'p.address_line2',
    'p.city',
    'p.postcode',
    'p.location',
  ])
    .from('properties', 'p');

  if (includeLandlordInfo) {
    qb.leftJoin('landlords', 'l', 'p.landlord_id = l.id')
      .select(['l.id as landlord_id', 'l.name as landlord_name']);
  }

  qb.whereLandlord(landlordId);

  if (includeLandlordInfo) {
    qb.orderBy('l.name').orderBy('p.address_line1');
  } else {
    qb.orderBy('p.address_line1');
  }

  const { sql, params } = qb.build();
  const result = await db.query(sql, params, agencyId);
  return result.rows;
}

/**
 * Get room occupancy for a property with current and next tenant
 */
async function getRoomOccupancy(propertyId, today, includeNextTenant, agencyId) {
  const qb = new ReportQueryBuilder();

  // CTE for current tenant (most recent active tenant per bedroom that has started)
  qb.withCTE('current_tenant', `
    SELECT
      tm.id as member_id,
      tm.bedroom_id,
      tm.first_name,
      tm.surname,
      tm.rent_pppw,
      t.id as tenancy_id,
      t.start_date,
      t.end_date,
      t.status as tenancy_status,
      ROW_NUMBER() OVER (PARTITION BY tm.bedroom_id ORDER BY t.start_date DESC) as rn
    FROM tenancy_members tm
    INNER JOIN tenancies t ON tm.tenancy_id = t.id
    WHERE t.status = 'active' AND t.start_date <= ?
  `, [today]);

  if (includeNextTenant) {
    // CTE for next tenant (earliest future tenant per bedroom)
    // Include pending, signed, awaiting_signatures, and active tenancies that start in the future
    qb.withCTE('next_tenant', `
      SELECT
        tm.id as next_member_id,
        tm.bedroom_id,
        tm.first_name as next_first_name,
        tm.surname as next_surname,
        tm.rent_pppw as next_rent_pppw,
        t.id as next_tenancy_id,
        t.start_date as next_start_date,
        t.end_date as next_end_date,
        ROW_NUMBER() OVER (PARTITION BY tm.bedroom_id ORDER BY t.start_date ASC) as rn
      FROM tenancy_members tm
      INNER JOIN tenancies t ON tm.tenancy_id = t.id
      WHERE t.status IN ('active', 'signed', 'awaiting_signatures', 'pending') AND t.start_date > ?
    `, [today]);
  }

  qb.select([
    'b.id',
    'b.bedroom_name',
    'b.price_pppw',
    'b.display_order',
    'ct.member_id',
    'ct.first_name',
    'ct.surname',
    'ct.rent_pppw',
    'ct.tenancy_id',
    'ct.start_date',
    'ct.end_date',
    'ct.tenancy_status',
  ])
    .from('bedrooms', 'b')
    .leftJoin('current_tenant', 'ct', 'b.id = ct.bedroom_id AND (ct.rn = 1 OR ct.rn IS NULL)');

  if (includeNextTenant) {
    qb.leftJoin('next_tenant', 'nt', 'b.id = nt.bedroom_id AND (nt.rn = 1 OR nt.rn IS NULL)')
      .select([
        'nt.next_member_id',
        'nt.next_first_name',
        'nt.next_surname',
        'nt.next_rent_pppw',
        'nt.next_tenancy_id',
        'nt.next_start_date',
        'nt.next_end_date',
      ]);
  }

  qb.where('b.property_id = ?', propertyId)
    .orderBy('b.display_order');

  const { sql, params } = qb.build();
  const result = await db.query(sql, params, agencyId);
  return result.rows;
}

/**
 * Get current whole house tenancy for a property
 */
async function getWholeHouseTenancy(propertyId, today, agencyId) {
  const qb = new ReportQueryBuilder();

  qb.select([
    't.id',
    't.start_date',
    't.end_date',
    't.status',
    "STRING_AGG(tm.first_name || ' ' || tm.surname, ', ') as tenants",
    'COUNT(tm.id) as tenant_count',
    'SUM(tm.rent_pppw) as total_rent_pppw',
  ])
    .from('tenancies', 't')
    .join('tenancy_members', 'tm', 't.id = tm.tenancy_id', 'INNER')
    .where('t.property_id = ?', propertyId)
    .where("t.status = 'active'")
    .where("t.tenancy_type = 'whole_house'")
    .where('t.start_date <= ?', today)
    .groupBy('t.id');

  const { sql, params } = qb.build();
  const result = await db.query(sql, params, agencyId);
  return result.rows[0];
}

/**
 * Get next whole house tenancy for a property
 */
async function getNextWholeHouseTenancy(propertyId, today, agencyId) {
  const qb = new ReportQueryBuilder();

  qb.select([
    't.id',
    't.start_date',
    't.end_date',
    't.status',
    "STRING_AGG(tm.first_name || ' ' || tm.surname, ', ') as tenants",
    'COUNT(tm.id) as tenant_count',
    'SUM(tm.rent_pppw) as total_rent_pppw',
  ])
    .from('tenancies', 't')
    .join('tenancy_members', 'tm', 't.id = tm.tenancy_id', 'INNER')
    .where('t.property_id = ?', propertyId)
    .where("t.status IN ('active', 'signed', 'awaiting_signatures', 'pending')")
    .where("t.tenancy_type = 'whole_house'")
    .where('t.start_date > ?', today)
    .groupBy('t.id')
    .orderBy('t.start_date', 'ASC');

  const { sql, params } = qb.build();
  // LIMIT 1 - get only the next upcoming one
  const limitedSql = sql + ' LIMIT 1';
  const result = await db.query(limitedSql, params, agencyId);
  return result.rows[0];
}

module.exports = { generate };
