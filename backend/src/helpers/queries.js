const db = require('../db');

/**
 * Centralized query helpers to eliminate duplicate SELECT patterns
 * These functions encapsulate common database queries used across multiple controllers
 */

/**
 * Get tenancy members with full details (applications, users, bedrooms)
 * Used in: tenanciesController (8+ locations)
 *
 * @param {number} tenancyId - The tenancy ID
 * @param {number} agencyId - The agency ID for RLS
 * @returns {Promise<Array>} Array of tenancy member objects with joined data
 */
async function getTenancyMembersWithDetails(tenancyId, agencyId) {
  const result = await db.query(`
    SELECT
      tm.id,
      tm.tenancy_id,
      tm.application_id,
      tm.bedroom_id,
      tm.rent_pppw,
      tm.deposit_amount,
      tm.signature_data,
      tm.signed_at,
      tm.is_signed,
      tm.signed_agreement_html,
      tm.payment_option,
      tm.created_at,
      tm.guarantor_required,
      tm.guarantor_name,
      tm.guarantor_dob,
      tm.guarantor_email,
      tm.guarantor_phone,
      tm.guarantor_address,
      tm.guarantor_relationship,
      tm.guarantor_id_type,
      tm.user_id,
      tm.title,
      tm.current_address,
      a.application_type,
      COALESCE(tm.first_name, u.first_name) as first_name,
      COALESCE(tm.surname, u.last_name) as last_name,
      u.email,
      u.phone,
      b.bedroom_name
    FROM tenancy_members tm
    LEFT JOIN applications a ON tm.application_id = a.id
    LEFT JOIN users u ON COALESCE(tm.user_id, a.user_id) = u.id
    LEFT JOIN bedrooms b ON tm.bedroom_id = b.id
    WHERE tm.tenancy_id = $1 AND tm.agency_id = $2
    ORDER BY tm.id
  `, [tenancyId, agencyId], agencyId);
  return result.rows;
}

/**
 * Get landlord properties (basic info)
 * Used in: landlordsController (2 locations)
 *
 * @param {number} landlordId - The landlord ID
 * @param {number} agencyId - The agency ID for RLS
 * @returns {Promise<Array>} Array of property objects
 */
async function getLandlordProperties(landlordId, agencyId) {
  const result = await db.query(`
    SELECT id, address_line1, location, is_live,
      (SELECT COUNT(*) FROM bedrooms WHERE property_id = p.id) as bedroom_count
    FROM properties p
    WHERE landlord_id = $1 AND agency_id = $2
    ORDER BY address_line1 ASC
  `, [landlordId, agencyId], agencyId);
  return result.rows;
}

/**
 * Get tenancy with property details
 * Common pattern for fetching tenancy + property info
 *
 * @param {number} tenancyId - The tenancy ID
 * @param {number} agencyId - The agency ID for RLS
 * @returns {Promise<Object|null>} Tenancy object with property details or null if not found
 */
async function getTenancyWithProperty(tenancyId, agencyId) {
  const result = await db.query(`
    SELECT t.*, p.address_line1, p.city
    FROM tenancies t
    JOIN properties p ON t.property_id = p.id
    WHERE t.id = $1 AND t.agency_id = $2
  `, [tenancyId, agencyId], agencyId);
  return result.rows[0] || null;
}

module.exports = {
  getTenancyMembersWithDetails,
  getLandlordProperties,
  getTenancyWithProperty
};
