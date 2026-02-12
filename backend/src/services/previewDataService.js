/**
 * Preview Data Service
 * Creates temporary test data for agreement previews
 * Data is created in a transaction and cleaned up after use
 */

const db = require('../db');

/**
 * Default test tenant data
 */
const defaultTenants = {
  primary: {
    firstName: 'John',
    lastName: 'Smith',
    phone: '07700900123',
    room: 'Room 1 (Double)',
    rent: 125.00,
    deposit: 500.00,
    title: 'mr',
    address: '123 Previous Street, Sheffield, S1 1AA'
  },
  secondary: {
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '07700900456',
    room: 'Room 2 (Single)',
    rent: 115.00,
    deposit: 450.00,
    title: 'miss',
    address: '456 Previous Road, Sheffield, S2 2BB'
  }
};

/**
 * Default property data
 */
const defaultPropertyData = {
  address_line1: '123 Example Street',
  city: 'Sheffield',
  postcode: 'S1 2AB',
  location: 'Broomhill',
  bedrooms: 5,
  bathrooms: 2,
  communal_areas: 1,
  available_from: '2025-09-01',
  property_type: 'Terraced House',
  has_parking: true,
  has_garden: true,
  description: 'Beautiful 5-bedroom student house',
  bills_included: true
};

/**
 * Create preview data for agreement generation
 *
 * @param {Object} options
 * @param {string} options.tenancyType - 'room_only' or 'whole_house'
 * @param {number|null} options.landlordId - Existing landlord ID or null to create temporary one
 * @param {Object} options.primaryTenant - Primary tenant data (optional)
 * @param {Object} options.secondTenant - Second tenant data for whole_house (optional)
 * @param {Object} options.propertyData - Custom property data (optional)
 * @param {string} options.startDate - Tenancy start date (default: '2025-09-01')
 * @param {string} options.endDate - Tenancy end date (default: '2026-08-31')
 * @param {boolean} options.isRollingMonthly - Whether this is a rolling monthly tenancy (default: false)
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Object} Created IDs and cleanup function
 */
