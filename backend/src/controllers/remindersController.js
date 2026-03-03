const db = require('../db');
const { processReminderEmails } = require('../services/reminderEmailService');
const asyncHandler = require('../utils/asyncHandler');

// Get all reminder threshold settings
exports.getThresholds = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query('SELECT * FROM reminder_thresholds WHERE agency_id = $1 ORDER BY display_order, id', [agencyId], agencyId);

  res.json(result.rows.map(t => ({
    ...t,
    enabled: Boolean(t.enabled)
  })));
}, 'fetch reminder thresholds');

// Update reminder threshold settings
exports.updateThresholds = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { thresholds } = req.body;

  if (!Array.isArray(thresholds)) {
    return res.status(400).json({ error: 'Thresholds must be an array' });
  }

  for (const threshold of thresholds) {
    // Defense-in-depth: explicit agency_id filtering
    await db.query(`
      UPDATE reminder_thresholds
      SET critical_days = $1, medium_days = $2, low_days = $3, enabled = $4, updated_at = CURRENT_TIMESTAMP
      WHERE certificate_type = $5 AND agency_id = $6
    `, [
      threshold.critical_days,
      threshold.medium_days,
      threshold.low_days,
      threshold.enabled ? true : false,
      threshold.certificate_type,
      agencyId
    ], agencyId);
  }

  res.json({ message: 'Reminder thresholds updated successfully' });
}, 'update reminder thresholds');

// Reorder reminder thresholds
exports.reorderThresholds = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { thresholdIds } = req.body;

  if (!Array.isArray(thresholdIds)) {
    return res.status(400).json({ error: 'thresholdIds must be an array' });
  }

  for (let index = 0; index < thresholdIds.length; index++) {
    // Defense-in-depth: explicit agency_id filtering
    await db.query(`
      UPDATE reminder_thresholds
      SET display_order = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND agency_id = $3
    `, [index, thresholdIds[index], agencyId], agencyId);
  }

  res.json({ message: 'Reminder thresholds reordered successfully' });
}, 'reorder reminder thresholds');

// Get all active reminders (automated + manual)
exports.getAllReminders = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const reminders = [];

  // Get threshold configurations
  // Defense-in-depth: explicit agency_id filtering
  const thresholdsResult = await db.query('SELECT * FROM reminder_thresholds WHERE enabled = true AND agency_id = $1', [agencyId], agencyId);
  const thresholds = thresholdsResult.rows;

  // Get all properties
  // Defense-in-depth: explicit agency_id filtering
  const propertiesResult = await db.query('SELECT id, address_line1 FROM properties WHERE agency_id = $1', [agencyId], agencyId);
  const properties = propertiesResult.rows;

  // Get all property certificates with expiry dates
  // Defense-in-depth: explicit agency_id filtering
  const propertyCertificatesResult = await db.query(`
    SELECT c.entity_id as property_id, c.expiry_date,
           ct.name as certificate_type_name,
           ct.display_name as certificate_type_display_name
    FROM certificates c
    JOIN certificate_types ct ON c.certificate_type_id = ct.id
    WHERE c.entity_type = 'property' AND c.expiry_date IS NOT NULL AND c.agency_id = $1
  `, [agencyId], agencyId);
  const propertyCertificates = propertyCertificatesResult.rows;

  // Group property certificates by property_id
  const propertyCertsMap = {};
  propertyCertificates.forEach(cert => {
    if (!propertyCertsMap[cert.property_id]) {
      propertyCertsMap[cert.property_id] = [];
    }
    propertyCertsMap[cert.property_id].push(cert);
  });

  // Get global certificates from settings
  // Defense-in-depth: explicit agency_id filtering
  const settingsResult = await db.query(
    'SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN ($1, $2) AND agency_id = $3',
    ['prs_certificate_expiry', 'cmp_certificate_expiry', agencyId],
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
      // Skip global certificates for property processing
      if (threshold.certificate_type === 'prs_certificate' || threshold.certificate_type === 'cmp_certificate') {
        continue;
      }

      // Check for dynamic property certificates
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
    // Defense-in-depth: explicit agency_id filtering
    const viewingRequestsResult = await db.query(`
      SELECT vr.*, p.address_line1 as property_address
      FROM viewing_requests vr
      LEFT JOIN properties p ON vr.property_id = p.id
      WHERE vr.status IN ('pending', 'confirmed') AND vr.agency_id = $1
    `, [agencyId], agencyId);
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
            days_remaining: -daysSinceCreated, // Negative because it's overdue
            reference_type: 'viewing_request',
            reference_id: vr.id,
            property_address: vr.property_address,
            viewing_request_data: {
              visitor_name: vr.visitor_name,
              visitor_email: vr.visitor_email,
              visitor_phone: vr.visitor_phone,
              preferred_date: vr.preferred_date,
              internal_notes: vr.internal_notes
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
              internal_notes: vr.internal_notes
            }
          });
        }
      }
    }
  }

  // Get manual reminders
  // Defense-in-depth: explicit agency_id filtering
  const manualRemindersResult = await db.query(`
    SELECT mr.*, p.address_line1 as property_address
    FROM manual_reminders mr
    LEFT JOIN properties p ON mr.property_id = p.id
    WHERE mr.agency_id = $1
    ORDER BY mr.reminder_date ASC
  `, [agencyId], agencyId);
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

  // Sort by severity (critical first) then by days remaining
  const severityOrder = { critical: 0, medium: 1, low: 2 };
  reminders.sort((a, b) => {
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return a.days_remaining - b.days_remaining;
  });

  // Add email notification status to each reminder
  const recipientEmailResult = await db.query(
    'SELECT email FROM agencies WHERE id = $1', [agencyId], agencyId
  );
  const recipientEmail = recipientEmailResult.rows[0]?.email;
  if (recipientEmail) {
    // Defense-in-depth: explicit agency_id filtering
    const notificationsResult = await db.query(`
      SELECT reminder_identifier, severity, last_emailed_at
      FROM reminder_email_notifications
      WHERE recipient_email = $1 AND agency_id = $2
    `, [recipientEmail, agencyId], agencyId);
    const notifications = notificationsResult.rows;

    // Create a map for quick lookup
    const notificationMap = new Map();
    notifications.forEach(n => {
      notificationMap.set(n.reminder_identifier, {
        severity: n.severity,
        last_emailed_at: n.last_emailed_at
      });
    });

    // Add email status to each reminder
    reminders.forEach(reminder => {
      const notification = notificationMap.get(reminder.id);
      if (notification) {
        reminder.email_sent = true;
        reminder.email_sent_at = notification.last_emailed_at;
        reminder.email_sent_severity = notification.severity;
      } else {
        reminder.email_sent = false;
        reminder.email_sent_at = null;
        reminder.email_sent_severity = null;
      }
    });
  }

  res.json(reminders);
}, 'fetch reminders');

