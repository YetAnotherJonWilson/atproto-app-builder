/**
 * Cloudflare Worker entry point.
 *
 * Handles /api/publish for lexicon publishing (PDS writes + DNS creation).
 * All other requests fall through to the static app assets.
 */

import { APP_WIZARD_SCOPE, COMPAT_SCOPE } from '../src/shared/scopes';

interface Env {
  ASSETS: Fetcher;
  PDS_HANDLE: string;
  PDS_APP_PASSWORD: string;
  CF_ZONE_ID: string;
  CF_DNS_API_TOKEN: string;
}

interface LexiconEntry {
  nsid: string;
  schema: {
    lexicon: number;
    id: string;
    defs: Record<string, unknown>;
    [key: string]: unknown;
  };
}

interface PublishRequest {
  lexicons: LexiconEntry[];
}

interface PublishResult {
  nsid: string;
  uri: string;
}

interface PublishFailure {
  nsid: string;
  error: string;
}

const PDS_BASE = 'https://bsky.social/xrpc';
const TEMP_NSID_PATTERN = /^com\.thelexfiles\.[a-z0-9-]+\.temp\.[a-zA-Z][a-zA-Z0-9]*$/;
const PDS_DID = 'did:plc:deh4u7fsoeqtrbtkf5eptizr';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/client-metadata.json') {
      return handleClientMetadata(url, APP_WIZARD_SCOPE);
    }

    if (url.pathname === '/client-metadata-compat.json') {
      return handleClientMetadata(url, COMPAT_SCOPE);
    }

    if (url.pathname === '/api/publish' && request.method === 'POST') {
      return handlePublish(request, env);
    }

    // CORS preflight for the publish endpoint
    if (url.pathname === '/api/publish' && request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    // Proxy Lexicon Garden — no CORS headers from upstream, so we must proxy
    if (url.pathname.startsWith('/lexicon-garden/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders() });
      }
      return handleLexiconGardenProxy(request, url);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

function handleClientMetadata(url: URL, scope: string): Response {
  const origin = `${url.protocol}//${url.host}`;
  const metadata = {
    client_id: `${origin}${url.pathname}`,
    client_name: 'AT Protocol App Wizard',
    client_uri: origin,
    redirect_uris: [origin],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope,
    token_endpoint_auth_method: 'none',
    application_type: 'web',
    dpop_bound_access_tokens: true,
  };
  return new Response(JSON.stringify(metadata), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: corsHeaders(),
  });
}

// --- Main publish handler ---

async function handlePublish(request: Request, env: Env): Promise<Response> {
  // Validate content type
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    return jsonResponse({ error: 'Content-Type must be application/json' }, 400);
  }

  // Parse and validate request body
  let body: PublishRequest;
  try {
    body = await request.json() as PublishRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.lexicons || !Array.isArray(body.lexicons) || body.lexicons.length === 0) {
    return jsonResponse({ error: 'Request must contain a non-empty "lexicons" array' }, 400);
  }

  if (body.lexicons.length > 50) {
    return jsonResponse({ error: 'Maximum 50 lexicons per request' }, 400);
  }

  // Validate each lexicon entry
  for (const entry of body.lexicons) {
    const validationError = validateLexiconEntry(entry);
    if (validationError) {
      return jsonResponse({ error: validationError }, 400);
    }
  }

  // Authenticate with PDS
  let accessJwt: string;
  try {
    accessJwt = await authenticateWithPds(env);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: `PDS authentication failed: ${message}` }, 500);
  }

  // Publish each lexicon to PDS
  const published: PublishResult[] = [];
  const failed: PublishFailure[] = [];

  for (const entry of body.lexicons) {
    try {
      const uri = await writeSchemaRecord(accessJwt, entry);
      published.push({ nsid: entry.nsid, uri });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      failed.push({ nsid: entry.nsid, error: message });
    }
  }

  // Create DNS records for new usernames (best-effort — don't fail the response)
  const usernames = extractUniqueUsernames(body.lexicons.map(l => l.nsid));
  for (const username of usernames) {
    try {
      await ensureDnsRecord(env, username);
    } catch (err) {
      // Log but don't fail — the schema was published, DNS can be retried
      console.error(`DNS record creation failed for username "${username}":`, err);
    }
  }

  return jsonResponse({ published, failed });
}

// --- Validation ---

