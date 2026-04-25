// @vitest-environment jsdom
/**
 * Tests for src/generator/inlay/data-binding.ts.
 *
 * Two flavors of assertion per fixture:
 *   1. Emitted code shape — function name, getter / store accessors,
 *      conditional resolveDidToAvatar wiring.
 *   2. End-to-end runtime — strip TS types via esbuild, evaluate the
 *      function with mocked Api / Store / identity, verify the DOM
 *      mutations match what the spec describes.
 */

import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { deserializeTree } from '@inlay/core';
import { compileBindFunction } from '../../../src/generator/inlay/data-binding';
import type { ResolvedTemplate } from '../../../src/inlay/resolve';
import type { InlayElement } from '../../../src/inlay/element';
import type { RecordType } from '../../../src/types/wizard';
import nowplayingFixture from '../../fixtures/inlay/nowplaying.json';
import avihandleFixture from '../../fixtures/inlay/avihandle.json';

// ── Fixtures → ResolvedTemplate helpers ───────────────────────────────

type Fixture = typeof nowplayingFixture;

function toResolved(fixture: Fixture): ResolvedTemplate {
  return {
    templateTree: deserializeTree(fixture.value.body.node) as InlayElement,
    view: fixture.value.view as Record<string, unknown>,
    imports: fixture.value.imports as string[],
    uri: fixture.uri,
    unresolvedComponents: [],
  };
}

const STATUS_RT: RecordType = {
  id: 'status',
  name: 'status',
  displayName: 'Status',
  description: '',
  fields: [],
  source: 'new',
};

const PROFILE_RT: RecordType = {
  id: 'profile',
  name: 'profile',
  displayName: 'Profile',
  description: '',
  fields: [],
  source: 'new',
};

// ── Bind harness — execute emitted TS in jsdom ────────────────────────

interface HarnessOptions {
  records: unknown[];
  avatarLookup?: Record<string, string | null>;
}

interface Harness {
  bindFn: (container: HTMLElement) => Promise<void>;
  store: Record<string, unknown[]>;
  setterCalls: number;
  apiCalls: number;
  avatarCalls: string[];
}

