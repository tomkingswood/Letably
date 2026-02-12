const db = require('../db');

/**
 * Build and execute a paginated query with dynamic filters.
 *
 * @param {Object} options
 * @param {string} options.baseQuery - SELECT query without WHERE/ORDER/LIMIT (must include FROM)
 * @param {string} options.countQuery - Base COUNT query without WHERE (e.g. "SELECT COUNT(*) as total FROM table")
 * @param {string} options.orderBy - ORDER BY clause (e.g. "created_at DESC")
 * @param {Array<{clause: string, value: *}>} [options.filters=[]] - Dynamic WHERE conditions with $N placeholders and values
 * @param {string} [options.baseWhere] - Fixed WHERE condition always applied (e.g. "agency_id = $1")
 * @param {Array<*>} [options.baseParams=[]] - Parameters for baseWhere
 * @param {number} [options.limit=50] - Page size
 * @param {number} [options.offset=0] - Offset
 * @param {number|string} options.agencyId - Agency ID for db.query
 * @returns {Promise<{rows: Array, pagination: {total: number, limit: number, offset: number, hasMore: boolean}}>}
 */
async function paginatedQuery({
  baseQuery,
  countQuery,
  orderBy,
  filters = [],
  baseWhere,
  baseParams = [],
  limit = 50,
  offset = 0,
  agencyId,
}) {
  const limitNum = parseInt(limit) || 50;
  const offsetNum = parseInt(offset) || 0;

  // Start paramIndex after baseParams
  let paramIndex = baseParams.length + 1;
  const filterClauses = [];
  const filterParams = [];

  for (const filter of filters) {
    // Replace $N placeholder in clause with the current paramIndex
    filterClauses.push(filter.clause.replace('$N', `$${paramIndex++}`));
    filterParams.push(filter.value);
  }

  // Build WHERE clause
  const allConditions = [];
  if (baseWhere) allConditions.push(baseWhere);
  allConditions.push(...filterClauses);
  const whereClause = allConditions.length > 0 ? ` WHERE ${allConditions.join(' AND ')}` : '';

  // Data query
  const allParams = [...baseParams, ...filterParams];
  const dataQuery = `${baseQuery}${whereClause} ORDER BY ${orderBy} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  allParams.push(limitNum, offsetNum);

  const result = await db.query(dataQuery, allParams, agencyId);

  // Count query (same filters, no LIMIT/OFFSET)
  const countParams = [...baseParams, ...filterParams];
  const fullCountQuery = `${countQuery}${whereClause}`;
  const countResult = await db.query(fullCountQuery, countParams, agencyId);
  const total = parseInt(countResult.rows[0].total);

  return {
    rows: result.rows,
    pagination: {
      total,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + result.rows.length < total,
    },
  };
}

module.exports = { paginatedQuery };
