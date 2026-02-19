/**
 * Report Query Builder
 *
 * Fluent API for building parameterized SQL queries.
 * All user inputs are passed as parameters to prevent SQL injection.
 *
 * SECURITY NOTES:
 * - NEVER concatenate user input directly into SQL strings
 * - Always use $N placeholders and add values to params array
 * - The whereLandlord() method is the critical security filter for data isolation
 */

/**
 * SQL Query Builder for reports (PostgreSQL)
 * Builds parameterized queries with dynamic WHERE clauses and JOINs
 */
class ReportQueryBuilder {
  constructor() {
    this.selectClauses = [];
    this.fromClause = '';
    this.joins = [];
    this.whereClauses = [];
    this.groupByClauses = [];
    this.orderByClauses = [];
    this.params = [];
    this.ctes = []; // Common Table Expressions (WITH clauses)
    this.paramIndex = 1; // PostgreSQL parameter counter
  }

  /**
   * Get next parameter placeholder ($1, $2, etc.)
   */
  getNextParam() {
    return `$${this.paramIndex++}`;
  }

  /**
   * Add a CTE (Common Table Expression) for complex subqueries
   * @param {string} name - CTE name
   * @param {string} query - SQL query (use $N for params)
   * @param {any[]} params - Parameters for the query
   */
  withCTE(name, query, params = []) {
    // Replace ? placeholders with $N
    let convertedQuery = query;
    for (let i = 0; i < params.length; i++) {
      convertedQuery = convertedQuery.replace('?', this.getNextParam());
    }
    this.ctes.push({ name, query: convertedQuery });
    this.params.push(...params);
    return this;
  }

  /**
   * Add SELECT columns
   * @param {string|string[]} columns - Column(s) to select
   */
  select(columns) {
    if (Array.isArray(columns)) {
      this.selectClauses.push(...columns);
    } else {
      this.selectClauses.push(columns);
    }
    return this;
  }

  /**
   * Set FROM table
   * @param {string} table - Table name
   * @param {string} alias - Optional alias
   */
  from(table, alias = null) {
    this.fromClause = alias ? `${table} ${alias}` : table;
    return this;
  }

  /**
   * Add a JOIN clause
   * @param {string} table - Table to join
   * @param {string} alias - Table alias
   * @param {string} condition - Join condition
   * @param {string} type - Join type (INNER, LEFT, etc.)
   */
  join(table, alias, condition, type = 'INNER') {
    // Replace any ? in condition with $N
    let convertedCondition = condition;
    const matches = condition.match(/\?/g);
    if (matches) {
      for (let i = 0; i < matches.length; i++) {
        convertedCondition = convertedCondition.replace('?', this.getNextParam());
      }
    }
    this.joins.push({
      type,
      table,
      alias,
      condition: convertedCondition,
    });
    return this;
  }

  /**
   * Add a LEFT JOIN clause
   */
  leftJoin(table, alias, condition) {
    return this.join(table, alias, condition, 'LEFT');
  }

  /**
   * Add a WHERE condition with parameterized values
   * SECURITY: Always use placeholders, never concatenate user input
   * @param {string} condition - SQL condition with ? placeholders
   * @param {any|any[]} params - Parameter(s) for the condition
   */
  where(condition, params = []) {
    // Convert ? to $N for PostgreSQL
    let convertedCondition = condition;
    const paramsArray = Array.isArray(params) ? params : (params !== undefined && params !== null ? [params] : []);

    for (let i = 0; i < paramsArray.length; i++) {
      convertedCondition = convertedCondition.replace('?', this.getNextParam());
    }

    this.whereClauses.push(convertedCondition);
    this.params.push(...paramsArray);
    return this;
  }

  /**
   * Add a WHERE condition only if value is truthy
   * @param {string} condition - SQL condition with ? placeholders
   * @param {boolean} shouldApply - Whether to apply this condition
   * @param {any|any[]} params - Parameter(s) for the condition
   */
  whereIf(condition, shouldApply, params = []) {
    if (shouldApply) {
      return this.where(condition, params);
    }
    return this;
  }

  /**
   * Add landlord filter - CRITICAL SECURITY FILTER
   * This is the primary data isolation mechanism for multi-tenant security.
   * Landlord users MUST have this filter applied to prevent data leakage.
   *
   * @param {number|null} landlordId - Landlord ID to filter by
   * @param {string} propertyAlias - Alias for properties table (default 'p')
   */
  whereLandlord(landlordId, propertyAlias = 'p') {
    if (landlordId !== null && landlordId !== undefined) {
      return this.where(`${propertyAlias}.landlord_id = ?`, landlordId);
    }
    return this;
  }

  /**
   * Add property filter
   * @param {number|null} propertyId - Property ID to filter by
   * @param {string} propertyAlias - Alias for properties table
   */
  whereProperty(propertyId, propertyAlias = 'p') {
    if (propertyId !== null && propertyId !== undefined) {
      return this.where(`${propertyAlias}.id = ?`, propertyId);
    }
    return this;
  }

