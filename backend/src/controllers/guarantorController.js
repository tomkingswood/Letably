const { getGuarantorAgreementByToken, signGuarantorAgreement, checkTenancySigningComplete, generateGuarantorAgreementContent } = require('../services/guarantorService');
const { generatePaymentSchedulesForTenancy } = require('../services/paymentService');
const db = require('../db');
const handleError = require('../utils/handleError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Look up agency_id from a guarantor token (for public endpoints with no auth)
 */
async function getAgencyIdFromToken(token) {
  const result = await db.query(
    'SELECT agency_id FROM guarantor_agreements WHERE guarantor_token = $1',
    [token]
  );
  return result.rows[0]?.agency_id || null;
}

/**
 * Get guarantor agreement by token (public endpoint)
 * This allows guarantors to view the agreement they need to sign
 */
exports.getAgreementByToken = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const agencyId = await getAgencyIdFromToken(token);
  const agreement = await getGuarantorAgreementByToken(token, agencyId);

  if (!agreement) {
    return res.status(404).json({ error: 'Guarantor agreement not found' });
  }

  // Calculate monthly rent from PPPW
  const monthlyRent = agreement.rent_pppw ? ((agreement.rent_pppw * 52) / 12).toFixed(2) : '0.00';

  // Format company address
  const companyAddress = [
    agreement.company_address_line1,
    agreement.company_address_line2,
    agreement.company_city,
    agreement.company_postcode
  ].filter(Boolean).join(', ');

  // Format property address (filter out null/undefined/empty values)
  const propertyFullAddress = [
    agreement.address_line1,
    agreement.address_line2,
    agreement.city,
    agreement.postcode
  ].filter(val => val && val !== 'null').join(', ');

  res.json({
    agreement: {
      id: agreement.id,
      guarantor_name: agreement.guarantor_name,
      guarantor_address: agreement.guarantor_address,
      tenant_name: `${agreement.tenant_first_name} ${agreement.tenant_surname}`,
      tenant_email: agreement.tenant_email,
      tenant_member_id: agreement.tenant_member_id,
      tenant_signed_agreement_html: agreement.tenant_signed_agreement_html,
      property_address: [agreement.address_line1, agreement.city].filter(val => val && val !== 'null').join(', '),
      property_full_address: propertyFullAddress,
      tenancy_start_date: agreement.tenancy_start_date,
      tenancy_end_date: agreement.tenancy_end_date,
      company_name: agreement.company_name,
      company_address: companyAddress,
      monthly_rent: monthlyRent,
      is_signed: Boolean(agreement.is_signed),
      signed_at: agreement.signed_at,
      agency_slug: agreement.agency_slug || null
    }
  });
}, 'fetch guarantor agreement');

/**
 * Sign guarantor agreement (public endpoint)
 * This allows guarantors to sign their agreement
 */
exports.signAgreement = async (req, res) => {
  try {
    const { token } = req.params;
    const { signature_data } = req.body;

    if (!signature_data) {
      return res.status(400).json({ error: 'Signature is required' });
    }

    // Validate signature format (basic validation)
    if (typeof signature_data !== 'string' || signature_data.trim().length < 2) {
      return res.status(400).json({ error: 'Invalid signature format' });
    }

    const agencyId = await getAgencyIdFromToken(token);
    const signedAgreement = await signGuarantorAgreement(token, signature_data.trim(), agencyId);

    // Check if all guarantor agreements for this tenancy are now signed
    // If so, auto-promote the tenancy to 'approval' status
    try {
      // Get tenancy_id from the signed agreement's member
      const memberResult = await db.query(
        'SELECT tenancy_id FROM tenancy_members WHERE id = $1',
        [signedAgreement.tenancy_member_id]
      );
      const tenancyId = memberResult.rows[0]?.tenancy_id;

      if (tenancyId) {
        // Get tenancy status and agency_id
        const tenancyResult = await db.query(
          'SELECT status, agency_id FROM tenancies WHERE id = $1',
          [tenancyId]
        );
        const tenancy = tenancyResult.rows[0];

        // Auto-promote if tenancy is in 'awaiting_signatures' and all tenants + guarantors have signed
        if (tenancy?.status === 'awaiting_signatures') {
          const allComplete = await checkTenancySigningComplete(tenancyId, tenancy.agency_id);

          if (allComplete) {
            await db.query(
              'UPDATE tenancies SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND agency_id = $3',
              ['approval', tenancyId, tenancy.agency_id],
              tenancy.agency_id
            );

            const paymentResult = await generatePaymentSchedulesForTenancy(tenancyId, tenancy.agency_id);
            console.log(`Auto-approval: All tenants + guarantors signed. Generated payment schedules for tenancy ${tenancyId}:`, paymentResult);
          }
        }
      }
    } catch (approvalError) {
      console.error('Error checking auto-approval after guarantor signing:', approvalError);
      // Don't fail the guarantor signing response
    }

    res.json({
      message: 'Guarantor agreement signed successfully',
      agreement: {
        id: signedAgreement.id,
        is_signed: Boolean(signedAgreement.is_signed),
        signed_at: signedAgreement.signed_at
      }
    });
  } catch (err) {
    if (err.message === 'Guarantor agreement not found') {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    if (err.message === 'This guarantor agreement has already been signed') {
      return res.status(400).json({ error: err.message });
    }

    handleError(res, err, 'sign guarantor agreement');
  }
};

/**
 * Get signed agreement HTML (public endpoint)
 * This allows guarantors to view their signed agreement
 */
exports.getSignedAgreement = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const agencyId = await getAgencyIdFromToken(token);
  const agreement = await getGuarantorAgreementByToken(token, agencyId);

  if (!agreement) {
    return res.status(404).json({ error: 'Guarantor agreement not found' });
  }

  if (!agreement.is_signed) {
    return res.status(400).json({ error: 'This agreement has not been signed yet' });
  }

  res.json({
    signed_agreement_html: agreement.signed_agreement_html,
    signed_at: agreement.signed_at
  });
}, 'fetch signed agreement');
