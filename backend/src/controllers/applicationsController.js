const { queueEmail } = require('../services/emailService');
const { getAgencyBranding } = require('../services/brandingService');
const crypto = require('crypto');
const { createEmailTemplate, createButton, createInfoBox, escapeHtml } = require('../utils/emailTemplates');
const { createUser } = require('../services/userService');
const db = require('../db');
const appRepo = require('../repositories/applicationRepository');
const asyncHandler = require('../utils/asyncHandler');
const { parseJsonField, parseJsonFields } = require('../utils/parseJsonField');

// Helper function to generate guarantor token
function generateGuarantorToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Create new application (admin only)
exports.createApplication = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const {
    user_id,
    email,
    first_name,
    last_name,
    phone,
    is_new_user,
    application_type,
    guarantor_required
  } = req.body;

  // Validation
  if (!application_type) {
    return res.status(400).json({ error: 'application_type is required' });
  }

  if (!['student', 'professional'].includes(application_type)) {
    return res.status(400).json({ error: 'application_type must be either "student" or "professional"' });
  }

  let user;
  let setupToken = null;

  if (is_new_user) {
    // Creating a new user using shared service
    try {
      const result = await createUser({
        email,
        firstName: first_name,
        lastName: last_name,
        phone,
        role: 'tenant',
      }, agencyId);

      user = result.user;
      setupToken = result.setupToken;
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  } else {
    // Using existing user
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required for existing users' });
    }

    user = await appRepo.getUserById(user_id, agencyId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
  }

  // Check if user already has an in-progress application (pending or awaiting_guarantor)
  const existingApplication = await appRepo.getUserInProgressApplication(user.id, agencyId);

  if (existingApplication) {
    const statusText = existingApplication.status === 'awaiting_guarantor' ? 'awaiting guarantor' : 'pending';
    return res.status(400).json({ error: `This user already has an in-progress application (status: ${statusText}). Please complete or cancel the existing application before creating a new one.` });
  }

  // Convert guarantor_required to boolean for PostgreSQL
  // Default to true (required) if not specified
  let guarantorRequired = true; // default
  if (guarantor_required !== undefined && guarantor_required !== null) {
    // Handle boolean, string, or number values
    guarantorRequired = (guarantor_required === true || guarantor_required === 'true' || guarantor_required === 1);
  }

  // Create application (property is assigned at tenancy creation time)
  // Pre-populate with the user's account details
  const newApplication = await appRepo.createApplication({
    agencyId,
    userId: user.id,
    applicationType: application_type,
    guarantorRequired,
    firstName: user.first_name,
    surname: user.last_name
  });

  const applicationId = newApplication.id;

  // Get site settings for email
  // Get branding for email
  const branding = await getAgencyBranding(agencyId);
  const contactEmail = branding.email || 'support@letably.com';
  const companyName = branding.companyName || 'Letably';

  if (is_new_user && setupToken) {
    // Send a SINGLE combined email: welcome + application notification
    const setupUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/setup-password/${setupToken}`;

    const bodyContent = `
      <h1>Welcome to ${escapeHtml(companyName)}!</h1>
      <p>Hi ${escapeHtml(user.first_name)},</p>

      <p>An account has been created for you with ${escapeHtml(companyName)}, and you have an application to complete.</p>

      ${createInfoBox(`
        <p style="margin: 5px 0;"><strong>Your Email Address:</strong> ${escapeHtml(user.email)}</p>
        <p style="margin: 5px 0;"><strong>Application Type:</strong> ${application_type === 'student' ? 'Student' : 'Professional'}</p>
      `, 'info')}

      <p>To get started, please set up your password first:</p>

      <div style="text-align: center;">
        ${createButton(setupUrl, 'Set Up Your Password', branding.primaryColor)}
      </div>

      <p style="font-size: 14px; color: #666;">This setup link will expire in 7 days. If it expires, please contact us for a new link.</p>

      <p>Once your password is set, you can complete your application here:</p>

      <div style="text-align: center;">
        ${createButton(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/applications/${applicationId}`, 'Complete Application')}
      </div>

      ${createInfoBox(`
        <p style="margin: 0;"><strong>Important:</strong> You must complete this application before we can proceed with your tenancy.</p>
      `, 'warning')}

      <p>If you have any questions, please contact us at ${contactEmail}.</p>
    `;

    const emailHtml = createEmailTemplate(`Welcome to ${companyName}`, bodyContent, branding);

    const emailText = `Welcome to ${companyName}!

Hi ${user.first_name},

An account has been created for you with ${companyName}, and you have an application to complete.

Your email address: ${user.email}
Application Type: ${application_type === 'student' ? 'Student' : 'Professional'}

To get started, please set up your password by visiting:
${setupUrl}

This setup link will expire in 7 days. If it expires, please contact us for a new link.

Once your password is set, you can complete your application here:
${process.env.FRONTEND_URL || 'http://localhost:3000'}/applications/${applicationId}

Important: You must complete this application before we can proceed with your tenancy.

If you have any questions, please contact us at ${contactEmail}.

${companyName}`;

    queueEmail({
      to_email: user.email,
      to_name: `${user.first_name} ${user.last_name}`,
      subject: `Welcome to ${companyName} - Complete Your Application`,
      html_body: emailHtml,
      text_body: emailText,
      priority: 1
    }, agencyId);
  } else {
    // Existing user: send application notification email only
    const bodyContent = `
      <h1>Application Created</h1>
      <p>Hello ${escapeHtml(user.first_name)},</p>

      <p>An application has been created for you to complete:</p>

      ${createInfoBox(`
        <p style="margin: 5px 0;"><strong>Application Type:</strong> ${application_type === 'student' ? 'Student' : 'Professional'}</p>
      `, 'info')}

      <p>Please click the button below to complete your application:</p>

      <div style="text-align: center;">
        ${createButton(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/applications/${applicationId}`, 'Complete Application')}
      </div>

      ${createInfoBox(`
        <p style="margin: 0;"><strong>Important:</strong> You must complete this application before we can proceed with your tenancy.</p>
      `, 'warning')}

      <p>If you have any questions, please contact us at ${contactEmail}.</p>
    `;

    const emailHtml = createEmailTemplate('Application Created', bodyContent);

    const emailText = `
Application Created

Hello ${user.first_name},

An application has been created for you to complete.

Application Type: ${application_type === 'student' ? 'Student' : 'Professional'}

Please visit the following link to complete your application:
${process.env.FRONTEND_URL || 'http://localhost:3000'}/applications/${applicationId}

Important: You must complete this application before we can proceed with your tenancy.

If you have any questions, please contact us at ${contactEmail}.

© ${new Date().getFullYear()} ${companyName}. All rights reserved.
    `;

    queueEmail({
      to_email: user.email,
      to_name: `${user.first_name} ${user.last_name}`,
      subject: `Application Created - ${companyName}`,
      html_body: emailHtml,
      text_body: emailText,
      priority: 1
    }, agencyId);
  }

  const response = {
    message: 'Application created successfully',
    application_id: applicationId,
    user_created: is_new_user,
  };

  res.status(201).json(response);
}, 'create application');

// Get all applications (admin only)
exports.getAllApplications = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { status, application_type } = req.query;

  const applications = await appRepo.getAllApplications({
    status,
    applicationType: application_type
  }, agencyId);

  parseJsonFields(applications, 'address_history');

  res.json({ applications });
}, 'fetch applications');

// Get user's applications
exports.getUserApplications = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const userId = req.user.id;

  const applications = await appRepo.getUserApplications(userId, agencyId);

  parseJsonFields(applications, 'address_history');

  res.json({ applications });
}, 'fetch applications');

// Get single application by ID (User route - enforces ownership)
exports.getApplicationById = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  const userId = req.user.id;

  const application = await appRepo.getApplicationByIdWithUser(id, agencyId);

  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Check authorization (users can only see their own applications on this route)
  // Admins must use the admin route to view other users' applications
  if (application.user_id !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  parseJsonField(application, 'address_history');

  res.json(application);
}, 'fetch application');

// Get single application by ID (Admin route - no ownership check)
exports.getApplicationByIdAdmin = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  const application = await appRepo.getApplicationByIdWithUser(id, agencyId);

  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  parseJsonField(application, 'address_history');

  res.json(application);
}, 'fetch application');

// Update/Submit application
exports.updateApplication = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  const userId = req.user.id;

  // Get existing application
  const application = await appRepo.getApplicationById(id, agencyId);

  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Check authorization (users can only update their own applications on this route)
  // Admins must use the admin route to update other users' applications
  if (application.user_id !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Only pending applications can be updated
  if (application.status !== 'pending') {
    return res.status(403).json({ error: 'This application has already been submitted and cannot be modified. Please contact us if you need to make changes.' });
  }

  // Prepare update data
  const {
    // Applicant Information
    title, title_other, date_of_birth, first_name, middle_name, surname, email, phone,
    // Current Address
    residential_status, residential_status_other, period_years, period_months,
    current_address,
    // Landlord details
    landlord_name, landlord_address, landlord_email, landlord_phone,
    // Address history
    address_history,
    // Proof of identity
    id_type,
    // Student fields
    payment_method, payment_plan, university, year_of_study, course, student_number,
    // Professional fields
    employment_type, company_name, employment_start_date,
    contact_name, contact_job_title, contact_email, contact_phone,
    company_address,
    // Guarantor
    guarantor_name, guarantor_dob, guarantor_email, guarantor_phone,
    guarantor_address, guarantor_relationship,
    // Declaration
    declaration_name, declaration_agreed,
    // Status
    submit
  } = req.body;

  // Stringify address_history - ensure it's always a string for PostgreSQL
  let addressHistoryJson;
  if (address_history) {
    addressHistoryJson = JSON.stringify(address_history);
  } else if (application.address_history) {
    // If address_history is already a string, use it; otherwise stringify it
    addressHistoryJson = typeof application.address_history === 'string'
      ? application.address_history
      : JSON.stringify(application.address_history);
  } else {
    addressHistoryJson = '[]';
  }

  // Convert boolean to boolean for PostgreSQL
  const declarationAgreedBool = declaration_agreed ? true : false;

  // Determine if this is a submission (complete) or just a save
  let newStatus = application.status;
  let completedAt = application.completed_at;
  let guarantorToken = application.guarantor_token;
  let guarantorTokenExpiresAt = application.guarantor_token_expires_at;

  if (submit && application.status === 'pending') {
    // Validate signature matches applicant's name
    const applicantFirstName = first_name || application.first_name || '';
    const applicantSurname = surname || application.surname || '';
    const expectedName = `${applicantFirstName} ${applicantSurname}`.trim().toLowerCase();

    // Remove common titles from signature and normalize
    const titles = ['mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'miss', 'miss.', 'dr', 'dr.', 'prof', 'prof.', 'rev', 'rev.', 'sir', 'sir.', 'dame', 'dame.', 'lord', 'lord.', 'lady', 'lady.'];
    let normalizedSignature = (declaration_name || '').trim().toLowerCase();

    // Remove title if present at start
    for (const t of titles) {
      if (normalizedSignature.startsWith(t + ' ')) {
        normalizedSignature = normalizedSignature.substring(t.length).trim();
        break;
      }
    }

    if (normalizedSignature !== expectedName) {
      return res.status(400).json({ error: `Signature name must match "${applicantFirstName} ${applicantSurname}"` });
    }
    // Check if guarantor is required
    if (application.guarantor_required === true) {
      // Set status to awaiting_guarantor and generate token
      newStatus = 'awaiting_guarantor';
      guarantorToken = generateGuarantorToken();
      // Set expiry to 30 days from now
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      guarantorTokenExpiresAt = expiryDate.toISOString();
    } else {
      // No guarantor required, mark as submitted (awaiting admin review)
      newStatus = 'submitted';
      completedAt = new Date().toISOString();
    }
  }

  // Update application
  await appRepo.updateApplication(id, {
    title, title_other, date_of_birth, first_name, middle_name, surname, email, phone,
    residential_status, residential_status_other, period_years, period_months,
    current_address,
    landlord_name, landlord_address, landlord_email, landlord_phone,
    address_history: addressHistoryJson,
    id_type,
    payment_method, payment_plan, university, year_of_study, course, student_number,
    employment_type, company_name, employment_start_date,
    contact_name, contact_job_title, contact_email, contact_phone,
    company_address,
    guarantor_name, guarantor_dob, guarantor_email, guarantor_phone,
    guarantor_address, guarantor_relationship,
    declaration_name, declaration_agreed: declarationAgreedBool,
    status: newStatus,
    completed_at: completedAt,
    guarantor_token: guarantorToken,
    guarantor_token_expires_at: guarantorTokenExpiresAt
  }, agencyId);

  // Sync name changes back to user account
  if (first_name || surname) {
    const updates = {};
    if (first_name) updates.first_name = first_name;
    if (surname) updates.last_name = surname;
    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`);
    const values = Object.values(updates);
    await db.query(
      `UPDATE users SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length + 1} AND agency_id = $${values.length + 2}`,
      [...values, application.user_id, agencyId],
      agencyId
    );
  }

  // If submitted, send notification email to admin
  if (submit && application.status === 'pending') {
    const user = await appRepo.getUserById(application.user_id, agencyId);

    // Get branding for emails
    const branding = await getAgencyBranding(agencyId);
    const adminEmail = branding.email || 'support@letably.com';
    const brandName = branding.companyName || 'Letably';

    const bodyContent = `
      <h1>New Application Submitted</h1>
      <p>A new ${application.application_type} application has been submitted and requires your review.</p>

      ${createInfoBox(`
        <p style="margin: 5px 0;"><strong>Applicant:</strong> ${escapeHtml(user.first_name)} ${escapeHtml(user.last_name)}</p>
        <p style="margin: 5px 0;"><strong>Application Type:</strong> ${escapeHtml(application.application_type.charAt(0).toUpperCase() + application.application_type.slice(1))}</p>
        <p style="margin: 5px 0;"><strong>Application ID:</strong> #${id}</p>
      `, 'info')}

      <div style="text-align: center;">
        ${createButton(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/applications/${id}`, 'View Application Details')}
      </div>

      <p style="color: #666; font-size: 14px; margin-top: 30px;">
        This is an automated notification from your ${brandName} application system.
      </p>
    `;

    const emailHtml = createEmailTemplate('New Application Submitted', bodyContent, branding);

    queueEmail({
      to_email: adminEmail,
      to_name: 'Admin',
      subject: 'New Application Submitted',
      html_body: emailHtml,
      text_body: `A ${application.application_type} application has been submitted by ${user.first_name} ${user.last_name}`,
      priority: 1
    }, agencyId);

    // If guarantor is required, send email to guarantor
    if (newStatus === 'awaiting_guarantor' && guarantor_email) {
      const guarantorLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/guarantor/${guarantorToken}`;

      const guarantorBodyContent = `
        <h1>Guarantor Form Required</h1>
        <p>Hello ${escapeHtml(guarantor_name || 'Guarantor')},</p>

        <p>You have been named as a guarantor for a tenancy application with ${brandName}.</p>

        ${createInfoBox(`
          <p style="margin: 5px 0;"><strong>Applicant:</strong> ${escapeHtml(user.first_name)} ${escapeHtml(user.last_name)}</p>
        `, 'info')}

        <p>To complete the guarantor process, you will need to:</p>
        <ul>
          <li>Review and confirm the application details</li>
          <li>Verify or update your information</li>
          <li>Provide a digital signature</li>
        </ul>

        <p>Click the button below to access the guarantor form:</p>

        <div style="text-align: center;">
          ${createButton(guarantorLink, 'Complete Guarantor Form')}
        </div>

        ${createInfoBox(`
          <p style="margin: 0;">This link will expire in 30 days. If you have any questions or did not expect this email, please contact ${brandName}.</p>
        `, 'warning')}
      `;

      const guarantorEmailHtml = createEmailTemplate('Guarantor Form Required', guarantorBodyContent, branding);

      queueEmail({
        to_email: guarantor_email,
        to_name: guarantor_name || 'Guarantor',
        subject: `Guarantor Form Required - ${brandName}`,
        html_body: guarantorEmailHtml,
        text_body: `Hello, you have been named as a guarantor for ${user.first_name} ${user.last_name}'s tenancy application. Please complete the guarantor form at: ${guarantorLink}`,
        priority: 1
      }, agencyId);
    }
  }

  res.json({
    message: submit ? 'Application submitted successfully' : 'Application saved successfully',
    status: newStatus
  });
}, 'update application');