// Get reminder count (for navbar badge)
exports.getReminderCount = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const reminders = [];

  // Get threshold configurations
  // Defense-in-depth: explicit agency_id filtering
  const thresholdsResult = await db.query('SELECT * FROM reminder_thresholds WHERE enabled = true AND agency_id = $1', [agencyId], agencyId);
  const thresholds = thresholdsResult.rows;

  // Get all properties
  // Defense-in-depth: explicit agency_id filtering
  const propertiesResult = await db.query('SELECT id, address_line1 FROM properties WHERE agency_id = $1', [agencyId], agencyId);
  const properties = propertiesResult.rows;

  // Get all property certificates with expiry dates
  // Defense-in-depth: explicit agency_id filtering
  const propertyCertificatesResult = await db.query(`
    SELECT c.entity_id as property_id, c.expiry_date,
           ct.name as certificate_type_name,
           ct.display_name as certificate_type_display_name
    FROM certificates c
    JOIN certificate_types ct ON c.certificate_type_id = ct.id
    WHERE c.entity_type = 'property' AND c.expiry_date IS NOT NULL AND c.agency_id = $1
  `, [agencyId], agencyId);
  const propertyCertificates = propertyCertificatesResult.rows;

  // Group property certificates by property_id
  const propertyCertsMap = {};
  propertyCertificates.forEach(cert => {
    if (!propertyCertsMap[cert.property_id]) {
      propertyCertsMap[cert.property_id] = [];
    }
    propertyCertsMap[cert.property_id].push(cert);
  });

  // Get global certificates from settings
  // Defense-in-depth: explicit agency_id filtering
  const settingsResult = await db.query(
    'SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN ($1, $2) AND agency_id = $3',
    ['prs_certificate_expiry', 'cmp_certificate_expiry', agencyId],
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
          reminders.push({ severity: reminderInfo.severity });
        }
      }
    }
  }

  // Process property certificates
  for (const property of properties) {
    const propertyCerts = propertyCertsMap[property.id] || [];

    for (const threshold of thresholds) {
      if (threshold.certificate_type === 'prs_certificate' || threshold.certificate_type === 'cmp_certificate') {
        continue;
      }

      // Find matching certificate for this threshold
      const matchingCert = propertyCerts.find(cert =>
        cert.certificate_type_name === threshold.certificate_type
      );

      if (matchingCert && matchingCert.expiry_date) {
        const reminderInfo = calculateReminderInfo(matchingCert.expiry_date, threshold);
        if (reminderInfo) {
          reminders.push({ severity: reminderInfo.severity });
        }
      }
    }
  }

  // Get viewing request thresholds
  const viewingPendingThreshold = thresholds.find(t => t.certificate_type === 'viewing_request_pending');
  const viewingUpcomingThreshold = thresholds.find(t => t.certificate_type === 'viewing_request_upcoming');

  // Process viewing requests if thresholds are enabled
  if (viewingPendingThreshold || viewingUpcomingThreshold) {
    // Defense-in-depth: explicit agency_id filtering
    const viewingRequestsResult = await db.query(`
      SELECT vr.*, p.address_line1 as property_address
      FROM viewing_requests vr
      LEFT JOIN properties p ON vr.property_id = p.id
      WHERE vr.status IN ('pending', 'confirmed') AND vr.agency_id = $1
    `, [agencyId], agencyId);
    const viewingRequests = viewingRequestsResult.rows;

    for (const vr of viewingRequests) {
      // Pending viewing requests
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
          reminders.push({ severity });
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
          reminders.push({ severity });
        }
      }
    }
  }

  // Get manual reminders
  // Defense-in-depth: explicit agency_id filtering
  const manualRemindersResult = await db.query(`
    SELECT mr.*, p.address_line1 as property_address
    FROM manual_reminders mr
    LEFT JOIN properties p ON mr.property_id = p.id
    WHERE mr.agency_id = $1
    ORDER BY mr.reminder_date ASC
  `, [agencyId], agencyId);
  const manualReminders = manualRemindersResult.rows;

  for (const mr of manualReminders) {
    const reminderDate = new Date(mr.reminder_date);
    reminderDate.setHours(0, 0, 0, 0);
    const daysRemaining = Math.ceil((reminderDate - today) / (1000 * 60 * 60 * 24));

    // Only show manual reminders on or after the reminder date
    if (daysRemaining <= 0) {
      reminders.push({ severity: mr.severity });
    }
  }

  const criticalCount = reminders.filter(r => r.severity === 'critical').length;
  res.json({
    total: reminders.length,
    critical: criticalCount,
    medium: reminders.filter(r => r.severity === 'medium').length,
    low: reminders.filter(r => r.severity === 'low').length
  });
}, 'fetch reminder count');