function makeHarness(
  tsCode: string,
  meta: { bindFunctionName: string; apiGetterName: string; storeListKey: string; storeSetterName: string },
  opts: HarnessOptions
): Harness {
  // Strip TypeScript types so the snippet is plain JS — the emitted
  // function deliberately has no `export` so it can run inside Function.
  const jsCode = ts.transpileModule(tsCode, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const store: Record<string, unknown[]> = { [meta.storeListKey]: [] };
  let setterCalls = 0;
  let apiCalls = 0;
  const avatarCalls: string[] = [];

  const storeManager: Record<string, (items: unknown[]) => void> = {
    [meta.storeSetterName]: (items: unknown[]) => {
      store[meta.storeListKey] = items;
      setterCalls += 1;
    },
  };

  const apiGetter = async () => {
    apiCalls += 1;
    return { [meta.storeListKey]: opts.records };
  };

  const resolveDidToAvatar = async (did: string): Promise<string | null> => {
    avatarCalls.push(did);
    if (!opts.avatarLookup) return null;
    return Object.prototype.hasOwnProperty.call(opts.avatarLookup, did)
      ? opts.avatarLookup[did]
      : null;
  };

  const factory = new Function(
    'Store',
    'storeManager',
    meta.apiGetterName,
    'resolveDidToAvatar',
    'console',
    `${jsCode}\nreturn ${meta.bindFunctionName};`
  );

  const bindFn = factory(store, storeManager, apiGetter, resolveDidToAvatar, console) as (
    container: HTMLElement
  ) => Promise<void>;

  return {
    bindFn,
    store,
    get setterCalls() { return setterCalls; },
    get apiCalls() { return apiCalls; },
    avatarCalls,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('compileBindFunction()', () => {
  describe('emitted code shape', () => {
    it('names the function bindComponent<i> and references the chosen record type', () => {
      const compiled = compileBindFunction(toResolved(nowplayingFixture), STATUS_RT, 0);
      expect(compiled.bindFunctionName).toBe('bindComponent0');
      expect(compiled.apiGetterName).toBe('getStatuss');
      expect(compiled.storeListKey).toBe('statuss');
      expect(compiled.storeSetterName).toBe('setStatuss');
      expect(compiled.code).toContain('async function bindComponent0(container: HTMLElement)');
      expect(compiled.code).toContain('await getStatuss()');
      expect(compiled.code).toContain('storeManager.setStatuss(resp.statuss)');
      expect(compiled.code).toContain('Store.statuss');
    });

    it('uses the provided component index in the function name', () => {
      const compiled = compileBindFunction(toResolved(nowplayingFixture), STATUS_RT, 7);
      expect(compiled.bindFunctionName).toBe('bindComponent7');
      expect(compiled.code).toContain('async function bindComponent7(');
    });

    it('omits resolveDidToAvatar when the template has no DID-bound avatar', () => {
      const compiled = compileBindFunction(toResolved(nowplayingFixture), STATUS_RT, 0);
      expect(compiled.needsIdentityImport).toBe(false);
      expect(compiled.code).not.toContain('resolveDidToAvatar');
      expect(compiled.code).not.toContain('didHosts');
    });

    it('includes resolveDidToAvatar wiring when the template binds a DID to an avatar', () => {
      const compiled = compileBindFunction(toResolved(avihandleFixture), PROFILE_RT, 0);
      expect(compiled.needsIdentityImport).toBe(true);
      expect(compiled.code).toContain('resolveDidToAvatar(did)');
      expect(compiled.code).toContain('didHosts');
      expect(compiled.code).toContain("data-inlay-bind-did");
    });

    it('exposes the compiled HTML (so callers can drop it into the DOM)', () => {
      const compiled = compileBindFunction(toResolved(nowplayingFixture), STATUS_RT, 0);
      expect(compiled.html).toContain('<org-atsui-caption');
      expect(compiled.html).toContain('data-inlay-bind="record.item.trackName"');
    });
  });

  describe('runtime — NowPlaying', () => {
    it('fills both child binding markers from the first record', async () => {
      const compiled = compileBindFunction(toResolved(nowplayingFixture), STATUS_RT, 0);
      const harness = makeHarness(compiled.code, compiled, {
        records: [
          {
            uri: 'at://did:plc:abc/fm.teal.alpha.actor.status/self',
            item: { artists: [{ artistName: 'Boards of Canada' }], trackName: 'Roygbiv' },
          },
        ],
      });

      const container = document.createElement('div');
      container.innerHTML = compiled.html;

      await harness.bindFn(container);

      const spans = container.querySelectorAll('[data-inlay-bind]');
      expect(spans).toHaveLength(2);
      expect(spans[0].textContent).toBe('Boards of Canada');
      expect(spans[1].textContent).toBe('Roygbiv');
      expect(harness.apiCalls).toBe(1);
      expect(harness.setterCalls).toBe(1);
      expect(harness.avatarCalls).toEqual([]);
    });

    it('skips the API call when the store already has records', async () => {
      const compiled = compileBindFunction(toResolved(nowplayingFixture), STATUS_RT, 0);
      const harness = makeHarness(compiled.code, compiled, { records: [] });
      // Pre-fill the store before invoking
      harness.store.statuss = [
        {
          uri: 'at://did:plc:abc/fm.teal.alpha.actor.status/self',
          item: { artists: [{ artistName: 'Aphex Twin' }], trackName: 'Xtal' },
        },
      ];

      const container = document.createElement('div');
      container.innerHTML = compiled.html;
      await harness.bindFn(container);

      expect(harness.apiCalls).toBe(0);
      const spans = container.querySelectorAll('[data-inlay-bind]');
      expect(spans[0].textContent).toBe('Aphex Twin');
      expect(spans[1].textContent).toBe('Xtal');
    });

    it('leaves bindings empty and triggers no Maybe (none present) when no records exist', async () => {
      const compiled = compileBindFunction(toResolved(nowplayingFixture), STATUS_RT, 0);
      const harness = makeHarness(compiled.code, compiled, { records: [] });

      const container = document.createElement('div');
      container.innerHTML = compiled.html;
      await harness.bindFn(container);

      const spans = container.querySelectorAll('[data-inlay-bind]');
      spans.forEach((s) => expect(s.textContent).toBe(''));
    });
  });

  describe('runtime — AviHandle', () => {
    const profileUri = 'at://did:plc:abc/app.bsky.actor.profile/self';

    it('fills displayName + avatar src from the first record and skips Maybe fallback', async () => {
      const compiled = compileBindFunction(toResolved(avihandleFixture), PROFILE_RT, 0);
      const harness = makeHarness(compiled.code, compiled, {
        records: [
          {
            uri: profileUri,
            displayName: 'Dana',
            avatar: 'https://cdn.example/dana.jpg',
          },
        ],
      });

      const container = document.createElement('div');
      container.innerHTML = compiled.html;
      await harness.bindFn(container);

      // displayName binding inside the children branch resolves
      const displayNameSpan = container.querySelector('[data-inlay-bind="record.displayName"]');
      expect(displayNameSpan?.textContent).toBe('Dana');

      // The Maybe's children branch stays visible; fallback hidden.
      const maybe = container.querySelector('at-inlay-maybe')!;
      const childrenBranch = maybe.querySelector<HTMLElement>('[data-inlay-branch="children"]')!;
      const fallbackBranch = maybe.querySelector<HTMLElement>('[data-inlay-branch="fallback"]')!;
      expect(childrenBranch.style.display).not.toBe('none');
      expect(fallbackBranch.style.display).toBe('none');

      // record.avatar populates src on the inner <img>; no resolver call needed.
      const img = container.querySelector('org-atsui-avatar img') as HTMLImageElement;
      expect(img.getAttribute('src')).toBe('https://cdn.example/dana.jpg');
      expect(harness.avatarCalls).toEqual([]);
    });

    it('flips the Maybe to fallback when the children branch has a missing binding', async () => {
      const compiled = compileBindFunction(toResolved(avihandleFixture), PROFILE_RT, 0);
      const harness = makeHarness(compiled.code, compiled, {
        records: [
          {
            uri: profileUri,
            // No displayName — children branch should hide.
            avatar: 'https://cdn.example/x.jpg',
          },
        ],
      });

      const container = document.createElement('div');
      container.innerHTML = compiled.html;
      await harness.bindFn(container);

      const maybe = container.querySelector('at-inlay-maybe')!;
      const childrenBranch = maybe.querySelector<HTMLElement>('[data-inlay-branch="children"]')!;
      const fallbackBranch = maybe.querySelector<HTMLElement>('[data-inlay-branch="fallback"]')!;
      expect(childrenBranch.style.display).toBe('none');
      expect(fallbackBranch.style.display).toBe('');
    });

    it('treats props.* paths as missing (no component nesting in this spec)', async () => {
      const compiled = compileBindFunction(toResolved(avihandleFixture), PROFILE_RT, 0);
      const harness = makeHarness(compiled.code, compiled, {
        records: [
          {
            uri: profileUri,
            displayName: 'Dana',
            avatar: 'https://cdn.example/dana.jpg',
          },
        ],
      });

      const container = document.createElement('div');
      container.innerHTML = compiled.html;
      await harness.bindFn(container);

      // The <a> has data-inlay-bind-href="props.uri" — should NOT be set.
      const anchor = container.querySelector('a[data-inlay-bind-href]')!;
      expect(anchor.getAttribute('href')).toBeNull();
    });

    it('falls back to the avatar resolver when bind-src is missing but bind-did resolves', async () => {
      // Build a synthetic resolved template: Avatar with src=missing + did=$did
      // To avoid hand-rolling, reuse AviHandle but null out record.avatar so
      // the bind-src on the avatar resolves to missing.
      const compiled = compileBindFunction(toResolved(avihandleFixture), PROFILE_RT, 0);

      // Patch: replace data-inlay-bind-did="props.uri.$did" with one that uses
      // record.uri.$did so the test exercises the resolver path (props.* is
      // explicitly missing-by-design).
      const patchedHtml = compiled.html.replace(
        'data-inlay-bind-did="props.uri.$did"',
        'data-inlay-bind-did="record.uri.$did"'
      );

      const harness = makeHarness(compiled.code, compiled, {
        records: [
          {
            uri: profileUri,
            displayName: 'Dana',
            // no avatar field
          },
        ],
        avatarLookup: { 'did:plc:abc': 'https://cdn.example/avatar.jpg' },
      });

      const container = document.createElement('div');
      container.innerHTML = patchedHtml;
      await harness.bindFn(container);

      expect(harness.avatarCalls).toEqual(['did:plc:abc']);
      const img = container.querySelector('org-atsui-avatar img') as HTMLImageElement;
      expect(img.getAttribute('src')).toBe('https://cdn.example/avatar.jpg');
    });

    it('marks the avatar host as missing when the resolver returns null', async () => {
      const compiled = compileBindFunction(toResolved(avihandleFixture), PROFILE_RT, 0);
      const patchedHtml = compiled.html.replace(
        'data-inlay-bind-did="props.uri.$did"',
        'data-inlay-bind-did="record.uri.$did"'
      );

      const harness = makeHarness(compiled.code, compiled, {
        records: [
          {
            uri: profileUri,
            // no displayName, no avatar
          },
        ],
        avatarLookup: { 'did:plc:abc': null },
      });

      const container = document.createElement('div');
      container.innerHTML = patchedHtml;
      await harness.bindFn(container);

      // Avatar should be missing; combined with missing displayName, the
      // children branch of the Maybe stays hidden too.
      const img = container.querySelector('org-atsui-avatar img') as HTMLImageElement;
      expect(img.getAttribute('src')).toBeNull();
      expect(harness.avatarCalls).toEqual(['did:plc:abc']);
    });
  });
});