// Delete application (admin only)
exports.deleteApplication = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Check if application exists
  const exists = await appRepo.applicationExists(id, agencyId);
  if (!exists) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Get all ID documents for this application
  const idDocuments = await appRepo.getIdDocumentsForApplication(id, agencyId);

  // Delete physical files from disk
  const fs = require('fs').promises;
  const path = require('path');
  const SECURE_DOCS_DIR = path.join(__dirname, '../../../secure-documents');
  const APPLICANT_DOCS_DIR = path.join(SECURE_DOCS_DIR, 'applicants');
  const GUARANTOR_DOCS_DIR = path.join(SECURE_DOCS_DIR, 'guarantors');

  for (const doc of idDocuments) {
    try {
      const directory = doc.document_type === 'applicant_id' ? APPLICANT_DOCS_DIR : GUARANTOR_DOCS_DIR;
      const filePath = path.join(directory, doc.stored_filename);
      await fs.unlink(filePath);
      console.log(`Deleted ID document file: ${doc.stored_filename}`);
    } catch (fileError) {
      // Log error but continue - file might already be deleted
      console.error(`Error deleting file ${doc.stored_filename}:`, fileError.message);
    }
  }

  // Delete application (CASCADE will delete database records)
  await appRepo.deleteApplication(id, agencyId);

  res.json({ message: 'Application deleted successfully' });
}, 'delete application');

