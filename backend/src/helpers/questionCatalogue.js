/**
 * Application Form Question Catalogue
 *
 * Single source of truth for every question that can appear on an application form.
 * Each entry describes what to render, where the value is stored, and whether the
 * agency can toggle it on/off.
 *
 * Complex sections (AddressHistory, IdDocument, GuarantorInfo, Declaration) are
 * rendered by dedicated React components — the catalogue entry controls visibility
 * only; the component handles its own internal rendering.
 */

// ─── Question Definitions ────────────────────────────────────────────────────

const QUESTION_CATALOGUE = [
  // ── Personal Information (core — always on) ────────────────────────────────
  {
    key: 'title',
    label: 'Title',
    type: 'select',
    section: 'personal_info',
    sectionLabel: 'Applicant Information',
    scope: 'all',
    core: true,
    required: true,
    storage: 'column',
    options: [
      { value: 'Mr', label: 'Mr' },
      { value: 'Miss', label: 'Miss' },
      { value: 'Mrs', label: 'Mrs' },
      { value: 'Other', label: 'Other' },
    ],
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'title_other',
    label: 'Please Specify',
    type: 'text',
    section: 'personal_info',
    sectionLabel: 'Applicant Information',
    scope: 'all',
    core: true,
    required: true,
    storage: 'column',
    options: null,
    dependsOn: { key: 'title', value: 'Other' },
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'date_of_birth',
    label: 'Date of Birth',
    type: 'date',
    section: 'personal_info',
    sectionLabel: 'Applicant Information',
    scope: 'all',
    core: true,
    required: true,
    storage: 'column',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'first_name',
    label: 'First Name',
    type: 'text',
    section: 'personal_info',
    sectionLabel: 'Applicant Information',
    scope: 'all',
    core: true,
    required: true,
    storage: 'column',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'middle_name',
    label: 'Middle Name',
    type: 'text',
    section: 'personal_info',
    sectionLabel: 'Applicant Information',
    scope: 'all',
    core: true,
    required: false,
    storage: 'column',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'surname',
    label: 'Surname',
    type: 'text',
    section: 'personal_info',
    sectionLabel: 'Applicant Information',
    scope: 'all',
    core: true,
    required: true,
    storage: 'column',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'email',
    label: 'Email',
    type: 'email',
    section: 'personal_info',
    sectionLabel: 'Applicant Information',
    scope: 'all',
    core: true,
    required: true,
    storage: 'column',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'phone',
    label: 'Phone',
    type: 'tel',
    section: 'personal_info',
    sectionLabel: 'Applicant Information',
    scope: 'all',
    core: true,
    required: true,
    storage: 'column',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },

  // ── Additional Personal Details (configurable) ─────────────────────────────
  {
    key: 'nationality',
    label: 'Nationality',
    type: 'text',
    section: 'personal_info',
    sectionLabel: 'Applicant Information',
    scope: 'all',
    core: false,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: 'e.g. British',
    gridCols: 1,
  },
  {
    key: 'national_insurance_number',
    label: 'National Insurance Number',
    type: 'text',
    section: 'personal_info',
    sectionLabel: 'Applicant Information',
    scope: 'all',
    core: false,
    required: false,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: 'e.g. QQ 12 34 56 C',
    gridCols: 1,
  },

  // ── Current Address (core) ─────────────────────────────────────────────────
  {
    key: 'residential_status',
    label: 'Residential Status',
    type: 'select',
    section: 'current_address',
    sectionLabel: 'Current Address',
    scope: 'all',
    core: true,
    required: true,
    storage: 'form_data',
    options: [
      { value: 'Private Tenant', label: 'Private Tenant' },
      { value: 'Living with Parents', label: 'Living with Parents' },
      { value: 'Student Accommodation', label: 'Student Accommodation' },
      { value: 'Owner Occupier', label: 'Owner Occupier' },
      { value: 'Other', label: 'Other' },
    ],
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'residential_status_other',
    label: 'Please Specify',
    type: 'text',
    section: 'current_address',
    sectionLabel: 'Current Address',
    scope: 'all',
    core: true,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: { key: 'residential_status', value: 'Other' },
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'period_years',
    label: 'Years at Current Address',
    type: 'number',
    section: 'current_address',
    sectionLabel: 'Current Address',
    scope: 'all',
    core: true,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '0',
    gridCols: 1,
    min: 0,
  },
  {
    key: 'period_months',
    label: 'Months at Current Address',
    type: 'number',
    section: 'current_address',
    sectionLabel: 'Current Address',
    scope: 'all',
    core: true,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '0',
    gridCols: 1,
    min: 0,
    max: 11,
  },
  {
    key: 'current_address',
    label: 'Full Address',
    type: 'textarea',
    section: 'current_address',
    sectionLabel: 'Current Address',
    scope: 'all',
    core: true,
    required: true,
    storage: 'column',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 2,
  },

  // ── Landlord Details (core — data-driven visibility) ───────────────────────
  {
    key: 'landlord_name',
    label: 'Landlord Name',
    type: 'text',
    section: 'landlord_details',
    sectionLabel: 'Current Landlord Details',
    scope: 'all',
    core: true,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: { key: 'residential_status', value: 'Private Tenant' },
    placeholder: '',
    gridCols: 2,
  },
  {
    key: 'landlord_address',
    label: 'Landlord Address',
    type: 'textarea',
    section: 'landlord_details',
    sectionLabel: 'Current Landlord Details',
    scope: 'all',
    core: true,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: { key: 'residential_status', value: 'Private Tenant' },
    placeholder: '',
    gridCols: 2,
  },
  {
    key: 'landlord_email',
    label: 'Landlord Email',
    type: 'email',
    section: 'landlord_details',
    sectionLabel: 'Current Landlord Details',
    scope: 'all',
    core: true,
    required: false,
    storage: 'form_data',
    options: null,
    dependsOn: { key: 'residential_status', value: 'Private Tenant' },
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'landlord_phone',
    label: 'Landlord Phone',
    type: 'tel',
    section: 'landlord_details',
    sectionLabel: 'Current Landlord Details',
    scope: 'all',
    core: true,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: { key: 'residential_status', value: 'Private Tenant' },
    placeholder: '',
    gridCols: 1,
  },

  // ── Address History (core — complex component) ─────────────────────────────
  {
    key: 'address_history',
    label: 'Address History (Previous 3 Years)',
    type: 'complex',
    component: 'AddressHistory',
    section: 'address_history',
    sectionLabel: 'Address History (Previous 3 Years)',
    scope: 'all',
    core: true,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 2,
  },

  // ── Proof of Identity (core — complex component) ───────────────────────────
  {
    key: 'id_document',
    label: 'Proof of Identity',
    type: 'complex',
    component: 'IdDocument',
    section: 'id_document',
    sectionLabel: 'Proof of Identity',
    scope: 'all',
    core: true,
    required: true,
    storage: 'column', // id_type is a column; upload is separate
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 2,
  },

  // ── Pets & Smoking (configurable) ────────────────────────────────────────
  {
    key: 'has_pets',
    label: 'Do you have any pets?',
    type: 'select',
    section: 'pets_smoking',
    sectionLabel: 'Pets & Lifestyle',
    scope: 'all',
    core: false,
    required: true,
    storage: 'form_data',
    options: [
      { value: 'No', label: 'No' },
      { value: 'Yes', label: 'Yes' },
    ],
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'pet_details',
    label: 'Pet Details',
    type: 'text',
    section: 'pets_smoking',
    sectionLabel: 'Pets & Lifestyle',
    scope: 'all',
    core: true,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: { key: 'has_pets', value: 'Yes' },
    placeholder: 'e.g. 1 cat, 2 years old',
    gridCols: 1,
  },
  {
    key: 'is_smoker',
    label: 'Do you smoke?',
    type: 'select',
    section: 'pets_smoking',
    sectionLabel: 'Pets & Lifestyle',
    scope: 'all',
    core: false,
    required: true,
    storage: 'form_data',
    options: [
      { value: 'No', label: 'No' },
      { value: 'Yes', label: 'Yes' },
    ],
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },

  // ── Next of Kin / Emergency Contact (configurable) ─────────────────────────
  {
    key: 'next_of_kin_name',
    label: 'Next of Kin Name',
    type: 'text',
    section: 'next_of_kin',
    sectionLabel: 'Next of Kin / Emergency Contact',
    scope: 'all',
    core: false,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'next_of_kin_relationship',
    label: 'Relationship',
    type: 'text',
    section: 'next_of_kin',
    sectionLabel: 'Next of Kin / Emergency Contact',
    scope: 'all',
    core: false,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: 'e.g. Parent, Spouse, Sibling',
    gridCols: 1,
  },
  {
    key: 'next_of_kin_phone',
    label: 'Phone',
    type: 'tel',
    section: 'next_of_kin',
    sectionLabel: 'Next of Kin / Emergency Contact',
    scope: 'all',
    core: false,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'next_of_kin_email',
    label: 'Email',
    type: 'email',
    section: 'next_of_kin',
    sectionLabel: 'Next of Kin / Emergency Contact',
    scope: 'all',
    core: false,
    required: false,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },

  // ── Adverse Credit / Financial History (configurable) ──────────────────────
  {
    key: 'has_ccj',
    label: 'Do you have any County Court Judgments (CCJs)?',
    type: 'select',
    section: 'adverse_credit',
    sectionLabel: 'Financial History Declarations',
    scope: 'all',
    core: false,
    required: true,
    storage: 'form_data',
    options: [
      { value: 'No', label: 'No' },
      { value: 'Yes', label: 'Yes' },
    ],
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'has_bankruptcy_or_iva',
    label: 'Have you been declared bankrupt or subject to an IVA?',
    type: 'select',
    section: 'adverse_credit',
    sectionLabel: 'Financial History Declarations',
    scope: 'all',
    core: false,
    required: true,
    storage: 'form_data',
    options: [
      { value: 'No', label: 'No' },
      { value: 'Yes', label: 'Yes' },
    ],
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'has_been_evicted',
    label: 'Have you ever been evicted from a property?',
    type: 'select',
    section: 'adverse_credit',
    sectionLabel: 'Financial History Declarations',
    scope: 'all',
    core: false,
    required: true,
    storage: 'form_data',
    options: [
      { value: 'No', label: 'No' },
      { value: 'Yes', label: 'Yes' },
    ],
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'adverse_credit_details',
    label: 'If you answered Yes to any of the above, please provide details',
    type: 'textarea',
    section: 'adverse_credit',
    sectionLabel: 'Financial History Declarations',
    scope: 'all',
    core: true,
    required: false,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 2,
  },

  // ── Student Information (configurable) ─────────────────────────────────────
  {
    key: 'payment_method',
    label: 'How will you pay rent?',
    type: 'select',
    section: 'student_info',
    sectionLabel: 'Student Information',
    scope: 'student',
    core: false,
    required: true,
    storage: 'column',
    options: [
      { value: 'Student Loan', label: 'Student Loan' },
      { value: 'Parent / Family', label: 'Parent / Family' },
      { value: 'Other', label: 'Other' },
    ],
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'payment_plan',
    label: 'Payment Plan',
    type: 'select',
    section: 'student_info',
    sectionLabel: 'Student Information',
    scope: 'student',
    core: false,
    required: true,
    storage: 'form_data',
    options: [
      { value: 'Pay Upfront', label: 'Pay Upfront' },
      { value: 'Monthly', label: 'Monthly' },
      { value: 'Quarterly', label: 'Quarterly' },
      { value: 'Monthly to Quarterly', label: 'Monthly to Quarterly' },
    ],
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'university',
    label: 'University',
    type: 'text',
    section: 'student_info',
    sectionLabel: 'Student Information',
    scope: 'student',
    core: false,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 2,
  },
  {
    key: 'year_of_study',
    label: 'Year of Study',
    type: 'select',
    section: 'student_info',
    sectionLabel: 'Student Information',
    scope: 'student',
    core: false,
    required: true,
    storage: 'form_data',
    options: [
      { value: '1st Year', label: '1st Year' },
      { value: '2nd Year', label: '2nd Year' },
      { value: '3rd Year', label: '3rd Year' },
      { value: '4th Year', label: '4th Year' },
      { value: 'Postgraduate', label: 'Postgraduate' },
    ],
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'student_number',
    label: 'Student Number',
    type: 'text',
    section: 'student_info',
    sectionLabel: 'Student Information',
    scope: 'student',
    core: false,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'course',
    label: 'Course',
    type: 'text',
    section: 'student_info',
    sectionLabel: 'Student Information',
    scope: 'student',
    core: false,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 2,
  },

  // ── Professional / Employment Information (configurable) ───────────────────
  {
    key: 'employment_type',
    label: 'Employment Type',
    type: 'select',
    section: 'employment_info',
    sectionLabel: 'Employment Information',
    scope: 'professional',
    core: false,
    required: true,
    storage: 'form_data',
    options: [
      { value: 'Full Time', label: 'Full Time' },
      { value: 'Part Time', label: 'Part Time' },
      { value: 'Self Employed', label: 'Self Employed' },
    ],
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'employment_start_date',
    label: 'Employment Start Date',
    type: 'date',
    section: 'employment_info',
    sectionLabel: 'Employment Information',
    scope: 'professional',
    core: false,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'job_title',
    label: 'Job Title',
    type: 'text',
    section: 'employment_info',
    sectionLabel: 'Employment Information',
    scope: 'professional',
    core: false,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
  },
  {
    key: 'annual_income',
    label: 'Annual Income (before tax)',
    type: 'text',
    section: 'employment_info',
    sectionLabel: 'Employment Information',
    scope: 'professional',
    core: false,
    required: false,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: 'e.g. £30,000',
    gridCols: 1,
  },
  {
    key: 'company_name',
    label: 'Company Name',
    type: 'text',
    section: 'employment_info',
    sectionLabel: 'Employment Information',
    scope: 'professional',
    core: false,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 2,
  },
  {
    key: 'company_address',
    label: 'Company Address',
    type: 'textarea',
    section: 'employment_info',
    sectionLabel: 'Employment Information',
    scope: 'professional',
    core: false,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 2,
  },
  {
    key: 'contact_name',
    label: 'Employer Reference Name',
    type: 'text',
    section: 'employment_info',
    sectionLabel: 'Employment Information',
    scope: 'professional',
    core: false,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
    subSection: 'Employment Reference Contact',
  },
  {
    key: 'contact_job_title',
    label: 'Employer Reference Job Title',
    type: 'text',
    section: 'employment_info',
    sectionLabel: 'Employment Information',
    scope: 'professional',
    core: false,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
    subSection: 'Employment Reference Contact',
  },
  {
    key: 'contact_email',
    label: 'Employer Reference Email',
    type: 'email',
    section: 'employment_info',
    sectionLabel: 'Employment Information',
    scope: 'professional',
    core: false,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
    subSection: 'Employment Reference Contact',
  },
  {
    key: 'contact_phone',
    label: 'Employer Reference Phone',
    type: 'tel',
    section: 'employment_info',
    sectionLabel: 'Employment Information',
    scope: 'professional',
    core: false,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 1,
    subSection: 'Employment Reference Contact',
  },

  // ── Guarantor Information (core — data-driven by guarantor_required) ───────
  {
    key: 'guarantor_info',
    label: 'Guarantor Information',
    type: 'complex',
    component: 'GuarantorInfo',
    section: 'guarantor_info',
    sectionLabel: 'Guarantor Information',
    scope: 'all',
    core: true,
    required: true,
    storage: 'form_data',
    options: null,
    dependsOn: { key: 'guarantor_required', value: true },
    placeholder: '',
    gridCols: 2,
  },

  // ── Declaration (core — complex component) ─────────────────────────────────
  {
    key: 'declaration',
    label: 'Declaration',
    type: 'complex',
    component: 'Declaration',
    section: 'declaration',
    sectionLabel: 'Declaration',
    scope: 'all',
    core: true,
    required: true,
    storage: 'column',
    options: null,
    dependsOn: null,
    placeholder: '',
    gridCols: 2,
  },
];

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Get all questions applicable to a given application type.
 * Filters by scope: includes 'all' and the specific type.
 */
