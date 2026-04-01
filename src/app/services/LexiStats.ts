/**
 * LexiStats API client — fetches ATProto lexicons ranked by real network usage.
 * Data source: lexistats.linkedtrust.us
 *
 * Uses /api/v1/lexicon-meta for richer metadata (schema_type, tags, has_schema).
 * Called directly (not proxied) — LexiStats serves access-control-allow-origin: *.
 */

const LEXISTATS_API = 'https://lexistats.linkedtrust.us/api/v1/lexicon-meta';

export interface LexiStatEntry {
  nsid: string;
  authority?: string;
  domain?: string;
  description?: string;
  category?: string;
  tags?: string[];
  schema_type?: string | null;
  lexicon_url?: string;
  total_events?: number;
  unique_users_7d?: number;
  first_seen?: string;
  last_seen?: string;
  has_schema?: boolean;
  has_example?: boolean;
  spidered?: boolean;
}

/** Cached catalog — fetched once per session, stored at module level. */
let catalogCache: LexiStatEntry[] | null = null;

/**
 * Fetch the full lexicon catalog from LexiStats.
 * Caches in memory after first successful fetch.
 */
export async function fetchLexiconCatalog(): Promise<LexiStatEntry[]> {
  if (catalogCache) return catalogCache;

  const response = await fetch(LEXISTATS_API);
  if (!response.ok) {
    throw new Error(`LexiStats API error: ${response.status}`);
  }
  const data = await response.json();
  catalogCache = data.lexicons ?? [];
  return catalogCache!;
}

/**
 * Get the cached catalog without fetching. Returns null if not yet loaded.
 */
export function getCachedCatalog(): LexiStatEntry[] | null {
  return catalogCache;
}

/**
 * Filter the catalog to record-type lexicons only.
 */
export function filterRecords(lexicons: LexiStatEntry[]): LexiStatEntry[] {
  return lexicons.filter((l) => l.schema_type === 'record');
}

/**
 * Search the catalog by matching query against nsid, description, and tags.
 * Returns matching entries sorted by unique_users_7d descending.
 */
export function searchCatalog(
  lexicons: LexiStatEntry[],
  query: string,
): LexiStatEntry[] {
  const q = query.toLowerCase();
  return lexicons
    .filter((l) => {
      if (l.nsid.toLowerCase().includes(q)) return true;
      if (l.description?.toLowerCase().includes(q)) return true;
      if (l.tags?.some((t) => t.toLowerCase().includes(q))) return true;
      return false;
    })
    .sort((a, b) => (b.unique_users_7d ?? 0) - (a.unique_users_7d ?? 0));
}

/**
 * Look up a single entry by NSID from the cached catalog.
 */
export function findByNsid(
  lexicons: LexiStatEntry[],
  nsid: string,
): LexiStatEntry | undefined {
  return lexicons.find((l) => l.nsid.toLowerCase() === nsid.toLowerCase());
}

/** Reset cache — for testing. */
export function _resetCache(): void {
  catalogCache = null;
}
