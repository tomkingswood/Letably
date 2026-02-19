const db = require('../db');
const crypto = require('crypto');
const { formatDate } = require('../utils/dateFormatter');

/**
 * Safely format a number to 2 decimal places
 * Handles strings, nulls, and numbers from PostgreSQL NUMERIC type
 */
function formatCurrency(value) {
  if (value === null || value === undefined) return '0.00';
  return Number(value).toFixed(2);
}

/**
 * Simple template engine for replacing placeholders in agreement sections
 * Supports:
 * - {{variable}} - simple replacements
 * - {{#if condition}}...{{/if}} - conditional blocks
 * - {{#if_room_only}}...{{/if_room_only}} - special conditional
 * - {{#each array}}...{{/each}} - loops (with {{name}}, {{room}}, etc.)
 */
function renderTemplate(template, data) {
  let rendered = template;

  // Handle special conditionals FIRST (these should not be inside loops)
  rendered = rendered.replace(/{{#if_room_only}}([\s\S]*?){{\/if_room_only}}/g, (match, content) => {
    return data.tenancy_type === 'room_only' ? content : '';
  });

  rendered = rendered.replace(/{{#if_whole_house}}([\s\S]*?){{\/if_whole_house}}/g, (match, content) => {
    return data.tenancy_type === 'whole_house' ? content : '';
  });

  rendered = rendered.replace(/{{#if_individual_rents}}([\s\S]*?){{\/if_individual_rents}}/g, (match, content) => {
    return data.individual_rents ? content : '';
  });

  rendered = rendered.replace(/{{#if_individual_deposits}}([\s\S]*?){{\/if_individual_deposits}}/g, (match, content) => {
    return data.individual_deposits ? content : '';
  });

  rendered = rendered.replace(/{{#if_rolling_monthly}}([\s\S]*?){{\/if_rolling_monthly}}/g, (match, content) => {
    return data.is_rolling_monthly ? content : '';
  });

  rendered = rendered.replace(/{{#if_fixed_term}}([\s\S]*?){{\/if_fixed_term}}/g, (match, content) => {
    return !data.is_rolling_monthly ? content : '';
  });

  // Handle each loops BEFORE regular conditionals: {{#each array}}...{{/each}}
  rendered = rendered.replace(/{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g, (match, arrayName, itemTemplate) => {
    const array = data[arrayName];
    if (!Array.isArray(array)) return '';

    return array.map(item => {
      let itemRendered = itemTemplate;

      // Handle conditionals inside loops: {{#if property}}...{{/if}}
      itemRendered = itemRendered.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, propName, content) => {
        return item[propName] ? content : '';
      });

      // Replace item properties
      Object.keys(item).forEach(key => {
        const value = item[key] !== null && item[key] !== undefined ? item[key] : '';
        itemRendered = itemRendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });
      return itemRendered;
    }).join('\n');
  });

  // Handle regular conditionals AFTER loops: {{#if variable}}...{{/if}}
  // Process conditionals iteratively from innermost to outermost
  let previousRendered;
  do {
    previousRendered = rendered;
    // Match conditionals that don't contain nested {{#if (innermost first)
    rendered = rendered.replace(/{{#if\s+(\w+)}}((?:(?!{{#if).)*?){{\/if}}/s, (match, varName, content) => {
      return data[varName] ? content : '';
    });
  } while (rendered !== previousRendered);

  // Handle simple variable replacements: {{variable}}
  Object.keys(data).forEach(key => {
    const value = data[key] !== null && data[key] !== undefined ? data[key] : '';
    rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });

  return rendered;
}

// formatDate is imported from '../utils/dateFormatter'

/**
 * Get agreement sections for a landlord (landlord-specific + defaults)
 * @param {number} landlordId - The landlord ID
 * @param {string} agreementType - The type of agreement ('tenancy_agreement')
 * @param {number} agencyId - The agency ID for multi-tenancy
 */
async function getAgreementSections(landlordId, agreementType = 'tenancy_agreement', agencyId) {
  try {
    // Get ALL landlord-specific sections (including inactive) to determine which keys are overridden
    const allLandlordSectionsResult = await db.query(`
      SELECT * FROM agreement_sections
      WHERE landlord_id = $1
        AND (agreement_type = $2 OR agreement_type IS NULL)
        AND agency_id = $3
      ORDER BY section_order ASC
    `, [landlordId, agreementType, agencyId], agencyId);
    const allLandlordSections = allLandlordSectionsResult.rows;

    // Get section keys that are overridden (including inactive overrides)
    // This ensures inactive sections suppress their defaults
    const overriddenKeys = allLandlordSections.map(s => s.section_key);

    // Filter to only active landlord sections
    const activeLandlordSections = allLandlordSections.filter(s => s.is_active === true);

    // Get default sections that aren't overridden
    const defaultSectionsResult = await db.query(`
      SELECT * FROM agreement_sections
      WHERE landlord_id IS NULL
        AND is_active = true
        AND (agreement_type = $1 OR agreement_type IS NULL)
        AND agency_id = $2
      ORDER BY section_order ASC
    `, [agreementType, agencyId], agencyId);
    let defaultSections = defaultSectionsResult.rows;

    if (overriddenKeys.length > 0) {
      defaultSections = defaultSections.filter(s => !overriddenKeys.includes(s.section_key));
    }

    // Combine active landlord sections and non-overridden defaults
    return [...activeLandlordSections, ...defaultSections]
      .sort((a, b) => a.section_order - b.section_order);
  } catch (error) {
    throw error;
  }
}

/**
 * Save a signed document to the signed_documents table
 * @param {Object} params - Signature parameters
 * @param {string} params.documentType - Type of document ('tenancy_agreement')
 * @param {number} params.referenceId - The tenancy_id
 * @param {number} params.userId - The signing user's ID
 * @param {number} [params.memberId] - The tenancy_member ID (for tenancy agreements)
 * @param {number} [params.participantId] - Reserved for future use
 * @param {string} params.signatureData - The typed signature
 * @param {string} params.signedHtml - The frozen HTML snapshot
 * @param {string} [params.ipAddress] - IP address of the signer
 * @param {string} [params.userAgent] - Browser/device user agent string
 * @param {number} params.agencyId - The agency ID for multi-tenancy
 */
async function saveSignedDocument({ documentType, referenceId, userId, memberId, participantId, signatureData, signedHtml, ipAddress, userAgent, agencyId }) {
  try {
    // Generate SHA-256 hash of the document for integrity verification
    const documentHash = crypto.createHash('sha256').update(signedHtml).digest('hex');

    const result = await db.query(`
      INSERT INTO signed_documents (
        agency_id, document_type, reference_id, user_id, member_id, participant_id,
        signature_data, signed_html, document_hash, ip_address, user_agent, signed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      agencyId,
      documentType,
      referenceId,
      userId,
      memberId || null,
      participantId || null,
      signatureData,
      signedHtml,
      documentHash,
      ipAddress || null,
      userAgent || null
    ], agencyId);

    return result.rows[0].id;
  } catch (error) {
    throw error;
  }
}

/**
 * Generate agreement data for a tenancy and specific member
 * @param {number} tenancyId - The tenancy ID
 * @param {number} memberId - The tenancy member ID (the tenant signing the agreement)
 * @param {number} agencyId - The agency ID for multi-tenancy
 */
exports.generateAgreement = async (tenancyId, memberId, agencyId) => {
  try {
    // Get site settings (company address, contact info, etc.)
    const siteSettingsResult = await db.query('SELECT setting_key, setting_value FROM site_settings', [], agencyId);
    const settings = {};
    siteSettingsResult.rows.forEach(setting => {
      settings[setting.setting_key] = setting.setting_value;
    });

    // Get tenancy data
    const tenancyResult = await db.query(`
      SELECT
        t.*,
        p.id as property_id,
        p.address_line1,
        p.address_line2,
        p.city,
        p.postcode,
        p.location as property_location,
        p.landlord_id,
        l.name as landlord_name,
        l.legal_name as landlord_legal_name,
        l.agreement_display_format,
        l.email as landlord_email,
        l.phone as landlord_phone,
        l.address_line1 as landlord_address_line1,
        l.address_line2 as landlord_address_line2,
        l.city as landlord_city,
        l.postcode as landlord_postcode,
        l.bank_name,
        l.bank_account_name,
        l.sort_code,
        l.account_number,
        l.utilities_cap_amount,
        l.council_tax_in_bills
      FROM tenancies t
      JOIN properties p ON t.property_id = p.id
      LEFT JOIN landlords l ON p.landlord_id = l.id
      WHERE t.id = $1
    `, [tenancyId], agencyId);
    const tenancy = tenancyResult.rows[0];

    if (!tenancy) {
      throw new Error('Tenancy not found');
    }

    // Get tenancy members (tenants)
    const membersResult = await db.query(`
      SELECT
        tm.*,
        tm.surname as last_name,
        u.email as email,
        u.phone as phone,
        b.bedroom_name
      FROM tenancy_members tm
      JOIN users u ON tm.user_id = u.id
      LEFT JOIN bedrooms b ON tm.bedroom_id = b.id
      WHERE tm.tenancy_id = $1
      ORDER BY tm.first_name ASC
    `, [tenancyId], agencyId);
    const members = membersResult.rows;

    if (members.length === 0) {
      throw new Error('No tenants found for this tenancy');
    }

    // Validate that memberId exists in this tenancy
    if (!memberId) {
      throw new Error('Member ID is required for agreement generation');
    }

    const primaryTenant = members.find(m => m.id === parseInt(memberId));
    if (!primaryTenant) {
      throw new Error('Specified tenant not found in this tenancy');
    }

    // Separate primary tenant from others
    const otherTenants = members.filter(m => m.id !== parseInt(memberId));

    // Build landlord address
    const landlordAddressParts = [
      tenancy.landlord_address_line1,
      tenancy.landlord_address_line2,
      tenancy.landlord_city,
      tenancy.landlord_postcode
    ].filter(Boolean);
    const landlordAddress = landlordAddressParts.join(', ');

    // Build landlord display name (fallback to company name if no landlord)
    const landlordDisplayName = tenancy.agreement_display_format || tenancy.landlord_name || settings.company_name || 'Letably';

    // Build tenant names list (all tenants)
    const tenantNamesList = members.map(m => {
      const title = m.title && m.title !== 'other' ? m.title + ' ' : '';
      return `${title}${m.first_name} ${m.last_name}`;
    }).join(', ');

    // Build primary tenant name
    const primaryTenantTitle = primaryTenant.title && primaryTenant.title !== 'other' ? primaryTenant.title + ' ' : '';
    const primaryTenantName = `${primaryTenantTitle}${primaryTenant.first_name} ${primaryTenant.last_name}`;

    // Build other tenants names list
    const otherTenantsNamesList = otherTenants.map(m => {
      const title = m.title && m.title !== 'other' ? m.title + ' ' : '';
      return `${title}${m.first_name} ${m.last_name}`;
    }).join(', ');

    // Check if rents are different (individual)
    const rents = [...new Set(members.map(m => m.rent_pppw))];
    const individualRents = rents.length > 1;

    // Check if deposits are different (individual)
    const deposits = [...new Set(members.map(m => m.deposit_amount))];
    const individualDeposits = deposits.length > 1;

    // Calculate totals
    const totalRentPppw = individualRents ? null : members[0].rent_pppw;
    // Always calculate total deposit as sum of all deposits
    const totalDeposit = members.reduce((sum, m) => sum + m.deposit_amount, 0);

    // Build tenant contact details (all tenants)
    const tenantContactDetails = members.map(m => {
      const email = m.email;
      const phone = m.phone ? `, ${m.phone}` : '';
      return `${m.first_name} ${m.last_name}: ${email}${phone}`;
    }).join('\n');

    // For room-only, only show the primary tenant's room
    const roomsList = tenancy.tenancy_type === 'room_only' && primaryTenant.bedroom_name
      ? primaryTenant.bedroom_name
      : '';

    // Build company address from settings
    const companyAddressParts = [
      settings.address_line1,
      settings.address_line2,
      settings.city,
      settings.postcode
    ].filter(Boolean);
    const companyAddress = companyAddressParts.join(', ');

    // Build full property address
    const propertyAddressParts = [
      tenancy.address_line1,
      tenancy.address_line2,
      tenancy.city,
      tenancy.postcode
    ].filter(Boolean);
    const fullPropertyAddress = propertyAddressParts.join(', ');

    // Prepare template data
    const templateData = {
      // Company info
      company_name: settings.company_name || 'Letably',
      company_address: companyAddress,
      company_address_line1: settings.address_line1 || '',
      company_address_line2: settings.address_line2 || '',
      company_city: settings.city || '',
      company_postcode: settings.postcode || '',
      company_email: settings.email_address || '',
      company_phone: settings.phone_number || '',

      // Landlord info
      landlord_display_name: landlordDisplayName,
      landlord_address: landlordAddress,
      landlord_email: tenancy.landlord_email || '',
      landlord_phone: tenancy.landlord_phone || '',

      // Property info
      property_address: fullPropertyAddress,
      property_address_line1: tenancy.address_line1 || '',
      property_address_line2: tenancy.address_line2 || '',
      property_city: tenancy.city || '',
      property_postcode: tenancy.postcode || '',
      property_location: tenancy.property_location,

      // Tenancy info
      tenancy_type: tenancy.tenancy_type,
      tenancy_type_description: tenancy.tenancy_type === 'room_only' ? 'Room Only' : 'Whole House',
      start_date: formatDate(tenancy.start_date),
      end_date: formatDate(tenancy.end_date),
      status: tenancy.status,
      is_rolling_monthly: !!tenancy.is_rolling_monthly,

      // Primary tenant (the one signing this agreement)
      primary_tenant_name: primaryTenantName,
      primary_tenant_first_name: primaryTenant.first_name,
      primary_tenant_last_name: primaryTenant.last_name,
      primary_tenant_address: primaryTenant.current_address || '',
      primary_tenant_email: primaryTenant.email,
      primary_tenant_phone: primaryTenant.phone || '',
      primary_tenant_room: primaryTenant.bedroom_name || '',
      primary_tenant_rent_pppw: formatCurrency(primaryTenant.rent_pppw),
      primary_tenant_deposit: formatCurrency(primaryTenant.deposit_amount),

      // Other tenants (everyone except primary)
      other_tenants_names_list: otherTenantsNamesList,
      other_tenants_count: otherTenants.length,

      // All tenants lists (for compatibility and for sections that list everyone)
      tenant_names_list: tenantNamesList,
      tenant_contact_details: tenantContactDetails,

      // Tenants array (all tenants, for loops) - single source of truth
      tenants: members.map(m => ({
        name: `${m.first_name} ${m.last_name}`,
        first_name: m.first_name,
        last_name: m.last_name,
        address: m.current_address || '',
        email: m.email,
        phone: m.phone || '',
        room: m.bedroom_name || '',
        rent_pppw: formatCurrency(m.rent_pppw),
        deposit_amount: formatCurrency(m.deposit_amount),
        application_type: m.application_type,
        is_primary: m.id === parseInt(memberId)
      })),

      // Other tenants array (for loops - excludes primary tenant)
      other_tenants: otherTenants.map(m => ({
        name: `${m.first_name} ${m.last_name}`,
        first_name: m.first_name,
        last_name: m.last_name,
        address: m.current_address || '',
        email: m.email,
        phone: m.phone || '',
        room: m.bedroom_name || '',
        rent_pppw: formatCurrency(m.rent_pppw),
        deposit_amount: formatCurrency(m.deposit_amount),
        application_type: m.application_type
      })),

      // Rent and deposit
      individual_rents: individualRents,
      individual_deposits: individualDeposits,
      total_rent_pppw: totalRentPppw ? formatCurrency(totalRentPppw) : '',
      total_deposit: formatCurrency(totalDeposit), // Always show total deposit
      rooms_list: roomsList,

      // Bank details
      bank_name: tenancy.bank_name || '',
      bank_account_name: tenancy.bank_account_name || '',
      sort_code: tenancy.sort_code || '',
      account_number: tenancy.account_number || '',

      // Utilities
      utilities_cap: tenancy.utilities_cap_amount ? true : false,
      utilities_cap_amount: (() => {
        if (!tenancy.utilities_cap_amount) return '';
        const capAmount = Number(tenancy.utilities_cap_amount);
        // For rolling monthly, use the annual amount
        if (tenancy.is_rolling_monthly) return formatCurrency(capAmount);
        // Calculate pro-rated amount based on tenancy length
        if (tenancy.start_date && tenancy.end_date) {
          const startDate = new Date(tenancy.start_date);
          const endDate = new Date(tenancy.end_date);
          const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
          const weeks = days / 7;
          const proRatedAmount = (capAmount / 52) * weeks;
          return formatCurrency(proRatedAmount);
        }
        return formatCurrency(capAmount);
      })(),
      utilities_cap_annual_amount: tenancy.utilities_cap_amount ? formatCurrency(tenancy.utilities_cap_amount) : '',
      utilities_cap_period: (() => {
        if (!tenancy.utilities_cap_amount) return '';
        if (tenancy.is_rolling_monthly) return 'per year (pro-rated for your actual tenancy period)';
        return `for the period ${formatDate(tenancy.start_date)} to ${formatDate(tenancy.end_date)}`;
      })(),
      council_tax_included: tenancy.council_tax_in_bills ? true : false
    };

    // Get agreement sections
    const sections = await getAgreementSections(tenancy.landlord_id, 'tenancy_agreement', agencyId);

    // Render each section
    const renderedSections = sections.map(section => ({
      id: section.id,
      section_key: section.section_key,
      section_title: section.section_title,
      section_content: renderTemplate(section.section_content, templateData),
      section_order: section.section_order
    }));

    return {
      company_name: settings.company_name || 'Letably',
      is_rolling_monthly: !!tenancy.is_rolling_monthly,
      tenancy: {
        id: tenancy.id,
        property_address: fullPropertyAddress,
        start_date: tenancy.start_date,
        end_date: tenancy.end_date,
        status: tenancy.status,
        tenancy_type: tenancy.tenancy_type
      },
      landlord: {
        name: tenancy.landlord_name,
        display_name: landlordDisplayName
      },
      primary_tenant: {
        id: primaryTenant.id,
        name: primaryTenantName,
        email: primaryTenant.email,
        room: primaryTenant.bedroom_name || null,
        rent_pppw: primaryTenant.rent_pppw,
        deposit_amount: primaryTenant.deposit_amount
      },
      other_tenants: otherTenants.map(m => ({
        name: `${m.first_name} ${m.last_name}`,
        email: m.email,
        room: m.bedroom_name || null
      })),
      tenants: members.map(m => ({
        name: `${m.first_name} ${m.last_name}`,
        email: m.email,
        room: m.bedroom_name || null,
        rent_pppw: formatCurrency(m.rent_pppw),
        deposit_amount: formatCurrency(m.deposit_amount),
        is_primary: m.id === parseInt(memberId)
      })),
      sections: renderedSections
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Generate static HTML representation of a signed agreement
 * This HTML is stored when the tenant signs to preserve the exact agreement at signing time
 * @param {number} tenancyId - The tenancy ID
 * @param {number} memberId - The tenancy member ID
 * @param {string} signatureData - The signature data
 * @param {string} paymentOption - The payment option
 * @param {number} agencyId - The agency ID for multi-tenancy
 */
exports.generateAgreementHTML = async (tenancyId, memberId, signatureData = null, paymentOption = null, agencyId) => {
  const agreement = await exports.generateAgreement(tenancyId, memberId, agencyId);

  // Format payment option for display
  const paymentOptionLabels = {
    'monthly': 'Monthly – due on 1st of each month',
    'monthly_to_quarterly': 'Monthly to quarterly – monthly payments (Jul/Aug/Sep) to quarterly (Oct/Jan/Apr)',
    'quarterly': 'Quarterly – July, October, January & April',
    'upfront': 'Upfront'
  };
  const paymentOptionLabel = paymentOption ? paymentOptionLabels[paymentOption] || paymentOption : null;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tenancy Agreement - ${agreement.tenancy.property_address}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; line-height: 1.6; color: #374151; max-width: 800px; margin: 0 auto; padding: 20px;">

  <!-- Agreement Information -->
  <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <h2 style="font-weight: bold; color: #1e3a8a; margin: 0 0 8px 0; font-size: 14px;">Agreement Information</h2>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; font-size: 12px;">
      <div>
        <p style="color: #1d4ed8; font-weight: 500; margin: 0 0 4px 0;">Landlord</p>
        <p style="color: #1e3a8a; margin: 0;">${agreement.landlord.display_name}</p>
      </div>
      <div>
        <p style="color: #1d4ed8; font-weight: 500; margin: 0 0 4px 0;">Tenancy Period</p>
        <p style="color: #1e3a8a; margin: 0;">${formatDate(agreement.tenancy.start_date)}${agreement.tenancy.end_date ? ` - ${formatDate(agreement.tenancy.end_date)}` : ' (Rolling Monthly)'}</p>
      </div>
      <div>
        <p style="color: #1d4ed8; font-weight: 500; margin: 0 0 4px 0;">Signing Tenant</p>
        <p style="color: #1e3a8a; margin: 0;">${agreement.primary_tenant.name}</p>
        ${agreement.primary_tenant.room ? `<p style="color: #1d4ed8; font-size: 11px; margin: 4px 0 0 0;">Room: ${agreement.primary_tenant.room}</p>` : ''}
      </div>
    </div>
    ${agreement.other_tenants && agreement.other_tenants.length > 0 ? `
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #bfdbfe;">
      <p style="color: #1d4ed8; font-weight: 500; font-size: 12px; margin: 0 0 4px 0;">Other Tenants (${agreement.other_tenants.length})</p>
      <p style="color: #1e3a8a; font-size: 12px; margin: 0;">${agreement.other_tenants.map(t => t.name).join(', ')}</p>
    </div>
    ` : ''}
  </div>

  <!-- Agreement Header -->
  <div style="text-align: center; margin-bottom: 30px; padding-bottom: 30px; border-bottom: 2px solid #d1d5db;">
    <h1 style="font-size: 30px; font-weight: bold; color: #111827; margin: 0 0 8px 0;">ASSURED SHORTHOLD TENANCY AGREEMENT</h1>
    <p style="font-size: 16px; color: #6b7280; margin: 0 0 8px 0;">${agreement.is_rolling_monthly ? 'Periodic (Rolling Monthly) Tenancy' : 'Fixed Term Tenancy'}</p>
    <p style="font-size: 14px; color: #374151; margin: 0;">Provided under part 1 of the Housing Act 1988 and amended under part 3 of the Housing Act 1996</p>
  </div>

  <!-- Agreement Sections -->
  ${agreement.sections.map((section, index) => `
  <div style="margin-bottom: 32px;">
    <div style="display: flex; align-items: center; gap: 12px; font-size: 24px; font-weight: bold; color: #111827; margin-bottom: 16px;">
      <div style="background-color: #CF722F; color: white; width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; text-align: center; line-height: 32px;">${index + 1}</div>
      <span>${section.section_title}</span>
    </div>
    <div style="color: #4b5563; font-size: 14px;">
      ${section.section_content}
    </div>
  </div>
  `).join('')}

  <!-- Other Tenants List -->
  ${agreement.other_tenants && agreement.other_tenants.length > 0 ? `
  <div style="margin-top: 48px; padding-top: 32px; border-top: 2px solid #d1d5db;">
    <h3 style="font-weight: bold; font-size: 16px; margin: 0 0 12px 0;">Other Tenants in this Tenancy:</h3>
    <p style="font-size: 12px; color: #6b7280; margin: 0 0 8px 0;">The following tenants will each sign their own individual agreements:</p>
    <ul style="list-style: disc; margin: 0 0 0 20px; padding: 0; color: #4b5563;">
      ${agreement.other_tenants.map(tenant => `
      <li style="margin-bottom: 4px;">${tenant.name}${tenant.room ? ` (Room: ${tenant.room})` : ''}</li>
      `).join('')}
    </ul>
  </div>
  ` : ''}

  <!-- Footer -->
  <div style="margin-top: 48px; padding-top: 32px; border-top: 2px solid #d1d5db; font-size: 12px; color: #6b7280; text-align: center;">
    <p style="margin: 0;">This agreement was signed electronically on ${formatDate(new Date(), 'long')}</p>
    ${signatureData ? `<p style="margin: 8px 0 0 0; font-weight: 600; color: #111827;">Signed by: ${signatureData}</p>` : ''}
    ${paymentOptionLabel ? `<p style="margin: 8px 0 0 0; font-weight: 600; color: #111827;">Payment Option: ${paymentOptionLabel}</p>` : ''}
    <p style="margin: 8px 0 0 0;">Generated by ${agreement.company_name || 'Letably'}</p>
  </div>
</body>
</html>
  `.trim();

  return html;
};

// Export helper functions for signed documents
exports.saveSignedDocument = saveSignedDocument;
exports.getAgreementSections = getAgreementSections;
exports.renderTemplate = renderTemplate;
