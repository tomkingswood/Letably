/**
 * Agency Service
 *
 * Business logic for agency operations.
 */

const bcrypt = require('bcryptjs');

const AgencyModel = require('../models/agency');
const AgencySettingsModel = require('../models/agencySettings');
const db = require('../db');

/**
 * Generate URL-safe slug from name
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Ensure slug is unique
 */
async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let counter = 1;

  while (!(await AgencyModel.isSlugAvailable(slug, excludeId))) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Register new agency with admin user
 */
async function registerAgency(data) {
  const {
    agency_name,
    agency_email,
    agency_phone,
    admin_email,
    admin_password,
    admin_first_name,
    admin_last_name,
    admin_phone
  } = data;

  // Generate unique slug
  const baseSlug = generateSlug(agency_name);
  const slug = await ensureUniqueSlug(baseSlug);

  // Start transaction
  return db.transaction(async (client) => {
    // Create agency
    const agencyResult = await client.query(
      `INSERT INTO agencies (name, slug, email, phone, primary_color)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [agency_name, slug, agency_email, agency_phone, '#1E3A5F']
    );
    const agency = agencyResult.rows[0];

    // Create default site settings for the agency
    const defaultSettings = [
      ['payment_reminder_days_before', '7'],
      ['overdue_reminder_frequency', '3'],
      ['certificate_reminder_days', '30'],
      ['public_site_enabled', 'true']
    ];

    for (const [key, value] of defaultSettings) {
      await client.query(
        `INSERT INTO site_settings (agency_id, setting_key, setting_value)
         VALUES ($1, $2, $3)
         ON CONFLICT (agency_id, setting_key) DO NOTHING`,
        [agency.id, key, value]
      );
    }

    // Seed default certificate types
    const defaultCertificateTypes = [
      { name: 'Gas Safety', type: 'property', has_expiry: true, is_compliance: true, display_order: 1 },
      { name: 'EPC', type: 'property', has_expiry: true, is_compliance: true, display_order: 2 },
      { name: 'EICR', type: 'property', has_expiry: true, is_compliance: true, display_order: 3 },
      { name: 'Deposit Protection Certificate', type: 'agency', has_expiry: true, is_compliance: true, display_order: 1 },
      { name: 'How to Rent Guide', type: 'agency', has_expiry: false, is_compliance: true, display_order: 2 },
    ];

    for (const ct of defaultCertificateTypes) {
      await client.query(
        `INSERT INTO certificate_types (agency_id, name, display_name, type, has_expiry, is_compliance, display_order, is_active)
         VALUES ($1, $2, $2, $3, $4, $5, $6, true)`,
        [agency.id, ct.name, ct.type, ct.has_expiry, ct.is_compliance, ct.display_order]
      );
    }

    // Create default reminder thresholds for property certificate types
    for (const ct of defaultCertificateTypes.filter(c => c.type === 'property')) {
      await client.query(
        `INSERT INTO reminder_thresholds (agency_id, certificate_type, display_name, critical_days, medium_days, low_days, enabled, display_order)
         VALUES ($1, $2, $2, 3, 7, 30, true, $3)`,
        [agency.id, ct.name, ct.display_order]
      );
    }

    // Seed default agreement sections (for new agency registration; see also scripts/seed-agreement-sections.js)
    const defaultAgreementSections = [
      {
        section_key: 'important_notice',
        section_title: 'Important Notice',
        section_order: 1,
        section_content: `<div style="border: 2px solid #e5e7eb; padding: 20px; margin: 20px 0; background-color: #fffbeb;">
<h2 style="margin-top: 0; color: #92400e;">Important Notice</h2>
<p><strong>Do not sign this agreement without reading it. By signing this document, you are agreeing to all the conditions specified in it. If you do not understand it, you should seek advice from a Solicitor, Citizens' Advice Bureau or other legal representative.</strong></p>
</div>

<p>This document is intended to create an Assured Shorthold Tenancy Agreement in accordance with Section 19a Housing Act 1988 as amended under part 3 of the Housing Act 1996. It gives the Tenant a right to occupy the Property until the agreement is brought to an end in accordance with the provisions contained in that Act. The Tenant understands that the Landlord can recover possession at the end of the Term and may also end the tenancy early if the Tenant fails to carry out their responsibilities.</p>`
      },
      {
        section_key: 'parties',
        section_title: 'Parties',
        section_order: 2,
        section_content: `<p><strong>This agreement is between us:</strong></p>
<p>{{landlord_display_name}}<br>
{{landlord_address}}</p>

<p><strong>And you:</strong></p>
{{#each tenants}}<p>{{name}}<br>
<span style="font-size: 12px; color: #6b7280;">{{email}}</span></p>
{{/each}}

{{#if_whole_house}}<p>The person named first in the list above is signing this agreement. All persons named above are jointly and severally liable for the obligations under this tenancy.</p>{{/if_whole_house}}`
      },
      {
        section_key: 'the_property',
        section_title: 'The Property',
        section_order: 3,
        section_content: `<p><strong>Address:</strong> {{property_address}}</p>
<p><strong>Tenancy Type:</strong> {{tenancy_type_description}}</p>
{{#if_room_only}}<p><strong>Room(s):</strong> {{primary_tenant_room}}</p>{{/if_room_only}}`
      },
      {
        section_key: 'tenancy_period',
        section_title: 'Tenancy Period',
        section_order: 4,
        section_content: `<p>The tenancy will commence on <strong>{{start_date}}</strong> on a rolling monthly (periodic) basis.</p>
<p>Either party may end this tenancy by giving at least one month's written notice (two months for the Landlord).</p>

<p>This is an <strong>Assured Shorthold Tenancy</strong> as defined by the Housing Act 1988 (as amended).</p>

<div style="margin: 20px 0; padding: 15px; background-color: #f9fafb; border-left: 4px solid #3b82f6;">
<h4 style="margin-top: 0;">Renters' Rights Act 2025</h4>
<p>Under the Renters' Rights Act 2025, all assured shorthold tenancies are assured periodic tenancies. The tenancy will continue on a rolling basis until properly ended by either party in accordance with the Act.</p>
</div>`
      },
      {
        section_key: 'rent',
        section_title: 'Rent',
        section_order: 5,
        section_content: `<p>The rent is payable as follows:</p>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<thead>
<tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
<th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Tenant</th>
<th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Room</th>
<th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Rent (PPPW)</th>
</tr>
</thead>
<tbody>
{{#each tenants}}
<tr>
<td style="padding: 12px; border: 1px solid #e5e7eb;">{{name}}</td>
<td style="padding: 12px; border: 1px solid #e5e7eb;">{{room}}</td>
<td style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">\u00a3{{rent_pppw}}</td>
</tr>
{{/each}}
</tbody>
</table>

{{#if bank_name}}
<p>By bank transfer to:</p>
<ul>
<li><strong>Bank:</strong> {{bank_name}}</li>
<li><strong>Account Name:</strong> {{bank_account_name}}</li>
<li><strong>Sort Code:</strong> {{sort_code}}</li>
<li><strong>Account Number:</strong> {{account_number}}</li>
</ul>
<p><strong>Reference:</strong> Please use your name and property address as the payment reference.</p>
{{/if}}

<h3>Rent Increases</h3>
<p>The Landlord may increase the rent no more than <strong>once per year</strong> by serving a notice under <strong>Section 13 of the Housing Act 1988</strong>. Any rent increase must reflect the market rate and the Tenant has the right to challenge any increase they consider above market rate by applying to the First-tier Tribunal (Property Chamber).</p>
<p>Any clause or agreement that attempts to bypass the Section 13 procedure is void under the Renters' Rights Act 2025.</p>`
      },
      {
        section_key: 'deposit',
        section_title: 'Deposit',
        section_order: 6,
        section_content: `<p>A deposit is payable as follows:</p>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<thead>
<tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
<th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Tenant</th>
<th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">Deposit Amount</th>
</tr>
</thead>
<tbody>
{{#each tenants}}
<tr>
<td style="padding: 12px; border: 1px solid #e5e7eb;">{{name}}</td>
<td style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">\u00a3{{deposit_amount}}</td>
</tr>
{{/each}}
</tbody>
<tfoot>
<tr style="background-color: #f3f4f6; border-top: 2px solid #e5e7eb; font-weight: bold;">
<td style="padding: 12px; border: 1px solid #e5e7eb;">Total Deposit</td>
<td style="padding: 12px; text-align: right; border: 1px solid #e5e7eb;">\u00a3{{total_deposit}}</td>
</tr>
</tfoot>
</table>

<p>The deposit will be held and protected in a Government-approved tenancy deposit protection scheme in accordance with the Housing Act 2004. The Landlord will not pay interest on the deposit.</p>

<div style="margin: 20px 0; padding: 15px; background-color: #f9fafb; border-left: 4px solid #3b82f6;">
<h4 style="margin-top: 0;">Deposit Terms:</h4>
<ul style="margin-bottom: 0;">
<li>The deposit is held as security for the performance of the tenant's obligations under this agreement and to compensate the Landlord for any breach of these obligations.</li>
<li>The deposit will be returned only once possession of the property has been returned to the Landlord/Agent with all keys and any deductions have been mutually agreed in writing.</li>
<li>In the event that the total amount lawfully due at the end of the tenancy exceeds the amount of the deposit, the tenant shall reimburse the landlord within 14 days of written request.</li>
<li>The Landlord reserves the right to use the deposit for any non-payment of rent.</li>
</ul>
</div>`
      },
      {
        section_key: 'bills_and_utilities',
        section_title: 'Bills and Utilities',
        section_order: 7,
        section_content: `<p>Unless otherwise agreed in writing, the Tenant is responsible for all utility bills and charges during the tenancy, including but not limited to:</p>
<ul>
<li>Gas and electricity</li>
<li>Water and sewerage</li>
<li>Internet and telephone</li>
<li>TV licence</li>
{{#if council_tax_included}}<li><strong>Council Tax</strong> is included in the rent</li>{{/if}}
</ul>

{{#if utilities_cap}}
<div style="margin: 20px 0; padding: 15px; background-color: #f9fafb; border-left: 4px solid #3b82f6;">
<h4 style="margin-top: 0;">Utilities Allowance</h4>
<p>A utilities allowance of <strong>\u00a3{{utilities_cap_amount}}</strong> is included {{utilities_cap_period}}. Should usage exceed this allowance, any additional charges will be split equally between the tenants of the property.</p>
</div>
{{/if}}

<p>Where utility supply issues arise (e.g. water pressure, power outages), it is the tenant's responsibility to contact the relevant supplier directly. The Landlord is not liable for service disruptions caused by third-party providers.</p>`
      },
      {
        section_key: 'tenant_obligations',
        section_title: 'Tenant Obligations',
        section_order: 8,
        section_content: `<p><strong>You the Tenant must do the following:</strong></p>
<ol>
<li>Pay your rent on or before the dates agreed in the payment schedule, without deduction. All rental payments are made in advance of the period to which they relate.</li>
<li>In cases of late payment of rent, you will have to pay interest on this amount where you are 14 days or more in arrears. The interest rate applicable is 3% above the Bank of England base rate, in accordance with the Tenant Fees Act 2019.</li>
<li>Promptly notify the Landlord or Landlord's Agent of any defect or damage to the property.</li>
<li>Do not remove any of the supplied fixtures and fittings from the property.</li>
<li>Keep the property sufficiently well aired and warmed to avoid build-up of condensation and mildew growth and to protect it from frost.</li>
<li>Keep the inside of the property in at least as good a condition as when the tenancy started (apart from fair wear and tear).</li>
<li>Keep the external areas of the property presentable and ensure that no rubbish is allowed to accumulate. Present refuse bins for collection on the relevant days.</li>
<li>You will be liable for charges for repairs to damage caused deliberately or through neglect or carelessness by you or anyone visiting you at the property.</li>
<li>Whenever you leave the property unattended, you must lock all doors and windows. You must notify the Landlord if the property will be unoccupied for more than 28 consecutive days.</li>
<li>The Tenant is not permitted to assign, sublet or share possession with any person not named in this agreement without the Landlord's prior written consent.</li>
<li>Allow the Landlord access to the property at reasonable hours to inspect its condition, carry out repairs or show prospective tenants. A minimum of 24 hours' written notice will be given except in emergencies.</li>
<li>You must allow immediate access in the event of an emergency.</li>
<li>Check the inventory and report any errors to the Landlord's Agent within 7 days of receipt.</li>
<li>Pay the reasonable costs for replacing keys and/or locks if you fail to return any key at the end of the tenancy.</li>
<li>It is your responsibility to organise your own contents insurance for your belongings. We highly recommend this as your belongings are otherwise uninsured in case of fire or theft.</li>
<li>Allow possible new tenants to view the property with a minimum of 24 hours' notice during the tenancy.</li>
</ol>`
      },
      {
        section_key: 'landlord_obligations',
        section_title: 'Landlord Obligations',
        section_order: 9,
        section_content: `<p><strong>We the Landlord agree to do the following:</strong></p>
<ol>
<li>Allow the Tenant quiet enjoyment of the property during the tenancy without any unlawful interruption from the Landlord or any person on behalf of the Landlord.</li>
<li>Keep the property insured against fire and other comprehensive risks. This does not include insurance for the Tenant's own belongings.</li>
<li>Be responsible for servicing and maintaining any gas heating system and ensuring all gas appliances are checked each year by a Gas Safe registered engineer, in line with the Gas Safety (Installation and Use) Regulations 1998.</li>
<li>Be responsible for ensuring any furniture provided complies with the Furniture and Furnishings (Fire) (Safety) Regulations.</li>
<li>Keep the structure and exterior of the property in good repair, in accordance with Section 11 of the Landlord and Tenant Act 1985.</li>
<li>Keep installations for the supply of water, gas, electricity, sanitation, space heating and water heating in good repair and proper working order.</li>
<li>Carry out necessary repairs in a reasonable timeframe once notified in writing by the Tenant.</li>
<li>Give the Tenant a minimum of 24 hours' written notice before accessing the property, except in an emergency.</li>
<li>Ensure the property meets the Homes (Fitness for Human Habitation) Act 2018 requirements.</li>
<li>Ensure smoke alarms are installed on every storey and carbon monoxide detectors in rooms with solid fuel burning appliances, and check they are in working order at the start of the tenancy.</li>
<li>Refund any rent paid which relates to a period after the tenancy ends.</li>
<li>Provide the Tenant with a copy of the Government's "How to Rent" guide, a valid Gas Safety Certificate, Energy Performance Certificate, and Electrical Installation Condition Report before the tenancy begins.</li>
</ol>`
      },
      {
        section_key: 'maintenance_and_repairs',
        section_title: 'Maintenance and Repairs',
        section_order: 10,
        section_content: `<p>The Tenant must report any maintenance issues or repairs needed to {{company_name}} as soon as possible.</p>

<p><strong>Emergency repairs:</strong> If there is an emergency (such as no heating or hot water, a major leak, or a gas leak), the Tenant should contact {{company_name}} immediately.</p>

<p><strong>Tenant responsibility:</strong> The Tenant is responsible for minor maintenance, including:</p>
<ul>
<li>Unblocking sinks and drains (unless caused by a structural issue)</li>
<li>Keeping the property clean and free from damp caused by condensation</li>
<li>Keeping appliances (oven, fridge, freezer) clean</li>
<li>Replacing light bulbs and batteries in smoke/CO detectors</li>
</ul>

<p><strong>Damage by tenant:</strong> If damage is caused by the Tenant or their visitors, the Tenant will be responsible for the cost of repairs.</p>`
      },
      {
        section_key: 'access_and_inspections',
        section_title: 'Access and Inspections',
        section_order: 11,
        section_content: `<p>The Landlord or their representative may access the property:</p>
<ul>
<li>For routine inspections (with at least 24 hours' written notice)</li>
<li>To carry out repairs or maintenance (with reasonable notice)</li>
<li>In case of emergency (without notice)</li>
<li>To show prospective tenants or buyers</li>
</ul>
<p>Routine inspections will be conducted periodically to ensure the property is being maintained properly.</p>`
      },
      {
        section_key: 'termination',
        section_title: 'Termination',
        section_order: 12,
        section_content: `<h3>End of Tenancy</h3>

<p><strong>Periodic tenancy:</strong> This is a rolling monthly tenancy. The Tenant may end this tenancy by giving at least one month's written notice. The Landlord may only seek possession by serving the appropriate notice under Section 8 of the Housing Act 1988 (as amended), using one of the grounds specified in Schedule 2 of that Act.</p>

<p><strong>Possession by landlord:</strong> The Landlord may only seek to recover possession of the property by serving notice and obtaining a court order under <strong>Section 8 of the Housing Act 1988</strong> (as amended by the Renters' Rights Act 2025). The Landlord cannot serve a Section 21 (no-fault eviction) notice. Valid grounds for possession include rent arrears, breach of tenancy obligations, the landlord wishing to sell the property, or the landlord or a close family member wishing to move in, subject to the notice periods and conditions specified in the Act.</p>

<p><strong>End of tenancy requirements:</strong></p>
<ul>
<li>Return the property in the same condition as at the start, fair wear and tear excepted</li>
<li>Return all keys</li>
<li>Remove all personal belongings</li>
<li>Leave the property clean and tidy</li>
<li>Redirect your post</li>
</ul>`
      },
      {
        section_key: 'notices',
        section_title: 'Notices',
        section_order: 13,
        section_content: `<p>All notices must be in writing and delivered by:</p>
<ul>
<li>Hand delivery</li>
<li>First class post</li>
<li>Email (if agreed by both parties)</li>
</ul>

<p><strong>{{company_name}}'s contact details:</strong></p>
<ul>
<li>Email: {{company_email}}</li>
{{#if company_phone}}<li>Telephone: {{company_phone}}</li>{{/if}}
{{#if company_address}}<li>Address: {{company_address}}</li>{{/if}}
</ul>

<p><strong>Tenant's contact details:</strong></p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<thead>
<tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
<th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Name</th>
<th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Email</th>
<th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb;">Phone</th>
</tr>
</thead>
<tbody>
{{#each tenants}}
<tr>
<td style="padding: 12px; border: 1px solid #e5e7eb;">{{name}}</td>
<td style="padding: 12px; border: 1px solid #e5e7eb;">{{email}}</td>
<td style="padding: 12px; border: 1px solid #e5e7eb;">{{phone}}</td>
</tr>
{{/each}}
</tbody>
</table>`
      },
      {
        section_key: 'prohibitions',
        section_title: 'Prohibitions and Restrictions',
        section_order: 14,
        section_content: `<p><strong>You must not do the following:</strong></p>
<ol>
<li>Make any alterations or additions to the structure, fixtures or furnishings of the property without prior written consent.</li>
<li>Do anything that may be a nuisance or annoyance to neighbours.</li>
<li>Keep any pets at the property without the Landlord's prior written consent. Under the Renters' Rights Act 2025, the Tenant has the right to request permission to keep a pet and the Landlord must not unreasonably refuse. The Landlord may require the Tenant to obtain appropriate pet insurance as a condition of consent.</li>
<li>Tamper with fire safety equipment (smoke alarms, heat detectors, fire blankets or extinguishers).</li>
<li>Sublet the property or any part of it without prior written consent.</li>
<li>Carry on any profession, trade or business at the property.</li>
<li>Use the property for anything other than as a private residential dwelling.</li>
<li>Use any paraffin or portable gas heaters.</li>
<li>Smoke within the property.</li>
<li>Use the property for any illegal or immoral purpose.</li>
</ol>`
      },
      {
        section_key: 'data_protection',
        section_title: 'Data Protection',
        section_order: 15,
        section_content: `<p>The Landlord will process the Tenant's personal data in accordance with the General Data Protection Regulation (GDPR) and the Data Protection Act 2018.</p>
<p>Personal data will be used for:</p>
<ul>
<li>Managing the tenancy</li>
<li>Processing rent payments</li>
<li>Complying with legal obligations</li>
<li>Protecting the Landlord's legitimate interests</li>
</ul>
<p>Personal data will not be shared with third parties except:</p>
<ul>
<li>As required by law</li>
<li>With the Tenant's consent</li>
<li>With service providers (e.g. deposit protection schemes, maintenance contractors)</li>
</ul>`
      },
      {
        section_key: 'general_provisions',
        section_title: 'General Provisions',
        section_order: 16,
        section_content: `<ul>
{{#if_whole_house}}<li><strong>Joint and several liability:</strong> Where there is more than one tenant, each tenant is jointly and severally liable for all obligations under this agreement. This means each tenant is responsible for the full rent and all other obligations, not just their share.</li>{{/if_whole_house}}
<li><strong>Entire agreement:</strong> This agreement constitutes the entire agreement between the parties and supersedes all previous agreements.</li>
<li><strong>Amendments:</strong> Any changes to this agreement must be made in writing and signed by both parties.</li>
<li><strong>Governing law:</strong> This agreement is governed by the laws of England and Wales.</li>
<li><strong>Severability:</strong> If any provision of this agreement is found to be invalid or unenforceable, the remaining provisions will continue in full force.</li>
</ul>`
      },
    ];

    for (const section of defaultAgreementSections) {
      await client.query(
        `INSERT INTO agreement_sections (agency_id, landlord_id, section_key, section_title, section_content, section_order, is_active, agreement_type)
         VALUES ($1, NULL, $2, $3, $4, $5, true, 'tenancy_agreement')`,
        [agency.id, section.section_key, section.section_title, section.section_content, section.section_order]
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(admin_password, 10);

    // Create admin user
    const userResult = await client.query(
      `INSERT INTO users (agency_id, email, password_hash, first_name, last_name, phone, role, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, 'admin', true)
       RETURNING id, email, first_name, last_name, role`,
      [agency.id, admin_email.toLowerCase(), passwordHash, admin_first_name, admin_last_name, admin_phone]
    );
    const admin = userResult.rows[0];

    return {
      agency,
      admin
    };
  });
}

/**
 * Get agency public info (for login page, etc.)
 */
async function getPublicInfo(slug) {
  const agency = await AgencyModel.findBySlug(slug);

  if (!agency) {
    return null;
  }

  // Return only public fields
  return {
    id: agency.id,
    name: agency.name,
    slug: agency.slug,
    logo_url: agency.logo_url,
    primary_color: agency.primary_color,
    secondary_color: agency.secondary_color,
    show_powered_by: agency.show_powered_by,
    is_active: agency.is_active,
    property_images_enabled: agency.property_images_enabled
  };
}

/**
 * Get full agency info (for authenticated admins)
 */
async function getFullInfo(agencyId) {
  const agency = await AgencyModel.findById(agencyId);
  const settings = await AgencySettingsModel.get(agencyId);

  return {
    agency,
    settings
  };
}

/**
 * Update agency branding
 */
async function updateBranding(agencyId, data) {
  // Validate hex color format
  const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

  if (data.primary_color && !hexColorRegex.test(data.primary_color)) {
    throw new Error('Invalid primary color format. Use hex format: #RRGGBB');
  }

  if (data.secondary_color && !hexColorRegex.test(data.secondary_color)) {
    throw new Error('Invalid secondary color format. Use hex format: #RRGGBB');
  }

  return AgencyModel.updateBranding(agencyId, data);
}

/**
 * Update agency settings
 */
async function updateSettings(agencyId, data) {
  return AgencySettingsModel.update(agencyId, data);
}

/**
 * Generate or regenerate API key
 */
async function generateApiKey(agencyId) {
  return AgencyModel.generateApiKey(agencyId);
}

/**
 * Revoke API key
 */
async function revokeApiKey(agencyId) {
  return AgencyModel.revokeApiKey(agencyId);
}

/**
 * Check subscription status
 */
async function checkSubscription(agencyId) {
  const agency = await AgencyModel.findById(agencyId);

  const isExpired = agency.subscription_expires_at &&
    new Date(agency.subscription_expires_at) < new Date();

  return {
    tier: agency.subscription_tier,
    expires_at: agency.subscription_expires_at,
    is_expired: isExpired,
    is_active: agency.is_active && !isExpired
  };
}

module.exports = {
  generateSlug,
  ensureUniqueSlug,
  registerAgency,
  getPublicInfo,
  getFullInfo,
  updateBranding,
  updateSettings,
  generateApiKey,
  revokeApiKey,
  checkSubscription
};
