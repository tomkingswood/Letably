const db = require('../db');
const { generatePaymentSchedulesForTenancy } = require('../services/paymentService');
const { createGuarantorAgreements, sendGuarantorAgreementEmails } = require('../services/guarantorService');
const { queueEmail } = require('../services/emailService');
const { getTenancyMembersWithDetails } = require('../helpers/queries');
const asyncHandler = require('../utils/asyncHandler');

// Import refactored modules
const {
  checkBedroomConflicts,
  formatBedroomConflictError,
  validateNoDuplicateBedrooms
} = require('../validators/tenancyValidator');

const {
  getBaseUrl,
  getTenancyMembersForEmail
} = require('../repositories/tenancyRepository');

const { buildSigningNotificationEmail } = require('../utils/tenancyEmailBuilder');

/**
 * Get all tenancies with member details and filtering
 * GET /api/tenancies
 */
exports.getAllTenancies = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const {
    search,
    status,
    statusGroup,
    type,
    property_id,
    startDateFrom,
    startDateTo
  } = req.query;

  // Build dynamic WHERE clause
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  // Status group filter (current, workflow, active, expired)
  // 'current' = workflow + active (excludes expired)
  if (statusGroup === 'current') {
    conditions.push(`t.status IN ('pending', 'awaiting_signatures', 'signed', 'approval', 'active')`);
  } else if (statusGroup === 'workflow') {
    conditions.push(`t.status IN ('pending', 'awaiting_signatures', 'signed', 'approval')`);
  } else if (statusGroup === 'active') {
    conditions.push(`t.status = 'active'`);
  } else if (statusGroup === 'expired') {
    conditions.push(`t.status = 'expired'`);
  } else if (status) {
    // Individual status filter
    conditions.push(`t.status = $${paramIndex++}`);
    params.push(status);
  }

  // Tenancy type filter
  if (type === 'room_only' || type === 'whole_house') {
    conditions.push(`t.tenancy_type = $${paramIndex++}`);
    params.push(type);
  } else if (type === 'rolling_monthly') {
    conditions.push(`t.is_rolling_monthly = true`);
  }

  // Property filter
  if (property_id) {
    conditions.push(`t.property_id = $${paramIndex++}`);
    params.push(property_id);
  }

  // Date range filter
  if (startDateFrom) {
    conditions.push(`t.start_date >= $${paramIndex++}`);
    params.push(startDateFrom);
  }
  if (startDateTo) {
    conditions.push(`t.start_date <= $${paramIndex++}`);
    params.push(startDateTo);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const tenanciesResult = await db.query(`
    SELECT t.*, p.address_line1 as property_address, p.location as property_location,
      COUNT(tm.id) as member_count
    FROM tenancies t
    LEFT JOIN properties p ON t.property_id = p.id
    LEFT JOIN tenancy_members tm ON t.id = tm.tenancy_id
    ${whereClause}
    GROUP BY t.id, p.address_line1, p.location
    ORDER BY
      CASE t.status
        WHEN 'pending' THEN 1
        WHEN 'awaiting_signatures' THEN 2
        WHEN 'signed' THEN 3
        WHEN 'approval' THEN 4
        WHEN 'active' THEN 5
        WHEN 'expired' THEN 6
      END,
      t.created_at DESC
  `, params, agencyId);

  const tenancies = tenanciesResult.rows;

  // Fetch members for each tenancy
  const tenanciesWithMembers = await Promise.all(tenancies.map(async (tenancy) => {
    const members = await getTenancyMembersWithDetails(tenancy.id, agencyId);
    return { ...tenancy, members };
  }));

  // Apply search filter on tenant names and property address (done after fetching members)
  let filteredTenancies = tenanciesWithMembers;
  if (search && search.trim()) {
    const searchLower = search.toLowerCase().trim();
    filteredTenancies = tenanciesWithMembers.filter(tenancy => {
      // Search in property address
      if (tenancy.property_address && tenancy.property_address.toLowerCase().includes(searchLower)) {
        return true;
      }
      // Search in property location
      if (tenancy.property_location && tenancy.property_location.toLowerCase().includes(searchLower)) {
        return true;
      }
      // Search in tenant names
      if (tenancy.members && tenancy.members.some(member => {
        const fullName = `${member.first_name || ''} ${member.last_name || ''}`.toLowerCase();
        return fullName.includes(searchLower);
      })) {
        return true;
      }
      return false;
    });
  }

  // Calculate summary stats
  const statsResult = await db.query(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('pending', 'awaiting_signatures', 'signed', 'approval') THEN 1 ELSE 0 END) as workflow,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
    FROM tenancies
  `, [], agencyId);

  const statsQuery = statsResult.rows[0];
  const stats = {
    total: parseInt(statsQuery.total) || 0,
    workflow: parseInt(statsQuery.workflow) || 0,
    active: parseInt(statsQuery.active) || 0,
    expired: parseInt(statsQuery.expired) || 0
  };

  res.json({ tenancies: filteredTenancies, stats });
}, 'fetch tenancies');

/**
 * Get single tenancy with full member details
 * GET /api/tenancies/:id
 */
exports.getTenancyById = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Defense-in-depth: explicit agency_id filtering
  const tenancyResult = await db.query(`
    SELECT t.*, p.address_line1 as property_address, p.location
    FROM tenancies t
    LEFT JOIN properties p ON t.property_id = p.id
    WHERE t.id = $1 AND t.agency_id = $2
  `, [id, agencyId], agencyId);

  const tenancy = tenancyResult.rows[0];

  if (!tenancy) {
    return res.status(404).json({ error: 'Tenancy not found' });
  }

  // Get tenancy members with application and user details
  const members = await getTenancyMembersWithDetails(id, agencyId);

  res.json({ tenancy: { ...tenancy, members } });
}, 'fetch tenancy');

/**
 * Get completed applications grouped by property
 * DEPRECATED: Applications no longer have property_id
 * Property is now assigned at tenancy creation time
 * Use getApprovedApplicants instead
 * GET /api/tenancies/completed-applications
 */
exports.getCompletedApplicationsByProperty = async (req, res) => {
  res.json({
    propertiesWithApplications: [],
    message: 'This endpoint is deprecated. Applications are no longer grouped by property. Use /approved-applicants instead.'
  });
};

/**
 * Get all approved applicants (not grouped by property)
 * Used for the new tenancy creation flow where property is selected first
 * GET /api/tenancies/approved-applicants
 */
exports.getApprovedApplicants = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;

  const applicantsResult = await db.query(`
    SELECT
      a.id,
      a.user_id,
      a.application_type,
      a.status,
      a.guarantor_required,
      a.first_name,
      a.surname as last_name,
      a.created_at,
      u.email,
      u.phone
    FROM applications a
    INNER JOIN users u ON a.user_id = u.id
    WHERE a.status = 'approved'
    ORDER BY a.created_at DESC
  `, [], agencyId);

  res.json({
    applicants: applicantsResult.rows.map(a => ({
      id: a.id,
      user_id: a.user_id,
      application_type: a.application_type,
      status: a.status,
      guarantor_required: !!a.guarantor_required,
      first_name: a.first_name,
      last_name: a.last_name,
      email: a.email,
      phone: a.phone,
      created_at: a.created_at
    }))
  });
}, 'fetch approved applicants');

/**
 * Create tenancy from application(s)
 * POST /api/tenancies
 */
exports.createTenancy = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const {
    property_id,
    tenancy_type,
    start_date,
    end_date,
    status = 'pending',
    is_rolling_monthly = false,
    auto_generate_payments = true,
    members // Array of { application_id, bedroom_id (optional), rent_pppw, deposit_amount }
  } = req.body;

  // Validation - end_date is optional for rolling monthly tenancies
  if (!property_id || !tenancy_type || !start_date || !members || members.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Rolling monthly tenancies must NOT have an end_date
  if (is_rolling_monthly && end_date) {
    return res.status(400).json({ error: 'Rolling monthly tenancies cannot have an end date' });
  }

  // Non-rolling tenancies MUST have an end_date
  if (!is_rolling_monthly && !end_date) {
    return res.status(400).json({ error: 'End date is required for fixed-term tenancies' });
  }

  if (!['room_only', 'whole_house'].includes(tenancy_type)) {
    return res.status(400).json({ error: 'Invalid tenancy type' });
  }

  if (tenancy_type === 'room_only' && members.length !== 1) {
    return res.status(400).json({ error: 'Room only tenancy must have exactly 1 member' });
  }

  // Validate dates
  const startDate = new Date(start_date);

  if (isNaN(startDate.getTime())) {
    return res.status(400).json({ error: 'Invalid start date' });
  }

  // Only validate end_date for non-rolling tenancies
  if (!is_rolling_monthly) {
    const endDate = new Date(end_date);

    if (isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid end date' });
    }

    if (endDate <= startDate) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }
  }

  // Validate all applications exist and are approved
  // Note: Property is assigned at tenancy creation time, not application time
  for (const member of members) {
    // Defense-in-depth: explicit agency_id filtering
    const applicationResult = await db.query('SELECT status FROM applications WHERE id = $1 AND agency_id = $2', [member.application_id, agencyId], agencyId);
    const application = applicationResult.rows[0];

    if (!application) {
      return res.status(404).json({ error: `Application ${member.application_id} not found` });
    }

    if (application.status !== 'approved') {
      return res.status(400).json({ error: `Application ${member.application_id} is not approved (current status: ${application.status}). Applications must be approved before creating a tenancy.` });
    }
  }

  // Validate no duplicate applications
  const applicationIds = members.map(m => m.application_id);
  if (new Set(applicationIds).size !== applicationIds.length) {
    return res.status(400).json({ error: 'Duplicate applications found' });
  }

  // Validate no duplicate bedroom assignments using validator
  const bedroomValidation = validateNoDuplicateBedrooms(members);
  if (!bedroomValidation.valid) {
    return res.status(400).json({ error: bedroomValidation.error });
  }

  // Check for bedroom conflicts with existing tenancies
  const bedroomAssignments = [];
  for (const m of members) {
    // Get member name from application for conflict messages
    // Defense-in-depth: explicit agency_id filtering
    const appResult = await db.query('SELECT first_name, surname FROM applications WHERE id = $1 AND agency_id = $2', [m.application_id, agencyId], agencyId);
    const app = appResult.rows[0];
    bedroomAssignments.push({
      bedroom_id: m.bedroom_id,
      member_name: app ? `${app.first_name} ${app.surname}` : 'Unknown'
    });
  }

  const bedroomConflicts = checkBedroomConflicts(bedroomAssignments, start_date, end_date || null, null);
  if (bedroomConflicts.length > 0) {
    const conflictError = formatBedroomConflictError(bedroomConflicts);
    return res.status(409).json({ error: conflictError.error });
  }

  // Use transaction for creating tenancy
  const result = await db.transaction(async (client) => {
    // Calculate total rent from members
    const totalRent = members.reduce((sum, m) => sum + (parseFloat(m.rent_pppw) || 0), 0);

    // Insert tenancy
    const tenancyResult = await client.query(`
      INSERT INTO tenancies (agency_id, property_id, tenancy_type, start_date, end_date, rent_amount, status, is_rolling_monthly, auto_generate_payments)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      agencyId,
      property_id,
      tenancy_type,
      start_date,
      end_date || null,
      totalRent,
      status,
      is_rolling_monthly,
      auto_generate_payments
    ]);

    const tenancyId = tenancyResult.rows[0].id;

    // Helper function to map application payment_plan to tenancy payment_option
    const mapPaymentPlanToOption = (paymentPlan) => {
      // Rolling monthly tenancies are forced to use monthly payment option
      if (is_rolling_monthly) {
        return 'monthly';
      }

      if (!paymentPlan) return null;
      const plan = paymentPlan.toLowerCase().trim();
      if (plan.includes('quarterly')) return 'quarterly';
      if (plan.includes('upfront') || plan.includes('full')) return 'upfront';
      // Default to monthly for any monthly plan or unrecognized plans
      return 'monthly';
    };

    // Insert tenancy members with all data copied from applications (snapshot for decoupling)
    for (const member of members) {
      // Fetch tenant info and guarantor data from application
      const appDataResult = await client.query(`
        SELECT first_name, surname, user_id, title, current_address, application_type,
               COALESCE(form_data->>'payment_plan', payment_plan) as payment_plan,
               guarantor_required,
               COALESCE(form_data->>'guarantor_name', guarantor_name) as guarantor_name,
               COALESCE(form_data->>'guarantor_dob', guarantor_dob::text) as guarantor_dob,
               COALESCE(form_data->>'guarantor_email', guarantor_email) as guarantor_email,
               COALESCE(form_data->>'guarantor_phone', guarantor_phone) as guarantor_phone,
               COALESCE(form_data->>'guarantor_address', guarantor_address) as guarantor_address,
               COALESCE(form_data->>'guarantor_relationship', guarantor_relationship) as guarantor_relationship,
               COALESCE(form_data->>'guarantor_id_type', guarantor_id_type) as guarantor_id_type
        FROM applications
        WHERE id = $1
      `, [member.application_id]);
      const appData = appDataResult.rows[0];

      // Map application payment_plan to payment_option and pre-populate as default
      // Tenant can still change this when signing their agreement
      const defaultPaymentOption = mapPaymentPlanToOption(appData.payment_plan);

      await client.query(`
        INSERT INTO tenancy_members (
          agency_id, tenancy_id, application_id, bedroom_id, rent_pppw, deposit_amount,
          first_name, surname, user_id, title, current_address, application_type,
          payment_option,
          guarantor_required, guarantor_name, guarantor_dob, guarantor_email,
          guarantor_phone, guarantor_address, guarantor_relationship, guarantor_id_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      `, [
        agencyId,
        tenancyId,
        member.application_id,
        member.bedroom_id || null,
        member.rent_pppw,
        member.deposit_amount,
        appData.first_name || null,
        appData.surname || null,
        appData.user_id || null,
        appData.title || null,
        appData.current_address || null,
        appData.application_type || null,
        defaultPaymentOption,
        appData.guarantor_required || false,
        appData.guarantor_name || null,
        appData.guarantor_dob || null,
        appData.guarantor_email || null,
        appData.guarantor_phone || null,
        appData.guarantor_address || null,
        appData.guarantor_relationship || null,
        appData.guarantor_id_type || null
      ]);

      // Update application status to converted_to_tenancy
      await client.query('UPDATE applications SET status = $1 WHERE id = $2', ['converted_to_tenancy', member.application_id]);
    }

    return tenancyId;
  }, agencyId);

  const tenancyId = result;

  // Fetch the created tenancy with members
  // Defense-in-depth: explicit agency_id filtering
  const tenancyResult = await db.query(`
    SELECT t.*, p.address_line1 as property_address
    FROM tenancies t
    LEFT JOIN properties p ON t.property_id = p.id
    WHERE t.id = $1 AND t.agency_id = $2
  `, [tenancyId, agencyId], agencyId);
  const tenancy = tenancyResult.rows[0];

  // Defense-in-depth: explicit agency_id filtering
  const tenancyMembersResult = await db.query(`
    SELECT tm.*,
      a.user_id,
      u.first_name, u.last_name, u.email
    FROM tenancy_members tm
    LEFT JOIN applications a ON tm.application_id = a.id
    LEFT JOIN users u ON a.user_id = u.id
    WHERE tm.tenancy_id = $1 AND tm.agency_id = $2
  `, [tenancyId, agencyId], agencyId);

  res.status(201).json({ tenancy: { ...tenancy, members: tenancyMembersResult.rows } });
}, 'create tenancy');

