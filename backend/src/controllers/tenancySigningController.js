const db = require('../db');
const { generateAgreement, generateAgreementHTML, saveSignedDocument } = require('../services/agreementService');
const { generatePaymentSchedulesForTenancy } = require('../services/paymentService');
const { createGuarantorAgreementForMember, sendGuarantorAgreementEmails, checkTenancySigningComplete } = require('../services/guarantorService');
const { validatePaymentOption, validateSignature } = require('../validators/tenancyValidator');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Generate tenancy agreement (legacy - generates for first tenant)
 * GET /api/tenancies/:id/agreement
 */
exports.generateTenancyAgreement = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Check if tenancy exists
  // Defense-in-depth: explicit agency_id filtering
  const tenancyResult = await db.query('SELECT id FROM tenancies WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);
  if (tenancyResult.rows.length === 0) {
    return res.status(404).json({ error: 'Tenancy not found' });
  }

  // Get first member and generate agreement for them
  // Defense-in-depth: explicit agency_id filtering
  const firstMemberResult = await db.query(`
    SELECT id FROM tenancy_members WHERE tenancy_id = $1 AND agency_id = $2 ORDER BY id LIMIT 1
  `, [id, agencyId], agencyId);
  const firstMember = firstMemberResult.rows[0];

  if (!firstMember) {
    return res.status(404).json({ error: 'Tenants for this tenancy not found' });
  }

  const agreement = await generateAgreement(id, firstMember.id, agencyId);

  res.json({ agreement });
}, 'generate tenancy agreement');

/**
 * Generate tenancy agreement for specific member
 * GET /api/tenancies/:id/members/:memberId/agreement
 */
exports.generateTenancyMemberAgreement = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id, memberId } = req.params;

  // Check if tenancy exists
  // Defense-in-depth: explicit agency_id filtering
  const tenancyResult = await db.query('SELECT id FROM tenancies WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);
  if (tenancyResult.rows.length === 0) {
    return res.status(404).json({ error: 'Tenancy not found' });
  }

  // Check if member exists and belongs to this tenancy
  // Defense-in-depth: explicit agency_id filtering
  const memberResult = await db.query(`
    SELECT id FROM tenancy_members WHERE id = $1 AND tenancy_id = $2 AND agency_id = $3
  `, [memberId, id, agencyId], agencyId);

  if (memberResult.rows.length === 0) {
    return res.status(404).json({ error: 'Tenant in this tenancy not found' });
  }

  const agreement = await generateAgreement(parseInt(id), parseInt(memberId), agencyId);

  res.json({ agreement });
}, 'generate tenancy agreement');

/**
 * Sign agreement
 * POST /api/tenancies/:tenancyId/members/:memberId/sign
 */
