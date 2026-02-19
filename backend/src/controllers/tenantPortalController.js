const db = require('../db');
const { generateAgreement } = require('../services/agreementService');
const { validatePaymentOption } = require('../validators/tenancyValidator');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get pending agreements for current user (tenant)
 * GET /api/tenancies/my-pending-agreements
 */
exports.getPendingAgreements = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const userId = req.user.id;

  // Find all tenancy members for this user where tenancy is 'awaiting_signatures' and not yet signed
  // Defense-in-depth: explicit agency_id filtering
  const pendingAgreementsResult = await db.query(`
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
      AND tm.agency_id = $2
  `, [userId, agencyId], agencyId);

  res.json({
    count: pendingAgreementsResult.rows.length,
    agreements: pendingAgreementsResult.rows
  });
}, 'fetch pending agreements');

/**
 * Get all tenancies for current user (tenant portal) - supports multiple tenancies (active + expired)
 * GET /api/tenancies/my-tenancy
 */
exports.getMyActiveTenancy = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const userId = req.user.id;
  const selectedTenancyId = req.query.tenancyId ? parseInt(req.query.tenancyId) : null;

  // Find ALL tenancies for this user (active + expired)
  // Support both regular tenancies (via application) and migration tenancies (via tm.user_id)
  // Defense-in-depth: explicit agency_id filtering
  const allMyTenanciesResult = await db.query(`
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
    WHERE (tm.user_id = $1 OR a.user_id = $1) AND t.status IN ('active', 'expired')
      AND tm.agency_id = $2
    ORDER BY
      status_order,
      t.start_date DESC
  `, [userId, agencyId], agencyId);
  const allMyTenancies = allMyTenanciesResult.rows;

  if (allMyTenancies.length === 0) {
    return res.status(404).json({ error: 'No tenancies found not found' });
  }

  // Determine which tenancy to show full details for
  let targetTenancyId;
  if (selectedTenancyId) {
    // Verify user has access to this tenancy
    const hasAccess = allMyTenancies.some(t => t.id === selectedTenancyId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this tenancy' });
    }
    targetTenancyId = selectedTenancyId;
  } else {
    // Default to first (most recent active, or most recent expired)
    targetTenancyId = allMyTenancies[0].id;
  }

  // Get the member record for this specific tenancy
  // Defense-in-depth: explicit agency_id filtering
  const myMemberResult = await db.query(`
    SELECT tm.*, t.id as tenancy_id, t.status as tenancy_status
    FROM tenancy_members tm
    LEFT JOIN applications a ON tm.application_id = a.id
    INNER JOIN tenancies t ON tm.tenancy_id = t.id
    WHERE (tm.user_id = $1 OR a.user_id = $1) AND t.id = $2 AND tm.agency_id = $3
  `, [userId, targetTenancyId, agencyId], agencyId);
  const myMember = myMemberResult.rows[0];

  // Get full tenancy details
  // Defense-in-depth: explicit agency_id filtering
  const tenancyResult = await db.query(`
    SELECT t.*, p.address_line1 as property_address, p.location,
      l.name as landlord_name, l.email as landlord_email, l.phone as landlord_phone
    FROM tenancies t
    LEFT JOIN properties p ON t.property_id = p.id
    LEFT JOIN landlords l ON p.landlord_id = l.id
    WHERE t.id = $1 AND t.agency_id = $2
  `, [targetTenancyId, agencyId], agencyId);
  const tenancy = tenancyResult.rows[0];

  // Get all tenancy members with details
  // Defense-in-depth: explicit agency_id filtering
  const membersResult = await db.query(`
    SELECT tm.*,
      COALESCE(tm.user_id, a.user_id) as user_id,
      COALESCE(tm.first_name, u.first_name) as first_name,
      COALESCE(tm.surname, u.last_name) as last_name,
      u.email, u.phone,
      b.bedroom_name
    FROM tenancy_members tm
    LEFT JOIN applications a ON tm.application_id = a.id
    LEFT JOIN users u ON COALESCE(tm.user_id, a.user_id) = u.id
    LEFT JOIN bedrooms b ON tm.bedroom_id = b.id
    WHERE tm.tenancy_id = $1 AND tm.agency_id = $2
    ORDER BY tm.id
  `, [targetTenancyId, agencyId], agencyId);

  // Convert PostgreSQL booleans
  const convertedMembers = membersResult.rows.map(member => ({
    ...member,
    is_signed: Boolean(member.is_signed)
  }));

  // Get property certificates for this tenancy's property
  // Defense-in-depth: explicit agency_id filtering
  const propertyCertificatesResult = await db.query(`
    SELECT
      c.*,
      ct.name as type_name,
      ct.display_name as type_display_name,
      ct.icon as type_icon
    FROM certificates c
    JOIN certificate_types ct ON c.certificate_type_id = ct.id
    WHERE c.entity_type = 'property' AND c.entity_id = $1 AND c.agency_id = $2
    ORDER BY ct.display_order ASC, ct.display_name ASC
  `, [tenancy.property_id, agencyId], agencyId);

  // Get count of unpaid payments across all tenancies for this user
  // Defense-in-depth: explicit agency_id filtering
  const unpaidPaymentsResult = await db.query(`
    SELECT
      COUNT(*) as count,
      SUM(ps.amount_due - COALESCE(paid.total_paid, 0)) as total_outstanding
    FROM payment_schedules ps
    INNER JOIN tenancy_members tm ON ps.tenancy_member_id = tm.id
    LEFT JOIN applications a ON tm.application_id = a.id
    LEFT JOIN (
      SELECT payment_schedule_id, SUM(amount) as total_paid
      FROM payments
      WHERE agency_id = $2
      GROUP BY payment_schedule_id
    ) paid ON paid.payment_schedule_id = ps.id
    WHERE (tm.user_id = $1 OR a.user_id = $1) AND ps.status != 'paid' AND ps.agency_id = $2
  `, [userId, agencyId], agencyId);
  const unpaidPayments = unpaidPaymentsResult.rows[0];

  const hasActiveTenancy = allMyTenancies.some(t => t.status === 'active');

  res.json({
    hasTenancies: true,
    hasActiveTenancy,
    allTenancies: allMyTenancies,
    selectedTenancyId: targetTenancyId,
    tenancy,
    myMember: {
      ...myMember,
      is_signed: Boolean(myMember.is_signed)
    },
    members: convertedMembers,
    propertyCertificates: propertyCertificatesResult.rows,
    unpaidPaymentsCount: parseInt(unpaidPayments.count) || 0,
    totalOutstanding: parseFloat(unpaidPayments.total_outstanding) || 0
  });
}, 'fetch tenancies');