/**
 * Update tenancy
 * PUT /api/tenancies/:id
 */
exports.updateTenancy = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  const { start_date, end_date, status, auto_generate_payments } = req.body;

  // Validate status if provided
  const validStatuses = ['pending', 'awaiting_signatures', 'signed', 'approval', 'active', 'expired'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  // Defense-in-depth: explicit agency_id filtering
  const tenancyResult = await db.query('SELECT id, status, start_date, end_date, is_rolling_monthly, auto_generate_payments FROM tenancies WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);
  const tenancy = tenancyResult.rows[0];
  if (!tenancy) {
    return res.status(404).json({ error: 'Tenancy not found' });
  }

  const isRollingMonthly = tenancy.is_rolling_monthly === true;

  // Validate dates
  const startDate = new Date(start_date);

  if (isNaN(startDate.getTime())) {
    return res.status(400).json({ error: 'Invalid start date' });
  }

  // For rolling tenancies, end_date can be null (ongoing) or set (terminating)
  // For fixed tenancies, end_date is always required
  let validatedEndDate = end_date;

  if (isRollingMonthly) {
    // Rolling tenancy: end_date can be null or a valid date (for termination)
    if (end_date) {
      const endDate = new Date(end_date);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'Invalid end date' });
      }
      if (endDate <= startDate) {
        return res.status(400).json({ error: 'End date must be after start date' });
      }
    }
    validatedEndDate = end_date || null;
  } else {
    // Fixed tenancy: end_date is required
    const endDate = new Date(end_date);
    if (isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid end date' });
    }
    if (endDate <= startDate) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }
  }

  // Prevent changing start_date after tenancy has been checked
  // For rolling tenancies, allow setting end_date even after checked (for termination)
  if (tenancy.status !== 'pending') {
    const currentStartDate = new Date(tenancy.start_date).toISOString().split('T')[0];
    const newStartDate = new Date(start_date).toISOString().split('T')[0];

    if (newStartDate !== currentStartDate) {
      return res.status(400).json({ error: 'Cannot change start date after tenancy has been checked. Start date is locked once tenancy moves beyond pending status.' });
    }

    // For non-rolling tenancies, lock end_date EXCEPT for active tenancies (to allow early termination)
    if (!isRollingMonthly && tenancy.status !== 'active') {
      const currentEndDate = tenancy.end_date ? new Date(tenancy.end_date).toISOString().split('T')[0] : null;
      const newEndDate = validatedEndDate ? new Date(validatedEndDate).toISOString().split('T')[0] : null;

      if (newEndDate !== currentEndDate) {
        return res.status(400).json({ error: 'Cannot change end date after tenancy has been checked. Dates are locked until tenancy is active.' });
      }
    }
    // For rolling tenancies and active tenancies, we allow setting end_date (for termination/early termination)
  }

  // Enforce status workflow - status must always flow forwards
  if (status && status !== tenancy.status) {
    const currentStatus = tenancy.status;
    const newStatus = status;

    // Check if tenancy has members before allowing any status progression
    // Defense-in-depth: explicit agency_id filtering
    const memberCountResult = await db.query('SELECT COUNT(*) as count FROM tenancy_members WHERE tenancy_id = $1 AND agency_id = $2', [id, agencyId], agencyId);
    if (parseInt(memberCountResult.rows[0].count) === 0 && newStatus !== 'pending') {
      return res.status(400).json({ error: 'Cannot change tenancy status. Tenancy has no members. Please add tenants first.' });
    }

    // Define allowed transitions
    const allowedTransitions = {
      'pending': ['awaiting_signatures'],
      'awaiting_signatures': [], // Auto-transitions to 'signed' when all members sign
      'signed': ['approval'],
      'approval': ['active'],
      'active': ['expired'], // Can mark as expired for early termination
      'expired': [] // Cannot change from expired
    };

    const allowed = allowedTransitions[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      let errorMessage = `Cannot change status from '${currentStatus}' to '${newStatus}'.`;

      if (currentStatus === 'pending') {
        errorMessage += ' Tenancy must be marked as awaiting signatures first.';
      } else if (currentStatus === 'awaiting_signatures') {
        errorMessage += ' Status will automatically change to signed when all members sign their agreements.';
      } else if (currentStatus === 'signed') {
        errorMessage += ' Tenancy must move to approval status first.';
      } else if (currentStatus === 'approval') {
        errorMessage += ' Tenancy can only be activated from approval status once all guarantor agreements are signed.';
      } else if (currentStatus === 'active' || currentStatus === 'expired') {
        errorMessage += ' Status cannot be changed once tenancy is active or expired.';
      }

      return res.status(400).json({ error: errorMessage });
    }
  }

  // Check if status is changing to 'awaiting_signatures', 'approval' or 'active'
  const isMovingToAwaitingSignatures = status === 'awaiting_signatures' && tenancy.status !== 'awaiting_signatures';
  const isMovingToApproval = status === 'approval' && tenancy.status !== 'approval';
  const isActivating = status === 'active' && tenancy.status !== 'active';

  // Determine auto_generate_payments value (use existing if not provided)
  const newAutoGeneratePayments = auto_generate_payments !== undefined
    ? auto_generate_payments
    : tenancy.auto_generate_payments;

  // Defense-in-depth: explicit agency_id filtering
  await db.query(`
    UPDATE tenancies
    SET start_date = $1,
        end_date = $2,
        status = $3,
        auto_generate_payments = $4,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $5 AND agency_id = $6
  `, [start_date, validatedEndDate, status, newAutoGeneratePayments, id, agencyId], agencyId);

  // If tenancy is moving to awaiting_signatures status, send emails to all tenants
  if (isMovingToAwaitingSignatures) {
    try {
      // Get tenancy and property details
      // Defense-in-depth: explicit agency_id filtering
      const tenancyDetailsResult = await db.query(`
        SELECT t.*, p.address_line1, p.city
        FROM tenancies t
        JOIN properties p ON t.property_id = p.id
        WHERE t.id = $1 AND t.agency_id = $2
      `, [id, agencyId], agencyId);
      const tenancyDetails = tenancyDetailsResult.rows[0];

      // Get all tenancy members with their user info
      const members = await getTenancyMembersForEmail(id, agencyId);

      // Get base URL from repository
      const baseUrl = await getBaseUrl(agencyId);

      // Send email to each tenant using email builder
      for (const member of members) {
        const agencySlug = req.agency?.slug || '';
        const signingUrl = `${baseUrl}/${agencySlug}/agreements/sign/${id}/${member.id}`;

        const { html, text, subject } = buildSigningNotificationEmail({
          tenantFirstName: member.first_name,
          tenantSurname: member.surname,
          propertyAddress: tenancyDetails.address_line1,
          city: tenancyDetails.city,
          startDate: tenancyDetails.start_date,
          endDate: tenancyDetails.end_date,
          signingUrl
        });

        queueEmail({
          to_email: member.email,
          to_name: `${member.first_name} ${member.surname}`,
          subject,
          html_body: html,
          text_body: text,
          priority: 1
        }, agencyId);
      }

      console.log(`Sent signing notification emails to ${members.length} tenant(s) for tenancy ${id}`);
    } catch (error) {
      console.error('Error sending tenant signing emails:', error);
      // Don't fail the entire request, just log the error
    }
  }

  // If tenancy is moving to approval status
  if (isMovingToApproval) {
    try {
      // Generate payment schedules
      const paymentResult = await generatePaymentSchedulesForTenancy(db, id, agencyId);
      console.log(`Generated payment schedules for tenancy ${id}:`, paymentResult);

      // Create guarantor agreements and send emails (async, don't block response)
      createGuarantorAgreements(id, agencyId)
        .then(async (createdAgreements) => {
          console.log(`Created ${createdAgreements.length} guarantor agreement(s) for tenancy ${id}`);

          // Send emails to guarantors
          if (createdAgreements.length > 0) {
            await sendGuarantorAgreementEmails(createdAgreements, id, agencyId);
            console.log(`Sent ${createdAgreements.length} guarantor email(s) for tenancy ${id}`);
          }
        })
        .catch(error => {
          console.error('Error creating guarantor agreements:', error);
        });
    } catch (error) {
      console.error('Error in approval process:', error);
      // Don't fail the entire request, but log the error
    }
  }

  // Defense-in-depth: explicit agency_id filtering
  const updatedTenancyResult = await db.query(`
    SELECT t.*, p.address_line1 as property_address
    FROM tenancies t
    LEFT JOIN properties p ON t.property_id = p.id
    WHERE t.id = $1 AND t.agency_id = $2
  `, [id, agencyId], agencyId);

  res.json({ tenancy: updatedTenancyResult.rows[0] });
}, 'update tenancy');

