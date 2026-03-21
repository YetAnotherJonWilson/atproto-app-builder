/**
 * Lexicon generator
 */

import type { RecordType, Field } from '../types/wizard';
import type { LexiconSchema } from '../types/generation';

/**
 * Compute the NSID for a RecordType using its namespace settings.
 * Falls back to domain-based generation for backward compatibility.
 */
export function computeRecordTypeNsid(rt: RecordType, fallbackDomain?: string): string {
  // Adopted lexicons use their adopted NSID directly
  if (rt.source === 'adopted' && rt.adoptedNsid) {
    return rt.adoptedNsid;
  }

  const name = rt.name;

  if (rt.namespaceOption === 'byo-domain' && rt.customDomain) {
    const reversed = rt.customDomain.split('.').reverse().join('.');
    return `${reversed}.${name}`;
  }

  if (rt.namespaceOption === 'thelexfiles-temp' && rt.lexUsername) {
    return `com.thelexfiles.${rt.lexUsername}.temp.${name}`;
  }

  if (rt.namespaceOption === 'thelexfiles' && rt.lexUsername) {
    return `com.thelexfiles.${rt.lexUsername}.${name}`;
  }

  // Fallback: use domain-based NSID (backward compat)
  if (fallbackDomain) {
    const parts = fallbackDomain.split('.').reverse();
    return [...parts, name.toLowerCase().replace(/[^a-z0-9]/g, '')].join('.');
  }

  return name;
}

export function generateRecordLexicon(
  recordType: RecordType,
  domain: string,
  allRecordTypes?: RecordType[],
): LexiconSchema {
  // For adopted lexicons with a stored schema, pass it through directly
  if (recordType.source === 'adopted' && recordType.adoptedSchema) {
    return recordType.adoptedSchema;
  }

  const nsid = computeRecordTypeNsid(recordType, domain);

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  recordType.fields.forEach(field => {
    properties[field.name] = fieldToSchema(field, allRecordTypes);
    if (field.required) {
      required.push(field.name);
    }
  });

  return {
    lexicon: 1,
    id: nsid,
    defs: {
      main: {
        type: "record",
        description: recordType.description || `${recordType.name} record`,
        key: recordType.recordKeyType ?? "tid",
        record: {
          type: "object",
          required: required,
          properties: properties
        }
      }
    }
  };
}

/** Convert a Field to its lexicon schema representation */
function fieldToSchema(field: Field, allRecordTypes?: RecordType[]): Record<string, unknown> {
  const desc = field.description ? { description: field.description } : {};

  switch (field.type) {
    case 'string': {
      const schema: Record<string, unknown> = { type: 'string', ...desc };
      if (field.format) schema.format = field.format;
      if (field.maxLength != null) schema.maxLength = field.maxLength;
      if (field.minLength != null) schema.minLength = field.minLength;
      if (field.maxGraphemes != null) schema.maxGraphemes = field.maxGraphemes;
      if (field.minGraphemes != null) schema.minGraphemes = field.minGraphemes;
      return schema;
    }

    case 'integer': {
      const schema: Record<string, unknown> = { type: 'integer', ...desc };
      if (field.minimum != null) schema.minimum = field.minimum;
      if (field.maximum != null) schema.maximum = field.maximum;
      return schema;
    }

    case 'boolean':
      return { type: 'boolean', ...desc };

    case 'blob': {
      const schema: Record<string, unknown> = { type: 'blob', ...desc };
      if (field.accept?.length) schema.accept = field.accept;
      if (field.maxSize != null) schema.maxSize = field.maxSize;
      return schema;
    }

    case 'bytes': {
      const schema: Record<string, unknown> = { type: 'bytes', ...desc };
      if (field.minLength != null) schema.minLength = field.minLength;
      if (field.maxLength != null) schema.maxLength = field.maxLength;
      return schema;
    }

    case 'cid-link':
      return { type: 'cid-link', ...desc };

    case 'array-string': {
      const schema: Record<string, unknown> = { type: 'array', items: { type: 'string' }, ...desc };
      if (field.minLength != null) schema.minItems = field.minLength;
      if (field.maxLength != null) schema.maxItems = field.maxLength;
      return schema;
    }

    case 'array-integer': {
      const schema: Record<string, unknown> = { type: 'array', items: { type: 'integer' }, ...desc };
      if (field.minLength != null) schema.minItems = field.minLength;
      if (field.maxLength != null) schema.maxItems = field.maxLength;
      return schema;
    }

    case 'ref': {
      let ref = field.refTarget ?? '';
      // Resolve internal RecordType IDs to NSIDs
      if (allRecordTypes && ref && !ref.includes('.')) {
        const target = allRecordTypes.find(r => r.id === ref);
        if (target) {
          ref = computeRecordTypeNsid(target);
        }
      }
      return { type: 'ref', ref, ...desc };
    }

    default:
      // Legacy types: media-url → string+uri, array-number → array+integer
      if (field.type === 'media-url') {
        return { type: 'string', format: 'uri', ...desc };
      }
      if (field.type === 'array-number') {
        return { type: 'array', items: { type: 'integer' }, ...desc };
      }
      return { type: field.type, ...desc };
  }
}
