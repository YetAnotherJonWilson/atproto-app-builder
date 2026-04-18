import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveInlayTemplate,
  isResolveError,
  type ResolvedTemplate,
} from '../../src/inlay/resolve';
import { _resetInlayDiscoveryCache } from '../../src/inlay/discovery';
import nowplayingFixture from '../fixtures/inlay/nowplaying.json';
import avihandleFixture from '../fixtures/inlay/avihandle.json';

// ── Helpers ───────────────────────────────────────────────────────────

const NOWPLAYING_URI = nowplayingFixture.uri;
const AVIHANDLE_URI = avihandleFixture.uri;

function didFromUri(uri: string): string {
  return uri.replace('at://', '').split('/')[0];
}

/** Build a mock PLC directory response for a DID. */
function plcResponse(did: string, pds: string) {
  return {
    service: [
      { id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: pds },
    ],
  };
}

/** Build mock getRecord response wrapping a fixture's value. */
function getRecordResponse(fixture: typeof nowplayingFixture) {
  return { uri: fixture.uri, cid: fixture.cid, value: fixture.value };
}

function mockFetchForFixture(fixture: typeof nowplayingFixture, pds = 'https://pds.example.com') {
  const did = didFromUri(fixture.uri);
  return vi.fn(async (url: string) => {
    const urlStr = typeof url === 'string' ? url : String(url);
    // PLC directory
    if (urlStr.includes('plc.directory')) {
      return { ok: true, json: async () => plcResponse(did, pds) } as Response;
    }
    // getRecord
    if (urlStr.includes('getRecord')) {
      return { ok: true, json: async () => getRecordResponse(fixture) } as Response;
    }
    return { ok: false, status: 404 } as Response;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('resolveInlayTemplate()', () => {
  beforeEach(() => {
    _resetInlayDiscoveryCache();
    vi.restoreAllMocks();
  });

  describe('NowPlaying fixture', () => {
    it('resolves to a deserialized tree with bindings preserved', async () => {
      vi.stubGlobal('fetch', mockFetchForFixture(nowplayingFixture));

      const result = await resolveInlayTemplate(NOWPLAYING_URI);
      expect(isResolveError(result)).toBe(false);
      const resolved = result as ResolvedTemplate;

      expect(resolved.uri).toBe(NOWPLAYING_URI);
      expect(resolved.templateTree).toBeTruthy();
      expect(resolved.unresolvedComponents).toEqual([]);

      // The root should be a Caption element
      const root = resolved.templateTree as Record<string, unknown>;
      expect(root.type).toBe('org.atsui.Caption');

      // Children should contain Binding elements (deserialized — no "$" markers)
      const props = root.props as Record<string, unknown>;
      const children = props.children as unknown[];
      expect(children).toHaveLength(3);

      // First child is a Binding
      const firstBinding = children[0] as Record<string, unknown>;
      expect(firstBinding.type).toBe('at.inlay.Binding');
      const bindingProps = firstBinding.props as Record<string, unknown>;
      expect(bindingProps.path).toEqual(['record', 'item', 'artists', '0', 'artistName']);

      // Second child is text
      expect(children[1]).toBe(' – ');

      // Third child is a Binding
      const thirdBinding = children[2] as Record<string, unknown>;
      expect(thirdBinding.type).toBe('at.inlay.Binding');
    });

    it('extracts view and imports', async () => {
      vi.stubGlobal('fetch', mockFetchForFixture(nowplayingFixture));

      const result = await resolveInlayTemplate(NOWPLAYING_URI) as ResolvedTemplate;
      expect(result.view).toBeTruthy();
      expect(result.view!.$type).toBe('at.inlay.component#view');
      expect(result.imports).toHaveLength(3);
    });
  });

  describe('AviHandle fixture', () => {
    it('resolves to a deserialized tree with bindings in props', async () => {
      vi.stubGlobal('fetch', mockFetchForFixture(avihandleFixture));

      const result = await resolveInlayTemplate(AVIHANDLE_URI);
      expect(isResolveError(result)).toBe(false);
      const resolved = result as ResolvedTemplate;

      expect(resolved.uri).toBe(AVIHANDLE_URI);
      expect(resolved.unresolvedComponents).toEqual([]);

      // Root is a Link
      const root = resolved.templateTree as Record<string, unknown>;
      expect(root.type).toBe('org.atsui.Link');

      // Link's uri prop is a Binding element
      const rootProps = root.props as Record<string, unknown>;
      const uriBinding = rootProps.uri as Record<string, unknown>;
      expect(uriBinding.type).toBe('at.inlay.Binding');
      expect((uriBinding.props as Record<string, unknown>).path).toEqual(['props', 'uri']);
    });

    it('preserves the Maybe with children/fallback shape', async () => {
      vi.stubGlobal('fetch', mockFetchForFixture(avihandleFixture));

      const result = await resolveInlayTemplate(AVIHANDLE_URI) as ResolvedTemplate;
      const root = result.templateTree as Record<string, unknown>;
      const rootProps = root.props as Record<string, unknown>;
      const rootChildren = rootProps.children as unknown[];
      const row = rootChildren[0] as Record<string, unknown>;
      const rowProps = row.props as Record<string, unknown>;
      const rowChildren = rowProps.children as unknown[];
      const maybe = rowChildren[1] as Record<string, unknown>;

      expect(maybe.type).toBe('at.inlay.Maybe');
      const maybeProps = maybe.props as Record<string, unknown>;
      // children branch should be an array
      expect(Array.isArray(maybeProps.children)).toBe(true);
      // fallback branch should be an element
      const fallback = maybeProps.fallback as Record<string, unknown>;
      expect(fallback.type).toBe('org.atsui.Heading');
    });
  });

  describe('error cases', () => {
    it('returns network error for invalid AT-URI', async () => {
      const result = await resolveInlayTemplate('not-a-uri');
      expect(isResolveError(result)).toBe(true);
      if (isResolveError(result)) {
        expect(result.code).toBe('network');
      }
    });

    it('returns not-template when body type is wrong', async () => {
      const fixture = {
        ...nowplayingFixture,
        value: {
          ...nowplayingFixture.value,
          body: { $type: 'at.inlay.component#bodyOther' },
        },
      };
      vi.stubGlobal('fetch', mockFetchForFixture(fixture as typeof nowplayingFixture));

      const result = await resolveInlayTemplate(NOWPLAYING_URI);
      expect(isResolveError(result)).toBe(true);
      if (isResolveError(result)) {
        expect(result.code).toBe('not-template');
      }
    });

    it('returns external-body error for external components', async () => {
      const fixture = {
        ...nowplayingFixture,
        value: {
          ...nowplayingFixture.value,
          body: { $type: 'at.inlay.component#bodyExternal' },
        },
      };
      vi.stubGlobal('fetch', mockFetchForFixture(fixture as typeof nowplayingFixture));

      const result = await resolveInlayTemplate(NOWPLAYING_URI);
      expect(isResolveError(result)).toBe(true);
      if (isResolveError(result)) {
        expect(result.code).toBe('external-body');
      }
    });

    it('returns network error when fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => {
        throw new Error('Network failure');
      }));

      const result = await resolveInlayTemplate(NOWPLAYING_URI);
      expect(isResolveError(result)).toBe(true);
      if (isResolveError(result)) {
        expect(result.code).toBe('network');
        expect(result.error).toContain('Network failure');
      }
    });
  });

  describe('unresolved components', () => {
    it('reports unresolved nested component NSIDs', async () => {
      const fixture = {
        ...nowplayingFixture,
        value: {
          ...nowplayingFixture.value,
          body: {
            $type: 'at.inlay.component#bodyTemplate',
            node: {
              '$': '$',
              type: 'org.atsui.Stack',
              props: {
                children: [
                  {
                    '$': '$',
                    type: 'com.example.NestedWidget',
                    props: {},
                  },
                ],
              },
            },
          },
        },
      };
      vi.stubGlobal('fetch', mockFetchForFixture(fixture as typeof nowplayingFixture));

      const result = await resolveInlayTemplate(NOWPLAYING_URI) as ResolvedTemplate;
      expect(result.unresolvedComponents).toEqual(['com.example.NestedWidget']);
    });
  });
});
