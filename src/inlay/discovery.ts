/**
 * Inlay component discovery.
 *
 * Fetches `at.inlay.component` records from a hardcoded list of known
 * Inlay authors and parses them into a structured shape the rest of
 * the wizard can consume. External-body components are filtered out
 * (out of scope for the template-components initiative).
 *
 * Flow per author:
 *   1. Resolve DID → PDS via plc.directory.
 *   2. Call com.atproto.repo.listRecords on that PDS for
 *      collection=at.inlay.component, paginating if needed.
 *   3. Parse each record into an InlayComponentEntry.
 */

export interface InlayAuthor {
  handle: string;
  did: string;
}

export type InlayBodyType = 'template' | 'external' | 'primitive' | 'unknown';

export interface InlayComponentEntry {
  /** Fully-formed AT-URI of the component record. */
  uri: string;
  /** The NSID this component implements (derived from rkey). */
  nsid: string;
  author: InlayAuthor;
  description?: string;
  bodyType: InlayBodyType;
  /** Record-view collections this component accepts (from view.accepts viewRecord entries). */
  acceptsCollections: string[];
  /** Primitive-view types this component accepts (from view.accepts viewPrimitive entries). */
  acceptsPrimitives: string[];
  /** Prop name that receives the view data. */
  viewProp?: string;
  /** Raw record value, preserved for later consumers. */
  raw: Record<string, unknown>;
}

export interface InlayDiscoveryFailure {
  author: InlayAuthor;
  error: string;
}

export interface InlayDiscoveryResult {
  components: InlayComponentEntry[];
  failures: InlayDiscoveryFailure[];
}

export const KNOWN_INLAY_AUTHORS: readonly InlayAuthor[] = [
  { handle: 'danabra.mov', did: 'did:plc:fpruhuo22xkm5o7ttr2ktxdo' },
  { handle: 'dansshadow.bsky.social', did: 'did:plc:rm4mmytequowusm6smpw53ez' },
] as const;

const INLAY_COMPONENT_COLLECTION = 'at.inlay.component';
const PLC_DIRECTORY_BASE = 'https://plc.directory';
const PDS_SERVICE_ID = '#atproto_pds';
const PDS_SERVICE_TYPE = 'AtprotoPersonalDataServer';
const LIST_RECORDS_PAGE_SIZE = 100;
const MAX_PAGES = 20;

const pdsCache = new Map<string, string>();
let discoveryCache: InlayDiscoveryResult | null = null;

export function _resetInlayDiscoveryCache(): void {
  pdsCache.clear();
  discoveryCache = null;
}

/**
 * Resolve a DID to its PDS endpoint via plc.directory.
 * Caches results for the session.
 */
export async function resolveDidToPds(did: string): Promise<string> {
  const cached = pdsCache.get(did);
  if (cached) return cached;

  const res = await fetch(`${PLC_DIRECTORY_BASE}/${encodeURIComponent(did)}`);
  if (!res.ok) {
    throw new Error(`PLC directory returned ${res.status} for ${did}`);
  }
  const doc = (await res.json()) as {
    service?: Array<{ id?: string; type?: string; serviceEndpoint?: string }>;
  };
  const svc = doc.service?.find(
    (s) => s.id === PDS_SERVICE_ID && s.type === PDS_SERVICE_TYPE,
  );
  if (!svc?.serviceEndpoint) {
    throw new Error(`PLC document for ${did} has no ${PDS_SERVICE_ID} service`);
  }
  const endpoint = svc.serviceEndpoint.replace(/\/$/, '');
  pdsCache.set(did, endpoint);
  return endpoint;
}

interface PdsListRecord {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
}

interface PdsListRecordsResponse {
  records: PdsListRecord[];
  cursor?: string;
}

async function listAllInlayComponentRecords(
  pds: string,
  did: string,
): Promise<PdsListRecord[]> {
  const all: PdsListRecord[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${pds}/xrpc/com.atproto.repo.listRecords`);
    url.searchParams.set('repo', did);
    url.searchParams.set('collection', INLAY_COMPONENT_COLLECTION);
    url.searchParams.set('limit', String(LIST_RECORDS_PAGE_SIZE));
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`listRecords on ${pds} returned ${res.status}`);
    }
    const body = (await res.json()) as PdsListRecordsResponse;
    all.push(...(body.records ?? []));
    if (!body.cursor || !body.records?.length) break;
    cursor = body.cursor;
  }
  return all;
}

/**
 * Parse one listRecords entry into an InlayComponentEntry.
 * Returns null if the record is too malformed to describe.
 */
export function parseInlayComponentRecord(
  record: PdsListRecord,
  author: InlayAuthor,
): InlayComponentEntry | null {
  if (!record.uri || !isPlainObject(record.value)) return null;
  const value = record.value;

  const rkey = extractRkey(record.uri);
  if (!rkey) return null;

  const bodyType = readBodyType(value.body);
  const view = isPlainObject(value.view) ? value.view : undefined;
  const viewProp = typeof view?.prop === 'string' ? view.prop : undefined;
  const accepts = Array.isArray(view?.accepts) ? view.accepts : [];

  const acceptsCollections: string[] = [];
  const acceptsPrimitives: string[] = [];
  for (const entry of accepts) {
    if (!isPlainObject(entry)) continue;
    const entryType = entry.$type;
    if (entryType === 'at.inlay.component#viewRecord') {
      if (typeof entry.collection === 'string') {
        acceptsCollections.push(entry.collection);
      }
    } else if (entryType === 'at.inlay.component#viewPrimitive') {
      if (typeof entry.type === 'string') {
        acceptsPrimitives.push(entry.type);
      }
    }
  }

  return {
    uri: record.uri,
    nsid: rkey,
    author,
    description: typeof value.description === 'string' ? value.description : undefined,
    bodyType,
    acceptsCollections,
    acceptsPrimitives,
    viewProp,
    raw: value,
  };
}

function extractRkey(atUri: string): string | null {
  const prefix = 'at://';
  if (!atUri.startsWith(prefix)) return null;
  const parts = atUri.slice(prefix.length).split('/');
  if (parts.length < 3) return null;
  return parts.slice(2).join('/');
}

function readBodyType(body: unknown): InlayBodyType {
  if (body === undefined || body === null) return 'primitive';
  if (!isPlainObject(body)) return 'unknown';
  const bodyTypeTag = body.$type;
  if (bodyTypeTag === 'at.inlay.component#bodyTemplate') return 'template';
  if (bodyTypeTag === 'at.inlay.component#bodyExternal') return 'external';
  return 'unknown';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Discover inlay components from all known authors.
 * Caches the first completed result for the session; call
 * `_resetInlayDiscoveryCache()` to force a refresh.
 * External-body components are filtered out.
 */
export async function discoverInlayComponents(): Promise<InlayDiscoveryResult> {
  if (discoveryCache) return discoveryCache;

  const components: InlayComponentEntry[] = [];
  const failures: InlayDiscoveryFailure[] = [];

  await Promise.all(
    KNOWN_INLAY_AUTHORS.map(async (author) => {
      try {
        const pds = await resolveDidToPds(author.did);
        const records = await listAllInlayComponentRecords(pds, author.did);
        for (const rec of records) {
          const parsed = parseInlayComponentRecord(rec, author);
          if (parsed && parsed.bodyType !== 'external') {
            components.push(parsed);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ author, error: message });
        console.warn(`[inlay-discovery] ${author.handle} failed: ${message}`);
      }
    }),
  );

  const result: InlayDiscoveryResult = { components, failures };
  discoveryCache = result;
  return result;
}
