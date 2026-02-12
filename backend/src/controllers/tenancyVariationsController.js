const db = require('../db');
const { generatePaymentSchedulesForTenancy } = require('../services/paymentService');
const { queueEmail } = require('../services/emailService');
const { createEmailTemplate, createButton, createInfoBox, escapeHtml } = require('../utils/emailTemplates');
const { getTenancyMembersWithDetails, getTenancyWithProperty } = require('../helpers/queries');
const {
  checkBedroomConflicts,
  formatBedroomConflictError,
  validateDates,
  validateNoDuplicateBedrooms,
  validateTenancyType,
  validatePropertyExists,
  validateMigrationMember,
  validateNoDuplicateUsers
} = require('../validators/tenancyValidator');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Create a rolling tenancy from an existing tenancy
 * This copies selected members to a new rolling tenancy
 * POST /api/tenancies/:id/create-rolling
 */
exports.createRollingTenancyFromExisting = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id: sourceTenancyId } = req.params;
  const { start_date, end_date, members } = req.body;

  // Validate required fields
  if (!start_date) {
    return res.status(400).json({ error: 'Start date is required' });
  }

  if (!members || !Array.isArray(members) || members.length === 0) {
    return res.status(400).json({ error: 'At least one tenant must be selected' });
  }

  // Get source tenancy
  // Defense-in-depth: explicit agency_id filtering
  const sourceTenancyResult = await db.query(`
    SELECT * FROM tenancies WHERE id = $1 AND agency_id = $2
  `, [sourceTenancyId, agencyId], agencyId);
  const sourceTenancy = sourceTenancyResult.rows[0];

  if (!sourceTenancy) {
    return res.status(404).json({ error: 'Source tenancy not found' });
  }

  // Validate that all member IDs belong to the source tenancy
  // Defense-in-depth: explicit agency_id filtering
  const sourceMemberIdsResult = await db.query(`
    SELECT id FROM tenancy_members WHERE tenancy_id = $1 AND agency_id = $2
  `, [sourceTenancyId, agencyId], agencyId);
  const sourceMemberIds = sourceMemberIdsResult.rows.map(m => m.id);

  for (const member of members) {
    if (!sourceMemberIds.includes(member.member_id)) {
      return res.status(400).json({ error: `Member ID ${member.member_id} does not belong to this tenancy` });
    }
  }

  // Check for bedroom conflicts with existing tenancies
  // Get bedroom assignments with member names for conflict messages
  const bedroomAssignments = [];
  for (const m of members) {
    // Get the source member data to get name and resolve bedroom_id
    // Defense-in-depth: explicit agency_id filtering
    const sourceMemberResult = await db.query(`
      SELECT first_name, surname, bedroom_id FROM tenancy_members WHERE id = $1 AND agency_id = $2
    `, [m.member_id, agencyId], agencyId);
    const sourceMember = sourceMemberResult.rows[0];

    // Use provided bedroom_id if set, otherwise fall back to source member's bedroom
    const effectiveBedroomId = m.bedroom_id !== undefined ? m.bedroom_id : (sourceMember?.bedroom_id || null);

    bedroomAssignments.push({
      bedroom_id: effectiveBedroomId,
      member_name: sourceMember ? `${sourceMember.first_name} ${sourceMember.surname}` : 'Unknown'
    });
  }

  const bedroomConflicts = checkBedroomConflicts(bedroomAssignments, start_date, end_date || null, null);
  if (bedroomConflicts.length > 0) {
    const conflictError = formatBedroomConflictError(bedroomConflicts);
    return res.status(409).json(conflictError);
  }

  // Create the new rolling tenancy and members in a transaction
  const result = await db.transaction(async (client) => {
    // Calculate total rent from members (use override if provided, otherwise fetch from source)
    let totalRent = 0;
    for (const member of members) {
      if (member.rent_pppw !== undefined) {
        totalRent += parseFloat(member.rent_pppw) || 0;
      } else {
        const srcMember = await client.query('SELECT rent_pppw FROM tenancy_members WHERE id = $1', [member.member_id]);
        totalRent += parseFloat(srcMember.rows[0]?.rent_pppw) || 0;
      }
    }

    // Create new tenancy
    const newTenancyResult = await client.query(`
      INSERT INTO tenancies (
        agency_id,
        property_id,
        tenancy_type,
        start_date,
        end_date,
        rent_amount,
        status,
        is_rolling_monthly,
        auto_generate_payments
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', true, true)
      RETURNING *
    `, [
      agencyId,
      sourceTenancy.property_id,
      sourceTenancy.tenancy_type,
      start_date,
      end_date || null,
      totalRent
    ]);

    const newTenancyId = newTenancyResult.rows[0].id;

    // Copy selected members to new tenancy
    const newMemberIds = [];
    for (const member of members) {
      const insertResult = await client.query(`
        INSERT INTO tenancy_members (
          agency_id,
          tenancy_id,
          application_id,
          user_id,
          bedroom_id,
          rent_pppw,
          deposit_amount,
          first_name,
          surname,
          title,
          current_address,
          application_type,
          guarantor_required,
          guarantor_name,
          guarantor_dob,
          guarantor_email,
          guarantor_phone,
          guarantor_address,
          guarantor_relationship,
          guarantor_id_type
        )
        SELECT
          $1,
          $2,
          application_id,
          user_id,
          COALESCE($3, bedroom_id),
          COALESCE($4, rent_pppw),
          COALESCE($5, deposit_amount),
          first_name,
          surname,
          title,
          current_address,
          application_type,
          guarantor_required,
          guarantor_name,
          guarantor_dob,
          guarantor_email,
          guarantor_phone,
          guarantor_address,
          guarantor_relationship,
          guarantor_id_type
        FROM tenancy_members
        WHERE id = $6
        RETURNING id
      `, [
        agencyId,
        newTenancyId,
        member.bedroom_id !== undefined ? member.bedroom_id : null,
        member.rent_pppw !== undefined ? member.rent_pppw : null,
        member.deposit_amount !== undefined ? member.deposit_amount : null,
        member.member_id
      ]);
      newMemberIds.push(insertResult.rows[0].id);
    }

    return { newTenancyId, newMemberIds };
  }, agencyId);

  const { newTenancyId, newMemberIds } = result;

  // Fetch the newly created tenancy with full details
  const newTenancy = await getTenancyWithProperty(newTenancyId, agencyId);
  const newMembers = await getTenancyMembersWithDetails(newTenancyId, agencyId);

  res.status(201).json({
    message: 'Rolling tenancy created successfully',
    tenancy: {
      ...newTenancy,
      members: newMembers
    }
  });
}, 'create rolling tenancy');

