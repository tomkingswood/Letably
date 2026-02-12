/**
 * Tenancy Email Builder
 * Builds email content for tenancy-related notifications
 */

const { createEmailTemplate, createButton, createInfoBox, escapeHtml } = require('./emailTemplates');
const { formatAddress } = require('./formatAddress');
const { formatDate } = require('./dateFormatter');

/**
 * Build signing notification email for tenant
 * @param {Object} params
 * @param {string} params.tenantFirstName
 * @param {string} params.tenantSurname
 * @param {string} params.propertyAddress
 * @param {string} params.city
 * @param {string} params.startDate
 * @param {string|null} params.endDate
 * @param {string} params.signingUrl
 * @param {Object} params.branding - Agency branding object
 * @returns {{ html: string, text: string, subject: string }}
 */
function buildSigningNotificationEmail({ tenantFirstName, tenantSurname, propertyAddress, city, startDate, endDate, signingUrl, branding = {} }) {
  const tenantName = `${tenantFirstName} ${tenantSurname}`;
  const address = formatAddress(propertyAddress, city);
  const tenancyPeriod = `${formatDate(startDate)} - ${endDate ? formatDate(endDate) : 'Rolling Monthly'}`;
  const companyName = branding.companyName || 'Letably';

  const bodyContent = `
    <h1>Action Required: Sign Your Tenancy Agreement</h1>

    <p>Hello ${escapeHtml(tenantFirstName)},</p>

    <p>Your tenancy agreement is now ready for your signature!</p>

    ${createInfoBox(`
      <p style="margin: 5px 0;"><strong>Property:</strong> ${escapeHtml(address)}</p>
      <p style="margin: 5px 0;"><strong>Tenancy Period:</strong> ${escapeHtml(tenancyPeriod)}</p>
    `)}

    <p>Please review and sign your tenancy agreement by clicking the button below:</p>

    <div style="text-align: center;">
      ${createButton(signingUrl, 'Review and Sign Agreement', branding.primaryColor)}
    </div>

    <p class="text-small text-muted">Or copy and paste this link into your browser:</p>
    <p class="text-small text-muted" style="word-break: break-all;">${signingUrl}</p>

    <hr />

    ${createInfoBox(`
      <p style="margin: 5px 0;"><strong>Important:</strong> Please review your agreement carefully before signing.</p>
      <p style="margin: 5px 0;">Once all tenants have signed, we can proceed to the next stage of your tenancy.</p>
    `, 'info')}
  `;

  const html = createEmailTemplate('Tenancy Agreement Ready - Signature Required', bodyContent, branding);

  const text = `Tenancy Agreement Ready - Signature Required

Hello ${tenantFirstName},

Your tenancy agreement is now ready for your signature!

Property: ${address}
Tenancy Period: ${tenancyPeriod}

Please review and sign your tenancy agreement by visiting the following link:

${signingUrl}

IMPORTANT: Please review your agreement carefully before signing. Once all tenants have signed, we can proceed to the next stage of your tenancy.

---

${companyName}
${branding.email || ''}
${branding.website ? 'www.' + branding.website.replace(/^(https?:\/\/)?(www\.)?/, '') : ''}

${new Date().getFullYear()} ${companyName}. All rights reserved.`;

  return {
    html,
    text,
    subject: 'Tenancy Agreement Ready - Signature Required'
  };
}

/**
 * Build guarantor regeneration email
 * @param {Object} params
 * @param {string} params.guarantorName
 * @param {string} params.guarantorEmail
 * @param {string} params.tenantFirstName
 * @param {string} params.tenantSurname
 * @param {string} params.propertyAddress
 * @param {string} params.city
 * @param {string} params.tenancyStartDate
 * @param {string|null} params.tenancyEndDate
 * @param {string} params.signingUrl
 * @param {Object} params.branding - Agency branding object
 * @returns {{ html: string, text: string, subject: string }}
 */
