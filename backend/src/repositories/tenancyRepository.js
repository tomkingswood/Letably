/**
 * Tenancy Repository
 * Centralized database queries for tenancy-related data
 */

const db = require('../db');

/**
 * Status groups for filtering
 */
const STATUS_GROUPS = {
  WORKFLOW: ['pending', 'awaiting_signatures', 'approval'],
  ACTIVE: ['active'],
  EXPIRED: ['expired']
};

/**
 * Get tenancy by ID with property details
 */
async function getTenancyWithProperty(tenancyId, agencyId) {
  try {
    const result = await db.query(`
      SELECT t.*,
        p.address_line1 as property_address,
        p.location,
        p.id as property_id
      FROM tenancies t
      LEFT JOIN properties p ON t.property_id = p.id
      WHERE t.id = $1 AND t.agency_id = $2
    `, [tenancyId, agencyId], agencyId);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Get tenancy with full property and landlord details
 */
async function getTenancyWithPropertyAndLandlord(tenancyId, agencyId) {
  try {
    const result = await db.query(`
      SELECT t.*,
        p.address_line1 as property_address,
        p.location,
        p.city,
        l.name as landlord_name,
        l.email as landlord_email,
        l.phone as landlord_phone
      FROM tenancies t
      LEFT JOIN properties p ON t.property_id = p.id
      LEFT JOIN landlords l ON p.landlord_id = l.id
      WHERE t.id = $1 AND t.agency_id = $2
    `, [tenancyId, agencyId], agencyId);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Get tenancy members with full details (user, application, room)
 */
async function getTenancyMembersWithDetails(tenancyId, agencyId) {
  try {
    const result = await db.query(`
      SELECT tm.*,
        COALESCE(tm.user_id, a.user_id) as user_id,
        COALESCE(tm.first_name, u.first_name) as first_name,
        COALESCE(tm.surname, u.last_name) as last_name,
        u.email,
        u.phone,
        b.bedroom_name,
        a.application_type,
        a.status as application_status
      FROM tenancy_members tm
      LEFT JOIN applications a ON tm.application_id = a.id
      LEFT JOIN users u ON COALESCE(tm.user_id, a.user_id) = u.id
      LEFT JOIN bedrooms b ON tm.bedroom_id = b.id
      WHERE tm.tenancy_id = $1 AND tm.agency_id = $2
      ORDER BY tm.id
    `, [tenancyId, agencyId], agencyId);
    return result.rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Get tenancy members for email sending (with user email)
 */
async function getTenancyMembersForEmail(tenancyId, agencyId) {
  try {
    const result = await db.query(`
      SELECT tm.id, tm.first_name, tm.surname, u.email
      FROM tenancy_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.tenancy_id = $1 AND tm.agency_id = $2
    `, [tenancyId, agencyId], agencyId);
    return result.rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Get member by ID with tenancy status
 */
async function getMemberWithTenancyStatus(memberId, tenancyId, agencyId) {
  try {
    const result = await db.query(`
      SELECT tm.*,
        tm.surname as last_name,
        t.status as tenancy_status,
        t.property_id,
        a.status as application_status
      FROM tenancy_members tm
      INNER JOIN tenancies t ON tm.tenancy_id = t.id
      LEFT JOIN applications a ON tm.application_id = a.id
      WHERE tm.id = $1 AND tm.tenancy_id = $2 AND tm.agency_id = $3
    `, [memberId, tenancyId, agencyId], agencyId);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Get member by ID with user verification
 */
async function getMemberForUser(memberId, tenancyId, userId, agencyId) {
  try {
    const result = await db.query(`
      SELECT tm.*,
        tm.surname as last_name,
        t.status as tenancy_status,
        a.status as application_status
      FROM tenancy_members tm
      INNER JOIN tenancies t ON tm.tenancy_id = t.id
      LEFT JOIN applications a ON tm.application_id = a.id
      WHERE tm.id = $1 AND tm.tenancy_id = $2 AND tm.user_id = $3 AND tm.agency_id = $4
    `, [memberId, tenancyId, userId, agencyId], agencyId);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Get all tenancies for a user (for tenant portal)
 */
async function getUserTenancies(userId, agencyId) {
  try {
    const result = await db.query(`
      SELECT DISTINCT
        t.id,
        t.status,
        t.start_date,
        t.end_date,
        t.is_rolling_monthly,
        p.address_line1 as property_address,
        p.location,
        tm.id as member_id,
        CASE t.status WHEN 'active' THEN 0 ELSE 1 END as status_order
      FROM tenancy_members tm
      LEFT JOIN applications a ON tm.application_id = a.id
      INNER JOIN tenancies t ON tm.tenancy_id = t.id
      LEFT JOIN properties p ON t.property_id = p.id
      WHERE (tm.user_id = $1 OR a.user_id = $2)
        AND t.status IN ('active', 'expired')
        AND t.agency_id = $3
      ORDER BY
        status_order,
        t.start_date DESC
    `, [userId, userId, agencyId], agencyId);
    return result.rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Get pending agreements for a user
 */
async function getPendingAgreementsForUser(userId, agencyId) {
  try {
    const result = await db.query(`
      SELECT
        tm.id as member_id,
        tm.tenancy_id,
        tm.is_signed,
        t.property_id,
        t.status as tenancy_status,
        p.address_line1 as property_address
      FROM tenancy_members tm
      INNER JOIN applications a ON tm.application_id = a.id
      INNER JOIN tenancies t ON tm.tenancy_id = t.id
      INNER JOIN properties p ON t.property_id = p.id
      WHERE a.user_id = $1
        AND t.status = 'awaiting_signatures'
        AND (tm.is_signed = false OR tm.is_signed IS NULL)
        AND t.agency_id = $2
    `, [userId, agencyId], agencyId);
    return result.rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Get pending application for user
 */
async function getPendingApplicationForUser(userId, agencyId) {
  try {
    const result = await db.query(`
      SELECT
        a.id,
        a.status,
        a.application_type
      FROM applications a
      WHERE a.user_id = $1 AND a.status IN ('pending', 'awaiting_guarantor') AND a.agency_id = $2
      ORDER BY a.created_at DESC
      LIMIT 1
    `, [userId, agencyId], agencyId);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Get pending agreement for user
 */
async function getPendingAgreementForUser(userId, agencyId) {
  try {
    const result = await db.query(`
      SELECT
        t.id as tenancy_id,
        tm.id as member_id,
        t.start_date,
        t.end_date,
        t.status,
        p.address_line1,
        p.location
      FROM tenancy_members tm
      JOIN tenancies t ON tm.tenancy_id = t.id
      JOIN properties p ON t.property_id = p.id
      LEFT JOIN applications a ON tm.application_id = a.id
      WHERE tm.user_id = $1
        AND t.status IN ('pending', 'awaiting_signatures')
        AND (tm.is_signed = false OR tm.is_signed IS NULL)
        AND (tm.application_id IS NULL OR a.status IN ('approved', 'converted_to_tenancy'))
        AND t.agency_id = $2
      ORDER BY t.start_date ASC
      LIMIT 1
    `, [userId, agencyId], agencyId);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Get unpaid payments count for user
 */
async function getUnpaidPaymentsForUser(userId, agencyId) {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) as count,
        SUM(ps.amount_due - COALESCE(paid.total_paid, 0)) as total_outstanding
      FROM payment_schedules ps
      INNER JOIN tenancy_members tm ON ps.tenancy_member_id = tm.id
      LEFT JOIN applications a ON tm.application_id = a.id
      LEFT JOIN (
        SELECT payment_schedule_id, SUM(amount) as total_paid
        FROM payments
        GROUP BY payment_schedule_id
      ) paid ON paid.payment_schedule_id = ps.id
      WHERE (tm.user_id = $1 OR a.user_id = $2) AND ps.status != 'paid' AND ps.agency_id = $3
    `, [userId, userId, agencyId], agencyId);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Get property certificates for a property
 */
async function getPropertyCertificates(propertyId, agencyId) {
  try {
    const result = await db.query(`
      SELECT
        c.*,
        ct.name as type_name,
        ct.display_name as type_display_name,
        ct.icon as type_icon
      FROM certificates c
      JOIN certificate_types ct ON c.certificate_type_id = ct.id
      WHERE c.entity_type = 'property' AND c.entity_id = $1 AND c.agency_id = $2
      ORDER BY ct.display_order ASC, ct.display_name ASC
    `, [propertyId, agencyId], agencyId);
    return result.rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Get unsigned members count for tenancy
 */
async function getUnsignedMembersCount(tenancyId, agencyId) {
  try {
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM tenancy_members
      WHERE tenancy_id = $1 AND (is_signed = false OR is_signed IS NULL) AND agency_id = $2
    `, [tenancyId, agencyId], agencyId);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Get member count for tenancy
 */
async function getMemberCount(tenancyId, agencyId) {
  try {
    const result = await db.query(`
      SELECT COUNT(*) as count FROM tenancy_members WHERE tenancy_id = $1 AND agency_id = $2
    `, [tenancyId, agencyId], agencyId);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Get site settings as object
 */
async function getSiteSettings(agencyId) {
  try {
    const result = await db.query('SELECT setting_key, setting_value FROM site_settings', [], agencyId);
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    return settings;
  } catch (error) {
    throw error;
  }
}

/**
 * Get base URL from settings or env
 */
async function getBaseUrl(agencyId) {
  try {
    const settings = await getSiteSettings(agencyId);
    return settings.base_url || process.env.FRONTEND_URL || 'http://localhost:3000';
  } catch (error) {
    throw error;
  }
}

/**
 * Update tenancy status
 */
async function updateTenancyStatus(tenancyId, status, agencyId) {
  try {
    const result = await db.query(`
      UPDATE tenancies
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND agency_id = $3
      RETURNING *
    `, [status, tenancyId, agencyId], agencyId);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Update tenancy fields
 */
async function updateTenancy(tenancyId, fields, agencyId) {
  try {
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (fields.start_date !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      values.push(fields.start_date);
    }
    if (fields.end_date !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      values.push(fields.end_date);
    }
    if (fields.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(fields.status);
    }
    if (fields.auto_generate_payments !== undefined) {
      updates.push(`auto_generate_payments = $${paramIndex++}`);
      values.push(fields.auto_generate_payments);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(tenancyId);
    values.push(agencyId);

    const result = await db.query(`
      UPDATE tenancies SET ${updates.join(', ')} WHERE id = $${paramIndex} AND agency_id = $${paramIndex + 1}
      RETURNING *
    `, values, agencyId);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Sign member agreement
 */
async function signMemberAgreement(memberId, signatureData, agreementHtml, paymentOption, agencyId) {
  try {
    const result = await db.query(`
      UPDATE tenancy_members
      SET signature_data = $1,
          signed_at = CURRENT_TIMESTAMP,
          is_signed = true,
          signed_agreement_html = $2,
          payment_option = $3
      WHERE id = $4 AND agency_id = $5
      RETURNING *
    `, [signatureData, agreementHtml, paymentOption, memberId, agencyId], agencyId);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Revert member signature
 */
async function revertMemberSignature(memberId, agencyId) {
  try {
    const result = await db.query(`
      UPDATE tenancy_members
      SET is_signed = false,
          signature_data = NULL,
          signed_at = NULL,
          signed_agreement_html = NULL,
          payment_option = NULL
      WHERE id = $1 AND agency_id = $2
      RETURNING *
    `, [memberId, agencyId], agencyId);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

module.exports = {
  STATUS_GROUPS,
  // Tenancy queries
  getTenancyWithProperty,
  getTenancyWithPropertyAndLandlord,
  getTenancyMembersWithDetails,
  getTenancyMembersForEmail,
  getMemberWithTenancyStatus,
  getMemberForUser,
  getUnsignedMembersCount,
  getMemberCount,
  getPropertyCertificates,
  // User queries
  getUserTenancies,
  getPendingAgreementsForUser,
  getPendingApplicationForUser,
  getPendingAgreementForUser,
  getUnpaidPaymentsForUser,
  // Settings
  getSiteSettings,
  getBaseUrl,
  // Mutations
  updateTenancyStatus,
  updateTenancy,
  signMemberAgreement,
  revertMemberSignature
};
