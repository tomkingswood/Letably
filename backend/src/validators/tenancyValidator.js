/**
 * Tenancy Validator
 * Centralized validation logic for tenancy operations
 */

const db = require('../db');

/**
 * Validate tenancy dates
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string|null} endDate - End date (YYYY-MM-DD) or null for rolling
 * @param {boolean} isRollingMonthly - Whether this is a rolling monthly tenancy
 * @returns {{ valid: boolean, error?: string, startDate?: Date, endDate?: Date|null }}
 */
function validateDates(startDate, endDate, isRollingMonthly = false) {
  const start = new Date(startDate);

  if (isNaN(start.getTime())) {
    return { valid: false, error: 'Invalid start date' };
  }

  // Rolling monthly tenancies
  if (isRollingMonthly) {
    if (endDate) {
      // Rolling tenancies CAN have an end date (for termination)
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return { valid: false, error: 'Invalid end date' };
      }
      if (end <= start) {
        return { valid: false, error: 'End date must be after start date' };
      }
      return { valid: true, startDate: start, endDate: end };
    }
    return { valid: true, startDate: start, endDate: null };
  }

  // Fixed-term tenancies MUST have an end_date
  if (!endDate) {
    return { valid: false, error: 'End date is required for fixed-term tenancies' };
  }

  const end = new Date(endDate);

  if (isNaN(end.getTime())) {
    return { valid: false, error: 'Invalid end date' };
  }

  if (end <= start) {
    return { valid: false, error: 'End date must be after start date' };
  }

  return { valid: true, startDate: start, endDate: end };
}

/**
 * Validate bedroom assignments for duplicate bedrooms within the same tenancy
 * @param {Array<{ bedroom_id: number|null }>} members - Array of member objects with bedroom_id
 * @returns {{ valid: boolean, error?: string }}
 */
function validateNoDuplicateBedrooms(members) {
  const assignedBedroomIds = members
    .map(m => m.bedroom_id)
    .filter(bedroomId => bedroomId != null && bedroomId !== '');

  if (assignedBedroomIds.length > 0) {
    const uniqueBedroomIds = new Set(assignedBedroomIds);
    if (uniqueBedroomIds.size !== assignedBedroomIds.length) {
      return { valid: false, error: 'Multiple tenants cannot be assigned to the same bedroom' };
    }
  }

  return { valid: true };
}

/**
 * Validate bedroom belongs to property
 * @param {number} bedroomId - Bedroom ID
 * @param {number} propertyId - Property ID
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
async function validateBedroomBelongsToProperty(bedroomId, propertyId, agencyId) {
  try {
    if (!bedroomId) return { valid: true };

    const result = await db.query(
      `SELECT id FROM bedrooms WHERE id = $1 AND property_id = $2`,
      [bedroomId, propertyId],
      agencyId
    );

    if (!result.rows[0]) {
      return { valid: false, error: 'Invalid bedroom for this property' };
    }

    return { valid: true };
  } catch (error) {
    throw error;
  }
}

/**
 * Check for bedroom conflicts with existing tenancies
 * @param {Array<{ bedroom_id: number|null, member_name: string }>} bedroomAssignments
 * @param {string} startDate - New tenancy start date
 * @param {string|null} endDate - New tenancy end date
 * @param {number|null} excludeTenancyId - Tenancy to exclude (for updates)
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Promise<Array<Object>>} Array of conflict objects
 */
