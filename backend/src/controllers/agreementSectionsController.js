const db = require('../db');
const { generateAgreement } = require('../services/agreementService');
const { generatePreviewAgreement: generatePreview } = require('../services/previewDataService');
const asyncHandler = require('../utils/asyncHandler');

// Get all agreement sections (with optional landlord and agreement_type filters)
exports.getAllSections = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { landlord_id, agreement_type } = req.query;

  let query = `
    SELECT
      s.*,
      l.name as landlord_name
    FROM agreement_sections s
    LEFT JOIN landlords l ON s.landlord_id = l.id
    WHERE s.agency_id = $1
  `;

  const params = [agencyId];
  let paramIndex = 2;

  if (landlord_id) {
    if (landlord_id === 'default') {
      query += ' AND s.landlord_id IS NULL';
    } else {
      query += ` AND s.landlord_id = $${paramIndex}`;
      params.push(landlord_id);
      paramIndex++;
    }
  }

  // Filter by agreement_type (default: tenancy_agreement)
  if (agreement_type) {
    query += ` AND (s.agreement_type = $${paramIndex} OR s.agreement_type IS NULL)`;
    params.push(agreement_type);
    paramIndex++;
  }

  query += ' ORDER BY s.section_order ASC, s.section_key ASC';

  const result = await db.query(query, params, agencyId);

  res.json({ sections: result.rows });
}, 'fetch agreement sections');

// Get single agreement section
exports.getSectionById = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(`
    SELECT
      s.*,
      l.name as landlord_name
    FROM agreement_sections s
    LEFT JOIN landlords l ON s.landlord_id = l.id
    WHERE s.id = $1 AND s.agency_id = $2
  `, [id, agencyId], agencyId);

  const section = result.rows[0];

  if (!section) {
    return res.status(404).json({ error: 'Agreement section not found' });
  }

  res.json({ section });
}, 'fetch agreement section');

// Get sections for a specific landlord (including defaults)
exports.getSectionsForLandlord = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { landlord_id } = req.params;
  const { agreement_type } = req.query;
  const agreementTypeFilter = agreement_type || 'tenancy_agreement';

  // Defense-in-depth: explicit agency_id filtering
  // Get landlord-specific sections
  const landlordResult = await db.query(`
    SELECT * FROM agreement_sections
    WHERE landlord_id = $1
      AND is_active = true
      AND (agreement_type = $2 OR agreement_type IS NULL)
      AND agency_id = $3
    ORDER BY section_order ASC
  `, [landlord_id, agreementTypeFilter, agencyId], agencyId);

  const landlordSections = landlordResult.rows;

  // Get section keys that are overridden by landlord
  const overriddenKeys = landlordSections.map(s => s.section_key);

  // Defense-in-depth: explicit agency_id filtering
  // Get default sections that aren't overridden
  const defaultResult = await db.query(`
    SELECT * FROM agreement_sections
    WHERE landlord_id IS NULL
      AND is_active = true
      AND (agreement_type = $1 OR agreement_type IS NULL)
      AND agency_id = $2
    ORDER BY section_order ASC
  `, [agreementTypeFilter, agencyId], agencyId);

  let defaultSections = defaultResult.rows;

  if (overriddenKeys.length > 0) {
    defaultSections = defaultSections.filter(s => !overriddenKeys.includes(s.section_key));
  }

  // Combine and sort by section_order
  const allSections = [...landlordSections, ...defaultSections]
    .sort((a, b) => a.section_order - b.section_order);

  res.json({ sections: allSections });
}, 'fetch sections for landlord');

