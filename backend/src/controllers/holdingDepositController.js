/**
 * Holding Deposit Controller
 * Handles holding deposit CRUD and approval workflow
 */

const asyncHandler = require('../utils/asyncHandler');
const holdingDepositRepo = require('../repositories/holdingDepositRepository');
const appRepo = require('../repositories/applicationRepository');
const { queueEmail } = require('../services/emailService');
const { getAgencyBranding } = require('../services/brandingService');
const { createEmailTemplate, escapeHtml } = require('../utils/emailTemplates');
const db = require('../db');

/**
 * Create holding deposit and approve application (atomic)
 * POST /api/holding-deposits
 */
exports.createDeposit = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const userId = req.user.id;
  const {
    application_id,
    amount,
    payment_reference,
    date_received,
    bedroom_id,
    property_id,
    reservation_days
  } = req.body;

  // Validate required fields
  if (!application_id || !amount || !date_received) {
    return res.status(400).json({ error: 'Application ID, amount, and date received are required' });
  }

  const parsedAmount = parseFloat(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a valid number greater than 0' });
  }

  // Validate date_received is a valid date
  if (isNaN(new Date(date_received).getTime())) {
    return res.status(400).json({ error: 'Invalid date received' });
  }

  // Validate reservation_days if provided
  if (reservation_days !== undefined && reservation_days !== null && reservation_days !== '') {
    const days = parseInt(reservation_days);
    if (isNaN(days) || days < 1 || days > 365) {
      return res.status(400).json({ error: 'Reservation days must be between 1 and 365' });
    }
  }

  // Validate application exists and is submitted
  const application = await appRepo.getApplicationById(application_id, agencyId);
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  if (application.status !== 'submitted') {
    return res.status(400).json({ error: `Cannot record holding deposit for application with status '${application.status}'. Only 'submitted' applications can receive holding deposits.` });
  }

  // Check for existing holding deposit on this application
  const existingDeposit = await holdingDepositRepo.getByApplicationId(application_id, agencyId);
  if (existingDeposit && existingDeposit.status === 'held') {
    return res.status(400).json({ error: 'This application already has an active holding deposit' });
  }

  // Validate bedroom and property exist if provided
  if (bedroom_id) {
    const bedroomQuery = property_id
      ? 'SELECT id FROM bedrooms WHERE id = $1 AND property_id = $2 AND agency_id = $3'
      : 'SELECT id FROM bedrooms WHERE id = $1 AND agency_id = $2';
    const bedroomParams = property_id
      ? [bedroom_id, property_id, agencyId]
      : [bedroom_id, agencyId];
    const bedroomResult = await db.query(bedroomQuery, bedroomParams, agencyId);
    if (bedroomResult.rows.length === 0) {
      return res.status(404).json({ error: property_id ? 'Bedroom not found in the specified property' : 'Bedroom not found' });
    }
  } else if (property_id) {
    const propertyResult = await db.query(
      'SELECT id FROM properties WHERE id = $1 AND agency_id = $2',
      [property_id, agencyId], agencyId
    );
    if (propertyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }
  }

  // If bedroom_id provided, check for reservation conflicts
  if (bedroom_id) {
    const activeReservation = await holdingDepositRepo.getActiveReservationForBedroom(bedroom_id, agencyId);
    if (activeReservation) {
      return res.status(409).json({ error: `Bedroom is already reserved by ${activeReservation.applicant_first_name} ${activeReservation.applicant_surname} until ${new Date(activeReservation.reservation_expires_at).toLocaleDateString('en-GB')}` });
    }
  }

  // Calculate reservation expiry
  let reservationExpiresAt = null;
  if (reservation_days && reservation_days > 0) {
    const received = new Date(date_received);
    received.setDate(received.getDate() + parseInt(reservation_days));
    reservationExpiresAt = received.toISOString();
  }

  // Create deposit and approve application in transaction
  const deposit = await db.transaction(async (client) => {
    // Create holding deposit
    const depositResult = await client.query(`
      INSERT INTO holding_deposits (
        agency_id, application_id, amount, payment_reference, date_received,
        bedroom_id, property_id, reservation_days, reservation_expires_at,
        status, status_changed_at, status_changed_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'held', NOW(), $10)
      RETURNING *
    `, [
      agencyId, application_id, parseFloat(amount), payment_reference || null,
      date_received, bedroom_id || null, property_id || null,
      reservation_days ? parseInt(reservation_days) : null,
      reservationExpiresAt, userId
    ]);

    // Approve the application
    await client.query(
      'UPDATE applications SET status = $1 WHERE id = $2 AND agency_id = $3',
      ['approved', application_id, agencyId]
    );

    return depositResult.rows[0];
  }, agencyId);

  // Send approval email (best-effort, don't fail the response)
  try {
    const user = await appRepo.getUserById(application.user_id, agencyId);
    if (user) {
      const branding = await getAgencyBranding(agencyId);
      const brandName = branding.companyName || 'Letably';

      const bodyContent = `
        <h1>Application Approved!</h1>
        <p>Hello ${escapeHtml(user.first_name)},</p>

        <p>Great news! Your application has been approved.</p>

        <p>We will be in touch with next steps.</p>

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
        text_body: 'Great news! Your application has been approved. We will be in touch with next steps.',
        priority: 1
      }, agencyId);
    }
  } catch (emailError) {
    console.error('Failed to send approval email:', emailError);
  }

  res.status(201).json({ deposit, message: 'Holding deposit recorded and application approved' });
}, 'create holding deposit');

/**
 * Get all holding deposits
 * GET /api/holding-deposits
 */
exports.getAllDeposits = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { status } = req.query;

  const deposits = await holdingDepositRepo.getAll({ status }, agencyId);
  res.json(deposits);
}, 'get all holding deposits');

/**
 * Get holding deposit for an application
 * GET /api/holding-deposits/application/:applicationId
 */
exports.getByApplication = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { applicationId } = req.params;

  const deposit = await holdingDepositRepo.getByApplicationId(applicationId, agencyId);
  res.json({ deposit });
}, 'get holding deposit by application');

/**
 * Get single holding deposit
 * GET /api/holding-deposits/:id
 */
exports.getById = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  const deposit = await holdingDepositRepo.getById(id, agencyId);
  if (!deposit) {
    return res.status(404).json({ error: 'Holding deposit not found' });
  }
  res.json(deposit);
}, 'get holding deposit');

/**
 * Record payment for an awaiting_payment deposit (does NOT approve the application)
 * PATCH /api/holding-deposits/:id/record-payment
 */
exports.recordPayment = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const userId = req.user.id;
  const { id } = req.params;
  const { payment_reference, date_received } = req.body;

  if (!date_received) {
    return res.status(400).json({ error: 'Date received is required' });
  }

  if (isNaN(new Date(date_received).getTime())) {
    return res.status(400).json({ error: 'Invalid date received' });
  }

  const deposit = await holdingDepositRepo.getById(id, agencyId);
  if (!deposit) {
    return res.status(404).json({ error: 'Holding deposit not found' });
  }

  if (deposit.status !== 'awaiting_payment') {
    return res.status(400).json({ error: `Cannot record payment for deposit with status '${deposit.status}'. Only 'awaiting_payment' deposits can receive payments.` });
  }

  // Calculate reservation expiry from payment date
  let reservationExpiresAt = null;
  if (deposit.reservation_days && deposit.reservation_days > 0) {
    const received = new Date(date_received);
    received.setDate(received.getDate() + deposit.reservation_days);
    reservationExpiresAt = received.toISOString();
  }

  // Record payment — update deposit to 'held' (reservation starts now)
  const updated = await db.query(`
    UPDATE holding_deposits
    SET status = 'held', payment_reference = $1, date_received = $2,
        reservation_expires_at = $3,
        status_changed_at = NOW(), status_changed_by = $4, updated_at = NOW()
    WHERE id = $5 AND agency_id = $6 AND status = 'awaiting_payment'
    RETURNING *
  `, [payment_reference || null, date_received, reservationExpiresAt, userId, id, agencyId], agencyId);

  res.json({ deposit: updated.rows[0], message: 'Payment recorded successfully' });
}, 'record holding deposit payment');

/**
 * Undo payment — revert a 'held' deposit back to 'awaiting_payment'
 * PATCH /api/holding-deposits/:id/undo-payment
 */
exports.undoPayment = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const userId = req.user.id;
  const { id } = req.params;

  const deposit = await holdingDepositRepo.getById(id, agencyId);
  if (!deposit) {
    return res.status(404).json({ error: 'Holding deposit not found' });
  }

  if (deposit.status !== 'held') {
    return res.status(400).json({ error: `Cannot undo payment for deposit with status '${deposit.status}'. Only 'held' deposits can be reverted.` });
  }

  const updated = await db.query(`
    UPDATE holding_deposits
    SET status = 'awaiting_payment', payment_reference = NULL, date_received = NULL,
        reservation_expires_at = NULL,
        status_changed_at = NOW(), status_changed_by = $1, updated_at = NOW()
    WHERE id = $2 AND agency_id = $3 AND status = 'held'
    RETURNING *
  `, [userId, id, agencyId], agencyId);

  res.json({ deposit: updated.rows[0], message: 'Payment undone — deposit reverted to awaiting payment' });
}, 'undo holding deposit payment');

/**
 * Get holding deposit for tenant's own application
 * GET /api/holding-deposits/my-application/:applicationId
 */
exports.getByApplicationForTenant = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const userId = req.user.id;
  const { applicationId } = req.params;

  // Verify the application belongs to this user
  const application = await appRepo.getApplicationById(applicationId, agencyId);
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  if (application.user_id !== userId) {
    return res.status(403).json({ error: 'You do not have permission to access this deposit' });
  }

  const deposit = await holdingDepositRepo.getByApplicationId(applicationId, agencyId);

  // Also return bank details from settings
  const agencySettingsModel = require('../models/agencySettings');
  const settings = await agencySettingsModel.get(agencyId);

  res.json({
    deposit: deposit || null,
    bank_details: {
      bank_name: settings.bank_name || null,
      sort_code: settings.sort_code || null,
      account_number: settings.account_number || null,
    }
  });
}, 'get holding deposit for tenant application');

/**
 * Update holding deposit status (refund or forfeit)
 * PATCH /api/holding-deposits/:id/status
 */
exports.updateStatus = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const userId = req.user.id;
  const { id } = req.params;
  const { status: newStatus, notes } = req.body;

  const validStatuses = ['refunded', 'forfeited'];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const deposit = await holdingDepositRepo.getById(id, agencyId);
  if (!deposit) {
    return res.status(404).json({ error: 'Holding deposit not found' });
  }

  if (deposit.status !== 'held' && deposit.status !== 'awaiting_payment') {
    return res.status(400).json({ error: `Cannot change status from '${deposit.status}' to '${newStatus}'. Only 'held' or 'awaiting_payment' deposits can be refunded or forfeited.` });
  }

  const updated = await holdingDepositRepo.updateStatus(id, newStatus, userId, notes || null, agencyId);
  res.json({ deposit: updated, message: `Holding deposit ${newStatus} successfully` });
}, 'update holding deposit status');
