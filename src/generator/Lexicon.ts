/**
 * Lexicon generator
 */

import type { RecordType } from '../types/wizard';
import type { LexiconSchema } from '../types/generation';
import { generateNSID } from '../utils';

export function generateRecordLexicon(recordType: RecordType, domain: string): LexiconSchema {
  const nsid = generateNSID(domain, recordType.name);

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  recordType.fields.forEach(field => {
    let fieldSchema: Record<string, unknown>;

    if (field.type === 'array-string') {
      fieldSchema = {
        type: 'array',
        items: { type: 'string' },
        ...(field.description && { description: field.description })
      };
    } else if (field.type === 'array-number') {
      fieldSchema = {
        type: 'array',
        items: { type: 'integer' },
        ...(field.description && { description: field.description })
      };
    } else if (field.type === 'media-url') {
      fieldSchema = {
        type: 'string',
        format: 'uri',
        ...(field.description && { description: field.description + ` (${field.mediaType || 'media'} URL)` })
      };
    } else {
      fieldSchema = {
        type: field.type,
        ...(field.format && { format: field.format }),
        ...(field.maxLength && { maxLength: field.maxLength }),
        ...(field.description && { description: field.description })
      };
    }

    properties[field.name] = fieldSchema;

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
        key: "tid",
        record: {
          type: "object",
          required: required,
          properties: properties
        }
      }
    }
  };
}
