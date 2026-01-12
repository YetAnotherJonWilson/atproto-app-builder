/**
 * Types service generator
 */

import type { RecordType, Field } from '../../types/wizard';
import { toPascalCase, toCamelCase } from '../../utils';

export function generateTypesTs(recordTypes: RecordType[], domain: string): string {
  let output = `/**
 * Shared type definitions for the app
 */

`;

  // Generate interface for each record type
  recordTypes.forEach(record => {
    const interfaceName = toPascalCase(record.name) + 'Data';

    output += `export interface ${interfaceName} {\n`;
    output += `  uri: string;\n`;
    output += `  cid: string;\n`;

    record.fields.forEach(field => {
      const tsType = getTypeScriptType(field);
      const optional = field.required ? '' : '?';
      output += `  ${field.name}${optional}: ${tsType};\n`;
    });

    output += `}\n\n`;
  });

  // Generate pagination and response types
  output += `export interface PaginationOptions {
  limit?: number;
  cursor?: string | null;
  reverse?: boolean;
}

export interface CreateRecordResponse {
  uri: string;
  cid: string;
  validationStatus?: string;
}

`;

  // Generate response types for each record
  recordTypes.forEach(record => {
    const pascalName = toPascalCase(record.name);
    output += `export interface ${pascalName}Response {
  ${toCamelCase(record.name)}s: ${pascalName}Data[];
  cursor: string | null;
  total: number;
}

`;
  });

  // Generate store type
  output += `export interface StoreType {\n`;
  recordTypes.forEach(record => {
    const pascalName = toPascalCase(record.name);
    output += `  ${toCamelCase(record.name)}s: ${pascalName}Data[];\n`;
  });
  output += `}\n`;

  return output;
}

export function getTypeScriptType(field: Field): string {
  switch (field.type) {
    case 'string':
      return 'string';
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array-string':
      return 'string[]';
    case 'array-number':
      return 'number[]';
    case 'media-url':
      return 'string';
    case 'bytes':
      return 'Uint8Array';
    case 'cid-link':
      return 'string';
    case 'blob':
      return 'Blob';
    default:
      return 'unknown';
  }
}