async function createPreviewData(options, agencyId) {
  const {
    tenancyType,
    landlordId: existingLandlordId = null,
    primaryTenant = defaultTenants.primary,
    secondTenant = defaultTenants.secondary,
    propertyData = defaultPropertyData,
    startDate = '2025-09-01',
    endDate = '2026-08-31',
    isRollingMonthly = false
  } = options;

  const timestamp = Date.now();

  // Use db.transaction to ensure all queries run on the same client
  const ids = await db.transaction(async (client) => {
    let createdLandlordId = null;

    // Create temporary landlord if not provided
    let landlordId = existingLandlordId;
    if (!landlordId) {
      const landlordResult = await client.query(`
        INSERT INTO landlords (agency_id, name, legal_name, email, phone)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        agencyId,
        'Preview Landlord (Temporary)',
        'Letably',
        `preview.${timestamp}@example.com`,
        '07384252558'
      ]);
      landlordId = landlordResult.rows[0].id;
      createdLandlordId = landlordId;
    }

    // Create property
    const lettingType = tenancyType === 'room_only' ? 'Room Only' : 'Whole House';
    const propertyTitle = propertyData.title || `${propertyData.address_line1}, ${propertyData.city}`;
    const propertyResult = await client.query(`
      INSERT INTO properties (
        agency_id, title, address_line1, address_line2, city, postcode, location,
        bathrooms, communal_areas,
        available_from, property_type, has_parking, has_garden,
        description, bills_included, letting_type, landlord_id, is_live
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `, [
      agencyId,
      propertyTitle,
      propertyData.address_line1,
      propertyData.address_line2 || null,
      propertyData.city,
      propertyData.postcode,
      propertyData.location,
      propertyData.bathrooms,
      propertyData.communal_areas,
      propertyData.available_from,
      propertyData.property_type,
      propertyData.has_parking,
      propertyData.has_garden,
      propertyData.description,
      propertyData.bills_included,
      lettingType,
      landlordId,
      false // Not live - preview only
    ]);
    const propertyId = propertyResult.rows[0].id;

    // Create bedrooms
    const room1Result = await client.query(`
      INSERT INTO bedrooms (agency_id, property_id, bedroom_name, price_pppw)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [agencyId, propertyId, primaryTenant.room, primaryTenant.rent]);
    const room1Id = room1Result.rows[0].id;

    const room2Result = await client.query(`
      INSERT INTO bedrooms (agency_id, property_id, bedroom_name, price_pppw)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [agencyId, propertyId, secondTenant.room, secondTenant.rent]);
    const room2Id = room2Result.rows[0].id;

    // Create users
    const user1Result = await client.query(`
      INSERT INTO users (agency_id, email, password_hash, first_name, last_name, phone, role)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      agencyId,
      `preview.${timestamp}.1@example.com`,
      'dummy_hash',
      primaryTenant.firstName,
      primaryTenant.lastName,
      primaryTenant.phone,
      'user'
    ]);
    const user1Id = user1Result.rows[0].id;

    let user2Id = null;
    if (tenancyType === 'whole_house') {
      const user2Result = await client.query(`
        INSERT INTO users (agency_id, email, password_hash, first_name, last_name, phone, role)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        agencyId,
        `preview.${timestamp}.2@example.com`,
        'dummy_hash',
        secondTenant.firstName,
        secondTenant.lastName,
        secondTenant.phone,
        'user'
      ]);
      user2Id = user2Result.rows[0].id;
    }

    // Create applications
    const app1Result = await client.query(`
      INSERT INTO applications (
        agency_id, user_id, application_type, status,
        first_name, surname, title, current_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      agencyId,
      user1Id,
      tenancyType === 'room_only' ? 'room_only' : 'whole_house',
      'completed',
      primaryTenant.firstName,
      primaryTenant.lastName,
      primaryTenant.title,
      primaryTenant.address || null
    ]);
    const app1Id = app1Result.rows[0].id;

    let app2Id = null;
    if (tenancyType === 'whole_house') {
      const app2Result = await client.query(`
        INSERT INTO applications (
          agency_id, user_id, application_type, status,
          first_name, surname, title, current_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        agencyId,
        user2Id,
        'whole_house',
        'completed',
        secondTenant.firstName,
        secondTenant.lastName,
        secondTenant.title,
        secondTenant.address || null
      ]);
      app2Id = app2Result.rows[0].id;
    }

    // Create tenancy
    // Calculate total rent for the tenancy (sum of all tenant rents)
    const totalRent = tenancyType === 'whole_house'
      ? primaryTenant.rent + secondTenant.rent
      : primaryTenant.rent;
    const totalDeposit = tenancyType === 'whole_house'
      ? primaryTenant.deposit + secondTenant.deposit
      : primaryTenant.deposit;

    const tenancyResult = await client.query(`
      INSERT INTO tenancies (
        agency_id, property_id, tenancy_type, start_date, end_date, status,
        is_rolling_monthly, rent_amount, deposit_amount
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      agencyId,
      propertyId,
      tenancyType,
      startDate,
      endDate,
      'pending',
      isRollingMonthly,
      totalRent,
      totalDeposit
    ]);
    const tenancyId = tenancyResult.rows[0].id;

    // Create tenancy members
    const member1Result = await client.query(`
      INSERT INTO tenancy_members (
        agency_id, tenancy_id, application_id, user_id, bedroom_id, rent_pppw, deposit_amount,
        first_name, surname, title, current_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      agencyId,
      tenancyId,
      app1Id,
      user1Id,
      tenancyType === 'room_only' ? room1Id : null,
      primaryTenant.rent,
      primaryTenant.deposit,
      primaryTenant.firstName,
      primaryTenant.lastName,
      primaryTenant.title,
      primaryTenant.address || null
    ]);
    const member1Id = member1Result.rows[0].id;

    let member2Id = null;
    if (tenancyType === 'whole_house' && app2Id) {
      const member2Result = await client.query(`
        INSERT INTO tenancy_members (
          agency_id, tenancy_id, application_id, user_id, bedroom_id, rent_pppw, deposit_amount,
          first_name, surname, title, current_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        agencyId,
        tenancyId,
        app2Id,
        user2Id,
        room2Id,
        secondTenant.rent,
        secondTenant.deposit,
        secondTenant.firstName,
        secondTenant.lastName,
        secondTenant.title,
        secondTenant.address || null
      ]);
      member2Id = member2Result.rows[0].id;
    }

    return {
      landlordId,
      createdLandlordId,
      propertyId,
      room1Id,
      room2Id,
      user1Id,
      user2Id,
      app1Id,
      app2Id,
      tenancyId,
      member1Id,
      member2Id
    };
  }, agencyId);

  return {
    ids,
    cleanup: () => cleanupPreviewData(ids, agencyId)
  };
}

/**
 * Clean up preview data (in reverse order of creation to respect foreign keys)
 * @param {Object} ids - IDs returned from createPreviewData
 * @param {number} agencyId - Agency ID for multi-tenancy
 */
async function cleanupPreviewData(ids, agencyId) {
  // Use db.transaction to ensure all deletes run on the same client
  // Defense-in-depth: explicit agency_id filtering on all DELETEs
  await db.transaction(async (client) => {
    // Delete in reverse order of creation
    await client.query('DELETE FROM tenancy_members WHERE tenancy_id = $1 AND agency_id = $2', [ids.tenancyId, agencyId]);
    await client.query('DELETE FROM tenancies WHERE id = $1 AND agency_id = $2', [ids.tenancyId, agencyId]);

    if (ids.app2Id) {
      await client.query('DELETE FROM applications WHERE id = $1 AND agency_id = $2', [ids.app2Id, agencyId]);
    }
    await client.query('DELETE FROM applications WHERE id = $1 AND agency_id = $2', [ids.app1Id, agencyId]);

    if (ids.user2Id) {
      await client.query('DELETE FROM users WHERE id = $1 AND agency_id = $2', [ids.user2Id, agencyId]);
    }
    await client.query('DELETE FROM users WHERE id = $1 AND agency_id = $2', [ids.user1Id, agencyId]);

    await client.query('DELETE FROM bedrooms WHERE id = $1 AND agency_id = $2', [ids.room2Id, agencyId]);
    await client.query('DELETE FROM bedrooms WHERE id = $1 AND agency_id = $2', [ids.room1Id, agencyId]);
    await client.query('DELETE FROM properties WHERE id = $1 AND agency_id = $2', [ids.propertyId, agencyId]);

    // Only delete landlord if we created it
    if (ids.createdLandlordId) {
      await client.query('DELETE FROM landlords WHERE id = $1 AND agency_id = $2', [ids.createdLandlordId, agencyId]);
    }
  }, agencyId);
}

/**
 * High-level: create preview data, generate agreement, clean up.
 * Ensures cleanup runs even on error.
 *
 * @param {Object} options - Same options as createPreviewData
 * @param {number} agencyId - Agency ID
 * @param {Function} generateAgreementFn - Agreement generation function (tenancyId, memberId, agencyId) => agreement
 * @returns {Promise<Object>} The generated agreement
 */
async function generatePreviewAgreement(options, agencyId, generateAgreementFn) {
  const { ids, cleanup } = await createPreviewData(options, agencyId);
  try {
    const agreement = await generateAgreementFn(ids.tenancyId, ids.member1Id, agencyId);
    await cleanup();
    return agreement;
  } catch (error) {
    try { await cleanup(); } catch (cleanupError) {
      console.error('Error cleaning up preview data:', cleanupError);
    }
    throw error;
  }
}

module.exports = {
  createPreviewData,
  cleanupPreviewData,
  generatePreviewAgreement,
  defaultTenants,
  defaultPropertyData
};
