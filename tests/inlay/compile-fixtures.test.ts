/**
 * Fixture-based compile tests — verify that real community template trees
 * produce the expected binding marker HTML structure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compileToHtml } from '../../src/generator/inlay/compile';
import {
  resolveInlayTemplate,
  isResolveError,
  type ResolvedTemplate,
} from '../../src/inlay/resolve';
import { _resetInlayDiscoveryCache } from '../../src/inlay/discovery';
import type { InlayElement } from '../../src/inlay/element';
import nowplayingFixture from '../fixtures/inlay/nowplaying.json';
import avihandleFixture from '../fixtures/inlay/avihandle.json';

// ── Helpers ───────────────────────────────────────────────────────────

function didFromUri(uri: string): string {
  return uri.replace('at://', '').split('/')[0];
}

function mockFetchForFixture(fixture: typeof nowplayingFixture) {
  const did = didFromUri(fixture.uri);
  return vi.fn(async (url: string) => {
    const urlStr = typeof url === 'string' ? url : String(url);
    if (urlStr.includes('plc.directory')) {
      return {
        ok: true,
        json: async () => ({
          service: [
            { id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example.com' },
          ],
        }),
      } as Response;
    }
    if (urlStr.includes('getRecord')) {
      return {
        ok: true,
        json: async () => ({ uri: fixture.uri, cid: fixture.cid, value: fixture.value }),
      } as Response;
    }
    return { ok: false, status: 404 } as Response;
  });
}

async function resolveFixture(fixture: typeof nowplayingFixture): Promise<InlayElement> {
  vi.stubGlobal('fetch', mockFetchForFixture(fixture));
  const result = await resolveInlayTemplate(fixture.uri);
  if (isResolveError(result)) throw new Error(result.error);
  return (result as ResolvedTemplate).templateTree as InlayElement;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('compile community fixtures', () => {
  beforeEach(() => {
    _resetInlayDiscoveryCache();
    vi.restoreAllMocks();
  });

  describe('NowPlaying', () => {
    it('compiles to Caption with inline binding markers', async () => {
      const tree = await resolveFixture(nowplayingFixture);
      const html = compileToHtml(tree);

      // Should be a Caption custom element
      expect(html).toContain('<org-atsui-caption');
      expect(html).toContain('role="note"');

      // Should contain two binding markers as child spans
      expect(html).toContain('<span data-inlay-bind="record.item.artists.0.artistName"></span>');
      expect(html).toContain('<span data-inlay-bind="record.item.trackName"></span>');

      // Should contain the literal text separator
      expect(html).toContain(' – ');
    });
  });

  describe('AviHandle', () => {
    it('compiles to Link with binding markers on props and children', async () => {
      const tree = await resolveFixture(avihandleFixture);
      const html = compileToHtml(tree);

      // Root should be a Link
      expect(html).toMatch(/^<org-atsui-link>/);

      // Link anchor should have a bind-href marker (uri is a Binding)
      expect(html).toContain('data-inlay-bind-href="props.uri"');

      // Avatar should have bind-src and bind-did markers
      expect(html).toContain('data-inlay-bind-src="record.avatar"');
      expect(html).toContain('data-inlay-bind-did="props.uri.$did"');

      // Avatar should have size attribute
      expect(html).toContain('size="small"');

      // Maybe should have both branches
      expect(html).toContain('data-inlay-branch="children"');
      expect(html).toContain('data-inlay-branch="fallback"');
      expect(html).toContain('style="display:none"');

      // Children branch should contain a Heading with displayName binding + " PhD"
      expect(html).toContain('<span data-inlay-bind="record.displayName"></span>');
      expect(html).toContain(' PhD');

      // Fallback branch should contain a Heading with $did binding
      expect(html).toContain('<span data-inlay-bind="props.uri.$did"></span>');
    });

    it('walker recurses into Avatar prop bindings (src, did)', async () => {
      const tree = await resolveFixture(avihandleFixture);
      const html = compileToHtml(tree);

      // The Avatar element should NOT have <span> wrappers for its prop bindings —
      // they should be attribute markers on the host element
      const avatarMatch = html.match(/<org-atsui-avatar[^>]*>/);
      expect(avatarMatch).toBeTruthy();
      expect(avatarMatch![0]).toContain('data-inlay-bind-src=');
      expect(avatarMatch![0]).toContain('data-inlay-bind-did=');
    });
  });

  describe('Maybe with binding in children branch', () => {
    it('emits both branches — children visible, fallback hidden', async () => {
      const tree = await resolveFixture(avihandleFixture);
      const html = compileToHtml(tree);

      // Find the maybe section
      const maybeStart = html.indexOf('<at-inlay-maybe>');
      const maybeEnd = html.indexOf('</at-inlay-maybe>') + '</at-inlay-maybe>'.length;
      expect(maybeStart).toBeGreaterThan(-1);
      const maybeHtml = html.slice(maybeStart, maybeEnd);

      // Children branch should be visible (no display:none)
      expect(maybeHtml).toMatch(/data-inlay-branch="children">[^]*?<\/div>/);
      expect(maybeHtml).not.toMatch(/data-inlay-branch="children"[^>]*style="display:none"/);

      // Fallback branch should be hidden
      expect(maybeHtml).toContain('data-inlay-branch="fallback" style="display:none"');
    });
  });
});