/**
 * Delete tenancy
 * DELETE /api/tenancies/:id
 */
exports.deleteTenancy = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Defense-in-depth: explicit agency_id filtering
  const tenancyResult = await db.query('SELECT id FROM tenancies WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);
  if (tenancyResult.rows.length === 0) {
    return res.status(404).json({ error: 'Tenancy not found' });
  }

  // Get application IDs to revert their status
  // Defense-in-depth: explicit agency_id filtering
  const applicationIdsResult = await db.query(`
    SELECT application_id FROM tenancy_members WHERE tenancy_id = $1 AND agency_id = $2
  `, [id, agencyId], agencyId);
  const applicationIds = applicationIdsResult.rows;

  // Use transaction for deletion
  await db.transaction(async (client) => {
    // Revert application statuses back to approved (so they can be used again without re-approval)
    for (const { application_id } of applicationIds) {
      if (application_id) {
        await client.query('UPDATE applications SET status = $1 WHERE id = $2', ['approved', application_id]);
      }
    }

    // Delete related signed documents (uses reference_id with document_type, verified via tenancy agency)
    await client.query("DELETE FROM signed_documents WHERE document_type = 'tenancy_agreement' AND reference_id = $1 AND reference_id IN (SELECT id FROM tenancies WHERE agency_id = $2)", [id, agencyId]);

    // payment_schedules, payments, and guarantor_agreements have CASCADE delete - handled automatically

    // Delete tenancy (cascade will delete tenancy_members) - defense-in-depth: explicit agency_id
    await client.query('DELETE FROM tenancies WHERE id = $1 AND agency_id = $2', [id, agencyId]);
  }, agencyId);

  res.json({ message: 'Tenancy deleted successfully' });
}, 'delete tenancy');