function buildGuarantorRegenerationEmail({
  guarantorName,
  tenantFirstName,
  tenantSurname,
  propertyAddress,
  city,
  tenancyStartDate,
  tenancyEndDate,
  signingUrl,
  branding = {}
}) {
  const address = formatAddress(propertyAddress, city);
  const tenancyPeriod = `${formatDate(tenancyStartDate)} to ${tenancyEndDate ? formatDate(tenancyEndDate) : 'Rolling Monthly'}`;
  const companyName = branding.companyName || 'Letably';
  const primaryColor = branding.primaryColor || '#1E3A5F';
  const contactEmail = branding.email || 'support@letably.com';

  const bodyContent = `
    <h2>New Link: Sign Guarantor Agreement</h2>

    <p>Dear ${escapeHtml(guarantorName)},</p>

    <p>A new link has been generated for you to sign the guarantor agreement for <strong>${escapeHtml(tenantFirstName)} ${escapeHtml(tenantSurname)}</strong>.</p>

    ${createInfoBox(`
      <p style="margin: 5px 0;"><strong>Tenant:</strong> ${escapeHtml(tenantFirstName)} ${escapeHtml(tenantSurname)}</p>
      <p style="margin: 5px 0;"><strong>Property:</strong> ${escapeHtml(address)}</p>
      <p style="margin: 5px 0;"><strong>Tenancy Period:</strong> ${escapeHtml(tenancyPeriod)}</p>
    `)}

    <p><strong>Please review and sign the guarantor agreement by clicking the button below:</strong></p>

    <div style="text-align: center;">
      ${createButton(signingUrl, 'Sign Guarantor Agreement', primaryColor)}
    </div>

    ${createInfoBox(`
      <p style="margin: 0;"><strong>Important:</strong> This is a new link. Any previous links are no longer valid.</p>
    `, 'warning')}

    <p>If you have any questions, please contact us at ${escapeHtml(contactEmail)}.</p>
  `;

  const html = createEmailTemplate('Guarantor Agreement - New Link', bodyContent, branding);

  const text = `Guarantor Agreement - New Link

Dear ${guarantorName},

A new link has been generated for you to sign the guarantor agreement for ${tenantFirstName} ${tenantSurname}.

Tenant: ${tenantFirstName} ${tenantSurname}
Property: ${address}
Tenancy Period: ${tenancyPeriod}

Please review and sign the guarantor agreement by visiting:
${signingUrl}

Important: This is a new link. Any previous links are no longer valid.

If you have any questions, please contact us at ${contactEmail}.

${companyName}`;

  return {
    html,
    text,
    subject: 'Guarantor Agreement - New Link'
  };
}

/**
 * Build migration tenancy portal access email
 * @param {Object} params
 * @param {string} params.tenantFirstName
 * @param {string} params.tenantSurname
 * @param {string} params.email
 * @param {string} params.propertyAddress
 * @param {string} params.portalUrl
 * @param {Object} params.branding - Agency branding object
 * @returns {{ html: string, text: string, subject: string }}
 */
function buildMigrationPortalAccessEmail({ tenantFirstName, tenantSurname, propertyAddress, portalUrl, branding = {} }) {
  const html = createEmailTemplate(
    'Your Tenancy is Ready',
    `
      <p>Dear ${escapeHtml(tenantFirstName)},</p>
      <p>Great news! Your tenancy at <strong>${escapeHtml(propertyAddress)}</strong> has been set up in our tenant management system.</p>
      <p>You now have access to your personal tenant portal where you can:</p>
      <ul>
        <li>View your tenancy details and payment schedule</li>
        <li>See your rent payments and balances</li>
        <li>Submit and track maintenance requests</li>
        <li>Access important documents</li>
      </ul>
      ${createButton(portalUrl, 'Go to Tenant Portal', branding.primaryColor)}
      <p>If you have any questions, please don't hesitate to contact us.</p>
    `,
    branding
  );

  const text = `Dear ${tenantFirstName},

Great news! Your tenancy at ${propertyAddress} has been set up in our tenant management system.

You now have access to your personal tenant portal where you can:
- View your tenancy details and payment schedule
- See your rent payments and balances
- Submit and track maintenance requests
- Access important documents

Visit your portal: ${portalUrl}

If you have any questions, please don't hesitate to contact us.`;

  return {
    html,
    text,
    subject: `Your Tenancy - ${propertyAddress}`
  };
}

/**
 * Build migration tenancy setup email (for users who need to set password)
 * @param {Object} params
 * @param {string} params.tenantFirstName
 * @param {string} params.tenantSurname
 * @param {string} params.email
 * @param {string} params.propertyAddress
 * @param {string} params.setupUrl
 * @param {Object} params.branding - Agency branding object
 * @returns {{ html: string, text: string, subject: string }}
 */
function buildMigrationSetupEmail({ tenantFirstName, email, propertyAddress, setupUrl, branding = {} }) {
  const html = createEmailTemplate(
    'Your Tenancy is Ready',
    `
      <p>Dear ${escapeHtml(tenantFirstName)},</p>
      <p>Great news! Your tenancy at <strong>${escapeHtml(propertyAddress)}</strong> has been set up in our tenant management system.</p>
      <p>To access your personal tenant portal, you first need to set up your account password.</p>
      ${createInfoBox(`
        <p style="margin: 5px 0;"><strong>Your Email Address:</strong> ${escapeHtml(email)}</p>
        <p style="margin: 5px 0;">You'll use this to log in after setting your password.</p>
      `, 'info')}
      <div style="text-align: center;">
        ${createButton(setupUrl, 'Set Up Your Password', branding.primaryColor)}
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
    `,
    branding
  );

  const text = `Dear ${tenantFirstName},

Great news! Your tenancy at ${propertyAddress} has been set up in our tenant management system.

To access your personal tenant portal, you first need to set up your account password.

Your email address: ${email}

Set up your password here: ${setupUrl}

This link will expire in 7 days. If it expires, please contact us for a new link.

Once you've set up your password, you'll be able to:
- View your tenancy details and payment schedule
- See your rent payments and balances
- Submit and track maintenance requests
- Access important documents

If you have any questions, please don't hesitate to contact us.`;

  return {
    html,
    text,
    subject: `Your Tenancy - ${propertyAddress}`
  };
}

module.exports = {
  buildSigningNotificationEmail,
  buildGuarantorRegenerationEmail,
  buildMigrationPortalAccessEmail,
  buildMigrationSetupEmail
};
