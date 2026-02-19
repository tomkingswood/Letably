/**
 * Application form_data Helper
 *
 * Handles the hybrid storage pattern for applications:
 *   - Core columns: always-present fields stored as SQL columns
 *   - JSONB form_data: conditional fields that vary by application_type / residential_status
 *
 * Usage:
 *   READ:  const app = hydrateApplication(row);  // spreads form_data onto row with defaults
 *   WRITE: const fd = extractFormData(data);      // picks form_data fields from a flat object
 */

/**
 * Fields stored in the JSONB form_data column, with their safe defaults.
 * These fields are conditional — they depend on application_type (student/professional),
 * residential_status (Private Tenant shows landlord fields), or guarantor_required.
 */
const FORM_DATA_DEFAULTS = {
  // Current address details
  residential_status: null,
  residential_status_other: null,
  period_years: 0,
  period_months: 0,

  // Landlord details (shown when residential_status = 'Private Tenant')
  landlord_name: null,
  landlord_address: null,
  landlord_email: null,
  landlord_phone: null,

  // Address history (array of previous address objects)
  address_history: [],

  // Student-specific fields
  university: null,
  year_of_study: null,
  course: null,
  student_number: null,
  payment_plan: null,

  // Professional-specific fields
  employment_type: null,
  company_name: null,
  employment_start_date: null,
  contact_name: null,
  contact_job_title: null,
  contact_email: null,
  contact_phone: null,
  company_address: null,

  // Guarantor personal info (only when guarantor_required = true)
  // Written by both the applicant form and the guarantor form
  guarantor_name: null,
  guarantor_dob: null,
  guarantor_email: null,
  guarantor_phone: null,
  guarantor_address: null,
  guarantor_relationship: null,
  guarantor_id_type: null,
  guarantor_signature_name: null,
  guarantor_signature_agreed: false,
};

const FORM_DATA_FIELDS = Object.keys(FORM_DATA_DEFAULTS);

/**
 * Hydrate an application row by spreading form_data fields onto it with safe defaults.
 * After hydration, callers can access `app.residential_status`, `app.landlord_name`, etc.
 * directly — no need to know about the JSONB column.
 *
 * @param {Object|null} row - Raw database row from SELECT * on applications
 * @returns {Object|null} Row with form_data fields merged in, or null
 */
function hydrateApplication(row) {
  if (!row) return null;

  const formData = row.form_data || {};
  const hydrated = { ...row };

  for (const [key, defaultVal] of Object.entries(FORM_DATA_DEFAULTS)) {
    if (formData[key] !== undefined && formData[key] !== null) {
      // form_data has this field — use it
      hydrated[key] = formData[key];
    } else if (hydrated[key] === undefined || hydrated[key] === null) {
      // Neither form_data nor a legacy column has a value — use default
      // (handles transitional period where old apps may have data in
      // legacy columns like payment_plan before they were moved to form_data)
      hydrated[key] = defaultVal;
    }
    // Otherwise: legacy column has a value but form_data doesn't — keep it
  }

  return hydrated;
}

/**
 * Hydrate an array of application rows.
 *
 * @param {Array} rows - Array of raw database rows
 * @returns {Array} Array of hydrated rows
 */
function hydrateApplications(rows) {
  return rows.map(hydrateApplication);
}

/**
 * Extract form_data fields from a flat data object (e.g. from req.body).
 * Returns a plain object suitable for storing as JSONB.
 *
 * Handles address_history being passed as a JSON string (from controller stringify)
 * by parsing it back to an array.
 *
 * @param {Object} data - Flat object with all application fields
 * @returns {Object} Object containing only the form_data fields
 */
function extractFormData(data) {
  const formData = {};

  for (const key of FORM_DATA_FIELDS) {
    if (data[key] !== undefined) {
      // address_history may be passed as a JSON string from the controller
      if (key === 'address_history' && typeof data[key] === 'string') {
        try {
          formData[key] = JSON.parse(data[key]);
        } catch {
          formData[key] = [];
        }
      } else {
        formData[key] = data[key];
      }
    }
  }

  return formData;
}

module.exports = {
  hydrateApplication,
  hydrateApplications,
  extractFormData,
  FORM_DATA_FIELDS,
  FORM_DATA_DEFAULTS,
};
