/**
 * API service generator
 */

import type { RecordType } from '../../types/wizard';
import { toPascalCase, toCamelCase, generateNSID } from '../../utils';
import { getTypeScriptType } from './Types';

export function generateApiTs(recordTypes: RecordType[], domain: string): string {
  let output = `import { OAuthSession } from '@atproto/oauth-client-browser';
import { Agent } from '@atproto/api';
import { session } from './Auth';
import {
  PaginationOptions,
  CreateRecordResponse,
`;

  recordTypes.forEach(record => {
    const pascalName = toPascalCase(record.name);
    output += `  ${pascalName}Data,\n`;
    output += `  ${pascalName}Response,\n`;
  });

  output += `} from './types';

// Helper: Validate session exists
function ensureSession(): OAuthSession {
  if (!session) {
    throw new Error('User not logged in. Please sign in first.');
  }
  return session;
}

// Helper: Create agent instance
function createAgent(): Agent {
  return new Agent(ensureSession());
}

`;

  // Generate CRUD functions for each record type
  recordTypes.forEach(record => {
    const pascalName = toPascalCase(record.name);
    const camelName = toCamelCase(record.name);
    const nsid = generateNSID(domain, record.name);

    // CREATE function
    output += `/**
 * Create a new ${record.name} record
 */
export async function create${pascalName}(data: Omit<${pascalName}Data, 'uri' | 'cid'>): Promise<CreateRecordResponse> {
  const record: Record<string, unknown> = {
    $type: '${nsid}',
    ...data,
  };

  const agent = createAgent();
  const response = await agent.com.atproto.repo.createRecord({
    repo: session!.sub,
    collection: '${nsid}',
    record: record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
    validationStatus: response.data.validationStatus,
  };
}

`;

    // UPDATE function
    output += `/**
 * Update an existing ${record.name} record
 */
export async function update${pascalName}(uri: string, data: Omit<${pascalName}Data, 'uri' | 'cid'>): Promise<CreateRecordResponse> {
  const uriParts = uri.split('/');
  const rkey = uriParts[uriParts.length - 1];

  const record: Record<string, unknown> = {
    $type: '${nsid}',
    ...data,
  };

  const agent = createAgent();
  const response = await agent.com.atproto.repo.putRecord({
    repo: session!.sub,
    collection: '${nsid}',
    rkey: rkey,
    record: record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
    validationStatus: response.data.validationStatus,
  };
}

`;

    // DELETE function
    output += `/**
 * Delete a ${record.name} record
 */
export async function delete${pascalName}(uri: string): Promise<void> {
  const uriParts = uri.split('/');
  const rkey = uriParts[uriParts.length - 1];

  const agent = createAgent();
  await agent.com.atproto.repo.deleteRecord({
    repo: session!.sub,
    collection: '${nsid}',
    rkey: rkey,
  });
}

`;

    // GET ALL function
    output += `/**
 * Retrieve all ${record.name} records
 */
export async function get${pascalName}s(options: PaginationOptions = {}): Promise<${pascalName}Response> {
  const { limit = 50, cursor = null, reverse = false } = options;

  if (limit < 1 || limit > 100) {
    throw new Error('limit must be between 1 and 100');
  }

  ensureSession();
  const agent = createAgent();

  const queryParams = {
    repo: session!.sub,
    collection: '${nsid}',
    limit: limit,
    reverse: reverse,
    ...(cursor && { cursor }),
  };

  const response = await agent.com.atproto.repo.listRecords(queryParams);

  return {
    ${camelName}s: response.data.records.map((record) => ({
      uri: record.uri,
      cid: record.cid,
`;

    record.fields.forEach(field => {
      const defaultValue = field.type.startsWith('array') ? '[]' : 'null';
      if (field.required) {
        output += `      ${field.name}: (record.value as Record<string, unknown>).${field.name} as ${getTypeScriptType(field)},\n`;
      } else {
        output += `      ${field.name}: ((record.value as Record<string, unknown>).${field.name} as ${getTypeScriptType(field)}) || ${defaultValue},\n`;
      }
    });

    output += `    })),
    cursor: response.data.cursor || null,
    total: response.data.records.length,
  };
}

`;
  });

  return output;
}