/**
 * Get agreement for tenant to sign
 * GET /api/tenancies/:tenancyId/members/:memberId/sign
 */
exports.getTenantAgreement = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const userId = req.user.id;
  const { tenancyId, memberId } = req.params;

  // Verify this member belongs to the user
  // Defense-in-depth: explicit agency_id filtering
  const memberResult = await db.query(`
    SELECT tm.*, tm.surname as last_name, t.status as tenancy_status, a.status as application_status
    FROM tenancy_members tm
    INNER JOIN tenancies t ON tm.tenancy_id = t.id
    LEFT JOIN applications a ON tm.application_id = a.id
    WHERE tm.id = $1 AND tm.tenancy_id = $2 AND tm.user_id = $3 AND tm.agency_id = $4
  `, [memberId, tenancyId, userId, agencyId], agencyId);
  const member = memberResult.rows[0];

  if (!member) {
    return res.status(404).json({ error: 'Agreement or you do not have permission to view it not found' });
  }

  // Don't allow viewing if status is 'pending'
  if (member.tenancy_status === 'pending') {
    return res.status(403).json({ error: 'This agreement is not yet available for signing. It must be checked first.' });
  }

  // If member has an application, it must be approved before they can sign
  // - 'pending': User hasn't filled in application yet
  // - 'awaiting_guarantor': Waiting for guarantor
  // - 'submitted': User completed form, awaiting admin approval
  // - 'approved': Admin approved - CAN SIGN
  // - 'converted_to_tenancy': Normal flow where tenancy created from app - CAN SIGN
  if (member.application_id && member.application_status) {
    if (member.application_status === 'pending' || member.application_status === 'awaiting_guarantor') {
      return res.status(403).json({ error: 'You must complete your application before you can sign the tenancy agreement.' });
    }
    if (member.application_status === 'submitted') {
      return res.status(403).json({ error: 'Your application is awaiting admin approval. You will be able to sign once it has been reviewed.' });
    }
    // 'approved' and 'converted_to_tenancy' are allowed to proceed
  }

  // Generate the agreement
  const agreement = await generateAgreement(parseInt(tenancyId), parseInt(memberId), agencyId);

  res.json({
    agreement,
    member: {
      id: member.id,
      is_signed: member.is_signed,
      signed_at: member.signed_at,
      signature_data: member.signature_data,
      first_name: member.first_name,
      last_name: member.last_name,
      payment_option: member.payment_option
    }
  });
}, 'fetch agreement');