  /**
   * Add tenancy status filter
   * @param {string} status - Status value or 'all'
   * @param {string} tenancyAlias - Alias for tenancies table
   */
  whereTenancyStatus(status, tenancyAlias = 't') {
    if (status && status !== 'all') {
      return this.where(`${tenancyAlias}.status = ?`, status);
    }
    return this;
  }

  /**
   * Add date range filter for a column
   * @param {string} column - Column to filter
   * @param {string} startDate - Start date (ISO format)
   * @param {string} endDate - End date (ISO format)
   */
  whereDateRange(column, startDate, endDate) {
    if (startDate) {
      this.where(`${column} >= ?`, startDate);
    }
    if (endDate) {
      this.where(`${column} <= ?`, endDate);
    }
    return this;
  }

  /**
   * Add year/month filter using EXTRACT (PostgreSQL)
   * @param {string} column - Date column to filter
   * @param {number} year - Year value
   * @param {number|null} month - Month value (1-12)
   */
  whereYearMonth(column, year, month = null) {
    if (year) {
      this.where(`EXTRACT(YEAR FROM ${column})::text = ?`, year.toString());
    }
    if (month !== null && month !== undefined) {
      const paddedMonth = month.toString().padStart(2, '0');
      this.where(`TO_CHAR(${column}, 'MM') = ?`, paddedMonth);
    }
    return this;
  }

  /**
   * Add days ahead filter (for upcoming endings)
   * @param {string} column - Date column to compare
   * @param {number} daysAhead - Number of days ahead
   */
  whereDaysAhead(column, daysAhead) {
    if (daysAhead !== null && daysAhead !== undefined) {
      // PostgreSQL syntax for date arithmetic
      this.where(`${column} <= CURRENT_DATE + INTERVAL '1 day' * ?`, daysAhead);
    }
    return this;
  }

  /**
   * Add GROUP BY clause
   * @param {string|string[]} columns - Column(s) to group by
   */
  groupBy(columns) {
    if (Array.isArray(columns)) {
      this.groupByClauses.push(...columns);
    } else {
      this.groupByClauses.push(columns);
    }
    return this;
  }

  /**
   * Add ORDER BY clause
   * SECURITY: Validates column format and direction to prevent SQL injection
   * @param {string} column - Column to order by (must be alphanumeric with optional table alias)
   * @param {string} direction - Sort direction (ASC/DESC)
   */
  orderBy(column, direction = 'ASC') {
    // Validate direction
    const normalizedDirection = direction.toUpperCase();
    if (normalizedDirection !== 'ASC' && normalizedDirection !== 'DESC') {
      throw new Error(`Invalid ORDER BY direction: ${direction}. Must be ASC or DESC.`);
    }

    // Validate column format: must be alphanumeric with optional dots for table.column
    // Allows: column_name, t.column_name, table_alias.column_name, COALESCE(...), COUNT(*)
    const safeColumnPattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/;
    const aggregatePattern = /^(COUNT|SUM|AVG|MIN|MAX|COALESCE)\s*\([^)]+\)$/i;

    if (!safeColumnPattern.test(column) && !aggregatePattern.test(column)) {
      throw new Error(`Invalid ORDER BY column: ${column}. Must be a valid column identifier.`);
    }

    this.orderByClauses.push(`${column} ${normalizedDirection}`);
    return this;
  }

  /**
   * Build the final SQL query with parameters
   * @returns {{ sql: string, params: any[] }} The query and parameters
   */
  build() {
    let sql = '';

    // CTEs (WITH clauses)
    if (this.ctes.length > 0) {
      const cteStrings = this.ctes.map(cte => `${cte.name} AS (${cte.query})`);
      sql += `WITH ${cteStrings.join(',\n')}\n`;
    }

    // SELECT
    sql += `SELECT\n  ${this.selectClauses.join(',\n  ')}\n`;

    // FROM
    sql += `FROM ${this.fromClause}\n`;

    // JOINs
    for (const join of this.joins) {
      sql += `${join.type} JOIN ${join.table} ${join.alias} ON ${join.condition}\n`;
    }

    // WHERE
    if (this.whereClauses.length > 0) {
      sql += `WHERE ${this.whereClauses.join('\n  AND ')}\n`;
    }

    // GROUP BY
    if (this.groupByClauses.length > 0) {
      sql += `GROUP BY ${this.groupByClauses.join(', ')}\n`;
    }

    // ORDER BY
    if (this.orderByClauses.length > 0) {
      sql += `ORDER BY ${this.orderByClauses.join(', ')}\n`;
    }

    return { sql, params: this.params };
  }
}

/**
 * Factory for creating pre-configured query builders
 * These encapsulate common query patterns used across reports
 */
