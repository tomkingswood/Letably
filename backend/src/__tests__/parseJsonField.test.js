const { parseJsonField, parseJsonFields } = require('../utils/parseJsonField');

describe('parseJsonField', () => {
  it('parses a valid JSON string field in-place', () => {
    const obj = { data: '["a","b"]' };
    parseJsonField(obj, 'data');
    expect(obj.data).toEqual(['a', 'b']);
  });

  it('sets default value on invalid JSON', () => {
    const obj = { data: 'not-json' };
    parseJsonField(obj, 'data');
    expect(obj.data).toEqual([]);
  });

  it('uses custom default value on invalid JSON', () => {
    const obj = { data: '{broken' };
    parseJsonField(obj, 'data', null);
    expect(obj.data).toBeNull();
  });

  it('does nothing when field is falsy (null)', () => {
    const obj = { data: null };
    parseJsonField(obj, 'data');
    expect(obj.data).toBeNull();
  });

  it('does nothing when field is falsy (undefined)', () => {
    const obj = {};
    parseJsonField(obj, 'data');
    expect(obj.data).toBeUndefined();
  });

  it('does nothing when field is empty string', () => {
    const obj = { data: '' };
    parseJsonField(obj, 'data');
    expect(obj.data).toBe('');
  });

  it('parses nested JSON objects', () => {
    const obj = { data: '{"key":"value"}' };
    parseJsonField(obj, 'data');
    expect(obj.data).toEqual({ key: 'value' });
  });
});

describe('parseJsonFields', () => {
  it('parses the field on every object in the array', () => {
    const items = [
      { address_history: '["addr1"]' },
      { address_history: '["addr2","addr3"]' },
    ];
    parseJsonFields(items, 'address_history');
    expect(items[0].address_history).toEqual(['addr1']);
    expect(items[1].address_history).toEqual(['addr2', 'addr3']);
  });

  it('handles mixed valid/invalid/missing fields', () => {
    const items = [
      { address_history: '["valid"]' },
      { address_history: 'broken' },
      { address_history: null },
    ];
    parseJsonFields(items, 'address_history');
    expect(items[0].address_history).toEqual(['valid']);
    expect(items[1].address_history).toEqual([]);
    expect(items[2].address_history).toBeNull();
  });

  it('works with empty array', () => {
    const items = [];
    parseJsonFields(items, 'data');
    expect(items).toEqual([]);
  });
});
