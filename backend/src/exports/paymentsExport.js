/**
 * Payments Export Module
 *
 * Exports payment schedule data with tenant and property information.
 */

const db = require('../db');
const { formatDate, formatCurrency } = require('../utils/csvGenerator');

// CSV column definitions
const columns = [
  { key: 'id', label: 'ID' },
  { key: 'tenant_name', label: 'Tenant Name' },
  { key: 'tenant_email', label: 'Tenant Email' },
  { key: 'property_address', label: 'Property' },
  { key: 'amount_due', label: 'Amount Due', transform: formatCurrency },
  { key: 'amount_paid', label: 'Amount Paid', transform: formatCurrency },
  { key: 'balance', label: 'Balance', transform: (v, row) => formatCurrency(parseFloat(row.amount_due || 0) - parseFloat(row.amount_paid || 0)) },
  { key: 'due_date', label: 'Due Date', transform: formatDate },
  { key: 'payment_type', label: 'Payment Type' },
  { key: 'status', label: 'Status' },
  { key: 'description', label: 'Description' },
  { key: 'covers_from', label: 'Covers From', transform: formatDate },
  { key: 'covers_to', label: 'Covers To', transform: formatDate },
  { key: 'schedule_type', label: 'Schedule Type' },
  { key: 'landlord_name', label: 'Landlord' },
  { key: 'created_at', label: 'Created', transform: formatDate },
];

// XML schema definition
const xmlSchema = {
  rootElement: 'payments',
  rowElement: 'payment',
  fields: [
    { key: 'id', xmlName: 'id' },
    { key: 'tenant_name', xmlName: 'tenantName' },
    { key: 'tenant_email', xmlName: 'tenantEmail' },
    { key: 'property_address', xmlName: 'propertyAddress' },
    { key: 'amount_due', xmlName: 'amountDue', transform: formatCurrency },
    { key: 'amount_paid', xmlName: 'amountPaid', transform: formatCurrency },
    { key: 'balance', xmlName: 'balance', transform: (v, row) => formatCurrency(parseFloat(row.amount_due || 0) - parseFloat(row.amount_paid || 0)) },
    { key: 'due_date', xmlName: 'dueDate', transform: formatDate },
    { key: 'payment_type', xmlName: 'paymentType' },
    { key: 'status', xmlName: 'status' },
    { key: 'description', xmlName: 'description' },
    { key: 'covers_from', xmlName: 'coversFrom', transform: formatDate },
    { key: 'covers_to', xmlName: 'coversTo', transform: formatDate },
    { key: 'schedule_type', xmlName: 'scheduleType' },
    { key: 'landlord_name', xmlName: 'landlordName' },
    { key: 'created_at', xmlName: 'createdAt', transform: formatDate },
  ],
};

/**
 * Fetch payment schedules data with optional filtering
 * @param {number} agencyId - Agency ID
 * @param {object} filters - Filter options
 * @param {boolean} includeRelated - Include related data (tenant, property, landlord)
 * @returns {Promise<Array>} - Payment schedules data
 */
const fetchData = async (agencyId, filters = {}, includeRelated = true) => {
  let query = `
    SELECT
      ps.id,
      ps.amount_due,
      ps.due_date,
      ps.payment_type,
      ps.status,
      ps.description,
      ps.covers_from,
      ps.covers_to,
      ps.schedule_type,
      ps.created_at
      ${includeRelated ? `,
      COALESCE(
        (SELECT SUM(amount) FROM payments WHERE payment_schedule_id = ps.id), 0
      ) as amount_paid,
      COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') as tenant_name,
      u.email as tenant_email,
      COALESCE(p.address_line1, '') || ', ' || COALESCE(p.city, '') as property_address,
      l.name as landlord_name
      ` : ''}
    FROM payment_schedules ps
    ${includeRelated ? `
    LEFT JOIN tenancy_members tm ON ps.tenancy_member_id = tm.id
    LEFT JOIN users u ON tm.user_id = u.id
    LEFT JOIN tenancies t ON ps.tenancy_id = t.id
    LEFT JOIN properties p ON t.property_id = p.id
    LEFT JOIN landlords l ON p.landlord_id = l.id
    ` : ''}
    WHERE ps.agency_id = $1
  `;

  const params = [agencyId];
  let paramIndex = 2;

  // Apply filters
  if (filters.status) {
    query += ` AND ps.status = $${paramIndex++}`;
    params.push(filters.status);
  }

  if (filters.payment_type) {
    query += ` AND ps.payment_type = $${paramIndex++}`;
    params.push(filters.payment_type);
  }

  if (filters.due_date_from) {
    query += ` AND ps.due_date >= $${paramIndex++}`;
    params.push(filters.due_date_from);
  }

  if (filters.due_date_to) {
    query += ` AND ps.due_date <= $${paramIndex++}`;
    params.push(filters.due_date_to);
  }

  query += ' ORDER BY ps.due_date DESC, ps.id ASC';

  const result = await db.query(query, params, agencyId);
  return result.rows;
};

module.exports = {
  columns,
  xmlSchema,
  fetchData,
};