// Create manual reminder
exports.createManualReminder = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { title, description, reminder_date, severity, property_id } = req.body;

  if (!title || !reminder_date || !severity) {
    return res.status(400).json({ error: 'Title, reminder date, and severity are required' });
  }

  if (!['low', 'medium', 'critical'].includes(severity)) {
    return res.status(400).json({ error: 'Severity must be low, medium, or critical' });
  }

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(`
    INSERT INTO manual_reminders (title, description, reminder_date, severity, property_id, agency_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [
    title,
    description || null,
    reminder_date,
    severity,
    property_id || null,
    agencyId
  ], agencyId);

  const reminder = result.rows[0];

  res.status(201).json({ message: 'Manual reminder created successfully', reminder });
}, 'create manual reminder');

// Update manual reminder
exports.updateManualReminder = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  const { title, description, reminder_date, severity, property_id } = req.body;

  // Defense-in-depth: explicit agency_id filtering
  const reminderResult = await db.query('SELECT id FROM manual_reminders WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);
  if (reminderResult.rows.length === 0) {
    return res.status(404).json({ error: 'Reminder not found' });
  }

  if (severity && !['low', 'medium', 'critical'].includes(severity)) {
    return res.status(400).json({ error: 'Severity must be low, medium, or critical' });
  }

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(`
    UPDATE manual_reminders
    SET title = $1, description = $2, reminder_date = $3, severity = $4, property_id = $5
    WHERE id = $6 AND agency_id = $7
    RETURNING *
  `, [
    title,
    description || null,
    reminder_date,
    severity,
    property_id || null,
    id,
    agencyId
  ], agencyId);

  const updatedReminder = result.rows[0];

  res.json({ message: 'Manual reminder updated successfully', reminder: updatedReminder });
}, 'update manual reminder');

// Delete manual reminder
exports.deleteManualReminder = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Defense-in-depth: explicit agency_id filtering
  const reminderResult = await db.query('SELECT id FROM manual_reminders WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);
  if (reminderResult.rows.length === 0) {
    return res.status(404).json({ error: 'Reminder not found' });
  }

  // Defense-in-depth: explicit agency_id filtering
  await db.query('DELETE FROM manual_reminders WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);

  res.json({ message: 'Manual reminder deleted successfully' });
}, 'delete manual reminder');

// Get all manual reminders (for management page)
exports.getAllManualReminders = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(`
    SELECT mr.*, p.address_line1 as property_address
    FROM manual_reminders mr
    LEFT JOIN properties p ON mr.property_id = p.id
    WHERE mr.agency_id = $1
    ORDER BY mr.reminder_date ASC
  `, [agencyId], agencyId);

  res.json(result.rows);
}, 'fetch manual reminders');

// Process and send reminder emails
exports.processEmails = asyncHandler(async (req, res) => {
  // Manual trigger always sends email regardless of last sent date
  const result = await processReminderEmails(true);
  res.json(result);
}, 'process reminder emails');
