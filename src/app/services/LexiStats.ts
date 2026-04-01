/**
 * LexiStats API client — fetches ATProto lexicons ranked by real network usage.
 * Data source: lexistats.linkedtrust.us
 */

const LEXISTATS_BASE = '/lexistats';

export interface LexiStatEntry {
  nsid: string;
  description?: string;
  category?: string;
  domain?: string;
  total_events_7d?: number;
  avg_eps_7d?: number;
  unique_users_7d?: number;
}

/**
 * Fetch lexicons ranked by usage from the LexiStats API.
 * Returns an empty array if the response shape is unexpected.
 */
export async function fetchPopularLexicons(): Promise<LexiStatEntry[]> {
  const response = await fetch(`${LEXISTATS_BASE}/api/v1/lexicons`);
  if (!response.ok) {
    throw new Error(`LexiStats API error: ${response.status}`);
  }
  const data = await response.json();
  return data.lexicons ?? [];
}
