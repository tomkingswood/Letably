const db = require('../db');
const fs = require('fs');
const path = require('path');
const handleError = require('../utils/handleError');
const asyncHandler = require('../utils/asyncHandler');

// Get all site settings
const getAllSettings = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query('SELECT setting_key, setting_value FROM site_settings WHERE agency_id = $1', [agencyId], agencyId);
  const settings = result.rows;

  // Convert array of {setting_key, setting_value} to object
  const settingsObject = {};
  settings.forEach(setting => {
    settingsObject[setting.setting_key] = setting.setting_value;
  });

  // Merge identity fields from agencies table (single source of truth)
  const agencyResult = await db.query(
    'SELECT name, email, phone FROM agencies WHERE id = $1', [agencyId], agencyId
  );
  const agency = agencyResult.rows[0];
  if (agency) {
    settingsObject.company_name = agency.name || '';
    settingsObject.email_address = agency.email || '';
    settingsObject.phone_number = agency.phone || '';
  }

  res.json(settingsObject);
}, 'fetch settings');

// Get public viewing settings (no auth required)
const getViewingSettings = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    "SELECT setting_value FROM site_settings WHERE setting_key = $1 AND agency_id = $2",
    ['viewing_min_days_advance', agencyId],
    agencyId
  );
  const setting = result.rows[0];

  res.json({ viewing_min_days_advance: setting ? parseInt(setting.setting_value, 10) : 2 });
}, 'fetch viewing settings');

// Update site settings (admin only)
const updateSettings = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const {
    phone_number,
    email_address,
    address_line1,
    address_line2,
    city,
    postcode,
    facebook_url,
    twitter_url,
    instagram_url,
    company_name,
    redress_scheme_name,
    redress_scheme_number,
    redress_scheme_url,
    cmp_certificate_filename,
    prs_certificate_filename,
    cmp_certificate_expiry,
    prs_certificate_expiry,
    ico_certificate_filename,
    ico_certificate_expiry,
    viewing_min_days_advance
  } = req.body;

  // Validate required fields
  if (!phone_number || !email_address) {
    return res.status(400).json({ error: 'Phone number and email address are required' });
  }

  if (!company_name) {
    return res.status(400).json({ error: 'Company name is required' });
  }

  if (!redress_scheme_name || !redress_scheme_number) {
    return res.status(400).json({ error: 'Redress scheme information is required' });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email_address)) {
    return res.status(400).json({ error: 'Invalid email address format' });
  }

  // Phone validation (UK format - basic check)
  const phoneRegex = /^(?:(?:\+44\s?|0)(?:\d\s?){10})$/;
  const cleanPhone = phone_number.replace(/\s/g, '');
  if (cleanPhone.length < 10) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }

  // URL validation for social links and redress scheme (if provided)
  const urlRegex = /^https?:\/\/.+/;
  if (facebook_url && !urlRegex.test(facebook_url)) {
    return res.status(400).json({ error: 'Invalid Facebook URL format' });
  }
  if (twitter_url && !urlRegex.test(twitter_url)) {
    return res.status(400).json({ error: 'Invalid Twitter/X URL format' });
  }
  if (instagram_url && !urlRegex.test(instagram_url)) {
    return res.status(400).json({ error: 'Invalid Instagram URL format' });
  }
  if (redress_scheme_url && !urlRegex.test(redress_scheme_url)) {
    return res.status(400).json({ error: 'Invalid redress scheme URL format' });
  }

  const updateSetting = async (value, key) => {
    // Defense-in-depth: explicit agency_id filtering
    await db.query(
      `UPDATE site_settings SET setting_value = $1 WHERE setting_key = $2 AND agency_id = $3`,
      [value, key, agencyId],
      agencyId
    );
  };

  // Update agency identity fields (single source of truth: agencies table)
  await db.query(
    `UPDATE agencies SET name = $1, email = $2, phone = $3, updated_at = NOW()
     WHERE id = $4`,
    [company_name, email_address, phone_number || '', agencyId], agencyId
  );

  // Update remaining settings in site_settings
  await updateSetting(address_line1 || '', 'address_line1');
  await updateSetting(address_line2 || '', 'address_line2');
  await updateSetting(city || '', 'city');
  await updateSetting(postcode || '', 'postcode');
  await updateSetting(facebook_url || '', 'facebook_url');
  await updateSetting(twitter_url || '', 'twitter_url');
  await updateSetting(instagram_url || '', 'instagram_url');
  await updateSetting(redress_scheme_name, 'redress_scheme_name');
  await updateSetting(redress_scheme_number, 'redress_scheme_number');
  await updateSetting(redress_scheme_url || '', 'redress_scheme_url');
  await updateSetting(cmp_certificate_filename || 'Updated-CMP-cert.jpg', 'cmp_certificate_filename');
  await updateSetting(prs_certificate_filename || 'Updated-PRS-Certificate.jpg', 'prs_certificate_filename');
  await updateSetting(cmp_certificate_expiry || '', 'cmp_certificate_expiry');
  await updateSetting(prs_certificate_expiry || '', 'prs_certificate_expiry');
  await updateSetting(ico_certificate_filename || '', 'ico_certificate_filename');
  await updateSetting(ico_certificate_expiry || '', 'ico_certificate_expiry');

  // Viewing settings
  if (viewing_min_days_advance !== undefined) {
    const minDays = parseInt(viewing_min_days_advance, 10);
    if (!isNaN(minDays) && minDays >= 0) {
      await updateSetting(minDays.toString(), 'viewing_min_days_advance');
    }
  }

  res.json({ message: 'Settings updated successfully' });
}, 'update settings');

