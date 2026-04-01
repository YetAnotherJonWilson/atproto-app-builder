import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchLexiconCatalog,
  getCachedCatalog,
  filterRecords,
  searchCatalog,
  findByNsid,
  _resetCache,
} from '../../src/app/services/LexiStats';
import type { LexiStatEntry } from '../../src/app/services/LexiStats';

const mockCatalog: LexiStatEntry[] = [
  {
    nsid: 'app.bsky.feed.post',
    description: 'Record containing a Bluesky post.',
    category: 'social',
    tags: ['feed', 'content', 'bluesky', 'record'],
    schema_type: 'record',
    total_events: 1359580,
    unique_users_7d: 10000,
    has_schema: true,
  },
  {
    nsid: 'app.bsky.feed.like',
    description: 'Record declaring a like of a piece of subject content.',
    category: 'social',
    tags: ['feed', 'content', 'bluesky', 'record'],
    schema_type: 'record',
    total_events: 7302452,
    unique_users_7d: 10000,
    has_schema: true,
  },
  {
    nsid: 'com.example.unknown',
    description: 'An unknown lexicon.',
    category: 'other',
    tags: [],
    schema_type: null,
    total_events: 50,
    unique_users_7d: 3,
    has_schema: false,
  },
  {
    nsid: 'xyz.gaming.score',
    description: 'A gaming score record.',
    category: 'gaming',
    tags: ['gaming', 'score'],
    schema_type: 'record',
    total_events: 200,
    unique_users_7d: 15,
    has_schema: true,
  },
];

describe('LexiStats service', () => {
  beforeEach(() => {
    _resetCache();
    vi.restoreAllMocks();
  });

  describe('fetchLexiconCatalog', () => {
    it('fetches and caches the catalog', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ lexicons: mockCatalog }), { status: 200 }),
      );

      const result = await fetchLexiconCatalog();
      expect(result).toHaveLength(4);
      expect(result[0].nsid).toBe('app.bsky.feed.post');

      // Second call should return cached data without fetching
      const cached = await fetchLexiconCatalog();
      expect(cached).toBe(result);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('throws on API error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Server Error', { status: 500 }),
      );

      await expect(fetchLexiconCatalog()).rejects.toThrow('LexiStats API error: 500');
    });

    it('returns empty array for missing lexicons key', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 }),
      );

      const result = await fetchLexiconCatalog();
      expect(result).toEqual([]);
    });
  });

  describe('getCachedCatalog', () => {
    it('returns null when not yet loaded', () => {
      expect(getCachedCatalog()).toBeNull();
    });

    it('returns catalog after fetch', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ lexicons: mockCatalog }), { status: 200 }),
      );

      await fetchLexiconCatalog();
      expect(getCachedCatalog()).toHaveLength(4);
    });
  });

  describe('filterRecords', () => {
    it('filters to schema_type === "record" only', () => {
      const records = filterRecords(mockCatalog);
      expect(records).toHaveLength(3);
      expect(records.every((r) => r.schema_type === 'record')).toBe(true);
    });

    it('returns empty array when no records', () => {
      const result = filterRecords([{ nsid: 'x.y.z', schema_type: null }]);
      expect(result).toEqual([]);
    });
  });

  describe('searchCatalog', () => {
    it('matches by NSID', () => {
      const results = searchCatalog(mockCatalog, 'bsky.feed');
      expect(results.map((r) => r.nsid)).toContain('app.bsky.feed.post');
      expect(results.map((r) => r.nsid)).toContain('app.bsky.feed.like');
    });

    it('matches by description', () => {
      const results = searchCatalog(mockCatalog, 'gaming score');
      expect(results.map((r) => r.nsid)).toContain('xyz.gaming.score');
    });

    it('matches by tags', () => {
      const results = searchCatalog(mockCatalog, 'bluesky');
      expect(results).toHaveLength(2);
    });

    it('is case-insensitive', () => {
      const results = searchCatalog(mockCatalog, 'BSKY');
      expect(results.length).toBeGreaterThan(0);
    });

    it('sorts by unique_users_7d descending', () => {
      const results = searchCatalog(mockCatalog, 'record');
      // 'record' matches tags on bsky items (10000 users) and description on gaming (15 users)
      const users = results.map((r) => r.unique_users_7d ?? 0);
      for (let i = 1; i < users.length; i++) {
        expect(users[i]).toBeLessThanOrEqual(users[i - 1]);
      }
    });

    it('returns empty array for no matches', () => {
      const results = searchCatalog(mockCatalog, 'zzzznonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('findByNsid', () => {
    it('finds an entry by exact NSID', () => {
      const entry = findByNsid(mockCatalog, 'app.bsky.feed.post');
      expect(entry?.nsid).toBe('app.bsky.feed.post');
    });

    it('is case-insensitive', () => {
      const entry = findByNsid(mockCatalog, 'APP.BSKY.FEED.POST');
      expect(entry?.nsid).toBe('app.bsky.feed.post');
    });

    it('returns undefined for unknown NSID', () => {
      const entry = findByNsid(mockCatalog, 'does.not.exist');
      expect(entry).toBeUndefined();
    });
  });
});
