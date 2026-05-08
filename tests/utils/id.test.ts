import { describe, it, expect } from 'vitest';
import { generateId, makeSystemCreatedAtField } from '../../src/utils/id';

describe('generateId', () => {
  it('returns a string with the id- prefix', () => {
    const id = generateId();
    expect(id).toMatch(/^id-\d+-[a-z0-9]+$/);
  });

  it('produces a different id on each call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('makeSystemCreatedAtField', () => {
  it('returns the standard createdAt system field shape', () => {
    const field = makeSystemCreatedAtField();
    expect(field).toMatchObject({
      name: 'createdAt',
      type: 'string',
      format: 'datetime',
      required: true,
      isSystem: true,
    });
    expect(field.id).toMatch(/^id-/);
  });

  it('produces a fresh id per call', () => {
    expect(makeSystemCreatedAtField().id).not.toBe(
      makeSystemCreatedAtField().id
    );
  });
});