/**
 * Create a migration tenancy (Admin only)
 * Used for migrating existing tenancies where paperwork was done manually.
 * - Does NOT require applications
 * - Does NOT require signature workflow
 * - Starts directly as 'active' status
 * - Payment schedules are generated immediately
 * POST /api/tenancies/migration
 */
exports.createMigrationTenancy = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const {
    property_id,
    tenancy_type,
    start_date,
    end_date,
    is_rolling_monthly = false,
    auto_generate_payments = true,
    send_portal_email = false,
    members // Array of { user_id, first_name, surname, bedroom_id, rent_pppw, deposit_amount }
  } = req.body;

  // Validation
  if (!property_id || !tenancy_type || !start_date || !members || members.length === 0) {
    return res.status(400).json({ error: 'Missing required fields: property_id, tenancy_type, start_date, and members are required' });
  }

  // Rolling monthly tenancies must NOT have an end_date
  if (is_rolling_monthly && end_date) {
    return res.status(400).json({ error: 'Rolling monthly tenancies cannot have an end date' });
  }

  // Non-rolling tenancies MUST have an end_date
  if (!is_rolling_monthly && !end_date) {
    return res.status(400).json({ error: 'End date is required for fixed-term tenancies' });
  }

  // Validate tenancy type using validator
  const typeValidation = validateTenancyType(tenancy_type);
  if (!typeValidation.valid) {
    return res.status(400).json({ error: typeValidation.error });
  }

  if (tenancy_type === 'room_only' && members.length !== 1) {
    return res.status(400).json({ error: 'Room only tenancy must have exactly 1 member' });
  }

  // Validate property exists using validator
  const propertyValidation = await validatePropertyExists(property_id, agencyId);
  if (!propertyValidation.valid) {
    return res.status(404).json({ error: propertyValidation.error + ' not found' });
  }

  // Validate dates using validator
  const dateValidation = validateDates(start_date, end_date, is_rolling_monthly);
  if (!dateValidation.valid) {
    return res.status(400).json({ error: dateValidation.error });
  }

  // Validate all members have required fields using validator
  for (let i = 0; i < members.length; i++) {
    const memberValidation = validateMigrationMember(members[i], i);
    if (!memberValidation.valid) {
      return res.status(400).json({ error: memberValidation.error });
    }
  }

  // Validate no duplicate user IDs using validator
  const userValidation = validateNoDuplicateUsers(members);
  if (!userValidation.valid) {
    return res.status(400).json({ error: userValidation.error });
  }

  // Validate no duplicate bedroom assignments using validator
  const bedroomValidation = validateNoDuplicateBedrooms(members);
  if (!bedroomValidation.valid) {
    return res.status(400).json({ error: bedroomValidation.error });
  }

  // Check for bedroom conflicts with existing tenancies
  const bedroomAssignments = members.map(m => ({
    bedroom_id: m.bedroom_id,
    member_name: `${m.first_name} ${m.surname}`
  }));

  const bedroomConflicts = checkBedroomConflicts(bedroomAssignments, start_date, end_date || null, null);
  if (bedroomConflicts.length > 0) {
    const conflictError = formatBedroomConflictError(bedroomConflicts);
    return res.status(409).json(conflictError);
  }

  // Create tenancy in transaction
  const tenancyId = await db.transaction(async (client) => {
    // Calculate total rent from members
    const totalRent = members.reduce((sum, m) => sum + (parseFloat(m.rent_pppw) || 0), 0);

    // Insert tenancy with 'active' status
    const tenancyResult = await client.query(`
      INSERT INTO tenancies (agency_id, property_id, tenancy_type, start_date, end_date, rent_amount, status, is_rolling_monthly, auto_generate_payments, is_migration)
      VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, true)
      RETURNING *
    `, [
      agencyId,
      property_id,
      tenancy_type,
      start_date,
      end_date || null,
      totalRent,
      is_rolling_monthly,
      auto_generate_payments
    ]);

    const newTenancyId = tenancyResult.rows[0].id;

    // Insert tenancy members (no application_id, is_signed = true since paperwork was done manually)
    for (const member of members) {
      // Rolling monthly defaults to monthly payment option
      const paymentOption = is_rolling_monthly ? 'monthly' : (member.payment_option || 'monthly');

      await client.query(`
        INSERT INTO tenancy_members (
          agency_id, tenancy_id, user_id, bedroom_id, rent_pppw, deposit_amount,
          first_name, surname, is_signed, signed_at, payment_option
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, CURRENT_TIMESTAMP, $9)
      `, [
        agencyId,
        newTenancyId,
        member.user_id,
        member.bedroom_id || null,
        member.rent_pppw,
        member.deposit_amount,
        member.first_name,
        member.surname,
        paymentOption
      ]);
    }

    return newTenancyId;
  }, agencyId);

  // Generate payment schedules since tenancy is already active
  try {
    const paymentResult = await generatePaymentSchedulesForTenancy(db, tenancyId, agencyId);
    console.log(`Generated payment schedules for migration tenancy ${tenancyId}:`, paymentResult);
  } catch (error) {
    console.error('Error generating payment schedules for migration tenancy:', error);
    // Don't fail the request, but log the error
  }

  // Fetch the created tenancy with members
  // Defense-in-depth: explicit agency_id filtering
  const tenancyResult = await db.query(`
    SELECT t.*, p.address_line1 as property_address, p.location
    FROM tenancies t
    LEFT JOIN properties p ON t.property_id = p.id
    WHERE t.id = $1 AND t.agency_id = $2
  `, [tenancyId, agencyId], agencyId);
  const tenancy = tenancyResult.rows[0];

  // Defense-in-depth: explicit agency_id filtering
  const tenancyMembersResult = await db.query(`
    SELECT tm.*,
      u.email, u.phone, u.setup_token, u.setup_token_expires,
      b.bedroom_name
    FROM tenancy_members tm
    LEFT JOIN users u ON tm.user_id = u.id
    LEFT JOIN bedrooms b ON tm.bedroom_id = b.id
    WHERE tm.tenancy_id = $1 AND tm.agency_id = $2
  `, [tenancyId, agencyId], agencyId);
  const tenancyMembers = tenancyMembersResult.rows;

  // Send portal access emails if requested
  let emailsSent = 0;
  let setupEmailsSent = 0;
  if (send_portal_email) {
    const siteUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const propertyAddress = tenancy.property_address
      ? `${tenancy.property_address}${tenancy.location ? ', ' + tenancy.location : ''}`
      : 'your property';

    for (const member of tenancyMembers) {
      if (!member.email) {
        console.log(`Skipping email for ${member.first_name} ${member.surname} - no email address`);
        continue;
      }

      try {
        // Check if user needs to set up their password
        const hasValidSetupToken = member.setup_token &&
          member.setup_token_expires &&
          new Date(member.setup_token_expires) > new Date();

        if (hasValidSetupToken) {
          // User hasn't set up their password yet - send setup email with tenancy context
          const setupUrl = `${siteUrl}/setup-password/${member.setup_token}`;

          const emailContent = createEmailTemplate(
            'Your Tenancy is Ready',
            `
              <p>Dear ${member.first_name},</p>
              <p>Great news! Your tenancy at <strong>${propertyAddress}</strong> has been set up in our tenant management system.</p>
              <p>To access your personal tenant portal, you first need to set up your account password.</p>
              ${createInfoBox(`
                <p style="margin: 5px 0;"><strong>Your Email Address:</strong> ${member.email}</p>
                <p style="margin: 5px 0;">You'll use this to log in after setting your password.</p>
              `, 'info')}
              <div style="text-align: center;">
                ${createButton(setupUrl, 'Set Up Your Password')}
              </div>
              <p style="font-size: 14px; color: #666;">This link will expire in 7 days. If it expires, please contact us for a new link.</p>
              <p>Once you've set up your password, you'll be able to:</p>
              <ul>
                <li>View your tenancy details and payment schedule</li>
                <li>See your rent payments and balances</li>
                <li>Submit and track maintenance requests</li>
                <li>Access important documents</li>
              </ul>
              <p>If you have any questions, please don't hesitate to contact us.</p>
            `
          );

          await queueEmail({
            to_email: member.email,
            to_name: `${member.first_name} ${member.surname}`,
            subject: `Your Tenancy - ${propertyAddress}`,
            html_body: emailContent,
            text_body: `Dear ${member.first_name},\n\nGreat news! Your tenancy at ${propertyAddress} has been set up in our tenant management system.\n\nTo access your personal tenant portal, you first need to set up your account password.\n\nYour email address: ${member.email}\n\nSet up your password here: ${setupUrl}\n\nThis link will expire in 7 days. If it expires, please contact us for a new link.\n\nOnce you've set up your password, you'll be able to:\n- View your tenancy details and payment schedule\n- See your rent payments and balances\n- Submit and track maintenance requests\n- Access important documents\n\nIf you have any questions, please don't hesitate to contact us.`,
            priority: 1
          }, agencyId);
          setupEmailsSent++;
        } else {
          // User has set up their account - send portal access email
          const emailContent = createEmailTemplate(
            'Your Tenancy is Ready',
            `
              <p>Dear ${member.first_name},</p>
              <p>Great news! Your tenancy at <strong>${propertyAddress}</strong> has been set up in our tenant management system.</p>
              <p>You now have access to your personal tenant portal where you can:</p>
              <ul>
                <li>View your tenancy details and payment schedule</li>
                <li>See your rent payments and balances</li>
                <li>Submit and track maintenance requests</li>
                <li>Access important documents</li>
              </ul>
              ${createButton(`${siteUrl}/tenancy`, 'Go to Tenant Portal')}
              <p>If you have any questions, please don't hesitate to contact us.</p>
            `
          );

          await queueEmail({
            to_email: member.email,
            to_name: `${member.first_name} ${member.surname}`,
            subject: `Your Tenancy - ${propertyAddress}`,
            html_body: emailContent,
            text_body: `Dear ${member.first_name},\n\nGreat news! Your tenancy at ${propertyAddress} has been set up in our tenant management system.\n\nYou now have access to your personal tenant portal where you can:\n- View your tenancy details and payment schedule\n- See your rent payments and balances\n- Submit and track maintenance requests\n- Access important documents\n\nVisit your portal: ${siteUrl}/tenancy\n\nIf you have any questions, please don't hesitate to contact us.`,
            priority: 2
          }, agencyId);
          emailsSent++;
        }
      } catch (emailErr) {
        console.error(`Failed to queue email for ${member.email}:`, emailErr.message);
      }
    }
  }

  // Remove sensitive fields from response
  const cleanedMembers = tenancyMembers.map(({ setup_token, setup_token_expires, ...member }) => member);

  // Build email summary message
  const emailParts = [];
  if (emailsSent > 0) emailParts.push(`${emailsSent} portal access email(s)`);
  if (setupEmailsSent > 0) emailParts.push(`${setupEmailsSent} account setup email(s)`);
  const emailMessage = emailParts.length > 0 ? ` ${emailParts.join(' and ')} sent.` : '';

  res.status(201).json({
    message: `Migration tenancy created successfully. Tenancy is now active.${emailMessage}`,
    tenancy: {
      ...tenancy,
      members: cleanedMembers
    },
    emailsSent,
    setupEmailsSent
  });
}, 'create migration tenancy');
