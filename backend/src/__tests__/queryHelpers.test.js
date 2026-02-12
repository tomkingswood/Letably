const { paginatedQuery } = require('../utils/queryHelpers');

// Mock db module
jest.mock('../db', () => ({
  query: jest.fn(),
}));

const db = require('../db');

describe('paginatedQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs data query and count query with correct params', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] }) // data query
      .mockResolvedValueOnce({ rows: [{ total: '5' }] }); // count query

    const result = await paginatedQuery({
      baseQuery: 'SELECT * FROM items',
      countQuery: 'SELECT COUNT(*) as total FROM items',
      orderBy: 'created_at DESC',
      baseWhere: 'agency_id = $1',
      baseParams: [42],
      limit: 2,
      offset: 0,
      agencyId: 42,
    });

    expect(result.rows).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.pagination).toEqual({
      total: 5,
      limit: 2,
      offset: 0,
      hasMore: true,
    });

    // Verify data query
    expect(db.query).toHaveBeenCalledTimes(2);
    const [dataQueryStr, dataParams] = db.query.mock.calls[0];
    expect(dataQueryStr).toContain('SELECT * FROM items');
    expect(dataQueryStr).toContain('WHERE agency_id = $1');
    expect(dataQueryStr).toContain('ORDER BY created_at DESC');
    expect(dataQueryStr).toContain('LIMIT $2 OFFSET $3');
    expect(dataParams).toEqual([42, 2, 0]);
  });

  it('adds dynamic filters correctly', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ total: '1' }] });

    await paginatedQuery({
      baseQuery: 'SELECT * FROM emails',
      countQuery: 'SELECT COUNT(*) as total FROM emails',
      orderBy: 'created_at DESC',
      baseWhere: 'agency_id = $1',
      baseParams: [10],
      filters: [
        { clause: 'status = $N', value: 'sent' },
      ],
      limit: 50,
      offset: 0,
      agencyId: 10,
    });

    const [dataQueryStr, dataParams] = db.query.mock.calls[0];
    expect(dataQueryStr).toContain('WHERE agency_id = $1 AND status = $2');
    expect(dataQueryStr).toContain('LIMIT $3 OFFSET $4');
    expect(dataParams).toEqual([10, 'sent', 50, 0]);

    // Count query should have same filters but no LIMIT/OFFSET
    const [countQueryStr, countParams] = db.query.mock.calls[1];
    expect(countQueryStr).toContain('WHERE agency_id = $1 AND status = $2');
    expect(countQueryStr).not.toContain('LIMIT');
    expect(countParams).toEqual([10, 'sent']);
  });

  it('works with no filters', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const result = await paginatedQuery({
      baseQuery: 'SELECT * FROM items',
      countQuery: 'SELECT COUNT(*) as total FROM items',
      orderBy: 'id ASC',
      baseWhere: 'agency_id = $1',
      baseParams: [1],
      agencyId: 1,
    });

    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.total).toBe(0);
  });

  it('calculates hasMore correctly when at end', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })
      .mockResolvedValueOnce({ rows: [{ total: '5' }] });

    const result = await paginatedQuery({
      baseQuery: 'SELECT * FROM items',
      countQuery: 'SELECT COUNT(*) as total FROM items',
      orderBy: 'id ASC',
      baseWhere: 'agency_id = $1',
      baseParams: [1],
      limit: 2,
      offset: 4,
      agencyId: 1,
    });

    // offset(4) + rows.length(1) = 5, total = 5, so hasMore = false
    expect(result.pagination.hasMore).toBe(false);
  });

  it('handles multiple filters', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    await paginatedQuery({
      baseQuery: 'SELECT * FROM jobs',
      countQuery: 'SELECT COUNT(*) as total FROM jobs',
      orderBy: 'created_at DESC',
      baseWhere: 'agency_id = $1',
      baseParams: [5],
      filters: [
        { clause: 'status = $N', value: 'completed' },
        { clause: 'entity_type = $N', value: 'tenancy' },
      ],
      limit: 10,
      offset: 0,
      agencyId: 5,
    });

    const [queryStr, params] = db.query.mock.calls[0];
    expect(queryStr).toContain('WHERE agency_id = $1 AND status = $2 AND entity_type = $3');
    expect(queryStr).toContain('LIMIT $4 OFFSET $5');
    expect(params).toEqual([5, 'completed', 'tenancy', 10, 0]);
  });

  it('defaults limit to 50 and offset to 0 for invalid values', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const result = await paginatedQuery({
      baseQuery: 'SELECT * FROM items',
      countQuery: 'SELECT COUNT(*) as total FROM items',
      orderBy: 'id ASC',
      baseWhere: 'agency_id = $1',
      baseParams: [1],
      limit: 'invalid',
      offset: 'bad',
      agencyId: 1,
    });

    expect(result.pagination.limit).toBe(50);
    expect(result.pagination.offset).toBe(0);
  });
});