exports.signAgreement = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const userId = req.user.id;
  const { tenancyId, memberId } = req.params;
  const { signature_data, payment_option } = req.body;

  if (!signature_data) {
    return res.status(400).json({ error: 'Signature data is required' });
  }

  if (!payment_option) {
    return res.status(400).json({ error: 'Payment option is required' });
  }

  // Validate payment option using validator
  const paymentValidation = validatePaymentOption(payment_option);
  if (!paymentValidation.valid) {
    return res.status(400).json({ error: paymentValidation.error });
  }

  // Verify this member belongs to the user and get tenancy info
  // Defense-in-depth: explicit agency_id filtering
  const memberResult = await db.query(`
    SELECT tm.*, tm.surname as last_name, t.status as tenancy_status
    FROM tenancy_members tm
    INNER JOIN tenancies t ON tm.tenancy_id = t.id
    WHERE tm.id = $1 AND tm.tenancy_id = $2 AND tm.user_id = $3 AND tm.agency_id = $4
  `, [memberId, tenancyId, userId, agencyId], agencyId);
  const member = memberResult.rows[0];

  if (!member) {
    return res.status(404).json({ error: 'Agreement or you do not have permission to sign it not found' });
  }

  // Only allow signing if tenancy status is 'awaiting_signatures'
  if (member.tenancy_status !== 'awaiting_signatures') {
    return res.status(403).json({ error: 'This agreement cannot be signed at this time' });
  }

  // Check if already signed
  if (member.is_signed) {
    return res.status(400).json({ error: 'This agreement has already been signed' });
  }

  // Validate signature matches member's name using validator
  const signatureValidation = validateSignature(signature_data, member.first_name, member.last_name);
  if (!signatureValidation.valid) {
    return res.status(400).json({ error: signatureValidation.error });
  }

  // Generate agreement HTML snapshot before signing
  // This preserves the exact agreement at signing time
  const agreementHTML = await generateAgreementHTML(tenancyId, memberId, signature_data, payment_option, agencyId);

  // Use transaction for signing
  await db.transaction(async (client) => {
    // Update member signature and store agreement HTML (keeping for backwards compatibility)
    await client.query(`
      UPDATE tenancy_members
      SET signature_data = $1,
          signed_at = CURRENT_TIMESTAMP,
          is_signed = true,
          signed_agreement_html = $2,
          payment_option = $3
      WHERE id = $4
    `, [signature_data, agreementHTML, payment_option, memberId]);

    // Also save to centralized signed_documents table with audit trail
    await saveSignedDocument({
      documentType: 'tenancy_agreement',
      referenceId: parseInt(tenancyId),
      userId: parseInt(userId),
      memberId: parseInt(memberId),
      signatureData: signature_data,
      signedHtml: agreementHTML,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      agencyId
    }, client, agencyId);
  }, agencyId);

  // After transaction: create guarantor agreement for this member if needed, then check overall completion
  try {
    const agreement = await createGuarantorAgreementForMember(tenancyId, memberId, agencyId);
    if (agreement) {
      await sendGuarantorAgreementEmails([agreement], tenancyId, agencyId);
      console.log(`Tenant signed: Created and sent guarantor agreement for member ${memberId} in tenancy ${tenancyId}`);
    }

    // Check if all tenants + all guarantors have signed
    const allComplete = await checkTenancySigningComplete(tenancyId, agencyId);
    if (allComplete) {
      await db.query(`
        UPDATE tenancies SET status = 'approval', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND agency_id = $2
      `, [tenancyId, agencyId], agencyId);

      const paymentResult = await generatePaymentSchedulesForTenancy(tenancyId, agencyId);
      console.log(`Auto-approval: All tenants + guarantors signed. Generated payment schedules for tenancy ${tenancyId}:`, paymentResult);

      // Apply holding deposit reductions to first rent schedules
      const heldDeposits = await db.query(
        `SELECT hd.*, tm.id as member_id
         FROM holding_deposits hd
         JOIN tenancy_members tm ON hd.application_id = tm.application_id AND tm.tenancy_id = $1
         WHERE hd.applied_to_tenancy_id = $1 AND hd.agency_id = $2 AND hd.status = 'applied_to_rent'`,
        [tenancyId, agencyId], agencyId
      );
      for (const hd of heldDeposits.rows) {
        const firstRentSchedule = await db.query(
          `SELECT id, amount_due FROM payment_schedules
           WHERE tenancy_id = $1 AND member_id = $2 AND payment_type = 'rent' AND agency_id = $3
           ORDER BY due_date ASC LIMIT 1`,
          [tenancyId, hd.member_id, agencyId], agencyId
        );
        if (firstRentSchedule.rows[0]) {
          const currentAmount = parseFloat(firstRentSchedule.rows[0].amount_due);
          const newAmount = Math.max(0, currentAmount - parseFloat(hd.amount));
          await db.query(
            'UPDATE payment_schedules SET amount_due = $1 WHERE id = $2 AND agency_id = $3',
            [newAmount, firstRentSchedule.rows[0].id, agencyId], agencyId
          );
          console.log(`Holding deposit: Reduced first rent for member ${hd.member_id} by £${hd.amount} (${currentAmount} -> ${newAmount})`);
        }
      }
    }
  } catch (error) {
    console.error('Error in post-signing process:', error);
    // Don't fail the signing response, just log the error
  }

  // Get updated member data
  // Defense-in-depth: explicit agency_id filtering
  const updatedMemberResult = await db.query(`
    SELECT tm.*, t.status as tenancy_status
    FROM tenancy_members tm
    INNER JOIN tenancies t ON tm.tenancy_id = t.id
    WHERE tm.id = $1 AND tm.agency_id = $2
  `, [memberId, agencyId], agencyId);
  const updatedMember = updatedMemberResult.rows[0];

  res.json({
    message: 'Agreement signed successfully',
    member: {
      id: updatedMember.id,
      is_signed: updatedMember.is_signed,
      signed_at: updatedMember.signed_at
    },
    tenancy_status: updatedMember.tenancy_status
  });
}, 'sign agreement');

