const db = require('../db');
const { getLandlordProperties } = require('../helpers/queries');
const { generatePreviewAgreement, defaultTenants, defaultPropertyData } = require('../services/previewDataService');
const agreementService = require('../services/agreementService');
const userService = require('../services/userService');
const handleError = require('../utils/handleError');
const asyncHandler = require('../utils/asyncHandler');

// Get all landlords
exports.getAllLandlords = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;

  // Fetch landlords with their properties in a single query using JSON aggregation
  const result = await db.query(`
    SELECT l.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', p.id,
            'address_line1', p.address_line1,
            'location', p.location,
            'is_live', p.is_live,
            'bedroom_count', (SELECT COUNT(*) FROM bedrooms WHERE property_id = p.id)
          )
        ) FILTER (WHERE p.id IS NOT NULL),
        '[]'::json
      ) AS properties
    FROM landlords l
    LEFT JOIN properties p ON p.landlord_id = l.id
    WHERE l.agency_id = $1
    GROUP BY l.id
    ORDER BY l.name ASC
  `, [agencyId], agencyId);

  res.json({ landlords: result.rows });
}, 'fetch landlords');

// Get single landlord
exports.getLandlordById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query('SELECT * FROM landlords WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);
  const landlord = result.rows[0];

  if (!landlord) {
    return res.status(404).json({ error: 'Landlord not found' });
  }

  // Get properties for this landlord
  const properties = await getLandlordProperties(id, agencyId);

  res.json({ landlord: { ...landlord, properties } });
}, 'fetch landlord');

// Create landlord
exports.createLandlord = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const {
    name,
    legal_name,
    agreement_display_format,
    email,
    phone,
    address_line1,
    address_line2,
    city,
    postcode,
    bank_name,
    bank_account_name,
    sort_code,
    account_number,
    utilities_cap_amount,
    council_tax_in_bills,
    manage_rent,
    receive_maintenance_notifications,
    receive_tenancy_communications,
    notes,
    send_welcome_email = true
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const result = await db.query(`
    INSERT INTO landlords (
      name, legal_name, agreement_display_format, email, phone,
      address_line1, address_line2, city, postcode,
      bank_name, bank_account_name, sort_code, account_number,
      utilities_cap_amount, council_tax_in_bills, manage_rent,
      receive_maintenance_notifications, receive_tenancy_communications, notes, agency_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    RETURNING *
  `, [
    name,
    legal_name || null,
    agreement_display_format || null,
    email,
    phone || null,
    address_line1 || null,
    address_line2 || null,
    city || null,
    postcode || null,
    bank_name || null,
    bank_account_name || null,
    sort_code || null,
    account_number || null,
    utilities_cap_amount || null,
    council_tax_in_bills !== undefined ? council_tax_in_bills : true,
    manage_rent !== undefined ? manage_rent : true,
    receive_maintenance_notifications !== undefined ? receive_maintenance_notifications : true,
    receive_tenancy_communications !== undefined ? receive_tenancy_communications : true,
    notes || null,
    agencyId
  ], agencyId);

  const landlord = result.rows[0];
  const responseData = { landlord };

  // Auto-create or link user account
  try {
    // Check if a user with this email already exists in this agency
    const existingUser = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND agency_id = $2',
      [email, agencyId],
      agencyId
    );

    if (existingUser.rows[0]) {
      // Link existing user
      await db.query(
        'UPDATE landlords SET user_id = $1 WHERE id = $2 AND agency_id = $3',
        [existingUser.rows[0].id, landlord.id, agencyId],
        agencyId
      );
      landlord.user_id = existingUser.rows[0].id;
      responseData.user_linked = true;
    } else {
      // Split name into first_name / last_name
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];

      const { user, setupToken } = await userService.createUser({
        email,
        firstName,
        lastName,
        phone: phone || null,
        role: 'landlord',
      }, agencyId);

      // Link the new user to the landlord
      await db.query(
        'UPDATE landlords SET user_id = $1 WHERE id = $2 AND agency_id = $3',
        [user.id, landlord.id, agencyId],
        agencyId
      );
      landlord.user_id = user.id;
      responseData.user_created = true;
      responseData.send_welcome_email = send_welcome_email;
      responseData.setup_token = setupToken;
    }
  } catch (userError) {
    // Log but don't fail the landlord creation
    console.error('Error creating/linking user account for landlord:', userError.message);
    responseData.user_error = userError.message;
  }

  res.status(201).json(responseData);
}, 'create landlord');

