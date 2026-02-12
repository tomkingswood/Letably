const nodemailer = require('nodemailer');
const crypto = require('crypto');
const db = require('../db');

// Encryption configuration
const ALGORITHM = 'aes-256-cbc';

// SECURITY: Require explicit encryption key - no fallback to prevent data loss
const getEncryptionKey = () => {
  const key = process.env.EMAIL_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('SECURITY: EMAIL_ENCRYPTION_KEY environment variable must be set. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  if (key.length !== 64) {
    throw new Error('SECURITY: EMAIL_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }
  return Buffer.from(key, 'hex');
};

/**
 * Encrypt sensitive data (like SMTP password)
 */
const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

/**
 * Decrypt sensitive data
 */
const decrypt = (encryptedText) => {
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

/**
 * Get platform SMTP settings from environment variables
 */
const getPlatformSmtpSettings = () => {
  return {
    email_mode: 'platform',
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    username: process.env.SMTP_USER,
    password: process.env.SMTP_PASS,
    from_email: process.env.SMTP_FROM_EMAIL || 'noreply@letably.com',
    from_name: process.env.SMTP_FROM_NAME || 'Letably',
    sending_paused: false,
  };
};

/**
 * Get SMTP settings - returns platform or custom based on agency's email_mode
 */
const getSmtpSettings = async (agencyId) => {
  try {
    const result = await db.query(
      'SELECT * FROM smtp_settings WHERE agency_id = $1',
      [agencyId],
      agencyId
    );
    const settings = result.rows[0];

    // If no settings exist or mode is 'platform', use platform SMTP
    if (!settings || settings.email_mode === 'platform') {
      return getPlatformSmtpSettings();
    }

    // Custom mode - decrypt password and return agency settings
    if (settings.password) {
      try {
        settings.password = decrypt(settings.password);
      } catch (err) {
        console.error('Error decrypting SMTP password:', err);
        // Fall back to platform SMTP if decryption fails
        return getPlatformSmtpSettings();
      }
    }

    return settings;
  } catch (err) {
    console.error('Error fetching SMTP settings:', err);
    // Fall back to platform SMTP on error
    return getPlatformSmtpSettings();
  }
};

/**
 * Get raw SMTP settings from database (for admin display, without falling back to platform)
 */
const getRawSmtpSettings = async (agencyId) => {
  try {
    const result = await db.query(
      'SELECT * FROM smtp_settings WHERE agency_id = $1',
      [agencyId],
      agencyId
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('Error fetching raw SMTP settings:', err);
    return null;
  }
};

/**
 * Create nodemailer transporter from database settings
 */
const createTransporter = async (agencyId) => {
  const settings = await getSmtpSettings(agencyId);

  if (!settings) {
    throw new Error('SMTP is not configured');
  }

  const transportConfig = {
    host: settings.host,
    port: settings.port,
    secure: settings.secure === true, // true for 465, false for other ports
    auth: {
      user: settings.username,
      pass: settings.password,
    },
  };

  return nodemailer.createTransport(transportConfig);
};

/**
 * Add email to queue
 */
const queueEmail = async (emailData, agencyId) => {
  const {
    to_email,
    to_name = null,
    subject,
    html_body,
    text_body = null,
    priority = 5,
    scheduled_at = null,
    metadata = null,
  } = emailData;

  try {
    const result = await db.query(
      `INSERT INTO email_queue (
        agency_id, to_email, to_name, subject, html_body, text_body,
        priority, scheduled_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        agencyId,
        to_email,
        to_name,
        subject,
        html_body,
        text_body,
        priority,
        scheduled_at,
        metadata ? JSON.stringify(metadata) : null
      ],
      agencyId
    );

    return result.rows[0].id;
  } catch (err) {
    console.error('Error queuing email:', err);
    throw err;
  }
};

/**
 * Send a single email
 */
const sendEmail = async (emailId, agencyId) => {
  try {
    // Get email from queue
    const emailResult = await db.query(
      'SELECT * FROM email_queue WHERE id = $1',
      [emailId],
      agencyId
    );
    const email = emailResult.rows[0];

    if (!email) {
      throw new Error('Email not found in queue');
    }

    if (email.status === 'sent') {
      throw new Error('Email already sent');
    }

    const transporter = await createTransporter(agencyId);
    const settings = await getSmtpSettings(agencyId);

    const mailOptions = {
      from: `"${settings.from_name}" <${settings.from_email}>`,
      to: email.to_name ? `"${email.to_name}" <${email.to_email}>` : email.to_email,
      subject: email.subject,
      html: email.html_body,
      text: email.text_body,
    };

    const info = await transporter.sendMail(mailOptions);

    // Mark as sent
    await db.query(
      `UPDATE email_queue
       SET status = 'sent', sent_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [emailId],
      agencyId
    );

    console.log(`Email ${emailId} sent successfully:`, info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error(`Error sending email ${emailId}:`, error);

    // Get email again for retry count
    const emailResult = await db.query(
      'SELECT retry_count FROM email_queue WHERE id = $1',
      [emailId],
      agencyId
    );
    const email = emailResult.rows[0];

    if (email) {
      // Update retry count (max 3 retries)
      const retryCount = email.retry_count + 1;
      const maxRetries = 3;
      const status = retryCount >= maxRetries ? 'failed' : 'pending';

      await db.query(
        `UPDATE email_queue
         SET status = $1,
             retry_count = $2,
             error_message = $3
         WHERE id = $4`,
        [status, retryCount, error.message, emailId],
        agencyId
      );
    }

    throw error;
  }
};

/**
 * Process email queue (send pending emails)
 */
const processQueue = async (agencyId, limit = 10) => {
  try {
    // Check if sending is paused
    const settings = await getSmtpSettings(agencyId);
    if (settings && settings.sending_paused === true) {
      console.log('[Email Queue] Sending is paused - emails will remain queued');
      return { paused: true, message: 'Email sending is paused', processed: 0 };
    }

    const now = new Date().toISOString();

    // Get pending emails (scheduled or ready to send, max 3 retries)
    const pendingResult = await db.query(
      `SELECT * FROM email_queue
       WHERE status = 'pending'
       AND retry_count < 3
       AND (scheduled_at IS NULL OR scheduled_at <= $1)
       ORDER BY priority DESC, created_at ASC
       LIMIT $2`,
      [now, limit],
      agencyId
    );
    const pendingEmails = pendingResult.rows;

    const results = [];

    for (const email of pendingEmails) {
      try {
        const result = await sendEmail(email.id, agencyId);
        results.push({ id: email.id, success: true, ...result });
      } catch (error) {
        results.push({ id: email.id, success: false, error: error.message });
      }
    }

    return results;
  } catch (err) {
    console.error('Error processing email queue:', err);
    throw err;
  }
};

/**
 * Test SMTP connection
 */
const testSmtpConnection = async (agencyId) => {
  try {
    const transporter = await createTransporter(agencyId);
    await transporter.verify();
    return { success: true, message: 'SMTP connection successful' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = {
  encrypt,
  decrypt,
  getSmtpSettings,
  getRawSmtpSettings,
  getPlatformSmtpSettings,
  createTransporter,
  queueEmail,
  sendEmail,
  processQueue,
  testSmtpConnection,
};