// Upload CMP Certificate (admin only)
const uploadCmpCertificate = async (req, res) => {
  try {
    const agencyId = req.agencyId;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get current CMP certificate filename from database
    // Defense-in-depth: explicit agency_id filtering
    const result = await db.query(
      'SELECT setting_value FROM site_settings WHERE setting_key = $1 AND agency_id = $2',
      ['cmp_certificate_filename', agencyId],
      agencyId
    );
    const currentSetting = result.rows[0];

    // Delete old file if it exists and is different from new file
    if (currentSetting && currentSetting.setting_value) {
      const oldFilename = currentSetting.setting_value.replace('uploads/certificates/', '').replace('uploads/', '');
      const newFilename = req.file.filename;

      if (oldFilename !== newFilename) {
        const oldFilePath = path.join(__dirname, '../../uploads', oldFilename);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
    }

    // Store filename with uploads/ prefix for URL access
    const filenameWithPath = `uploads/${req.file.filename}`;

    // Update database with new filename (includes uploads/ prefix)
    // Defense-in-depth: explicit agency_id filtering
    await db.query(
      `UPDATE site_settings SET setting_value = $1 WHERE setting_key = $2 AND agency_id = $3`,
      [filenameWithPath, 'cmp_certificate_filename', agencyId],
      agencyId
    );

    res.json({ message: 'CMP certificate uploaded successfully', filename: filenameWithPath });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    handleError(res, error, 'upload CMP certificate');
  }
};

// Upload PRS Certificate (admin only)
const uploadPrsCertificate = async (req, res) => {
  try {
    const agencyId = req.agencyId;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get current PRS certificate filename from database
    // Defense-in-depth: explicit agency_id filtering
    const result = await db.query(
      'SELECT setting_value FROM site_settings WHERE setting_key = $1 AND agency_id = $2',
      ['prs_certificate_filename', agencyId],
      agencyId
    );
    const currentSetting = result.rows[0];

    // Delete old file if it exists and is different from new file
    if (currentSetting && currentSetting.setting_value) {
      const oldFilename = currentSetting.setting_value.replace('uploads/certificates/', '').replace('uploads/', '');
      const newFilename = req.file.filename;

      if (oldFilename !== newFilename) {
        const oldFilePath = path.join(__dirname, '../../uploads', oldFilename);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
    }

    // Store filename with uploads/ prefix for URL access
    const filenameWithPath = `uploads/${req.file.filename}`;

    // Update database with new filename (includes uploads/ prefix)
    // Defense-in-depth: explicit agency_id filtering
    await db.query(
      `UPDATE site_settings SET setting_value = $1 WHERE setting_key = $2 AND agency_id = $3`,
      [filenameWithPath, 'prs_certificate_filename', agencyId],
      agencyId
    );

    res.json({ message: 'PRS certificate uploaded successfully', filename: filenameWithPath });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    handleError(res, error, 'upload PRS certificate');
  }
};

// Upload Privacy Policy (admin only)
const uploadPrivacyPolicy = async (req, res) => {
  try {
    const agencyId = req.agencyId;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get current privacy policy filename from database
    // Defense-in-depth: explicit agency_id filtering
    const result = await db.query(
      'SELECT setting_value FROM site_settings WHERE setting_key = $1 AND agency_id = $2',
      ['privacy_policy_filename', agencyId],
      agencyId
    );
    const currentSetting = result.rows[0];

    // Delete old file if it exists and is different from new file
    if (currentSetting && currentSetting.setting_value) {
      const oldFilename = currentSetting.setting_value.replace('uploads/certificates/', '').replace('uploads/', '');
      const newFilename = req.file.filename;

      if (oldFilename !== newFilename) {
        const oldFilePath = path.join(__dirname, '../../uploads', oldFilename);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
    }

    // Store filename with uploads/ prefix for URL access
    const filenameWithPath = `uploads/${req.file.filename}`;

    // Update database with new filename (includes uploads/ prefix)
    // Defense-in-depth: explicit agency_id filtering
    await db.query(
      `UPDATE site_settings SET setting_value = $1 WHERE setting_key = $2 AND agency_id = $3`,
      [filenameWithPath, 'privacy_policy_filename', agencyId],
      agencyId
    );

    res.json({ message: 'Privacy policy uploaded successfully', filename: filenameWithPath });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    handleError(res, error, 'upload privacy policy');
  }
};

// Upload ICO Certificate (admin only)
const uploadIcoCertificate = async (req, res) => {
  try {
    const agencyId = req.agencyId;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get current ICO certificate filename from database
    // Defense-in-depth: explicit agency_id filtering
    const result = await db.query(
      'SELECT setting_value FROM site_settings WHERE setting_key = $1 AND agency_id = $2',
      ['ico_certificate_filename', agencyId],
      agencyId
    );
    const currentSetting = result.rows[0];

    // Delete old file if it exists and is different from new file
    if (currentSetting && currentSetting.setting_value) {
      const oldFilename = currentSetting.setting_value.replace('uploads/certificates/', '').replace('uploads/', '');
      const newFilename = req.file.filename;

      if (oldFilename !== newFilename) {
        const oldFilePath = path.join(__dirname, '../../uploads', oldFilename);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
    }

    // Store filename with uploads/ prefix for URL access
    const filenameWithPath = `uploads/${req.file.filename}`;

    // Update database with new filename (includes uploads/ prefix)
    // Defense-in-depth: explicit agency_id filtering
    await db.query(
      `UPDATE site_settings SET setting_value = $1 WHERE setting_key = $2 AND agency_id = $3`,
      [filenameWithPath, 'ico_certificate_filename', agencyId],
      agencyId
    );

    res.json({ message: 'ICO certificate uploaded successfully', filename: filenameWithPath });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    handleError(res, error, 'upload ICO certificate');
  }
};

module.exports = {
  getAllSettings,
  getViewingSettings,
  updateSettings,
  uploadCmpCertificate,
  uploadPrsCertificate,
  uploadPrivacyPolicy,
  uploadIcoCertificate
};
