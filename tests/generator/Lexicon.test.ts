import { describe, it, expect } from 'vitest';
import { generateRecordLexicon, computeRecordTypeNsid } from '../../src/generator/Lexicon';
import type { RecordType, Field } from '../../src/types/wizard';

function makeField(overrides: Partial<Field> = {}): Field {
  return {
    id: 'f-1',
    name: 'testField',
    type: 'string',
    required: false,
    ...overrides,
  };
}

function makeRecordType(overrides: Partial<RecordType> = {}): RecordType {
  return {
    id: 'rt-1',
    name: 'testRecord',
    displayName: 'Test Record',
    description: 'A test record',
    fields: [],
    source: 'new',
    ...overrides,
  };
}

// ── computeRecordTypeNsid ─────────────────────────────────────────────

describe('computeRecordTypeNsid', () => {
  it('uses adopted NSID for adopted records', () => {
    const rt = makeRecordType({ source: 'adopted', adoptedNsid: 'app.bsky.feed.post' });
    expect(computeRecordTypeNsid(rt)).toBe('app.bsky.feed.post');
  });

  it('generates thelexfiles NSID', () => {
    const rt = makeRecordType({ name: 'groceryItem', namespaceOption: 'thelexfiles', lexUsername: 'alice' });
    expect(computeRecordTypeNsid(rt)).toBe('com.thelexfiles.alice.groceryItem');
  });

  it('generates thelexfiles-temp NSID', () => {
    const rt = makeRecordType({ name: 'groceryItem', namespaceOption: 'thelexfiles-temp', lexUsername: 'alice' });
    expect(computeRecordTypeNsid(rt)).toBe('com.thelexfiles.alice.temp.groceryItem');
  });

  it('generates byo-domain NSID', () => {
    const rt = makeRecordType({ name: 'groceryItem', namespaceOption: 'byo-domain', customDomain: 'example.com' });
    expect(computeRecordTypeNsid(rt)).toBe('com.example.groceryItem');
  });

  it('falls back to domain-based NSID', () => {
    const rt = makeRecordType({ name: 'groceryItem' });
    expect(computeRecordTypeNsid(rt, 'example.com')).toBe('com.example.groceryitem');
  });
});

// ── generateRecordLexicon ─────────────────────────────────────────────

