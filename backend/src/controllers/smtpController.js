const db = require('../db');
const { encrypt, testSmtpConnection, getPlatformSmtpSettings } = require('../services/emailService');
const { createEmailTemplate, createInfoBox } = require('../utils/emailTemplates');
const { formatDateTime } = require('../utils/dateFormatter');
const { getAgencyBranding } = require('../services/brandingService');
const asyncHandler = require('../utils/asyncHandler');

// Get SMTP settings (without password for security)
exports.getSmtpSettings = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    'SELECT * FROM smtp_settings WHERE agency_id = $1',
    [agencyId],
    agencyId
  );
  const settings = result.rows[0];

  // Get platform settings for reference
  const platformSettings = getPlatformSmtpSettings();

  if (!settings) {
    return res.json({
      settings: {
        email_mode: 'platform',
        host: '',
        port: 587,
        secure: false,
        username: '',
        from_email: '',
        from_name: '',
        sending_paused: false,
      },
      configured: false,
      platform_from_email: platformSettings.from_email,
      platform_from_name: platformSettings.from_name,
    });
  }

  // Don't send password to frontend
  const { password, encryption_key, ...safeSettings } = settings;

  res.json({
    settings: {
      ...safeSettings,
      email_mode: safeSettings.email_mode || 'platform',
      secure: Boolean(safeSettings.secure),
      sending_paused: Boolean(safeSettings.sending_paused),
    },
    configured: settings.email_mode === 'custom' && settings.host && settings.username,
    platform_from_email: platformSettings.from_email,
    platform_from_name: platformSettings.from_name,
  });
}, 'fetch SMTP settings');

// Update email mode (platform vs custom)
exports.updateEmailMode = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { email_mode } = req.body;

  if (!['platform', 'custom'].includes(email_mode)) {
    return res.status(400).json({ error: 'Invalid email_mode. Must be "platform" or "custom"' });
  }

  // Check if settings exist
  // Defense-in-depth: explicit agency_id filtering
  const existingResult = await db.query(
    'SELECT id FROM smtp_settings WHERE agency_id = $1',
    [agencyId],
    agencyId
  );
  const existing = existingResult.rows[0];

  if (existing) {
    // Defense-in-depth: explicit agency_id filtering
    await db.query(
      `UPDATE smtp_settings SET email_mode = $1, updated_at = CURRENT_TIMESTAMP WHERE agency_id = $2`,
      [email_mode, agencyId],
      agencyId
    );
  } else {
    // Create settings with just the mode
    const platformSettings = getPlatformSmtpSettings();
    await db.query(
      `INSERT INTO smtp_settings (agency_id, email_mode, from_email, from_name)
       VALUES ($1, $2, $3, $4)`,
      [agencyId, email_mode, platformSettings.from_email, platformSettings.from_name],
      agencyId
    );
  }

  res.json({ message: 'Email mode updated successfully', email_mode });
}, 'update email mode');

// Update or create SMTP settings
exports.updateSmtpSettings = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const {
    host,
    port,
    secure,
    username,
    password,
    from_email,
    from_name,
    sending_paused,
    queue_interval_seconds,
  } = req.body;

  // Validation
  if (!host || !port || !username || !from_email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if settings exist
  // Defense-in-depth: explicit agency_id filtering
  const existingResult = await db.query(
    'SELECT id, password FROM smtp_settings WHERE agency_id = $1',
    [agencyId],
    agencyId
  );
  const existing = existingResult.rows[0];

  let encryptedPassword;
  if (password) {
    // New password provided, encrypt it
    encryptedPassword = encrypt(password);
  } else if (existing && existing.password) {
    // No new password, keep existing encrypted password
    encryptedPassword = existing.password;
  } else {
    return res.status(400).json({ error: 'Password is required for initial setup' });
  }

  // Validate queue interval
  const intervalSeconds = queue_interval_seconds || 60;
  if (intervalSeconds < 10 || intervalSeconds > 3600) {
    return res.status(400).json({ error: 'Queue interval must be between 10 and 3600 seconds' });
  }

  if (existing) {
    // Update existing settings - set mode to 'custom' since they're configuring SMTP
    // Defense-in-depth: explicit agency_id filtering
    await db.query(
      `UPDATE smtp_settings SET
        email_mode = 'custom',
        host = $1,
        port = $2,
        secure = $3,
        username = $4,
        password = $5,
        from_email = $6,
        from_name = $7,
        sending_paused = $8,
        queue_interval_seconds = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE agency_id = $10
      RETURNING *`,
      [
        host,
        port,
        secure ? true : false,
        username,
        encryptedPassword,
        from_email,
        from_name,
        sending_paused ? true : false,
        intervalSeconds,
        agencyId
      ],
      agencyId
    );
  } else {
    // Create new settings with 'custom' mode
    await db.query(
      `INSERT INTO smtp_settings (
        agency_id, email_mode, host, port, secure, username, password,
        from_email, from_name, sending_paused, queue_interval_seconds
      ) VALUES ($1, 'custom', $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        agencyId,
        host,
        port,
        secure ? true : false,
        username,
        encryptedPassword,
        from_email,
        from_name,
        sending_paused ? true : false,
        intervalSeconds
      ],
      agencyId
    );
  }

  // Notify queue processor to restart with new interval
  if (global.restartEmailQueueProcessor) {
    global.restartEmailQueueProcessor();
  }

  res.json({ message: 'SMTP settings updated successfully' });
}, 'update SMTP settings');

// Test SMTP connection
exports.testSmtpConnection = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const result = await testSmtpConnection(agencyId);
  res.json(result);
}, 'test SMTP connection');

// Send test email
exports.sendTestEmail = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { to_email } = req.body;

  if (!to_email) {
    return res.status(400).json({ error: 'Recipient email is required' });
  }

  const { queueEmail } = require('../services/emailService');
  const branding = await getAgencyBranding(agencyId);

  // Queue test email (will be sent by the automatic queue processor within 60 seconds)
  const bodyContent = `
    <h1>Test Email</h1>
    <p>This is a test email from your ${branding.companyName} email system.</p>

    ${createInfoBox(
      '<p style="margin: 0;"><strong>Success!</strong> If you\'re receiving this, your email configuration is working correctly.</p>',
      'success'
    )}

    <p style="color: #6b7280; font-size: 14px;">
      <strong>Queued at:</strong> ${formatDateTime(new Date())}
    </p>
  `;

  const emailId = await queueEmail({
    to_email,
    subject: `Test Email from ${branding.companyName}`,
    html_body: createEmailTemplate(`Test Email from ${branding.companyName}`, bodyContent, branding),
    text_body: `This is a test email from your ${branding.companyName} email system. If you're receiving this, your email configuration is working correctly!\n\nQueued at: ` + formatDateTime(new Date()),
    priority: 10, // High priority for test emails
  }, agencyId);

  res.json({
    message: `Test email queued (ID: ${emailId}). It will be sent within 60 seconds by the automatic queue processor.`,
    emailId,
  });
}, 'send test email');
