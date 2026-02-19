const db = require('../db');
const { queueEmail } = require('./emailService');
const { createEmailTemplate, createButton, COLORS, escapeHtml } = require('../utils/emailTemplates');
const { formatDate } = require('../utils/dateFormatter');
const { getAgencyBranding } = require('./brandingService');

/**
 * Get reminder recipient email from settings
 */
const getReminderRecipient = async (agencyId) => {
  try {
    const result = await db.query(
      'SELECT setting_value FROM site_settings WHERE setting_key = $1',
      ['email_address'],
      agencyId
    );
    return result.rows[0] ? result.rows[0].setting_value : null;
  } catch (error) {
    console.error('Error getting reminder recipient:', error);
    return null;
  }
};

/**
 * Get last consolidated email sent date
 */
const getLastEmailSent = async (agencyId) => {
  try {
    const result = await db.query(
      'SELECT setting_value FROM site_settings WHERE setting_key = $1',
      ['last_reminder_email_sent'],
      agencyId
    );
    return result.rows[0] ? result.rows[0].setting_value : null;
  } catch (error) {
    console.error('Error getting last email sent date:', error);
    return null;
  }
};

/**
 * Update last consolidated email sent timestamp
 */
const updateLastEmailSent = async (agencyId) => {
  try {
    const now = new Date().toISOString();
    const existingResult = await db.query(
      'SELECT setting_value FROM site_settings WHERE setting_key = $1',
      ['last_reminder_email_sent'],
      agencyId
    );

    if (existingResult.rows[0]) {
      await db.query(
        'UPDATE site_settings SET setting_value = $1, updated_at = CURRENT_TIMESTAMP WHERE setting_key = $2',
        [now, 'last_reminder_email_sent'],
        agencyId
      );
    } else {
      await db.query(
        'INSERT INTO site_settings (agency_id, setting_key, setting_value) VALUES ($1, $2, $3)',
        [agencyId, 'last_reminder_email_sent', now],
        agencyId
      );
    }
  } catch (error) {
    console.error('Error updating last email sent:', error);
  }
};

/**
 * Check if consolidated email was already sent today
 */
const wasEmailSentToday = async (agencyId) => {
  const lastSent = await getLastEmailSent(agencyId);
  if (!lastSent) return false;

  const lastSentDate = new Date(lastSent);
  const today = new Date();

  // Check if same date (ignoring time)
  return lastSentDate.toDateString() === today.toDateString();
};

/**
 * Get last email notification for a specific reminder
 */
const getLastEmailForReminder = async (reminderId, recipientEmail, agencyId) => {
  try {
    const result = await db.query(`
      SELECT * FROM reminder_email_notifications
      WHERE reminder_identifier = $1 AND recipient_email = $2
      ORDER BY last_emailed_at DESC
      LIMIT 1
    `, [reminderId, recipientEmail], agencyId);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting last email for reminder:', error);
    return null;
  }
};

/**
 * Check if a reminder should be included in the consolidated email
 * Returns { should: boolean, reason: string }
 */
const shouldIncludeInEmail = async (reminder, recipientEmail, agencyId) => {
  const lastEmail = await getLastEmailForReminder(reminder.id, recipientEmail, agencyId);

  console.log(`    Checking: ${reminder.id}`);
  console.log(`      Current severity: ${reminder.severity}`);
  console.log(`      Last email record:`, lastEmail ? `${lastEmail.severity} at ${lastEmail.last_emailed_at}` : 'none');

  if (!lastEmail) {
    console.log(`      Decision: INCLUDE (never_emailed)`);
    return { should: true, reason: 'never_emailed' };
  }

  // Check if severity has increased
  const severityLevels = { low: 1, medium: 2, critical: 3 };
  const currentSeverity = severityLevels[reminder.severity];
  const previousSeverity = severityLevels[lastEmail.severity];

  console.log(`      Severity comparison: ${currentSeverity} vs ${previousSeverity}`);

  if (currentSeverity > previousSeverity) {
    console.log(`      Decision: INCLUDE (severity_increased)`);
    return { should: true, reason: 'severity_increased' };
  }

  // Already emailed at same or higher severity
  console.log(`      Decision: SKIP (already_emailed)`);
  return { should: false, reason: 'already_emailed' };
};