describe('generateRecordLexicon', () => {
  it('generates a basic record with string field', () => {
    const rt = makeRecordType({
      fields: [makeField({ name: 'title', type: 'string', required: true })],
    });
    const lexicon = generateRecordLexicon(rt, 'example.com');
    const record = lexicon.defs.main.record!;

    expect(record.properties.title).toEqual({ type: 'string' });
    expect(record.required).toContain('title');
  });

  it('uses recordKeyType from the RecordType', () => {
    const rt = makeRecordType({ recordKeyType: 'any' });
    const lexicon = generateRecordLexicon(rt, 'example.com');
    expect(lexicon.defs.main.key).toBe('any');
  });

  it('defaults recordKeyType to tid', () => {
    const rt = makeRecordType();
    const lexicon = generateRecordLexicon(rt, 'example.com');
    expect(lexicon.defs.main.key).toBe('tid');
  });

  it('passes through adopted schema directly', () => {
    const adoptedSchema = {
      lexicon: 1,
      id: 'app.bsky.feed.post',
      defs: {
        main: {
          type: 'record',
          description: 'A Bluesky post',
          key: 'tid',
          record: {
            type: 'object',
            required: ['text', 'createdAt'],
            properties: { text: { type: 'string' } },
          },
        },
      },
    };
    const rt = makeRecordType({
      source: 'adopted',
      adoptedNsid: 'app.bsky.feed.post',
      adoptedSchema,
    });
    const result = generateRecordLexicon(rt, 'example.com');
    expect(result).toBe(adoptedSchema);
  });

  // Field type tests

  it('handles string with format and constraints', () => {
    const rt = makeRecordType({
      fields: [makeField({
        name: 'bio',
        type: 'string',
        format: 'uri',
        maxLength: 200,
        minLength: 1,
        maxGraphemes: 100,
        minGraphemes: 1,
      })],
    });
    const schema = generateRecordLexicon(rt, 'example.com');
    const prop = schema.defs.main.record!.properties.bio as Record<string, unknown>;
    expect(prop.type).toBe('string');
    expect(prop.format).toBe('uri');
    expect(prop.maxLength).toBe(200);
    expect(prop.minLength).toBe(1);
    expect(prop.maxGraphemes).toBe(100);
    expect(prop.minGraphemes).toBe(1);
  });

  it('handles integer with constraints', () => {
    const rt = makeRecordType({
      fields: [makeField({ name: 'count', type: 'integer', minimum: 0, maximum: 100 })],
    });
    const schema = generateRecordLexicon(rt, 'example.com');
    const prop = schema.defs.main.record!.properties.count as Record<string, unknown>;
    expect(prop.type).toBe('integer');
    expect(prop.minimum).toBe(0);
    expect(prop.maximum).toBe(100);
  });

  it('handles boolean', () => {
    const rt = makeRecordType({
      fields: [makeField({ name: 'active', type: 'boolean' })],
    });
    const schema = generateRecordLexicon(rt, 'example.com');
    const prop = schema.defs.main.record!.properties.active as Record<string, unknown>;
    expect(prop.type).toBe('boolean');
  });

  it('handles blob with accept and maxSize', () => {
    const rt = makeRecordType({
      fields: [makeField({
        name: 'avatar',
        type: 'blob',
        accept: ['image/*'],
        maxSize: 1048576,
      })],
    });
    const schema = generateRecordLexicon(rt, 'example.com');
    const prop = schema.defs.main.record!.properties.avatar as Record<string, unknown>;
    expect(prop.type).toBe('blob');
    expect(prop.accept).toEqual(['image/*']);
    expect(prop.maxSize).toBe(1048576);
  });

  it('handles bytes with constraints', () => {
    const rt = makeRecordType({
      fields: [makeField({ name: 'data', type: 'bytes', minLength: 1, maxLength: 1024 })],
    });
    const schema = generateRecordLexicon(rt, 'example.com');
    const prop = schema.defs.main.record!.properties.data as Record<string, unknown>;
    expect(prop.type).toBe('bytes');
    expect(prop.minLength).toBe(1);
    expect(prop.maxLength).toBe(1024);
  });

  it('handles cid-link', () => {
    const rt = makeRecordType({
      fields: [makeField({ name: 'hash', type: 'cid-link' })],
    });
    const schema = generateRecordLexicon(rt, 'example.com');
    const prop = schema.defs.main.record!.properties.hash as Record<string, unknown>;
    expect(prop.type).toBe('cid-link');
  });

  it('handles array-string with items constraints', () => {
    const rt = makeRecordType({
      fields: [makeField({ name: 'tags', type: 'array-string', minLength: 1, maxLength: 10 })],
    });
    const schema = generateRecordLexicon(rt, 'example.com');
    const prop = schema.defs.main.record!.properties.tags as Record<string, unknown>;
    expect(prop.type).toBe('array');
    expect(prop.items).toEqual({ type: 'string' });
    expect(prop.minItems).toBe(1);
    expect(prop.maxItems).toBe(10);
  });

  it('handles array-integer', () => {
    const rt = makeRecordType({
      fields: [makeField({ name: 'scores', type: 'array-integer' })],
    });
    const schema = generateRecordLexicon(rt, 'example.com');
    const prop = schema.defs.main.record!.properties.scores as Record<string, unknown>;
    expect(prop.type).toBe('array');
    expect(prop.items).toEqual({ type: 'integer' });
  });

  it('handles ref with external NSID', () => {
    const rt = makeRecordType({
      fields: [makeField({ name: 'post', type: 'ref', refTarget: 'app.bsky.feed.post' })],
    });
    const schema = generateRecordLexicon(rt, 'example.com');
    const prop = schema.defs.main.record!.properties.post as Record<string, unknown>;
    expect(prop.type).toBe('ref');
    expect(prop.ref).toBe('app.bsky.feed.post');
  });

  it('resolves internal ref target to NSID', () => {
    const targetRt = makeRecordType({
      id: 'rt-target',
      name: 'groceryList',
      namespaceOption: 'thelexfiles',
      lexUsername: 'alice',
    });
    const rt = makeRecordType({
      fields: [makeField({ name: 'list', type: 'ref', refTarget: 'rt-target' })],
    });
    const schema = generateRecordLexicon(rt, 'example.com', [rt, targetRt]);
    const prop = schema.defs.main.record!.properties.list as Record<string, unknown>;
    expect(prop.ref).toBe('com.thelexfiles.alice.groceryList');
  });

  it('includes description in field schema', () => {
    const rt = makeRecordType({
      fields: [makeField({ name: 'title', type: 'string', description: 'The item title' })],
    });
    const schema = generateRecordLexicon(rt, 'example.com');
    const prop = schema.defs.main.record!.properties.title as Record<string, unknown>;
    expect(prop.description).toBe('The item title');
  });

  it('handles legacy media-url type', () => {
    const rt = makeRecordType({
      fields: [makeField({ name: 'photo', type: 'media-url' })],
    });
    const schema = generateRecordLexicon(rt, 'example.com');
    const prop = schema.defs.main.record!.properties.photo as Record<string, unknown>;
    expect(prop.type).toBe('string');
    expect(prop.format).toBe('uri');
  });

  it('handles legacy array-number type', () => {
    const rt = makeRecordType({
      fields: [makeField({ name: 'scores', type: 'array-number' })],
    });
    const schema = generateRecordLexicon(rt, 'example.com');
    const prop = schema.defs.main.record!.properties.scores as Record<string, unknown>;
    expect(prop.type).toBe('array');
    expect(prop.items).toEqual({ type: 'integer' });
  });

  it('puts required fields in the required array', () => {
    const rt = makeRecordType({
      fields: [
        makeField({ name: 'title', required: true }),
        makeField({ id: 'f2', name: 'optional', required: false }),
        makeField({ id: 'f3', name: 'createdAt', type: 'string', format: 'datetime', required: true, isSystem: true }),
      ],
    });
    const schema = generateRecordLexicon(rt, 'example.com');
    expect(schema.defs.main.record!.required).toEqual(['title', 'createdAt']);
  });
});