// Create agreement section
exports.createSection = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const {
    landlord_id,
    section_key,
    section_title,
    section_content,
    section_order,
    is_active,
    agreement_type
  } = req.body;

  // Validation
  if (!section_key || !section_title || !section_content || section_order === undefined) {
    return res.status(400).json({ error: 'section_key, section_title, section_content, and section_order are required' });
  }

  // Validate agreement_type if provided
  const validAgreementTypes = ['tenancy_agreement'];
  if (agreement_type && !validAgreementTypes.includes(agreement_type)) {
    return res.status(400).json({ error: 'Invalid agreement_type. Must be "tenancy_agreement"' });
  }

  // Check if landlord exists (if landlord_id provided)
  if (landlord_id) {
    // Defense-in-depth: explicit agency_id filtering
    const landlordResult = await db.query('SELECT id FROM landlords WHERE id = $1 AND agency_id = $2', [landlord_id, agencyId], agencyId);
    if (!landlordResult.rows[0]) {
      return res.status(404).json({ error: 'Landlord not found' });
    }
  }

  const result = await db.query(`
    INSERT INTO agreement_sections (
      agency_id, landlord_id, section_key, section_title, section_content,
      section_order, is_active, agreement_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [
    agencyId,
    landlord_id || null,
    section_key,
    section_title,
    section_content,
    section_order,
    is_active !== undefined ? is_active : true,
    agreement_type || 'tenancy_agreement'
  ], agencyId);

  const section = result.rows[0];

  res.status(201).json({ section });
}, 'create agreement section');

// Update agreement section
exports.updateSection = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  const {
    landlord_id,
    section_key,
    section_title,
    section_content,
    section_order,
    is_active,
    agreement_type
  } = req.body;

  // Defense-in-depth: explicit agency_id filtering
  // Check if section exists
  const existingResult = await db.query('SELECT * FROM agreement_sections WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);
  const existing = existingResult.rows[0];
  if (!existing) {
    return res.status(404).json({ error: 'Agreement section not found' });
  }

  // Validate agreement_type if provided
  const validAgreementTypes = ['tenancy_agreement'];
  if (agreement_type && !validAgreementTypes.includes(agreement_type)) {
    return res.status(400).json({ error: 'Invalid agreement_type. Must be "tenancy_agreement"' });
  }

  // Check if landlord exists (if landlord_id provided)
  if (landlord_id) {
    // Defense-in-depth: explicit agency_id filtering
    const landlordResult = await db.query('SELECT id FROM landlords WHERE id = $1 AND agency_id = $2', [landlord_id, agencyId], agencyId);
    if (!landlordResult.rows[0]) {
      return res.status(404).json({ error: 'Landlord not found' });
    }
  }

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(`
    UPDATE agreement_sections
    SET landlord_id = $1,
        section_key = $2,
        section_title = $3,
        section_content = $4,
        section_order = $5,
        is_active = $6,
        agreement_type = $7,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $8 AND agency_id = $9
    RETURNING *
  `, [
    landlord_id || null,
    section_key,
    section_title,
    section_content,
    section_order,
    is_active !== undefined ? is_active : true,
    agreement_type || existing.agreement_type || 'tenancy_agreement',
    id,
    agencyId
  ], agencyId);

  const section = result.rows[0];

  res.json({ section });
}, 'update agreement section');

// Delete agreement section
exports.deleteSection = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Defense-in-depth: explicit agency_id filtering
  // Check if section exists
  const existingResult = await db.query('SELECT id FROM agreement_sections WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);
  if (!existingResult.rows[0]) {
    return res.status(404).json({ error: 'Agreement section not found' });
  }

  // Explicit agency_id for defense-in-depth
  await db.query('DELETE FROM agreement_sections WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);

  res.json({ message: 'Agreement section deleted successfully' });
}, 'delete agreement section');

// Duplicate a section (useful for creating landlord-specific overrides)
exports.duplicateSection = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  const { landlord_id } = req.body;

  // Defense-in-depth: explicit agency_id filtering
  // Get the section to duplicate
  const sectionResult = await db.query('SELECT * FROM agreement_sections WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);
  const section = sectionResult.rows[0];
  if (!section) {
    return res.status(404).json({ error: 'Agreement section not found' });
  }

  // Check if landlord exists (if landlord_id provided)
  if (landlord_id) {
    // Defense-in-depth: explicit agency_id filtering
    const landlordResult = await db.query('SELECT id FROM landlords WHERE id = $1 AND agency_id = $2', [landlord_id, agencyId], agencyId);
    if (!landlordResult.rows[0]) {
      return res.status(404).json({ error: 'Landlord not found' });
    }

    // Defense-in-depth: explicit agency_id filtering
    // Check if an override already exists for this landlord + section_key + agreement_type
    const existingOverrideResult = await db.query(`
      SELECT id FROM agreement_sections
      WHERE landlord_id = $1 AND section_key = $2 AND (agreement_type = $3 OR (agreement_type IS NULL AND $3 IS NULL)) AND agency_id = $4
    `, [landlord_id, section.section_key, section.agreement_type, agencyId], agencyId);

    const existingOverride = existingOverrideResult.rows[0];

    if (existingOverride) {
      return res.status(409).json({ error: 'An override already exists for this section' });
    }
  }

  const result = await db.query(`
    INSERT INTO agreement_sections (
      agency_id, landlord_id, section_key, section_title, section_content,
      section_order, is_active, agreement_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [
    agencyId,
    landlord_id || null,
    section.section_key,
    section.section_title,
    section.section_content,
    section.section_order,
    section.is_active,
    section.agreement_type || 'tenancy_agreement'
  ], agencyId);

  const newSection = result.rows[0];

  res.status(201).json({ section: newSection });
}, 'duplicate agreement section');

// Preview default agreement sections with dummy data (no landlord overrides)
exports.previewDefaultAgreement = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { tenancyType } = req.query; // 'room_only' or 'whole_house'

  // Validate tenancy type
  if (!tenancyType || !['room_only', 'whole_house'].includes(tenancyType)) {
    return res.status(400).json({ error: 'Invalid or missing tenancyType query parameter. Must be "room_only" or "whole_house"' });
  }

  const agreement = await generatePreview(
    { tenancyType, landlordId: null },
    agencyId,
    generateAgreement
  );

  res.json({
    agreement,
    preview_info: {
      tenancy_type: tenancyType,
      note: 'This is a preview with dummy data using only default sections (no landlord overrides)'
    }
  });
}, 'generate preview agreement');