/**
 * Record that reminders were included in the consolidated email
 */
const recordRemindersEmailed = async (reminders, recipientEmail, agencyId) => {
  try {
    console.log(`\n  Recording ${reminders.length} reminder(s) as emailed...`);
    const now = new Date().toISOString();

    for (const reminder of reminders) {
      console.log(`    - Recording: ${reminder.id} (${reminder.severity})`);
      const result = await db.query(`
        INSERT INTO reminder_email_notifications (reminder_identifier, severity, recipient_email, last_emailed_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT(reminder_identifier, recipient_email)
        DO UPDATE SET
          severity = EXCLUDED.severity,
          last_emailed_at = EXCLUDED.last_emailed_at
        RETURNING *
      `, [reminder.id, reminder.severity, recipientEmail, now], agencyId);
      console.log(`      Row count: ${result.rowCount}`);
    }

    console.log(`  All reminders recorded\n`);
  } catch (error) {
    console.error('Error recording reminders emailed:', error);
    console.error(error.stack);
  }
};

/**
 * Generate consolidated email content for all reminders
 */
const generateConsolidatedEmail = (reminders, recipientEmail, brandName = 'Letably', agencySlug = '') => {
  const severityColors = {
    critical: '#DC2626',
    medium: '#F97316',
    low: '#FACC15'
  };

  const severityLabels = {
    critical: 'CRITICAL',
    medium: 'MEDIUM PRIORITY',
    low: 'LOW PRIORITY'
  };

  // Group reminders by severity
  const critical = reminders.filter(r => r.severity === 'critical');
  const medium = reminders.filter(r => r.severity === 'medium');
  const low = reminders.filter(r => r.severity === 'low');

  // Build subject line with counts
  const subjectParts = [];
  if (critical.length > 0) subjectParts.push(`${critical.length} Critical`);
  if (medium.length > 0) subjectParts.push(`${medium.length} Medium`);
  if (low.length > 0) subjectParts.push(`${low.length} Low`);

  const today = formatDate(new Date(), 'medium');
  const subject = `[${subjectParts.join(', ')}] ${brandName} Reminders - ${today}`;

  // Helper function to render a single reminder
  const renderReminder = (reminder) => {
    let propertyLink = '';
    if (reminder.reference_type === 'property' && reminder.reference_id) {
      propertyLink = `<a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/${agencySlug}/admin?section=properties&action=edit&id=${reminder.reference_id}" style="color: #CF722F; text-decoration: none; font-weight: 600;">View Property →</a>`;
    }

    let viewingRequestDetails = '';
    if (reminder.reference_type === 'viewing_request' && reminder.viewing_request_data) {
      const vr = reminder.viewing_request_data;
      viewingRequestDetails = `
        <div style="background-color: #FEF3C7; padding: 12px; border-radius: 4px; margin: 10px 0; border-left: 3px solid #F59E0B; font-size: 14px;">
          <p style="margin: 5px 0;"><strong>Contact:</strong> ${escapeHtml(vr.visitor_name)}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${escapeHtml(vr.visitor_email)}" style="color: #CF722F;">${escapeHtml(vr.visitor_email)}</a></p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:${escapeHtml(vr.visitor_phone)}" style="color: #CF722F;">${escapeHtml(vr.visitor_phone)}</a></p>
          ${vr.preferred_date ? `<p style="margin: 5px 0;"><strong>Preferred Date:</strong> ${formatDate(vr.preferred_date, 'full')}</p>` : ''}
          ${vr.message ? `<p style="margin: 5px 0;"><strong>Message:</strong> ${escapeHtml(vr.message)}</p>` : ''}
        </div>
      `;
    }

    return `
      <div style="background-color: white; padding: 15px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid ${severityColors[reminder.severity]};">
        <h3 style="margin: 0 0 8px 0; color: #333; font-size: 16px;">${escapeHtml(reminder.title)}</h3>
        <p style="margin: 8px 0; color: #666; font-size: 14px;">${escapeHtml(reminder.description)}</p>
        ${reminder.property_address ? `<p style="margin: 8px 0; font-weight: 600; color: #555; font-size: 14px;">${escapeHtml(reminder.property_address)} ${propertyLink ? '&nbsp;&nbsp;' + propertyLink : ''}</p>` : ''}
        ${viewingRequestDetails}
        ${reminder.expiry_date ? `<p style="margin: 8px 0; font-size: 13px; color: #777;"><strong>Expiry:</strong> ${formatDate(reminder.expiry_date)}</p>` : ''}
        ${reminder.reminder_date ? `<p style="margin: 8px 0; font-size: 13px; color: #777;"><strong>Due:</strong> ${formatDate(reminder.reminder_date)}</p>` : ''}
      </div>
    `;
  };

  // Helper function to render a severity section
  const renderSection = (title, color, items) => {
    if (items.length === 0) return '';

    return `
      <div style="margin: 30px 0;">
        <div style="background-color: ${color}; color: white; padding: 12px 20px; border-radius: 6px; margin-bottom: 15px;">
          <h2 style="margin: 0; font-size: 18px;">${title} (${items.length})</h2>
        </div>
        ${items.map(reminder => renderReminder(reminder)).join('')}
      </div>
    `;
  };

  const bodyContent = `
    <h1>${brandName} Reminders</h1>
    <p style="font-size: 14px; color: ${COLORS.textLight}; margin-bottom: 20px;">${today}</p>

    <p style="font-size: 16px; margin: 0 0 20px 0; color: #555;">
      You have <strong>${reminders.length} active reminder${reminders.length !== 1 ? 's' : ''}</strong> requiring attention:
    </p>

    ${renderSection('CRITICAL PRIORITY', severityColors.critical, critical)}
    ${renderSection('MEDIUM PRIORITY', severityColors.medium, medium)}
    ${renderSection('LOW PRIORITY', severityColors.low, low)}

    <div style="margin-top: 30px; padding: 20px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">
        View and manage all reminders in the admin panel:
      </p>
      ${createButton(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/${agencySlug}/admin?section=reminders`,
        'Open Admin Panel'
      )}
    </div>

    <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
      This is an automated daily digest from ${brandName} property management system.
    </p>
  `;

  const emailHtml = createEmailTemplate(subject, bodyContent);

  // Generate plain text version
  const textParts = [`${brandName} Reminders - ${today}`, '', `You have ${reminders.length} active reminder(s):`, ''];

  if (critical.length > 0) {
    textParts.push('CRITICAL PRIORITY:', '');
    critical.forEach(r => {
      textParts.push(`- ${r.title}`);
      textParts.push(`  ${r.description}`);
      if (r.property_address) textParts.push(`  ${r.property_address}`);
      textParts.push('');
    });
  }

  if (medium.length > 0) {
    textParts.push('MEDIUM PRIORITY:', '');
    medium.forEach(r => {
      textParts.push(`- ${r.title}`);
      textParts.push(`  ${r.description}`);
      if (r.property_address) textParts.push(`  ${r.property_address}`);
      textParts.push('');
    });
  }

  if (low.length > 0) {
    textParts.push('LOW PRIORITY:', '');
    low.forEach(r => {
      textParts.push(`- ${r.title}`);
      textParts.push(`  ${r.description}`);
      if (r.property_address) textParts.push(`  ${r.property_address}`);
      textParts.push('');
    });
  }

  textParts.push('---');
  textParts.push(`View all reminders: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/${agencySlug}/admin?section=reminders`);

  return {
    to: recipientEmail,
    subject,
    html: emailHtml,
    text: textParts.join('\n')
  };
};

/**
 * Calculate all active reminders (reuses logic from remindersController)
 */
const calculateReminders = async (agencyId) => {
  const reminders = [];

  // Get threshold configurations
  const thresholdsResult = await db.query(
    'SELECT * FROM reminder_thresholds WHERE enabled = true',
    [],
    agencyId
  );
  const thresholds = thresholdsResult.rows;

  // Get all properties
  const propertiesResult = await db.query(`
    SELECT id, address_line1
    FROM properties
  `, [], agencyId);
  const properties = propertiesResult.rows;

  // Get all property certificates with expiry dates
  const propertyCertificatesResult = await db.query(`
    SELECT
      c.entity_id as property_id,
      c.expiry_date,
      ct.name as certificate_type_name,
      ct.display_name as certificate_type_display_name
    FROM certificates c
    JOIN certificate_types ct ON c.certificate_type_id = ct.id
    WHERE c.entity_type = 'property' AND c.expiry_date IS NOT NULL
  `, [], agencyId);
  const propertyCertificates = propertyCertificatesResult.rows;

  // Group certificates by property
  const propertyCertsMap = {};
  propertyCertificates.forEach(cert => {
    if (!propertyCertsMap[cert.property_id]) {
      propertyCertsMap[cert.property_id] = [];
    }
    propertyCertsMap[cert.property_id].push(cert);
  });

  // Get global certificates from settings
  const settingsResult = await db.query(
    'SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN ($1, $2)',
    ['prs_certificate_expiry', 'cmp_certificate_expiry'],
    agencyId
  );
  const settings = settingsResult.rows;

  const globalCerts = {};
  settings.forEach(s => {
    globalCerts[s.setting_key.replace('_expiry', '')] = s.setting_value;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper function to calculate severity and days remaining
  const calculateReminderInfo = (expiryDate, threshold) => {
    if (!expiryDate) return null;

    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const daysRemaining = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    let severity = null;
    if (daysRemaining < 0 || daysRemaining <= threshold.critical_days) {
      severity = 'critical';
    } else if (daysRemaining <= threshold.medium_days) {
      severity = 'medium';
    } else if (daysRemaining <= threshold.low_days) {
      severity = 'low';
    }

    return severity ? { severity, daysRemaining, expiryDate } : null;
  };

  // Process global certificates (PRS, CMP)
  for (const threshold of thresholds) {
    if (threshold.certificate_type === 'prs_certificate' || threshold.certificate_type === 'cmp_certificate') {
      const expiryDate = globalCerts[threshold.certificate_type];
      if (expiryDate) {
        const reminderInfo = calculateReminderInfo(expiryDate, threshold);
        if (reminderInfo) {
          // Include year-month in ID to make each expiry period unique
          const expiryYearMonth = reminderInfo.expiryDate.substring(0, 7); // e.g., "2025-10"
          const key = `${threshold.certificate_type}:global:${expiryYearMonth}`;
          reminders.push({
            id: key,
            type: 'automated',
            certificate_type: threshold.certificate_type,
            title: `${threshold.display_name} Expiring`,
            description: reminderInfo.daysRemaining < 0
              ? `Expired ${Math.abs(reminderInfo.daysRemaining)} days ago`
              : `Expires in ${reminderInfo.daysRemaining} day${reminderInfo.daysRemaining !== 1 ? 's' : ''}`,
            severity: reminderInfo.severity,
            expiry_date: reminderInfo.expiryDate,
            days_remaining: reminderInfo.daysRemaining,
            reference_type: 'global',
            reference_id: null
          });
        }
      }
    }
  }

  // Process property certificates
  for (const property of properties) {
    for (const threshold of thresholds) {
      if (threshold.certificate_type === 'prs_certificate' || threshold.certificate_type === 'cmp_certificate') {
        continue;
      }

      // Check for dynamic property certificates (EPC is now handled here too)
      const propertyCerts = propertyCertsMap[property.id] || [];
      const matchingCert = propertyCerts.find(cert => cert.certificate_type_name === threshold.certificate_type);

      if (matchingCert && matchingCert.expiry_date) {
        const reminderInfo = calculateReminderInfo(matchingCert.expiry_date, threshold);
        if (reminderInfo) {
          const expiryYearMonth = reminderInfo.expiryDate.substring(0, 7);
          const key = `${threshold.certificate_type}:${property.id}:${expiryYearMonth}`;
          reminders.push({
            id: key,
            type: 'automated',
            certificate_type: threshold.certificate_type,
            title: `${threshold.display_name} Expiring - ${property.address_line1}`,
            description: reminderInfo.daysRemaining < 0
              ? `Expired ${Math.abs(reminderInfo.daysRemaining)} days ago`
              : `Expires in ${reminderInfo.daysRemaining} day${reminderInfo.daysRemaining !== 1 ? 's' : ''}`,
            severity: reminderInfo.severity,
            expiry_date: reminderInfo.expiryDate,
            days_remaining: reminderInfo.daysRemaining,
            reference_type: 'property',
            reference_id: property.id,
            property_address: property.address_line1
          });
        }
      }
    }
  }

  // Get viewing request thresholds
  const viewingPendingThreshold = thresholds.find(t => t.certificate_type === 'viewing_request_pending');
  const viewingUpcomingThreshold = thresholds.find(t => t.certificate_type === 'viewing_request_upcoming');

  // Process viewing requests if thresholds are enabled
  if (viewingPendingThreshold || viewingUpcomingThreshold) {
    const viewingRequestsResult = await db.query(`
      SELECT vr.*, p.address_line1 as property_address
      FROM viewing_requests vr
      LEFT JOIN properties p ON vr.property_id = p.id
      WHERE vr.status IN ('pending', 'confirmed')
    `, [], agencyId);
    const viewingRequests = viewingRequestsResult.rows;

    for (const vr of viewingRequests) {
      // Pending viewing requests (awaiting confirmation)
      if (vr.status === 'pending' && viewingPendingThreshold && viewingPendingThreshold.enabled) {
        const createdDate = new Date(vr.created_at);
        createdDate.setHours(0, 0, 0, 0);
        const daysSinceCreated = Math.ceil((today - createdDate) / (1000 * 60 * 60 * 24));

        let severity = null;
        if (daysSinceCreated >= viewingPendingThreshold.critical_days) {
          severity = 'critical';
        } else if (daysSinceCreated >= viewingPendingThreshold.medium_days) {
          severity = 'medium';
        } else if (daysSinceCreated >= viewingPendingThreshold.low_days) {
          severity = 'low';
        }

        if (severity) {
          const createdYearMonth = vr.created_at.substring(0, 7);
          const key = `viewing_request_pending:${vr.id}:${createdYearMonth}`;
          reminders.push({
            id: key,
            type: 'automated',
            certificate_type: 'viewing_request_pending',
            title: `Pending Viewing Request - ${vr.property_address}`,
            description: `${vr.visitor_name} (${vr.visitor_email}) requested a viewing ${daysSinceCreated} day${daysSinceCreated !== 1 ? 's' : ''} ago. Please contact and confirm.`,
            severity: severity,
            days_remaining: -daysSinceCreated,
            reference_type: 'viewing_request',
            reference_id: vr.id,
            property_address: vr.property_address,
            viewing_request_data: {
              visitor_name: vr.visitor_name,
              visitor_email: vr.visitor_email,
              visitor_phone: vr.visitor_phone,
              preferred_date: vr.preferred_date,
              message: vr.message
            }
          });
        }
      }

      // Upcoming confirmed viewings
      if (vr.status === 'confirmed' && vr.preferred_date && viewingUpcomingThreshold && viewingUpcomingThreshold.enabled) {
        const viewingDate = new Date(vr.preferred_date);
        viewingDate.setHours(0, 0, 0, 0);
        const daysUntilViewing = Math.ceil((viewingDate - today) / (1000 * 60 * 60 * 24));

        let severity = null;
        if (daysUntilViewing <= viewingUpcomingThreshold.critical_days && daysUntilViewing >= 0) {
          severity = 'critical';
        } else if (daysUntilViewing <= viewingUpcomingThreshold.medium_days) {
          severity = 'medium';
        } else if (daysUntilViewing <= viewingUpcomingThreshold.low_days) {
          severity = 'low';
        }

        if (severity) {
          const viewingYearMonth = vr.preferred_date.substring(0, 7);
          const key = `viewing_request_upcoming:${vr.id}:${viewingYearMonth}`;
          reminders.push({
            id: key,
            type: 'automated',
            certificate_type: 'viewing_request_upcoming',
            title: `Upcoming Viewing - ${vr.property_address}`,
            description: daysUntilViewing === 0
              ? `Viewing with ${vr.visitor_name} is TODAY`
              : daysUntilViewing === 1
              ? `Viewing with ${vr.visitor_name} is TOMORROW`
              : `Viewing with ${vr.visitor_name} in ${daysUntilViewing} days`,
            severity: severity,
            expiry_date: vr.preferred_date,
            days_remaining: daysUntilViewing,
            reference_type: 'viewing_request',
            reference_id: vr.id,
            property_address: vr.property_address,
            viewing_request_data: {
              visitor_name: vr.visitor_name,
              visitor_email: vr.visitor_email,
              visitor_phone: vr.visitor_phone,
              preferred_date: vr.preferred_date,
              message: vr.message
            }
          });
        }
      }
    }
  }

  // Get manual reminders
  const manualRemindersResult = await db.query(`
    SELECT mr.*, p.address_line1 as property_address
    FROM manual_reminders mr
    LEFT JOIN properties p ON mr.property_id = p.id
    ORDER BY mr.reminder_date ASC
  `, [], agencyId);
  const manualReminders = manualRemindersResult.rows;

  for (const mr of manualReminders) {
    const reminderDate = new Date(mr.reminder_date);
    reminderDate.setHours(0, 0, 0, 0);
    const daysRemaining = Math.ceil((reminderDate - today) / (1000 * 60 * 60 * 24));

    // Only show manual reminders on or after the reminder date
    if (daysRemaining <= 0) {
      reminders.push({
        id: `manual:${mr.id}`,
        type: 'manual',
        manual_id: mr.id,
        title: mr.title,
        description: mr.description || (daysRemaining < 0
          ? `Overdue by ${Math.abs(daysRemaining)} days`
          : 'Due today'),
        severity: mr.severity,
        reminder_date: mr.reminder_date,
        days_remaining: daysRemaining,
        reference_type: mr.property_id ? 'property' : 'general',
        reference_id: mr.property_id,
        property_address: mr.property_address,
        created_at: mr.created_at
      });
    }
  }

  return reminders;
};

/**
 * Main function to process and send consolidated reminder email
 *
 * @param {boolean} isManualTrigger - If true, always sends email regardless of last sent date
 * @param {string} agencyId - The agency ID for multi-tenancy
 */
const processReminderEmails = async (isManualTrigger = false, agencyId) => {
  console.log('\n=== Processing Reminder Emails ===\n');
  console.log(`Trigger type: ${isManualTrigger ? 'MANUAL' : 'AUTOMATED'}`);

  try {
    // Get recipient email
    const recipientEmail = await getReminderRecipient(agencyId);
    if (!recipientEmail) {
      console.log('No recipient email configured in settings. Skipping reminder emails.');
      return { success: false, error: 'No recipient email configured', emailsSent: 0, emailsSkipped: 0 };
    }

    console.log(`Recipient: ${recipientEmail}`);

    // Check if email was already sent today (only for automated runs)
    if (!isManualTrigger && await wasEmailSentToday(agencyId)) {
      console.log('Consolidated email already sent today. Skipping.');
      console.log('=================================\n');
      return { success: true, emailsSent: 0, emailsSkipped: 0, alreadySentToday: true };
    }

    // Calculate all current reminders
    const allReminders = await calculateReminders(agencyId);
    console.log(`Found ${allReminders.length} total reminder(s)`);

    // Filter out manual reminders that are not yet due
    const activeReminders = allReminders.filter(reminder => {
      if (reminder.type === 'manual' && reminder.days_remaining > 0) {
        console.log(`  Filtered out: ${reminder.title} (not due yet - due in ${reminder.days_remaining} days)`);
        return false;
      }
      return true;
    });

    console.log(`${activeReminders.length} reminder(s) are due`);

    // Filter out reminders that were already emailed (unless severity upgraded)
    const remindersToEmail = [];
    let skippedCount = 0;

    for (const reminder of activeReminders) {
      const decision = await shouldIncludeInEmail(reminder, recipientEmail, agencyId);
      if (decision.should) {
        remindersToEmail.push(reminder);
        console.log(`  Include: ${reminder.title} (${decision.reason})`);
      } else {
        skippedCount++;
        console.log(`  Skip: ${reminder.title} (${decision.reason})`);
      }
    }

    console.log(`\n${remindersToEmail.length} reminder(s) to include in email, ${skippedCount} skipped`);

    // Skip if no new reminders to email
    if (remindersToEmail.length === 0) {
      console.log('No new reminders to send. Skipping email.');
      console.log('=================================\n');
      return { success: true, emailsSent: 0, emailsSkipped: activeReminders.length, noReminders: true };
    }

    // Get branding for the email
    const branding = await getAgencyBranding(agencyId);
    const brandName = branding.companyName || 'Letably';

    // Generate consolidated email with only new/upgraded reminders
    const emailContent = generateConsolidatedEmail(remindersToEmail, recipientEmail, brandName, branding.agencySlug);

    // Determine priority based on highest severity
    const hasCritical = remindersToEmail.some(r => r.severity === 'critical');
    const hasMedium = remindersToEmail.some(r => r.severity === 'medium');
    const priority = hasCritical ? 1 : hasMedium ? 3 : 5;

    // Queue the consolidated email
    await queueEmail({
      to_email: emailContent.to,
      subject: emailContent.subject,
      html_body: emailContent.html,
      text_body: emailContent.text,
      priority
    }, agencyId);

    // Record all reminders that were included in this email
    await recordRemindersEmailed(remindersToEmail, recipientEmail, agencyId);

    // Update last email sent timestamp
    await updateLastEmailSent(agencyId);

    const criticalCount = remindersToEmail.filter(r => r.severity === 'critical').length;
    const mediumCount = remindersToEmail.filter(r => r.severity === 'medium').length;
    const lowCount = remindersToEmail.filter(r => r.severity === 'low').length;

    console.log(`Consolidated email queued with ${remindersToEmail.length} reminder(s):`);
    console.log(`  - ${criticalCount} Critical`);
    console.log(`  - ${mediumCount} Medium`);
    console.log(`  - ${lowCount} Low`);
    console.log(`  (${skippedCount} reminder(s) already emailed previously)`);
    console.log('=================================\n');

    return {
      success: true,
      emailsSent: 1,
      emailsSkipped: skippedCount,
      totalReminders: remindersToEmail.length,
      criticalCount,
      mediumCount,
      lowCount
    };
  } catch (error) {
    console.error('Error processing reminder emails:', error);
    return { success: false, error: error.message, emailsSent: 0, emailsSkipped: 0 };
  }
};

module.exports = {
  processReminderEmails,
  calculateReminders,
  getReminderRecipient
};
