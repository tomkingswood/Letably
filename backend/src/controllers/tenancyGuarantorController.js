const db = require('../db');
const { getGuarantorAgreementsByTenancy } = require('../services/guarantorService');
const { queueEmail } = require('../services/emailService');
const { getSiteSettings, getBaseUrl } = require('../repositories/tenancyRepository');
const { buildGuarantorRegenerationEmail } = require('../utils/tenancyEmailBuilder');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get guarantor agreements for a tenancy (admin only)
 * GET /api/tenancies/:id/guarantor-agreements
 */
exports.getGuarantorAgreements = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  const agreements = await getGuarantorAgreementsByTenancy(id, agencyId);

  res.json({
    agreements: agreements.map(agreement => ({
      id: agreement.id,
      tenancy_member_id: agreement.tenancy_member_id,
      guarantor_name: agreement.guarantor_name,
      guarantor_email: agreement.guarantor_email,
      tenant_name: `${agreement.tenant_first_name} ${agreement.tenant_surname}`,
      is_signed: Boolean(agreement.is_signed),
      signed_at: agreement.signed_at,
      signed_agreement_html: agreement.signed_agreement_html,
      created_at: agreement.created_at,
      guarantor_token: agreement.guarantor_token
    }))
  });
}, 'fetch guarantor agreements');

/**
 * Regenerate guarantor agreement token and resend email (admin only)
 * POST /api/tenancies/:id/guarantor-agreements/:agreementId/regenerate-token
 */
exports.regenerateGuarantorAgreementToken = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id: tenancyId, agreementId } = req.params;

  // Get the guarantor agreement with full details
  // Defense-in-depth: explicit agency_id filtering
  const agreementResult = await db.query(`
    SELECT
      ga.*,
      tm.first_name as tenant_first_name,
      tm.surname as tenant_surname,
      t.start_date as tenancy_start_date,
      t.end_date as tenancy_end_date,
      p.address_line1,
      p.city
    FROM guarantor_agreements ga
    JOIN tenancy_members tm ON ga.tenancy_member_id = tm.id
    JOIN tenancies t ON tm.tenancy_id = t.id
    JOIN properties p ON t.property_id = p.id
    WHERE ga.id = $1 AND tm.tenancy_id = $2 AND ga.agency_id = $3
  `, [agreementId, tenancyId, agencyId], agencyId);
  const agreement = agreementResult.rows[0];

  if (!agreement) {
    return res.status(404).json({ error: 'Guarantor agreement not found' });
  }

  if (agreement.is_signed) {
    return res.status(400).json({ error: 'This guarantor agreement has already been signed' });
  }

  // Generate new token
  const crypto = require('crypto');
  const newToken = crypto.randomBytes(32).toString('hex');

  // Update the token
  // Defense-in-depth: explicit agency_id filtering
  await db.query(`
    UPDATE guarantor_agreements
    SET guarantor_token = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND agency_id = $3
  `, [newToken, agreementId, agencyId], agencyId);

  // Get base URL and settings from repository
  const baseUrl = await getBaseUrl(agencyId);
  const settings = await getSiteSettings(agencyId);
  const signingUrl = `${baseUrl}/guarantor/sign/${newToken}`;
  const companyName = settings.company_name || 'Letably';

  // Build email using email builder
  const { html, text, subject } = buildGuarantorRegenerationEmail({
    guarantorName: agreement.guarantor_name,
    tenantFirstName: agreement.tenant_first_name,
    tenantSurname: agreement.tenant_surname,
    propertyAddress: agreement.address_line1,
    city: agreement.city,
    tenancyStartDate: agreement.tenancy_start_date,
    tenancyEndDate: agreement.tenancy_end_date,
    signingUrl,
    companyName
  });

  // Send email
  await queueEmail({
    to_email: agreement.guarantor_email,
    to_name: agreement.guarantor_name,
    subject,
    html_body: html,
    text_body: text,
    priority: 1
  }, agencyId);

  res.json({
    message: 'New guarantor agreement link generated and email sent',
    token: newToken
  });
}, 'regenerate guarantor agreement token');
