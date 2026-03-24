/**
 * Lexicon publisher — publishes lexicon schemas via the Worker API.
 *
 * The Worker handles PDS authentication, schema record writes,
 * and DNS TXT record creation.
 */

import type { LexiconSchema } from '../../types/generation';

export interface PublishEntry {
  nsid: string;
  schema: LexiconSchema;
}

export interface PublishResultItem {
  nsid: string;
  uri: string;
}

export interface PublishFailureItem {
  nsid: string;
  error: string;
}

export interface PublishResult {
  published: PublishResultItem[];
  failed: PublishFailureItem[];
}

/**
 * Publish lexicon schemas to the AT Protocol PDS via the Worker API.
 * Returns which lexicons were published and which failed.
 */
export async function publishLexicons(
  entries: PublishEntry[],
): Promise<PublishResult> {
  if (entries.length === 0) {
    return { published: [], failed: [] };
  }

  const response = await fetch('/api/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lexicons: entries.map(e => ({
        nsid: e.nsid,
        schema: e.schema,
      })),
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = data && typeof data === 'object' && 'error' in data
      ? (data as { error: string }).error
      : `Publish failed: ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<PublishResult>;
}