async function checkBedroomConflicts(bedroomAssignments, startDate, endDate, excludeTenancyId = null, agencyId) {
  try {
    const conflicts = [];

    // Filter out null/undefined bedroom assignments
    const validAssignments = bedroomAssignments.filter(a => a.bedroom_id != null && a.bedroom_id !== '');

    if (validAssignments.length === 0) {
      return conflicts;
    }

    for (const assignment of validAssignments) {
      let query = `
        SELECT
          tm.id as member_id,
          tm.first_name,
          tm.surname,
          tm.bedroom_id,
          b.bedroom_name,
          t.id as tenancy_id,
          t.start_date,
          t.end_date,
          t.status,
          p.address_line1,
          p.city
        FROM tenancy_members tm
        JOIN tenancies t ON tm.tenancy_id = t.id
        JOIN bedrooms b ON tm.bedroom_id = b.id
        JOIN properties p ON t.property_id = p.id
        WHERE tm.bedroom_id = $1
          AND t.status != 'expired'
      `;

      const params = [assignment.bedroom_id];

      if (excludeTenancyId) {
        query += ` AND t.id != $2`;
        params.push(excludeTenancyId);
      }

      const result = await db.query(query, params, agencyId);
      const existingBookings = result.rows;

      for (const booking of existingBookings) {
        const newStart = new Date(startDate);
        const newEnd = endDate ? new Date(endDate) : null;
        const existingStart = new Date(booking.start_date);
        const existingEnd = booking.end_date ? new Date(booking.end_date) : null;

        // Ranges overlap if:
        // (newStart <= existingEnd OR existingEnd is NULL) AND (existingStart <= newEnd OR newEnd is NULL)
        const newStartBeforeExistingEnd = existingEnd === null || newStart <= existingEnd;
        const existingStartBeforeNewEnd = newEnd === null || existingStart <= newEnd;

        if (newStartBeforeExistingEnd && existingStartBeforeNewEnd) {
          const formatDisplayDate = (dateStr) => {
            if (!dateStr) return 'No end date (rolling)';
            return new Date(dateStr).toLocaleDateString('en-GB');
          };

          conflicts.push({
            bedroom_id: assignment.bedroom_id,
            bedroom_name: booking.bedroom_name,
            new_tenant: assignment.member_name,
            existing_tenant: `${booking.first_name} ${booking.surname}`,
            existing_tenancy_id: booking.tenancy_id,
            existing_tenancy_status: booking.status,
            existing_start: formatDisplayDate(booking.start_date),
            existing_end: formatDisplayDate(booking.end_date),
            property: `${booking.address_line1}, ${booking.city}`,
            message: `Bedroom "${booking.bedroom_name}" is already assigned to ${booking.first_name} ${booking.surname} ` +
                     `from ${formatDisplayDate(booking.start_date)} to ${formatDisplayDate(booking.end_date)} ` +
                     `(Tenancy #${booking.tenancy_id}, Status: ${booking.status})`
          });
        }
      }
    }

    return conflicts;
  } catch (error) {
    throw error;
  }
}

/**
 * Format bedroom conflicts into a user-friendly error response
 * @param {Array<Object>} conflicts
 * @returns {{ error: string, message: string, conflicts: Array }}
 */
function formatBedroomConflictError(conflicts) {
  if (conflicts.length === 0) return null;

  const header = `Cannot create tenancy: ${conflicts.length} bedroom conflict${conflicts.length > 1 ? 's' : ''} detected.\n\n`;

  const details = conflicts.map((c, i) => {
    return `${i + 1}. ${c.message}`;
  }).join('\n\n');

  const footer = '\n\nPlease either:\n' +
    '• Choose different bedrooms for the conflicting tenants\n' +
    '• Adjust the tenancy dates to avoid overlap\n' +
    '• End the existing tenancy before the new one starts';

  return {
    error: 'Bedroom booking conflict detected',
    message: header + details + footer,
    conflicts: conflicts
  };
}

/**
 * Validate tenancy type
 * @param {string} tenancyType
 * @returns {{ valid: boolean, error?: string }}
 */
function validateTenancyType(tenancyType) {
  if (!['room_only', 'whole_house'].includes(tenancyType)) {
    return { valid: false, error: 'Invalid tenancy type. Must be room_only or whole_house' };
  }
  return { valid: true };
}

/**
 * Validate tenancy status
 * @param {string} status
 * @returns {{ valid: boolean, error?: string }}
 */
function validateTenancyStatus(status) {
  const validStatuses = ['pending', 'awaiting_signatures', 'approval', 'active', 'expired'];
  if (!validStatuses.includes(status)) {
    return {
      valid: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    };
  }
  return { valid: true };
}

/**
 * Validate status transition is allowed
 * @param {string} currentStatus
 * @param {string} newStatus
 * @returns {{ valid: boolean, error?: string }}
 */
function validateStatusTransition(currentStatus, newStatus) {
  if (currentStatus === newStatus) {
    return { valid: true };
  }

  const allowedTransitions = {
    'pending': ['awaiting_signatures'],
    'awaiting_signatures': [], // Auto-transitions to 'approval' when all tenants + guarantors sign
    'approval': ['active'],
    'active': ['expired'],
    'expired': []
  };

  const allowed = allowedTransitions[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    let errorMessage = `Cannot change status from '${currentStatus}' to '${newStatus}'.`;

    if (currentStatus === 'pending') {
      errorMessage += ' Tenancy must be marked as awaiting signatures first.';
    } else if (currentStatus === 'awaiting_signatures') {
      errorMessage += ' Status will automatically change to approval when all tenants and guarantors have signed.';
    } else if (currentStatus === 'approval') {
      errorMessage += ' Tenancy can only be activated from approval status once all guarantor agreements are signed.';
    } else if (currentStatus === 'active' || currentStatus === 'expired') {
      errorMessage += ' Status cannot be changed once tenancy is active or expired.';
    }

    return { valid: false, error: errorMessage };
  }

  return { valid: true };
}