/**
 * Revert single member signature (Admin only)
 * Useful when wrong payment option was selected and tenant needs to sign again
 * POST /api/tenancies/:id/members/:memberId/revert-signature
 */
exports.revertMemberSignature = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id: tenancyId, memberId } = req.params;

  // Check if member exists
  // Defense-in-depth: explicit agency_id filtering
  const memberResult = await db.query(`
    SELECT tm.*, t.status as tenancy_status
    FROM tenancy_members tm
    INNER JOIN tenancies t ON tm.tenancy_id = t.id
    WHERE tm.id = $1 AND tm.tenancy_id = $2 AND tm.agency_id = $3
  `, [memberId, tenancyId, agencyId], agencyId);
  const member = memberResult.rows[0];

  if (!member) {
    return res.status(404).json({ error: 'Tenant in this tenancy not found' });
  }

  // Check if member has signed
  if (!member.is_signed) {
    return res.status(400).json({ error: 'This tenant has not signed the agreement yet' });
  }

  // Only allow reverting signatures when tenancy is in 'awaiting_signatures' status
  // Once moved to 'approval' or 'active', signatures are locked
  if (member.tenancy_status !== 'awaiting_signatures') {
    return res.status(400).json({ error: `Cannot revert signature after tenancy has moved to '${member.tenancy_status}' status. Signatures can only be reverted before approval.` });
  }

  // Revert signature in a transaction
  await db.transaction(async (client) => {
    // Clear signature data for this member
    // Defense-in-depth: explicit agency_id filtering
    await client.query(`
      UPDATE tenancy_members
      SET is_signed = false,
          signature_data = NULL,
          signed_at = NULL,
          signed_agreement_html = NULL,
          payment_option = NULL
      WHERE id = $1 AND agency_id = $2
    `, [memberId, agencyId]);

    // Delete guarantor agreement for THIS member only
    await client.query(`
      DELETE FROM guarantor_agreements
      WHERE tenancy_member_id = $1 AND agency_id = $2
    `, [memberId, agencyId]);
  }, agencyId);

  res.json({
    message: 'Signature has been reverted. This tenant must sign the agreement again.',
    tenancy_status: 'awaiting_signatures'
  });
}, 'revert signature');

/**
 * Create deposit return schedules for a tenancy
 * POST /api/tenancies/:id/deposit-return-schedules
 */
exports.createDepositReturnSchedules = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Check if tenancy exists and is active
  // Defense-in-depth: explicit agency_id filtering
  const tenancyResult = await db.query(`
    SELECT id, status
    FROM tenancies
    WHERE id = $1 AND agency_id = $2
  `, [id, agencyId], agencyId);
  const tenancy = tenancyResult.rows[0];

  if (!tenancy) {
    return res.status(404).json({ error: 'Tenancy not found' });
  }

  // Only allow deposit return schedules for active tenancies
  if (tenancy.status !== 'active') {
    return res.status(400).json({ error: 'Deposit return schedules can only be created for active tenancies' });
  }

  // Get all members of this tenancy
  // Defense-in-depth: explicit agency_id filtering
  const allMembersResult = await db.query(`
    SELECT id
    FROM tenancy_members
    WHERE tenancy_id = $1 AND agency_id = $2
  `, [id, agencyId], agencyId);
  const allMembers = allMembersResult.rows;

  if (allMembers.length === 0) {
    return res.status(400).json({ error: 'No tenants found in this tenancy' });
  }

  // Accept the return date from the request body
  // NOTE: key_status/key_return_date columns do not exist on tenancy_members table
  const { return_date } = req.body;
  const latestKeyReturnDate = return_date || new Date().toISOString().split('T')[0];

  if (!latestKeyReturnDate) {
    return res.status(400).json({ error: 'return_date is required in the request body' });
  }

  // Import the payment service
  const { createDepositReturnSchedules } = require('../services/paymentService');

  // Create the schedules using the latest key return date
  const result = await createDepositReturnSchedules(db, id, latestKeyReturnDate, agencyId);

  res.json({
    message: `Created ${result.schedulesCreated} deposit return schedule(s)`,
    ...result
  });
}, 'create deposit return schedules');
