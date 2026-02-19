const db = require('../db');
const crypto = require('crypto');
const { createEmailTemplate, createButton, createInfoBox, escapeHtml } = require('../utils/emailTemplates');
const { queueEmail } = require('./emailService');
const { formatAddress } = require('../utils/formatAddress');
const { formatDate } = require('../utils/dateFormatter');
const { getAgencyBranding } = require('./brandingService');

/**
 * Generate guarantor agreement HTML (returns complete HTML document)
 * @param {Object} data - Agreement data
 * @returns {string} Complete HTML document with inline styles
 */
function generateGuarantorAgreementContent(data) {
  const {
    guarantor,
    tenant,
    property,
    tenancy,
    landlord,
    signature,
    signedAt
  } = data;

  // Calculate monthly rent from PPPW
  const monthlyRent = tenant.rent_pppw ? ((tenant.rent_pppw * 52) / 12).toFixed(2) : '0.00';

  // Calculate term duration properly accounting for actual month lengths
  const startDate = new Date(tenancy.start_date);
  // Add 1 day to end date since tenancy end dates are inclusive (last day of tenancy)
  const endDate = new Date(tenancy.end_date);
  endDate.setDate(endDate.getDate() + 1);

  // Calculate month difference
  let years = endDate.getFullYear() - startDate.getFullYear();
  let months = endDate.getMonth() - startDate.getMonth();
  let days = endDate.getDate() - startDate.getDate();

  // Adjust if days are negative
  if (days < 0) {
    months--;
    // Get days in previous month
    const prevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
    days += prevMonth.getDate();
  }

  // Adjust if months are negative
  if (months < 0) {
    years--;
    months += 12;
  }

  // Convert years to months
  const totalMonths = years * 12 + months;

  // Format the duration string
  let termDuration = '';
  if (totalMonths > 0) {
    termDuration += `${totalMonths} Month${totalMonths !== 1 ? 's' : ''}`;
  }
  if (days > 0) {
    if (termDuration) termDuration += ' ';
    termDuration += `${days} day${days !== 1 ? 's' : ''}`;
  }
  if (!termDuration) {
    termDuration = '0 days';
  }

  // Format company address (from site settings)
  const companyAddress = formatAddress(
    landlord.company_address_line1,
    landlord.company_address_line2,
    landlord.company_city,
    landlord.company_postcode
  );

  // Format property address
  const propertyAddress = formatAddress(
    property.address_line1,
    property.address_line2,
    property.city,
    property.postcode
  );

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deed of Guarantee - ${property.address_line1}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; line-height: 1.6; color: #374151; max-width: 800px; margin: 0 auto; padding: 20px;">

  <!-- Agreement Header -->
  <div style="text-align: center; margin-bottom: 30px; padding-bottom: 30px; border-bottom: 2px solid #d1d5db;">
    <h1 style="font-size: 30px; font-weight: bold; color: #111827; margin: 0 0 8px 0;">DEED OF GUARANTEE</h1>
    <p style="font-size: 18px; color: #374151; margin: 0;">${landlord.company_name || 'Letably'}</p>
  </div>

  <!-- Important Warning -->
  <div style="background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <p style="font-weight: bold; color: #92400e; margin: 0 0 8px 0; font-size: 14px;">IMPORTANT WARNING TO INTENDED GUARANTORS:</p>
    <p style="color: #92400e; margin: 0; font-size: 13px;">By signing this document you agree to underwrite the rental and other responsibilities of the Tenant under his/her tenancy agreement. This means that if the tenant fails fulfil their obligations, the Guarantor would also be liable. If you do not understand this document, you should consider taking legal advice before signing it.</p>
  </div>

  <!-- Parties -->
  <div style="background-color: #f9fafb; border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <div style="margin-bottom: 16px;">
      <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>TO</strong> (Name of landlord/Agent): <span style="color: #1e3a8a;">${landlord.company_name || 'Letably'}</span></p>
      <p style="margin: 0 0 16px 0; font-size: 14px;"><strong>OF</strong> (Address of Landlord/Agent): <span style="color: #1e3a8a;">${companyAddress || '16 South Close, Unstone, Dronfield, S18 4DT'}</span></p>
    </div>
    <div style="margin-bottom: 16px;">
      <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>FROM</strong> (Name of Guarantor): <span style="color: #1e3a8a;">${guarantor.guarantor_name}</span></p>
      <p style="margin: 0 0 16px 0; font-size: 14px;"><strong>OF</strong> (Address of Guarantor): <span style="color: #1e3a8a;">${guarantor.guarantor_address}</span></p>
    </div>
  </div>

  <!-- Particulars -->
  <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <h2 style="font-weight: bold; color: #1e3a8a; margin: 0 0 12px 0; font-size: 16px;">PARTICULARS:</h2>
    <div style="font-size: 14px;">
      <p style="margin: 0 0 8px 0;"><strong>Tenant:</strong> <span style="color: #1e3a8a;">${tenant.first_name} ${tenant.surname}</span> <span style="font-size: 12px; color: #6b7280;">(Name of tenant for whom the guarantee is given)</span></p>
      <p style="margin: 0 0 8px 0;"><strong>Property Address:</strong> <span style="color: #1e3a8a;">${propertyAddress}</span></p>
      <p style="margin: 0 0 8px 0;"><strong>RENT:</strong> <span style="color: #1e3a8a; font-weight: bold;">£${monthlyRent} per Month</span> <span style="font-size: 12px; color: #6b7280;">N.B: The FULL amount of Rent payment under the Agreement on which this Tenant is named.</span></p>
      <p style="margin: 0;"><strong>TERM:</strong> <span style="color: #1e3a8a;">${termDuration}</span> <span style="font-size: 12px; color: #6b7280;">PLUS the time during which there is any continuation of the tenancy under a statutory periodic tenancy.</span></p>
    </div>
  </div>

  <!-- Guarantee Declaration -->
  <div style="margin-bottom: 32px;">
    <h2 style="font-weight: bold; color: #111827; margin: 0 0 16px 0; font-size: 18px;">Guarantee Declaration</h2>

    <div style="margin-bottom: 20px;">
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="background-color: #CF722F; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; text-align: center; line-height: 28px; font-weight: bold;">1</div>
        <div style="color: #4b5563; font-size: 14px; flex: 1;">
          <p style="margin: 0;">I hereby guarantee the aforementioned Tenant's obligations under the Tenancy agreement dated <strong>${formatDate(tenancy.start_date, 'long')}</strong>. This guarantee includes monies due as rent in line with the Tenancy agreement and any other monies due where the Tenant has not complied with their responsibilities as stipulated in the agreement.</p>
        </div>
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="background-color: #CF722F; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; text-align: center; line-height: 28px; font-weight: bold;">2</div>
        <div style="color: #4b5563; font-size: 14px; flex: 1;">
          <p style="margin: 0;">Our liability under this guarantee in respect of the rent payable under the Agreement shall be limited to the Tenant's contribution to the total rent for the Property, and their fair share of utilities (where included in the agreement). Otherwise, my guarantee is unlimited. For the purpose of this Guarantee, the Tenant's share will be calculated by dividing the total charges due by the number of tenants named on the agreement.</p>
        </div>
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="background-color: #CF722F; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; text-align: center; line-height: 28px; font-weight: bold;">3</div>
        <div style="color: #4b5563; font-size: 14px; flex: 1;">
          <p style="margin: 0;">I agree to pay any required rent as requested in writing within seven days, if the said amount is overdue by a minimum of 14 days.</p>
        </div>
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="background-color: #CF722F; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; text-align: center; line-height: 28px; font-weight: bold;">4</div>
        <div style="color: #4b5563; font-size: 14px; flex: 1;">
          <p style="margin: 0;">If the tenant does not comply with any of the terms of the Agreement which are the Tenant's responsibility, I will on written demand pay to you all losses which you are entitled to as a result of the Tenant breaking the terms of the Agreement, subject to full written calculation and detailed explanation of the loss. I understand that losses can include any damages, expenses or costs (including legal costs) that result if any rent or other monies payable are not paid or if any term of the agreement is broken.</p>
        </div>
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="background-color: #CF722F; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; text-align: center; line-height: 28px; font-weight: bold;">5</div>
        <div style="color: #4b5563; font-size: 14px; flex: 1;">
          <p style="margin: 0;">This guarantee shall continue beyond expiry of the agreement if the Tenant remains resident at the property, including where a statutory periodic tenancy arises under the Housing Act 1988 or there is a contractual continuation on the expiry of the fixed term granted by the Agreement. I agree that we will pay the rent and any other money payable and also pay any losses if any of the other terms of the tenancy are broken under this statutory periodic tenancy or contractual continuation.</p>
        </div>
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="background-color: #CF722F; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; text-align: center; line-height: 28px; font-weight: bold;">6</div>
        <div style="color: #4b5563; font-size: 14px; flex: 1;">
          <p style="margin: 0;">This guarantee cannot be revoked or cancelled for so long as the Tenant remains a tenant of the property under the fixed term tenancy granted by the Agreement, or if a statutory periodic tenancy or contractual continuation arises thereafter.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Acknowledgement -->
  <div style="background-color: #f9fafb; border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <p style="margin: 0; font-size: 14px; color: #374151; font-style: italic;">I acknowledge that I have received a copy of the Tenancy Agreement to which this Guarantee relates and agree to this Guarantee as described.</p>
  </div>

  ${signature && signedAt ? `
  <!-- Signature Footer -->
  <div style="margin-top: 48px; padding-top: 32px; border-top: 2px solid #d1d5db; font-size: 12px; color: #6b7280; text-align: center;">
    <p style="margin: 0;">This agreement was signed electronically on ${formatDate(signedAt, 'long')}</p>
    <p style="margin: 8px 0 0 0; font-weight: 600; color: #111827;">Signed by: ${signature}</p>
    <p style="margin: 8px 0 0 0;">Generated by ${landlord.company_name || 'Letably'}</p>
  </div>
  ` : ''}

</body>
</html>
  `.trim();
}

/**
 * Send guarantor agreement emails for newly created agreements
 */
async function sendGuarantorAgreementEmails(agreements, tenancyId, agencyId) {
  try {
    if (!agreements || agreements.length === 0) {
      return;
    }

    // Get site settings
    const siteSettingsResult = await db.query('SELECT setting_key, setting_value FROM site_settings', [], agencyId);
    const siteSettings = siteSettingsResult.rows;
    const settings = {};
    siteSettings.forEach(setting => {
      settings[setting.setting_key] = setting.setting_value;
    });

    // Get tenancy info
    const tenancyResult = await db.query(`
      SELECT t.*, p.address_line1, p.city
      FROM tenancies t
      JOIN properties p ON t.property_id = p.id
      WHERE t.id = $1
    `, [tenancyId], agencyId);

    const tenancy = tenancyResult.rows[0];

    for (const agreement of agreements) {
      // Generate signing URL
      const baseUrl = settings.base_url || process.env.FRONTEND_URL || 'http://localhost:3000';
      const signingUrl = `${baseUrl}/guarantor/sign/${agreement.token}`;
      const companyName = settings.company_name || 'Letably';

      // Generate email body content using template system
      const bodyContent = `
        <h1>Action Required: Sign Guarantor Agreement</h1>

        <p>Dear ${escapeHtml(agreement.guarantor_name)},</p>

        <p>You have been named as a guarantor for <strong>${escapeHtml(agreement.tenant_name)}</strong> for the following property:</p>

        ${createInfoBox(`
          <p style="margin: 5px 0;"><strong>Property:</strong> ${escapeHtml(formatAddress(tenancy.address_line1, tenancy.city))}</p>
          <p style="margin: 5px 0;"><strong>Tenancy Period:</strong> ${formatDate(tenancy.start_date)} - ${formatDate(tenancy.end_date)}</p>
        `)}

        <p>Please review and sign the guarantor agreement by clicking the button below:</p>

        <div style="text-align: center;">
          ${createButton(signingUrl, 'Review and Sign Agreement')}
        </div>

        <p class="text-small text-muted">Or copy and paste this link into your browser:</p>
        <p class="text-small text-muted" style="word-break: break-all;">${signingUrl}</p>

        <hr />

        ${createInfoBox(`
          <p style="margin: 5px 0;"><strong>Important:</strong> As a guarantor, you will be responsible for the tenant's rental obligations if they fail to meet them.</p>
          <p style="margin: 5px 0;">Please review the agreement carefully before signing.</p>
        `, 'warning')}
      `;

      const emailHtml = createEmailTemplate('Guarantor Agreement - Signature Required', bodyContent);

      const emailText = `Guarantor Agreement - Signature Required

Dear ${agreement.guarantor_name},

You have been named as a guarantor for ${agreement.tenant_name} for the following property:

Property: ${formatAddress(tenancy.address_line1, tenancy.city)}
Tenancy Period: ${formatDate(tenancy.start_date)} - ${formatDate(tenancy.end_date)}

Please review and sign the guarantor agreement by visiting the following link:

${signingUrl}

IMPORTANT: As a guarantor, you will be responsible for the tenant's rental obligations if they fail to meet them. Please review the agreement carefully before signing.

---

This email was sent by ${companyName}.

${new Date().getFullYear()} ${companyName}. All rights reserved.`;

      // Send email to guarantor
      await queueEmail({
        to_email: agreement.guarantor_email,
        to_name: agreement.guarantor_name,
        subject: 'Guarantor Agreement - Signature Required',
        html_body: emailHtml,
        text_body: emailText,
        priority: 1
      }, agencyId);
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Check if all guarantor agreements for a tenancy are complete
 */
async function checkGuarantorAgreementsComplete(tenancyId, agencyId) {
  try {
    const incompleteResult = await db.query(`
      SELECT COUNT(*) as count
      FROM guarantor_agreements ga
      JOIN tenancy_members tm ON ga.tenancy_member_id = tm.id
      WHERE tm.tenancy_id = $1 AND ga.is_signed = false
    `, [tenancyId], agencyId);

    const incomplete = incompleteResult.rows[0];

    return parseInt(incomplete.count) === 0;
  } catch (error) {
    throw error;
  }
}

/**
 * Get guarantor agreement by token (for public signing page)
 */
async function getGuarantorAgreementByToken(token, agencyId) {
  try {
    const agreementResult = await db.query(`
      SELECT
        ga.*,
        tm.id as tenant_member_id,
        tm.first_name as tenant_first_name,
        tm.surname as tenant_surname,
        tm.signed_agreement_html as tenant_signed_agreement_html,
        u.email as tenant_email,
        t.start_date as tenancy_start_date,
        t.end_date as tenancy_end_date,
        tm.rent_pppw,
        p.address_line1,
        p.address_line2,
        p.city,
        p.postcode,
        l.name as landlord_name,
        l.legal_name as landlord_legal_name,
        l.address_line1 as landlord_address_line1,
        l.city as landlord_city,
        l.postcode as landlord_postcode,
        ag.slug as agency_slug
      FROM guarantor_agreements ga
      JOIN tenancy_members tm ON ga.tenancy_member_id = tm.id
      JOIN tenancies t ON tm.tenancy_id = t.id
      JOIN users u ON tm.user_id = u.id
      JOIN properties p ON t.property_id = p.id
      LEFT JOIN landlords l ON p.landlord_id = l.id
      JOIN agencies ag ON ga.agency_id = ag.id
      WHERE ga.guarantor_token = $1
    `, [token], agencyId);

    const agreement = agreementResult.rows[0];

    if (!agreement) {
      return null;
    }

    // Get company details from site settings
    const siteSettingsResult = await db.query('SELECT setting_key, setting_value FROM site_settings', [], agencyId);
    const siteSettings = siteSettingsResult.rows;
    const settings = {};
    siteSettings.forEach(setting => {
      settings[setting.setting_key] = setting.setting_value;
    });

    // Add company details to agreement object
    agreement.company_name = settings.company_name || 'Letably';
    agreement.company_address_line1 = settings.company_address_line1 || '';
    agreement.company_address_line2 = settings.company_address_line2 || '';
    agreement.company_city = settings.company_city || '';
    agreement.company_postcode = settings.company_postcode || '';

    return agreement;
  } catch (error) {
    throw error;
  }
}

/**
 * Sign guarantor agreement
 */
async function signGuarantorAgreement(token, signatureData, agencyId) {
  try {
    const agreement = await getGuarantorAgreementByToken(token, agencyId);

    if (!agreement) {
      throw new Error('Guarantor agreement not found');
    }

    if (agreement.is_signed) {
      throw new Error('This guarantor agreement has already been signed');
    }

    // Get site settings
    const siteSettingsResult = await db.query('SELECT setting_key, setting_value FROM site_settings', [], agencyId);
    const siteSettings = siteSettingsResult.rows;
    const settings = {};
    siteSettings.forEach(setting => {
      settings[setting.setting_key] = setting.setting_value;
    });

    // Generate HTML snapshot of signed agreement
    const agreementHTML = generateGuarantorAgreementContent({
      guarantor: {
        guarantor_name: agreement.guarantor_name,
        guarantor_email: agreement.guarantor_email,
        guarantor_phone: agreement.guarantor_phone,
        guarantor_address: agreement.guarantor_address
      },
      tenant: {
        first_name: agreement.tenant_first_name,
        surname: agreement.tenant_surname,
        email: agreement.tenant_email,
        rent_pppw: agreement.rent_pppw
      },
      property: {
        address_line1: agreement.address_line1,
        address_line2: agreement.address_line2,
        city: agreement.city,
        postcode: agreement.postcode
      },
      tenancy: {
        start_date: agreement.tenancy_start_date,
        end_date: agreement.tenancy_end_date
      },
      landlord: {
        name: agreement.landlord_name,
        legal_name: agreement.landlord_legal_name,
        address_line1: agreement.landlord_address_line1,
        city: agreement.landlord_city,
        postcode: agreement.landlord_postcode
      },
      settings,
      signature: signatureData,
      signedAt: new Date().toISOString()
    });

    // Update guarantor agreement with signature
    const updatedResult = await db.query(`
      UPDATE guarantor_agreements
      SET
        is_signed = true,
        signed_at = CURRENT_TIMESTAMP,
        signature_data = $1,
        signed_agreement_html = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE guarantor_token = $3
      RETURNING *
    `, [signatureData, agreementHTML, token], agencyId);

    return updatedResult.rows[0];
  } catch (error) {
    throw error;
  }
}

/**
 * Get all guarantor agreements for a tenancy (admin view)
 */
async function getGuarantorAgreementsByTenancy(tenancyId, agencyId) {
  try {
    const agreementsResult = await db.query(`
      SELECT
        ga.*,
        tm.first_name as tenant_first_name,
        tm.surname as tenant_surname
      FROM guarantor_agreements ga
      JOIN tenancy_members tm ON ga.tenancy_member_id = tm.id
      WHERE tm.tenancy_id = $1
      ORDER BY ga.created_at ASC
    `, [tenancyId], agencyId);

    return agreementsResult.rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Create a guarantor agreement for a specific tenancy member (called after each tenant signs)
 * Idempotent: returns null if member doesn't need a guarantor or agreement already exists
 */
async function createGuarantorAgreementForMember(tenancyId, memberId, agencyId) {
  try {
    // Query this specific member
    const memberResult = await db.query(`
      SELECT tm.*
      FROM tenancy_members tm
      WHERE tm.id = $1 AND tm.tenancy_id = $2
      AND tm.guarantor_required = true
      AND tm.guarantor_name IS NOT NULL
      AND tm.guarantor_email IS NOT NULL
    `, [memberId, tenancyId], agencyId);

    const member = memberResult.rows[0];
    if (!member) {
      return null; // Member doesn't need a guarantor or missing guarantor info
    }

    // Check if agreement already exists (idempotent)
    const existingResult = await db.query(`
      SELECT id FROM guarantor_agreements
      WHERE tenancy_member_id = $1
    `, [member.id], agencyId);

    if (existingResult.rows[0]) {
      return null; // Agreement already exists
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Create guarantor agreement
    const insertResult = await db.query(`
      INSERT INTO guarantor_agreements (
        agency_id,
        tenancy_member_id,
        guarantor_name,
        guarantor_email,
        guarantor_phone,
        guarantor_address,
        guarantor_token,
        is_signed,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      agencyId,
      member.id,
      member.guarantor_name,
      member.guarantor_email,
      member.guarantor_phone || null,
      member.guarantor_address || null,
      token
    ], agencyId);

    const result = insertResult.rows[0];

    return {
      id: result.id,
      tenancy_id: tenancyId,
      application_id: member.application_id,
      guarantor_name: member.guarantor_name,
      guarantor_email: member.guarantor_email,
      tenant_name: `${member.first_name} ${member.surname}`,
      token
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Check if all tenants and all guarantors for a tenancy have signed
 * Returns true only when every member has signed AND every guarantor agreement is signed
 */
async function checkTenancySigningComplete(tenancyId, agencyId) {
  try {
    // Check all members have signed
    const unsignedMembersResult = await db.query(`
      SELECT COUNT(*) as count
      FROM tenancy_members
      WHERE tenancy_id = $1 AND (is_signed = false OR is_signed IS NULL)
    `, [tenancyId], agencyId);

    if (parseInt(unsignedMembersResult.rows[0].count) > 0) {
      return false;
    }

    // Check all guarantor agreements are signed
    const allGuarantorsSigned = await checkGuarantorAgreementsComplete(tenancyId, agencyId);
    return allGuarantorsSigned;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  sendGuarantorAgreementEmails,
  createGuarantorAgreementForMember,
  checkTenancySigningComplete,
  getGuarantorAgreementByToken,
  signGuarantorAgreement,
  getGuarantorAgreementsByTenancy,
  generateGuarantorAgreementContent
};