function getQuestionsForType(applicationType) {
  return QUESTION_CATALOGUE.filter(
    (q) => q.scope === 'all' || q.scope === applicationType
  );
}

/**
 * Get non-core (configurable) questions, grouped by scope.
 * Used by the admin settings UI to show which questions can be toggled.
 */
function getConfigurableQuestions() {
  const configurable = QUESTION_CATALOGUE.filter((q) => !q.core);
  const grouped = { student: [], professional: [], all: [] };
  for (const q of configurable) {
    grouped[q.scope].push({
      key: q.key,
      label: q.label,
      section: q.section,
      sectionLabel: q.sectionLabel,
      scope: q.scope,
      required: q.required,
    });
  }
  return grouped;
}

/**
 * Merge the master catalogue with an agency's saved config to produce a
 * renderable form schema for a specific application type.
 *
 * @param {Object|null} agencyConfig - { all: [...], student: [...], professional: [...] } from site_settings
 * @param {string} applicationType - 'student' | 'professional'
 * @returns {Array} Ordered array of questions with resolved `enabled` and `required`
 */
function resolveFormSchema(agencyConfig, applicationType) {
  const questions = getQuestionsForType(applicationType);

  // Build a lookup from the agency config — merge 'all' scope + type-specific
  const configMap = {};
  if (agencyConfig) {
    if (agencyConfig.all) {
      for (const entry of agencyConfig.all) {
        configMap[entry.key] = entry;
      }
    }
    if (agencyConfig[applicationType]) {
      for (const entry of agencyConfig[applicationType]) {
        configMap[entry.key] = entry;
      }
    }
  }

  return questions.map((q) => {
    if (q.core) {
      // Core questions are always enabled; required is fixed
      return { ...q, enabled: true };
    }

    const override = configMap[q.key];
    if (override) {
      return {
        ...q,
        enabled: override.enabled !== false, // default to true
        required: override.required !== undefined ? override.required : q.required,
      };
    }

    // No config saved for this question — default to enabled with catalogue defaults
    return { ...q, enabled: true };
  });
}