/**
 * Get comprehensive tenant status - consolidates all pending actions and tenancy info
 * Used by /tenancy page to determine what to show/where to redirect
 * GET /api/tenancies/my-status
 */
exports.getMyStatus = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const userId = req.user.id;

  // 1. Check for pending applications (highest priority)
  // Defense-in-depth: explicit agency_id filtering
  const pendingApplicationResult = await db.query(`
    SELECT
      a.id,
      a.status,
      a.application_type
    FROM applications a
    WHERE a.user_id = $1 AND a.status IN ('pending', 'awaiting_guarantor') AND a.agency_id = $2
    ORDER BY a.created_at DESC
    LIMIT 1
  `, [userId, agencyId], agencyId);
  const pendingApplication = pendingApplicationResult.rows[0];

  // 2. Check for pending tenancy agreements (application must be complete)
  // Defense-in-depth: explicit agency_id filtering
  const pendingAgreementResult = await db.query(`
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
      AND tm.agency_id = $2
    ORDER BY t.start_date ASC
    LIMIT 1
  `, [userId, agencyId], agencyId);
  const pendingAgreement = pendingAgreementResult.rows[0];

  // 5. Check for active tenancies
  // Defense-in-depth: explicit agency_id filtering
  const activeTenanciesResult = await db.query(`
    SELECT DISTINCT
      t.id,
      t.status,
      t.start_date,
      t.end_date,
      t.is_rolling_monthly,
      p.address_line1 as property_address,
      p.location,
      CASE t.status WHEN 'active' THEN 0 ELSE 1 END as status_order
    FROM tenancy_members tm
    LEFT JOIN applications a ON tm.application_id = a.id
    INNER JOIN tenancies t ON tm.tenancy_id = t.id
    LEFT JOIN properties p ON t.property_id = p.id
    WHERE (tm.user_id = $1 OR a.user_id = $1)
      AND t.status IN ('active', 'expired')
      AND tm.agency_id = $2
    ORDER BY
      status_order,
      t.start_date DESC
  `, [userId, agencyId], agencyId);
  const activeTenancies = activeTenanciesResult.rows;

  // Determine redirect URL based on priority
  let redirectTo = null;
  let priority = null;

  if (pendingApplication) {
    redirectTo = `/${req.agency?.slug || ''}/applications/${pendingApplication.id}`;
    priority = 'pending_application';
  } else if (pendingAgreement) {
    redirectTo = `/${req.agency?.slug || ''}/agreements/sign/${pendingAgreement.tenancy_id}/${pendingAgreement.member_id}`;
    priority = 'pending_agreement';
  }
  // If none of the above, user stays on /tenancy page

  res.json({
    // Redirect info
    redirectTo,
    priority,
    // Detailed status for display
    pendingApplication: pendingApplication ? {
      id: pendingApplication.id,
      status: pendingApplication.status,
      applicationType: pendingApplication.application_type
    } : null,
    pendingAgreement: pendingAgreement ? {
      tenancyId: pendingAgreement.tenancy_id,
      memberId: pendingAgreement.member_id,
      startDate: pendingAgreement.start_date,
      endDate: pendingAgreement.end_date,
      propertyAddress: pendingAgreement.address_line1,
      location: pendingAgreement.location
    } : null,
    // Active tenancies
    hasTenancies: activeTenancies.length > 0,
    tenancyCount: activeTenancies.length,
    activeTenancies: activeTenancies.map(t => ({
      id: t.id,
      status: t.status,
      startDate: t.start_date,
      endDate: t.end_date,
      isRollingMonthly: !!t.is_rolling_monthly,
      propertyAddress: t.property_address,
      location: t.location
    }))
  });
}, 'fetch tenant status');