function validateLexiconEntry(entry: LexiconEntry): string | null {
  if (!entry.nsid || typeof entry.nsid !== 'string') {
    return 'Each lexicon must have an "nsid" string';
  }

  if (!TEMP_NSID_PATTERN.test(entry.nsid)) {
    return `NSID "${entry.nsid}" must match pattern com.thelexfiles.<username>.temp.<name>`;
  }

  if (!entry.schema || typeof entry.schema !== 'object') {
    return `Lexicon "${entry.nsid}" must have a "schema" object`;
  }

  if (entry.schema.lexicon !== 1) {
    return `Lexicon "${entry.nsid}" schema must have "lexicon": 1`;
  }

  if (entry.schema.id !== entry.nsid) {
    return `Lexicon "${entry.nsid}" schema "id" must match the nsid (got "${entry.schema.id}")`;
  }

  return null;
}

// --- PDS operations ---

async function authenticateWithPds(env: Env): Promise<string> {
  const response = await fetch(`${PDS_BASE}/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: env.PDS_HANDLE,
      password: env.PDS_APP_PASSWORD,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text}`);
  }

  const data = await response.json() as { accessJwt: string };
  return data.accessJwt;
}

async function writeSchemaRecord(accessJwt: string, entry: LexiconEntry): Promise<string> {
  const record = {
    $type: 'com.atproto.lexicon.schema',
    ...entry.schema,
  };

  const response = await fetch(`${PDS_BASE}/com.atproto.repo.putRecord`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessJwt}`,
    },
    body: JSON.stringify({
      repo: PDS_DID,
      collection: 'com.atproto.lexicon.schema',
      rkey: entry.nsid,
      record,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PDS write failed (${response.status}): ${text}`);
  }

  const data = await response.json() as { uri: string };
  return data.uri;
}

// --- DNS operations ---

function extractUniqueUsernames(nsids: string[]): string[] {
  const usernames = new Set<string>();
  for (const nsid of nsids) {
    // com.thelexfiles.<username>.temp.<name>
    const parts = nsid.split('.');
    if (parts.length === 5 && parts[0] === 'com' && parts[1] === 'thelexfiles' && parts[3] === 'temp') {
      usernames.add(parts[2]);
    }
  }
  return [...usernames];
}

// --- Lexicon Garden proxy ---

const LEXICON_GARDEN_BASE = 'https://lexicon.garden';

async function handleLexiconGardenProxy(request: Request, url: URL): Promise<Response> {
  const upstreamPath = url.pathname.replace(/^\/lexicon-garden/, '') + url.search;
  const upstreamUrl = `${LEXICON_GARDEN_BASE}${upstreamPath}`;

  let response: Response;
  try {
    response = await fetch(upstreamUrl, {
      method: request.method,
      headers: {
        'Accept': 'application/json',
      },
    });
  } catch {
    return Response.json(
      { error: 'Lexicon Garden is unreachable' },
      { status: 502, headers: corsHeaders() },
    );
  }

  // Forward the response with CORS headers
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function ensureDnsRecord(env: Env, username: string): Promise<void> {
  const recordName = `_lexicon.temp.${username}.thelexfiles.com`;
  const cfBase = 'https://api.cloudflare.com/client/v4';
  const headers = {
    Authorization: `Bearer ${env.CF_DNS_API_TOKEN}`,
    'Content-Type': 'application/json',
  };

  // Check if the TXT record already exists
  const listUrl = `${cfBase}/zones/${env.CF_ZONE_ID}/dns_records?type=TXT&name=${encodeURIComponent(recordName)}`;
  const listResponse = await fetch(listUrl, { headers });

  if (!listResponse.ok) {
    throw new Error(`DNS list failed (${listResponse.status}): ${await listResponse.text()}`);
  }

  const listData = await listResponse.json() as { result: unknown[] };
  if (listData.result && listData.result.length > 0) {
    // Record already exists
    return;
  }

  // Create the TXT record
  const createUrl = `${cfBase}/zones/${env.CF_ZONE_ID}/dns_records`;
  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: 'TXT',
      name: recordName,
      content: `did=${PDS_DID}`,
      ttl: 3600,
      comment: `Lexicon authority for ${username}.temp.thelexfiles.com`,
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`DNS create failed (${createResponse.status}): ${await createResponse.text()}`);
  }
}