// Update landlord
exports.updateLandlord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;
  const {
    name,
    legal_name,
    agreement_display_format,
    email,
    phone,
    address_line1,
    address_line2,
    city,
    postcode,
    bank_name,
    bank_account_name,
    sort_code,
    account_number,
    utilities_cap_amount,
    council_tax_in_bills,
    manage_rent,
    receive_maintenance_notifications,
    receive_tenancy_communications,
    notes
  } = req.body;

  // Check if landlord exists - defense-in-depth: explicit agency_id filtering
  const existing = await db.query('SELECT id FROM landlords WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'Landlord not found' });
  }

  // Defense-in-depth: explicit agency_id in WHERE clause
  const result = await db.query(`
    UPDATE landlords
    SET name = $1,
        legal_name = $2,
        agreement_display_format = $3,
        email = $4,
        phone = $5,
        address_line1 = $6,
        address_line2 = $7,
        city = $8,
        postcode = $9,
        bank_name = $10,
        bank_account_name = $11,
        sort_code = $12,
        account_number = $13,
        utilities_cap_amount = $14,
        council_tax_in_bills = $15,
        manage_rent = $16,
        receive_maintenance_notifications = $17,
        receive_tenancy_communications = $18,
        notes = $19,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $20 AND agency_id = $21
    RETURNING *
  `, [
    name,
    legal_name || null,
    agreement_display_format || null,
    email,
    phone || null,
    address_line1 || null,
    address_line2 || null,
    city || null,
    postcode || null,
    bank_name || null,
    bank_account_name || null,
    sort_code || null,
    account_number || null,
    utilities_cap_amount || null,
    council_tax_in_bills !== undefined ? council_tax_in_bills : true,
    manage_rent !== undefined ? manage_rent : true,
    receive_maintenance_notifications !== undefined ? receive_maintenance_notifications : true,
    receive_tenancy_communications !== undefined ? receive_tenancy_communications : true,
    notes || null,
    id,
    agencyId
  ], agencyId);

  res.json({ landlord: result.rows[0] });
}, 'update landlord');

// Delete landlord
exports.deleteLandlord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;

  // Check if landlord exists - defense-in-depth: explicit agency_id filtering
  const existing = await db.query('SELECT id, user_id FROM landlords WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'Landlord not found' });
  }

  const landlord = existing.rows[0];

  // Check if landlord has properties - defense-in-depth: explicit agency_id filtering
  const propertyCount = await db.query(
    'SELECT COUNT(*) as count FROM properties WHERE landlord_id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );
  const count = parseInt(propertyCount.rows[0].count);

  if (count > 0) {
    return res.status(400).json({ error: `Cannot delete landlord. They have ${count} propert${count === 1 ? 'y' : 'ies'} assigned.` });
  }

  // Explicit agency_id for defense-in-depth
  await db.query('DELETE FROM landlords WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);

  // Also delete the linked user account if one exists
  if (landlord.user_id) {
    try {
      await db.query('DELETE FROM users WHERE id = $1 AND agency_id = $2', [landlord.user_id, agencyId], agencyId);
    } catch (userDeleteError) {
      console.error('Error deleting linked user account for landlord:', userDeleteError.message);
    }
  }

  res.json({ message: 'Landlord deleted successfully' });
}, 'delete landlord');

// Generate preview agreement with configurable test data
exports.generatePreviewAgreement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;
  const { tenancyType = 'room_only', testData = {} } = req.body;

  // Merge custom test data with defaults
  const primaryTenant = { ...defaultTenants.primary, ...testData.primaryTenant };
  const secondTenant = { ...defaultTenants.secondary, ...testData.secondTenant };
  const propertyData = { ...defaultPropertyData, ...testData.propertyData };

  const agreement = await generatePreviewAgreement({
    tenancyType,
    landlordId: parseInt(id),
    primaryTenant,
    secondTenant,
    propertyData,
    startDate: testData.startDate || '2025-09-01',
    endDate: testData.endDate || '2026-08-31',
    isRollingMonthly: testData.isRollingMonthly || false,
  }, agencyId, agreementService.generateAgreement);

  res.json(agreement);
}, 'generate preview agreement');
