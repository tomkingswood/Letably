/**
 * Seed Agreement Sections for a landlord
 *
 * Usage: node scripts/seed-agreement-sections.js [landlord_id]
 *   - If landlord_id is provided, creates landlord-specific overrides
 *   - If omitted, creates default (agency-wide) sections
 *
 * These sections demonstrate the full template engine capabilities:
 *   - Simple variable substitution: {{variable}}
 *   - Special conditionals: {{#if_room_only}}...{{/if_room_only}}
 *   - Regular conditionals: {{#if variable}}...{{/if}}
 *   - Loops: {{#each tenants}}...{{/each}}
 *   - Nested conditionals inside loops
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../src/db');

const landlordId = process.argv[2] ? parseInt(process.argv[2], 10) : null;

async function seed() {
  // First, find the agency_id for this landlord
  let agencyId;
  if (landlordId) {
    const res = await db.systemQuery('SELECT agency_id FROM landlords WHERE id = $1', [landlordId]);
    if (res.rows.length === 0) {
      console.error(`Landlord ${landlordId} not found`);
      process.exit(1);
    }
    agencyId = res.rows[0].agency_id;
    console.log(`Seeding agreement sections for landlord ${landlordId} (agency ${agencyId})`);
  } else {
    // Default to agency 1
    agencyId = 1;
    console.log(`Seeding default agreement sections for agency ${agencyId}`);
  }

  // Clear existing sections for this landlord (or defaults if no landlord)
  // Use db.query with agencyId to set RLS context (required when relforcerowsecurity is on)
  if (landlordId) {
    await db.query(
      'DELETE FROM agreement_sections WHERE landlord_id = $1 AND agency_id = $2',
      [landlordId, agencyId],
      agencyId
    );
    console.log(`Cleared existing sections for landlord ${landlordId}`);
  } else {
    await db.query(
      'DELETE FROM agreement_sections WHERE landlord_id IS NULL AND agency_id = $1',
      [agencyId],
      agencyId
    );
    console.log('Cleared existing default sections');
  }

  const sections = [
    // ── Section 1: Parties to the Agreement ──────────────────────────
    {
      section_key: 'parties',
      section_title: 'Parties to this Agreement',
      section_order: 1,
      section_content: `<p>This Assured Shorthold Tenancy Agreement is made between:</p>
<p><strong>The Landlord:</strong> {{landlord_display_name}}</p>
<p>Address: {{landlord_address}}</p>
<p>Email: {{landlord_email}} | Phone: {{landlord_phone}}</p>
<p><strong>The Managing Agent:</strong> {{company_name}}</p>
<p>Address: {{company_address}}</p>
<p>Email: {{company_email}} | Phone: {{company_phone}}</p>
<p><strong>The Tenant:</strong> {{primary_tenant_name}}</p>
<p>Current Address: {{primary_tenant_address}}</p>
<p>Email: {{primary_tenant_email}} | Phone: {{primary_tenant_phone}}</p>
{{#if other_tenants_count}}<p><strong>Other Tenants in this Property ({{other_tenants_count}}):</strong> {{other_tenants_names_list}}</p>
<p><em>Each tenant listed above will sign their own individual agreement.</em></p>{{/if}}`
    },

    // ── Section 2: Property Details ──────────────────────────────────
    {
      section_key: 'property_details',
      section_title: 'The Property',
      section_order: 2,
      section_content: `<p>The property that is the subject of this agreement is:</p>
<p><strong>{{property_address}}</strong></p>
{{#if_room_only}}<p>This is a <strong>Room Only</strong> tenancy. The Tenant is granted exclusive use of the following room:</p>
<p><strong>{{primary_tenant_room}}</strong></p>
<p>The Tenant shall also have shared use of the common areas including the kitchen, bathroom(s), and any communal living spaces within the property.</p>{{/if_room_only}}
{{#if_whole_house}}<p>This is a <strong>Whole House</strong> tenancy. The Tenant is granted use of the entire property and all rooms within it.</p>{{/if_whole_house}}`
    },

    // ── Section 3: Term of the Tenancy ───────────────────────────────
    {
      section_key: 'tenancy_term',
      section_title: 'Term of the Tenancy',
      section_order: 3,
      section_content: `{{#if_fixed_term}}<p>This tenancy is granted for a <strong>fixed term</strong> beginning on <strong>{{start_date}}</strong> and ending on <strong>{{end_date}}</strong>.</p>
<p>At the end of the fixed term, if neither party serves notice, the tenancy will automatically become a periodic (rolling monthly) tenancy under the same terms and conditions.</p>
<p>During the fixed term, the Tenant may not terminate this agreement early unless:</p>
<ul>
<li>A break clause has been agreed in writing between both parties</li>
<li>The Landlord agrees in writing to an early surrender of the tenancy</li>
<li>A suitable replacement tenant is found and approved by the Landlord/Agent</li>
</ul>{{/if_fixed_term}}
{{#if_rolling_monthly}}<p>This tenancy is a <strong>periodic (rolling monthly) tenancy</strong> commencing on <strong>{{start_date}}</strong>.</p>
<p>This tenancy will continue on a month-to-month basis until terminated by either party giving at least <strong>one calendar month's notice</strong> in writing, to expire at the end of a rental period.</p>
<p>The Landlord must give at least two months' notice to the Tenant in accordance with Section 21 of the Housing Act 1988.</p>{{/if_rolling_monthly}}`
    },

    // ── Section 4: Rent ──────────────────────────────────────────────
    {
      section_key: 'rent',
      section_title: 'Rent',
      section_order: 4,
      section_content: `<p>The Tenant agrees to pay rent as follows:</p>
{{#if individual_rents}}<p>Rent is calculated on an individual basis for each tenant in this property:</p>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
<thead>
<tr style="background-color: #f3f4f6;">
<th style="padding: 8px 12px; text-align: left; border: 1px solid #d1d5db;">Tenant</th>
<th style="padding: 8px 12px; text-align: left; border: 1px solid #d1d5db;">Room</th>
<th style="padding: 8px 12px; text-align: right; border: 1px solid #d1d5db;">Rent (PPPW)</th>
</tr>
</thead>
<tbody>
{{#each tenants}}
<tr>
<td style="padding: 8px 12px; border: 1px solid #d1d5db;">{{name}}{{#if is_primary}} <strong>(You)</strong>{{/if}}</td>
<td style="padding: 8px 12px; border: 1px solid #d1d5db;">{{room}}</td>
<td style="padding: 8px 12px; text-align: right; border: 1px solid #d1d5db;">&pound;{{rent_pppw}}</td>
</tr>
{{/each}}
</tbody>
</table>
<p><strong>Your rent: &pound;{{primary_tenant_rent_pppw}} per person per week.</strong></p>{{/if}}
{{#if total_rent_pppw}}<p>The rent for this tenancy is <strong>&pound;{{total_rent_pppw}} per person per week</strong>.</p>{{/if}}
<p>Rent is due in advance. The first payment is due on or before the commencement date of the tenancy.</p>
<p>Rent must be paid by bank transfer to the following account:</p>
<table style="width: auto; border-collapse: collapse; margin: 12px 0;">
<tr><td style="padding: 4px 12px; font-weight: bold;">Bank:</td><td style="padding: 4px 12px;">{{bank_name}}</td></tr>
<tr><td style="padding: 4px 12px; font-weight: bold;">Account Name:</td><td style="padding: 4px 12px;">{{bank_account_name}}</td></tr>
<tr><td style="padding: 4px 12px; font-weight: bold;">Sort Code:</td><td style="padding: 4px 12px;">{{sort_code}}</td></tr>
<tr><td style="padding: 4px 12px; font-weight: bold;">Account Number:</td><td style="padding: 4px 12px;">{{account_number}}</td></tr>
</table>`
    },

    // ── Section 5: Deposit ───────────────────────────────────────────
    {
      section_key: 'deposit',
      section_title: 'Deposit',
      section_order: 5,
      section_content: `<p>The Tenant shall pay a deposit as security for the performance of the Tenant's obligations and to cover any damage or unpaid rent.</p>
{{#if individual_deposits}}<p>Deposits vary by tenant:</p>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
<thead>
<tr style="background-color: #f3f4f6;">
<th style="padding: 8px 12px; text-align: left; border: 1px solid #d1d5db;">Tenant</th>
<th style="padding: 8px 12px; text-align: right; border: 1px solid #d1d5db;">Deposit Amount</th>
</tr>
</thead>
<tbody>
{{#each tenants}}
<tr>
<td style="padding: 8px 12px; border: 1px solid #d1d5db;">{{name}}{{#if is_primary}} <strong>(You)</strong>{{/if}}</td>
<td style="padding: 8px 12px; text-align: right; border: 1px solid #d1d5db;">&pound;{{deposit_amount}}</td>
</tr>
{{/each}}
</tbody>
</table>
<p><strong>Your deposit: &pound;{{primary_tenant_deposit}}</strong></p>{{/if}}
{{#if total_deposit}}<p>The deposit amount is <strong>&pound;{{primary_tenant_deposit}}</strong>.</p>{{/if}}
<p>The deposit must be paid before or on the commencement date of the tenancy. The deposit will be protected in a government-approved tenancy deposit scheme within 30 days of receipt, and the Tenant will be provided with the prescribed information as required by law.</p>
<p>The deposit (or balance thereof) will be returned to the Tenant within 10 working days of the end of the tenancy, subject to any deductions for:</p>
<ul>
<li>Unpaid rent or other charges</li>
<li>Damage to the property beyond fair wear and tear</li>
<li>Missing items from the inventory</li>
<li>Cleaning costs if the property is not left in the same condition as at the start of the tenancy</li>
<li>Any other breach of this agreement</li>
</ul>`
    },

    // ── Section 6: Utilities & Bills ─────────────────────────────────
    {
      section_key: 'utilities',
      section_title: 'Utilities and Bills',
      section_order: 6,
      section_content: `{{#if utilities_cap}}<p>Utilities (gas, electricity, water, and broadband) are included in the rent, subject to a <strong>fair usage cap of &pound;{{utilities_cap_amount}}</strong> {{utilities_cap_period}}.</p>
<p>The annual utilities cap is <strong>&pound;{{utilities_cap_annual_amount}}</strong>. If total utility costs exceed this cap, the excess will be divided equally among all tenants and invoiced at the end of the tenancy or at the end of each billing year, whichever comes first.</p>
{{#if council_tax_included}}<p>Council Tax is <strong>included</strong> in the bills package and is covered by the Landlord.</p>{{/if}}
{{#if_room_only}}<p>As this is a room-only tenancy, utility costs are shared equally among all occupants of the property.</p>{{/if_room_only}}{{/if}}
{{#if_whole_house}}<p>The Tenant is responsible for setting up and paying all utility accounts (gas, electricity, water) and council tax in the Tenant's own name from the start date of the tenancy.</p>
<p>The Tenant must ensure all accounts are settled and closed or transferred at the end of the tenancy.</p>{{/if_whole_house}}`
    },

    // ── Section 7: Tenant Obligations ────────────────────────────────
    {
      section_key: 'tenant_obligations',
      section_title: 'Tenant Obligations',
      section_order: 7,
      section_content: `<p>The Tenant agrees to:</p>
<ol>
<li>Pay the rent on time and in the manner described in this agreement.</li>
<li>Keep the property and all fixtures, fittings, and furnishings in good condition, and not cause or permit any damage (beyond fair wear and tear).</li>
<li>Not make any alterations or additions to the property without the prior written consent of the Landlord.</li>
<li>Not assign, sublet, or part with possession of the property or any part thereof.</li>
<li>Permit the Landlord or their Agent to enter the property at reasonable times (with at least 24 hours' written notice, except in emergencies) to inspect the condition of the property or to carry out repairs.</li>
<li>Not use the property for any illegal or immoral purpose, and not cause nuisance or annoyance to neighbours.</li>
<li>Comply with all regulations made by the managing agent regarding communal areas, refuse disposal, and general conduct.</li>
<li>Inform the Landlord or Agent promptly of any disrepair or defect in the property.</li>
<li>Return all keys at the end of the tenancy. A charge may be levied for any unreturned or lost keys.</li>
{{#if_room_only}}<li>Keep their designated room ({{primary_tenant_room}}) clean and tidy at all times.</li>
<li>Respect shared spaces and other tenants' right to quiet enjoyment of the property.</li>
<li>Participate fairly in the cleaning and upkeep of shared areas (kitchen, bathrooms, communal areas).</li>{{/if_room_only}}
</ol>`
    },

    // ── Section 8: Landlord Obligations ──────────────────────────────
    {
      section_key: 'landlord_obligations',
      section_title: 'Landlord Obligations',
      section_order: 8,
      section_content: `<p>The Landlord ({{landlord_display_name}}) agrees to:</p>
<ol>
<li>Allow the Tenant to quietly enjoy the property without unnecessary interference.</li>
<li>Keep the structure and exterior of the property in good repair, including drains, gutters, and external pipes.</li>
<li>Keep in repair and proper working order the installations for the supply of water, gas, electricity, and sanitation.</li>
<li>Keep in repair and proper working order the installations for space heating and heating water.</li>
<li>Ensure the property meets all applicable health and safety standards, including a valid Gas Safety Certificate and satisfactory Electrical Installation Condition Report (EICR).</li>
<li>Protect the Tenant's deposit in a government-approved scheme within 30 days and provide prescribed information.</li>
<li>Give at least 24 hours' written notice before entering the property, except in cases of emergency.</li>
<li>Ensure the property is fit for habitation as required by the Homes (Fitness for Human Habitation) Act 2018.</li>
<li>Provide the Tenant with the Landlord's name and address, and a contact address for service of notices.</li>
</ol>`
    },

    // ── Section 9: Maintenance & Repairs ─────────────────────────────
    {
      section_key: 'maintenance',
      section_title: 'Maintenance and Repairs',
      section_order: 9,
      section_content: `<p>Maintenance requests should be reported promptly to the managing agent ({{company_name}}) via the tenant portal or by contacting {{company_email}}.</p>
<p><strong>Emergency repairs</strong> (burst pipes, gas leaks, total loss of heating in winter, security breaches) should be reported immediately by phone to {{company_phone}}.</p>
<p>The Landlord is responsible for structural repairs and maintaining installations as outlined in Section 11 of the Landlord and Tenant Act 1985.</p>
<p>The Tenant is responsible for:</p>
<ul>
<li>Minor day-to-day maintenance (replacing light bulbs, unblocking sinks caused by tenant misuse, etc.)</li>
<li>Any damage caused by the Tenant, their guests, or their household</li>
<li>Reporting any issues promptly to prevent further damage</li>
</ul>
{{#if_room_only}}<p>For shared areas, maintenance responsibilities are shared among all tenants. Issues with communal facilities should be reported to the agent so they can be resolved fairly.</p>{{/if_room_only}}`
    },

    // ── Section 10: Tenant Details (Loop Demonstration) ──────────────
    {
      section_key: 'tenant_schedule',
      section_title: 'Schedule of Tenants',
      section_order: 10,
      section_content: `<p>The following tenants are party to tenancy agreements for the property at <strong>{{property_address}}</strong>:</p>
<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
<thead>
<tr style="background-color: #f3f4f6;">
<th style="padding: 8px 12px; text-align: left; border: 1px solid #d1d5db;">Tenant Name</th>
<th style="padding: 8px 12px; text-align: left; border: 1px solid #d1d5db;">Email</th>
<th style="padding: 8px 12px; text-align: left; border: 1px solid #d1d5db;">Phone</th>
{{#if_room_only}}<th style="padding: 8px 12px; text-align: left; border: 1px solid #d1d5db;">Room</th>{{/if_room_only}}
<th style="padding: 8px 12px; text-align: right; border: 1px solid #d1d5db;">Rent (PPPW)</th>
<th style="padding: 8px 12px; text-align: right; border: 1px solid #d1d5db;">Deposit</th>
</tr>
</thead>
<tbody>
{{#each tenants}}
<tr>
<td style="padding: 8px 12px; border: 1px solid #d1d5db;">{{name}}{{#if is_primary}} <em>(this agreement)</em>{{/if}}</td>
<td style="padding: 8px 12px; border: 1px solid #d1d5db;">{{email}}</td>
<td style="padding: 8px 12px; border: 1px solid #d1d5db;">{{phone}}</td>
{{#if room}}<td style="padding: 8px 12px; border: 1px solid #d1d5db;">{{room}}</td>{{/if}}
<td style="padding: 8px 12px; text-align: right; border: 1px solid #d1d5db;">&pound;{{rent_pppw}}</td>
<td style="padding: 8px 12px; text-align: right; border: 1px solid #d1d5db;">&pound;{{deposit_amount}}</td>
</tr>
{{/each}}
</tbody>
</table>
<p><strong>Total deposit held: &pound;{{total_deposit}}</strong></p>`
    },

    // ── Section 11: Ending the Tenancy ───────────────────────────────
    {
      section_key: 'ending_tenancy',
      section_title: 'Ending the Tenancy',
      section_order: 11,
      section_content: `{{#if_fixed_term}}<p>This tenancy will end on <strong>{{end_date}}</strong> unless:</p>
<ul>
<li>Both parties agree in writing to renew or extend the tenancy</li>
<li>The tenancy becomes periodic (rolling monthly) by operation of law</li>
</ul>
<p>If the Tenant wishes to leave at the end of the fixed term, the Tenant must give at least <strong>one month's written notice</strong> before the end date.</p>{{/if_fixed_term}}
{{#if_rolling_monthly}}<p>Either party may end this periodic tenancy by giving notice:</p>
<ul>
<li><strong>Tenant:</strong> At least one calendar month's written notice, to expire at the end of a rental period</li>
<li><strong>Landlord:</strong> At least two months' notice under Section 21 of the Housing Act 1988</li>
</ul>{{/if_rolling_monthly}}
<p>At the end of the tenancy, the Tenant must:</p>
<ol>
<li>Remove all personal belongings and any rubbish</li>
<li>Leave the property in a clean and tidy condition, consistent with the check-in inventory</li>
<li>Return all keys to the managing agent ({{company_name}})</li>
<li>Provide forwarding address details for the return of the deposit</li>
{{#if_room_only}}<li>Remove all personal items from the assigned room ({{primary_tenant_room}}) and shared storage areas</li>{{/if_room_only}}
{{#if_whole_house}}<li>Arrange for final utility meter readings and notify suppliers of the change of occupant</li>
<li>Cancel or redirect any post</li>{{/if_whole_house}}
</ol>`
    },

    // ── Section 12: Governing Law ────────────────────────────────────
    {
      section_key: 'governing_law',
      section_title: 'Governing Law',
      section_order: 12,
      section_content: `<p>This agreement is governed by and shall be construed in accordance with the laws of England and Wales.</p>
<p>This agreement constitutes the entire agreement between the parties relating to the letting of the property and supersedes all prior negotiations, representations, and agreements.</p>
<p>If any provision of this agreement is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.</p>
<p>Nothing in this agreement shall affect the Tenant's statutory rights under the Housing Act 1988, the Landlord and Tenant Act 1985, the Protection from Eviction Act 1977, or any other applicable legislation.</p>
<p style="margin-top: 24px;"><strong>Managed by:</strong> {{company_name}}, {{company_address}}</p>
<p><strong>On behalf of:</strong> {{landlord_display_name}}</p>`
    }
  ];

  // Insert all sections (with RLS context set)
  for (const section of sections) {
    await db.query(`
      INSERT INTO agreement_sections (
        agency_id, landlord_id, section_key, section_title, section_content,
        section_order, is_active, agreement_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      agencyId,
      landlordId,
      section.section_key,
      section.section_title,
      section.section_content,
      section.section_order,
      true,
      'tenancy_agreement'
    ], agencyId);
    console.log(`  ✓ ${section.section_order}. ${section.section_title} (${section.section_key})`);
  }

  console.log(`\nDone! Inserted ${sections.length} agreement sections.`);
  console.log('\nTemplate features demonstrated:');
  console.log('  • Simple variables: {{landlord_display_name}}, {{property_address}}, etc.');
  console.log('  • Room-only conditionals: {{#if_room_only}}...{{/if_room_only}}');
  console.log('  • Whole-house conditionals: {{#if_whole_house}}...{{/if_whole_house}}');
  console.log('  • Fixed-term conditionals: {{#if_fixed_term}}...{{/if_fixed_term}}');
  console.log('  • Rolling monthly conditionals: {{#if_rolling_monthly}}...{{/if_rolling_monthly}}');
  console.log('  • Individual rent conditionals: {{#if individual_rents}}...{{/if}}');
  console.log('  • Individual deposit conditionals: {{#if individual_deposits}}...{{/if}}');
  console.log('  • Utilities cap conditionals: {{#if utilities_cap}}...{{/if}}');
  console.log('  • Council tax conditionals: {{#if council_tax_included}}...{{/if}}');
  console.log('  • Tenant loops: {{#each tenants}}...{{/each}}');
  console.log('  • Loop conditionals: {{#if is_primary}}...{{/if}} inside loops');

  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