// Guarantor sub-fields rendered by the GuarantorInfo complex component.
// Not individually listed in QUESTION_CATALOGUE but stored in form_data.
const GUARANTOR_FORM_DATA_FIELDS = [
  ['guarantor_name', null],
  ['guarantor_dob', null],
  ['guarantor_email', null],
  ['guarantor_phone', null],
  ['guarantor_address', null],
  ['guarantor_relationship', null],
  ['guarantor_id_type', null],
  ['guarantor_signature_name', null],
  ['guarantor_signature_agreed', false],
];

/**
 * Derive the FORM_DATA_DEFAULTS object from the catalogue.
 * Only includes entries where storage === 'form_data'.
 * This replaces the manually maintained object in formData.js.
 */
function deriveFormDataDefaults() {
  const defaults = {};
  for (const q of QUESTION_CATALOGUE) {
    if (q.storage !== 'form_data') continue;

    // Complex entries represent whole sections, not individual fields
    if (q.type === 'complex') {
      // address_history is a special case — it's an array default
      if (q.key === 'address_history') {
        defaults.address_history = [];
      }
      // guarantor_info maps to individual form_data fields (handled below)
      continue;
    }

    // Set the appropriate default
    if (q.type === 'number') {
      defaults[q.key] = 0;
    } else if (q.key === 'guarantor_signature_agreed') {
      defaults[q.key] = false;
    } else {
      defaults[q.key] = null;
    }
  }

  // Guarantor fields stored in form_data — always present in defaults
  // (written by both the applicant form and the guarantor form)
  for (const [key, defaultVal] of GUARANTOR_FORM_DATA_FIELDS) {
    defaults[key] = defaultVal;
  }

  return defaults;
}

/**
 * Get the list of configurable field keys that are required for a given
 * application type under the agency's current config.
 * When `data` is provided, fields whose dependsOn condition is not met are excluded.
 * Used for backend submit validation.
 */
function getRequiredFieldKeys(agencyConfig, applicationType, data) {
  const schema = resolveFormSchema(agencyConfig, applicationType);
  return schema
    .filter((q) => q.enabled && q.required && q.type !== 'complex')
    .filter((q) => {
      if (!data || !q.dependsOn) return true;
      const depVal = data[q.dependsOn.key];
      return depVal === q.dependsOn.value;
    })
    .map((q) => q.key);
}

module.exports = {
  QUESTION_CATALOGUE,
  getQuestionsForType,
  getConfigurableQuestions,
  resolveFormSchema,
  deriveFormDataDefaults,
  getRequiredFieldKeys,
};
