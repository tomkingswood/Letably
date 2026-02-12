/**
 * Landlords Export Module
 *
 * Exports landlord data with property counts.
 */

const db = require('../db');
const { formatDate } = require('../utils/csvGenerator');

// CSV column definitions
const columns = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'legal_name', label: 'Legal Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address_line1', label: 'Address Line 1' },
  { key: 'address_line2', label: 'Address Line 2' },
  { key: 'city', label: 'City' },
  { key: 'postcode', label: 'Postcode' },
  { key: 'bank_name', label: 'Bank Name' },
  { key: 'bank_account_name', label: 'Account Name' },
  { key: 'sort_code', label: 'Sort Code' },
  { key: 'account_number', label: 'Account Number' },
  { key: 'receive_maintenance_notifications', label: 'Maintenance Notifications', transform: (v) => v ? 'Yes' : 'No' },
  { key: 'receive_payment_notifications', label: 'Payment Notifications', transform: (v) => v ? 'Yes' : 'No' },
  { key: 'receive_tenancy_communications', label: 'Tenancy Communications', transform: (v) => v ? 'Yes' : 'No' },
  { key: 'manage_rent', label: 'Manage Rent', transform: (v) => v ? 'Yes' : 'No' },
  { key: 'property_count', label: 'Property Count' },
  { key: 'notes', label: 'Notes' },
  { key: 'created_at', label: 'Created', transform: formatDate },
];

// XML schema definition
const xmlSchema = {
  rootElement: 'landlords',
  rowElement: 'landlord',
  fields: [
    { key: 'id', xmlName: 'id' },
    { key: 'name', xmlName: 'name' },
    { key: 'legal_name', xmlName: 'legalName' },
    { key: 'email', xmlName: 'email' },
    { key: 'phone', xmlName: 'phone' },
    { key: 'address_line1', xmlName: 'addressLine1' },
    { key: 'address_line2', xmlName: 'addressLine2' },
    { key: 'city', xmlName: 'city' },
    { key: 'postcode', xmlName: 'postcode' },
    { key: 'bank_name', xmlName: 'bankName' },
    { key: 'bank_account_name', xmlName: 'bankAccountName' },
    { key: 'sort_code', xmlName: 'sortCode' },
    { key: 'account_number', xmlName: 'accountNumber' },
    { key: 'receive_maintenance_notifications', xmlName: 'receiveMaintenanceNotifications', transform: (v) => v ? 'true' : 'false' },
    { key: 'receive_payment_notifications', xmlName: 'receivePaymentNotifications', transform: (v) => v ? 'true' : 'false' },
    { key: 'receive_tenancy_communications', xmlName: 'receiveTenancyCommunications', transform: (v) => v ? 'true' : 'false' },
    { key: 'manage_rent', xmlName: 'manageRent', transform: (v) => v ? 'true' : 'false' },
    { key: 'property_count', xmlName: 'propertyCount' },
    { key: 'notes', xmlName: 'notes' },
    { key: 'created_at', xmlName: 'createdAt', transform: formatDate },
  ],
};

/**
 * Fetch landlords data with optional filtering
 * @param {number} agencyId - Agency ID
 * @param {object} filters - Filter options
 * @param {boolean} includeRelated - Include related data (property count)
 * @returns {Promise<Array>} - Landlords data
 */
const fetchData = async (agencyId, filters = {}, includeRelated = true) => {
  let query = `
    SELECT
      l.id,
      l.name,
      l.legal_name,
      l.email,
      l.phone,
      l.address_line1,
      l.address_line2,
      l.city,
      l.postcode,
      l.bank_name,
      l.bank_account_name,
      l.sort_code,
      l.account_number,
      l.receive_maintenance_notifications,
      l.receive_payment_notifications,
      l.receive_tenancy_communications,
      l.manage_rent,
      l.notes,
      l.created_at
      ${includeRelated ? `,
      (SELECT COUNT(*) FROM properties p WHERE p.landlord_id = l.id) as property_count
      ` : ''}
    FROM landlords l
    WHERE l.agency_id = $1
  `;

  const params = [agencyId];
  let paramIndex = 2;

  // Apply filters
  if (filters.has_properties !== undefined && filters.has_properties !== '') {
    if (filters.has_properties === 'true' || filters.has_properties === true) {
      query += ` AND EXISTS (SELECT 1 FROM properties p WHERE p.landlord_id = l.id)`;
    } else {
      query += ` AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.landlord_id = l.id)`;
    }
  }

  query += ' ORDER BY l.id ASC';

  const result = await db.query(query, params, agencyId);
  return result.rows;
};

module.exports = {
  columns,
  xmlSchema,
  fetchData,
};