const QueryBuilderFactory = {
  /**
   * Create base query for property-related reports
   * @param {Object} options
   * @param {boolean} options.includeLandlordInfo - Include landlord attribution
   */
  createPropertyQuery(options = {}) {
    const qb = new ReportQueryBuilder();

    qb.from('properties', 'p');

    if (options.includeLandlordInfo) {
      qb.leftJoin('landlords', 'l', 'p.landlord_id = l.id');
      qb.select([
        'l.id as landlord_id',
        'l.name as landlord_name',
      ]);
    }

    return qb;
  },

  /**
   * Create query for room occupancy with current tenant data
   * Uses CTEs with ROW_NUMBER() to get latest tenant per room
   *
   * @param {Object} options
   * @param {boolean} options.includeNextTenant - Include future tenant data
   * @param {boolean} options.includeLandlordInfo - Include landlord attribution
   */
  createRoomOccupancyQuery(options = {}) {
    const today = new Date().toISOString().split('T')[0];

    const qb = new ReportQueryBuilder();

    // CTE for current tenant (most recent active tenant per bedroom that has started)
    qb.withCTE('current_tenant', `
      SELECT
        tm.id as member_id,
        tm.bedroom_id,
        tm.first_name,
        tm.surname,
        tm.rent_pppw,
        t.id as tenancy_id,
        t.start_date,
        t.end_date,
        t.status as tenancy_status,
        ROW_NUMBER() OVER (PARTITION BY tm.bedroom_id ORDER BY t.start_date DESC) as rn
      FROM tenancy_members tm
      INNER JOIN tenancies t ON tm.tenancy_id = t.id
      WHERE t.status = 'active' AND t.start_date <= ?
    `, [today]);

    if (options.includeNextTenant) {
      // CTE for next tenant (earliest future tenant per bedroom)
      qb.withCTE('next_tenant', `
        SELECT
          tm.id as next_member_id,
          tm.bedroom_id,
          tm.first_name as next_first_name,
          tm.surname as next_surname,
          tm.rent_pppw as next_rent_pppw,
          t.id as next_tenancy_id,
          t.start_date as next_start_date,
          t.end_date as next_end_date,
          ROW_NUMBER() OVER (PARTITION BY tm.bedroom_id ORDER BY t.start_date ASC) as rn
        FROM tenancy_members tm
        INNER JOIN tenancies t ON tm.tenancy_id = t.id
        WHERE t.status IN ('active', 'awaiting_signatures') AND t.start_date > ?
      `, [today]);
    }

    qb.from('bedrooms', 'b')
      .join('properties', 'p', 'b.property_id = p.id', 'INNER')
      .leftJoin('current_tenant', 'ct', 'b.id = ct.bedroom_id AND ct.rn = 1');

    if (options.includeNextTenant) {
      qb.leftJoin('next_tenant', 'nt', 'b.id = nt.bedroom_id AND nt.rn = 1');
    }

    if (options.includeLandlordInfo) {
      qb.leftJoin('landlords', 'l', 'p.landlord_id = l.id');
    }

    return qb;
  },

  /**
   * Create query for payment/financial reports
   * Includes payment sum subquery to avoid duplicate counting
   *
   * @param {Object} options
   * @param {boolean} options.includeLandlordInfo - Include landlord attribution
   */
  createPaymentQuery(options = {}) {
    const qb = new ReportQueryBuilder();

    // CTE for payment sums (to avoid duplicate counting with multiple payments)
    qb.withCTE('pay_sum', `
      SELECT payment_schedule_id, SUM(amount) as amount_paid
      FROM payments
      GROUP BY payment_schedule_id
    `);

    qb.from('payment_schedules', 'ps')
      .join('tenancy_members', 'tm', 'ps.tenancy_member_id = tm.id', 'INNER')
      .join('tenancies', 't', 'ps.tenancy_id = t.id', 'INNER')
      .join('properties', 'p', 't.property_id = p.id', 'INNER')
      .leftJoin('pay_sum', 'pay_sum', 'ps.id = pay_sum.payment_schedule_id')
      .leftJoin('bedrooms', 'b', 'tm.bedroom_id = b.id');

    if (options.includeLandlordInfo) {
      qb.leftJoin('landlords', 'l', 'p.landlord_id = l.id');
    }

    return qb;
  },

  /**
   * Create query for arrears reports
   * Extends payment query with user contact info
   *
   * @param {Object} options
   * @param {boolean} options.includeLandlordInfo - Include landlord attribution
   */
  createArrearsQuery(options = {}) {
    const qb = this.createPaymentQuery(options);

    // Add user info for contact details
    qb.join('users', 'u', 'tm.user_id = u.id', 'INNER');

    return qb;
  },

  /**
   * Create query for tenancy-based reports
   *
   * @param {Object} options
   * @param {boolean} options.includeLandlordInfo - Include landlord attribution
   */
  createTenancyQuery(options = {}) {
    const qb = new ReportQueryBuilder();

    qb.from('tenancies', 't')
      .join('properties', 'p', 't.property_id = p.id', 'INNER')
      .join('tenancy_members', 'tm', 't.id = tm.tenancy_id', 'INNER');

    if (options.includeLandlordInfo) {
      qb.leftJoin('landlords', 'l', 'p.landlord_id = l.id');
    }

    return qb;
  },
};

module.exports = {
  ReportQueryBuilder,
  QueryBuilderFactory,
};