// Get application by guarantor token (no auth required)
exports.getApplicationByGuarantorToken = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { token } = req.params;

  const application = await appRepo.getApplicationByGuarantorToken(token, agencyId);

  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Check if token has expired
  if (new Date(application.guarantor_token_expires_at) < new Date()) {
    return res.status(403).json({ error: 'This guarantor link has expired. Please contact us for a new link.' });
  }

  // Check if already completed
  if (application.guarantor_completed_at) {
    return res.status(403).json({ error: 'This guarantor form has already been completed.' });
  }

  // Only return necessary fields
  const guarantorData = {
    id: application.id,
    applicant_name: application.applicant_name,
    guarantor_name: application.guarantor_name,
    guarantor_dob: application.guarantor_dob,
    guarantor_email: application.guarantor_email,
    guarantor_phone: application.guarantor_phone,
    guarantor_address: application.guarantor_address,
    guarantor_relationship: application.guarantor_relationship,
    guarantor_id_type: application.guarantor_id_type
  };

  res.json(guarantorData);
}, 'fetch application');

// Submit guarantor form (no auth required)
exports.submitGuarantorForm = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { token } = req.params;
  const {
    guarantor_name,
    guarantor_dob,
    guarantor_email,
    guarantor_phone,
    guarantor_address,
    guarantor_relationship,
    guarantor_id_type,
    guarantor_signature_name,
    guarantor_signature_agreed
  } = req.body;

  // Validation
  if (!guarantor_signature_agreed) {
    return res.status(400).json({ error: 'You must agree to the declaration' });
  }

  const application = await appRepo.getApplicationByGuarantorTokenBasic(token, agencyId);

  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Check if token has expired
  if (new Date(application.guarantor_token_expires_at) < new Date()) {
    return res.status(403).json({ error: 'This guarantor link has expired' });
  }

  // Check if already completed
  if (application.guarantor_completed_at) {
    return res.status(403).json({ error: 'This guarantor form has already been completed' });
  }

  // Convert boolean to boolean for PostgreSQL
  const signatureAgreedBool = guarantor_signature_agreed ? true : false;

  // Update guarantor information and mark as submitted
  await appRepo.updateGuarantorInfo(token, {
    guarantor_name,
    guarantor_dob,
    guarantor_email,
    guarantor_phone,
    guarantor_address,
    guarantor_relationship,
    guarantor_id_type,
    guarantor_signature_name,
    guarantor_signature_agreed: signatureAgreedBool
  }, agencyId);

  // Get application details with user info for email
  const applicationDetails = await appRepo.getApplicationByGuarantorToken(token, agencyId);

  // Get branding for email
  const branding = await getAgencyBranding(agencyId);
  const adminEmail = branding.email || 'support@letably.com';
  const brandName = branding.companyName || 'Letably';

  const bodyContent = `
    <h1>Guarantor Form Completed</h1>
    <p>A guarantor has successfully completed their section of the application.</p>

    ${createInfoBox(`
      <p style="margin: 5px 0;"><strong>Application ID:</strong> #${applicationDetails.id}</p>
      <p style="margin: 5px 0;"><strong>Applicant:</strong> ${escapeHtml(applicationDetails.user_name)}</p>
      <p style="margin: 5px 0;"><strong>Guarantor:</strong> ${escapeHtml(guarantor_name)}</p>
      <p style="margin: 5px 0;"><strong>Relationship:</strong> ${escapeHtml(guarantor_relationship)}</p>
    `, 'success')}

    <p>The application is now complete and ready for review.</p>

    <div style="text-align: center;">
      ${createButton(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/applications/${applicationDetails.id}`, 'View Complete Application')}
    </div>
  `;

  const emailHtml = createEmailTemplate('Guarantor Form Completed', bodyContent, branding);

  queueEmail({
    to_email: adminEmail,
    to_name: `${brandName} Admin`,
    subject: 'Guarantor Form Completed - Application Ready for Review',
    html_body: emailHtml,
    text_body: `A guarantor has completed their section for application #${applicationDetails.id}. Applicant: ${applicationDetails.user_name}, Guarantor: ${guarantor_name}. The application is now complete and ready for review.`,
    priority: 2
  }, agencyId);

  res.json({ message: 'Guarantor form submitted successfully' });
}, 'submit guarantor form');