/**
 * Validate payment option
 * @param {string} paymentOption
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePaymentOption(paymentOption) {
  const validOptions = ['monthly', 'monthly_to_quarterly', 'quarterly', 'upfront'];
  if (!validOptions.includes(paymentOption)) {
    return { valid: false, error: 'Invalid payment option' };
  }
  return { valid: true };
}

/**
 * Validate signature matches member name
 * @param {string} signatureData - The typed signature
 * @param {string} firstName - Member's first name
 * @param {string} lastName - Member's last name
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSignature(signatureData, firstName, lastName) {
  const expectedName = `${firstName || ''} ${lastName || ''}`.trim().toLowerCase();

  // Remove common titles from signature
  const titles = ['mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'miss', 'miss.', 'dr', 'dr.', 'prof', 'prof.', 'rev', 'rev.', 'sir', 'sir.', 'dame', 'dame.', 'lord', 'lord.', 'lady', 'lady.'];
  let normalizedSignature = signatureData.trim().toLowerCase();

  for (const title of titles) {
    if (normalizedSignature.startsWith(title + ' ')) {
      normalizedSignature = normalizedSignature.substring(title.length).trim();
      break;
    }
  }

  if (normalizedSignature !== expectedName) {
    return {
      valid: false,
      error: `Signature name must match "${firstName} ${lastName}"`
    };
  }

  return { valid: true };
}

/**
 * Validate key status
 * @param {string} keyStatus
 * @returns {{ valid: boolean, error?: string }}
 */
function validateKeyStatus(keyStatus) {
  const validStatuses = ['not_collected', 'collected', 'returned'];
  if (!validStatuses.includes(keyStatus)) {
    return {
      valid: false,
      error: `Invalid key status. Must be one of: ${validStatuses.join(', ')}`
    };
  }
  return { valid: true };
}

/**
 * Validate member data for migration tenancy
 * @param {Object} member - Member object
 * @param {number} index - Member index (for error messages)
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
async function validateMigrationMember(member, index, agencyId) {
  try {
    if (!member.user_id) {
      return { valid: false, error: `Member ${index + 1}: user_id is required` };
    }
    if (!member.first_name || !member.surname) {
      return { valid: false, error: `Member ${index + 1}: first_name and surname are required` };
    }
    if (member.rent_pppw === undefined || member.rent_pppw === null) {
      return { valid: false, error: `Member ${index + 1}: rent_pppw is required` };
    }
    if (member.deposit_amount === undefined || member.deposit_amount === null) {
      return { valid: false, error: `Member ${index + 1}: deposit_amount is required` };
    }

    // Validate user exists
    const result = await db.query(
      'SELECT id FROM users WHERE id = $1',
      [member.user_id],
      agencyId
    );

    if (!result.rows[0]) {
      return { valid: false, error: `Member ${index + 1}: User with ID ${member.user_id} not found` };
    }

    return { valid: true };
  } catch (error) {
    throw error;
  }
}

/**
 * Validate no duplicate user IDs in members array
 * @param {Array<{ user_id: number }>} members
 * @returns {{ valid: boolean, error?: string }}
 */
function validateNoDuplicateUsers(members) {
  const userIds = members.map(m => m.user_id);
  if (new Set(userIds).size !== userIds.length) {
    return { valid: false, error: 'Duplicate user IDs found. Each tenant must be unique.' };
  }
  return { valid: true };
}

/**
 * Validate property exists
 * @param {number} propertyId
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
async function validatePropertyExists(propertyId, agencyId) {
  try {
    const result = await db.query(
      'SELECT id FROM properties WHERE id = $1',
      [propertyId],
      agencyId
    );

    if (!result.rows[0]) {
      return { valid: false, error: 'Property not found' };
    }

    return { valid: true };
  } catch (error) {
    throw error;
  }
}

/**
 * Validate application exists and is approved
 * Note: Property is assigned at tenancy creation time, not application time
 * @param {number} applicationId
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
async function validateApplicationForTenancy(applicationId, agencyId) {
  try {
    const result = await db.query(
      'SELECT status FROM applications WHERE id = $1',
      [applicationId],
      agencyId
    );

    const application = result.rows[0];

    if (!application) {
      return { valid: false, error: `Application ${applicationId} not found` };
    }

    if (application.status !== 'approved') {
      return { valid: false, error: `Application ${applicationId} is not approved (current status: ${application.status}). Applications must be approved before creating a tenancy.` };
    }

    return { valid: true };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  validateDates,
  validateNoDuplicateBedrooms,
  validateBedroomBelongsToProperty,
  checkBedroomConflicts,
  formatBedroomConflictError,
  validateTenancyType,
  validateTenancyStatus,
  validateStatusTransition,
  validatePaymentOption,
  validateSignature,
  validateKeyStatus,
  validateMigrationMember,
  validateNoDuplicateUsers,
  validatePropertyExists,
  validateApplicationForTenancy
};