// Regenerate guarantor token (admin only)
exports.regenerateGuarantorToken = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  const application = await appRepo.getApplicationById(id, agencyId);

  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  if (application.guarantor_required !== true) {
    return res.status(400).json({ error: 'This application does not require a guarantor' });
  }

  // Generate new token
  const newToken = generateGuarantorToken();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);

  // Update token
  await appRepo.updateGuarantorToken(id, newToken, expiryDate.toISOString(), agencyId);

  // Send new email to guarantor
  if (application.guarantor_email) {
    const user = await appRepo.getUserById(application.user_id, agencyId);
    const guarantorLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/guarantor/${newToken}`;

    // Get branding for email
    const branding = await getAgencyBranding(agencyId);
    const brandName = branding.companyName || 'Letably';

    const guarantorBodyContent = `
      <h1>New Guarantor Form Link</h1>
      <p>Hello ${escapeHtml(application.guarantor_name || 'Guarantor')},</p>

      <p>A new link has been generated for you to complete the guarantor form for:</p>

      ${createInfoBox(`
        <p style="margin: 5px 0;"><strong>Applicant:</strong> ${escapeHtml(user.first_name)} ${escapeHtml(user.last_name)}</p>
      `, 'info')}

      <div style="text-align: center;">
        ${createButton(guarantorLink, 'Complete Guarantor Form')}
      </div>

      ${createInfoBox(`
        <p style="margin: 0;">This link will expire in 30 days.</p>
      `, 'warning')}
    `;

    const guarantorEmailHtml = createEmailTemplate('New Guarantor Form Link', guarantorBodyContent, branding);

    queueEmail({
      to_email: application.guarantor_email,
      to_name: application.guarantor_name || 'Guarantor',
      subject: `New Guarantor Form Link - ${brandName}`,
      html_body: guarantorEmailHtml,
      text_body: `A new link has been generated for you to complete the guarantor form. Please visit: ${guarantorLink}`,
      priority: 1
    }, agencyId);
  }

  res.json({
    message: 'Guarantor token regenerated and email sent',
    token: newToken,
    expires_at: expiryDate.toISOString()
  });
}, 'regenerate guarantor token');

// Approve application (admin only)
// Changes status from 'submitted' to 'approved', allowing user to sign tenancy agreement
exports.approveApplication = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  const application = await appRepo.getApplicationById(id, agencyId);

  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  if (application.status !== 'submitted') {
    return res.status(400).json({ error: `Cannot approve application with status '${application.status}'. Only 'submitted' applications can be approved.` });
  }

  // Update status to approved
  await appRepo.updateApplicationStatus(id, 'approved', agencyId);

  // Notify the applicant that their application was approved
  const user = await appRepo.getUserById(application.user_id, agencyId);

  if (user) {
    // Get branding for email
    const branding = await getAgencyBranding(agencyId);
    const brandName = branding.companyName || 'Letably';

    const bodyContent = `
      <h1>Application Approved!</h1>
      <p>Hello ${escapeHtml(user.first_name)},</p>

      <p>Great news! Your application has been approved.</p>

      <p>We will be in touch with next steps. Please log in to your account for updates:</p>

      <div style="text-align: center;">
        ${createButton(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`, 'Log In to Continue')}
      </div>

      <p style="color: #666; font-size: 14px;">
        If you have any questions, please don't hesitate to contact us.
      </p>
    `;

    const emailHtml = createEmailTemplate('Application Approved', bodyContent, branding);

    queueEmail({
      to_email: user.email,
      to_name: `${user.first_name} ${user.last_name}`,
      subject: `Your Application Has Been Approved - ${brandName}`,
      html_body: emailHtml,
      text_body: `Great news! Your application has been approved. We will be in touch with next steps. Please log in to your account for updates.`,
      priority: 1
    }, agencyId);
  }

  res.json({
    message: 'Application approved successfully',
    status: 'approved'
  });
}, 'approve application');

// Cleanup orphaned application files (admin only)
exports.cleanupOrphanedFiles = asyncHandler(async (req, res) => {
  const { cleanupOrphanedFiles } = require('../services/fileCleanupService');
  await cleanupOrphanedFiles();
  res.json({ message: 'Orphaned file cleanup completed successfully' });
}, 'cleanup orphaned files');
