import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveAttachedTemplates } from '../../../src/generator/inlay/resolution';
import {
  _resetResolveCache,
  _setResolverForTest,
} from '../../../src/inlay/resolve-cache';
import type {
  ResolveResult,
  ResolvedTemplate,
  ResolveError,
} from '../../../src/inlay/resolve';
import type { Component } from '../../../src/types/wizard';

const URI_A = 'at://did:plc:fpruhuo22xkm5o7ttr2ktxdo/at.inlay.component/mov.danabra.NowPlaying';
const URI_B = 'at://did:plc:fpruhuo22xkm5o7ttr2ktxdo/at.inlay.component/mov.danabra.AviHandle';

function fakeTemplate(uri: string, unresolved: string[] = []): ResolvedTemplate {
  return {
    templateTree: { type: 'org.atsui.Stack', props: {} },
    view: undefined,
    imports: [],
    uri,
    unresolvedComponents: unresolved,
  };
}

function fakeError(): ResolveError {
  return { error: 'fetch failed', code: 'network' };
}

function component(id: string, ref?: string): Component {
  return {
    id,
    name: id,
    requirementIds: [],
    ...(ref !== undefined ? { inlayComponentRef: ref } : {}),
  };
}

describe('resolveAttachedTemplates()', () => {
  beforeEach(() => {
    _resetResolveCache();
  });

  it('returns an empty map when no components have inlayComponentRef', async () => {
    const resolver = vi.fn(async (uri: string) => fakeTemplate(uri) as ResolveResult);
    _setResolverForTest(resolver);

    const map = await resolveAttachedTemplates([
      component('c1'),
      component('c2'),
    ]);

    expect(map.size).toBe(0);
    expect(resolver).not.toHaveBeenCalled();
  });

  it('skips components whose inlayComponentRef is an empty string', async () => {
    const resolver = vi.fn(async (uri: string) => fakeTemplate(uri) as ResolveResult);
    _setResolverForTest(resolver);

    const map = await resolveAttachedTemplates([component('c1', '')]);

    expect(map.size).toBe(0);
    expect(resolver).not.toHaveBeenCalled();
  });

  it('resolves attached templates and keys the map by component id', async () => {
    const resolver = vi.fn(async (uri: string) => fakeTemplate(uri) as ResolveResult);
    _setResolverForTest(resolver);

    const map = await resolveAttachedTemplates([
      component('c1', URI_A),
      component('c2'),
      component('c3', URI_B),
    ]);

    expect(map.size).toBe(2);
    expect((map.get('c1') as ResolvedTemplate).uri).toBe(URI_A);
    expect((map.get('c3') as ResolvedTemplate).uri).toBe(URI_B);
    expect(map.has('c2')).toBe(false);
  });

  it('records ResolveError outcomes on the map without throwing', async () => {
    const resolver = vi.fn(async () => fakeError() as ResolveResult);
    _setResolverForTest(resolver);

    const map = await resolveAttachedTemplates([component('c1', URI_A)]);

    expect(map.size).toBe(1);
    expect(map.get('c1')).toEqual(fakeError());
  });

  it('records ResolvedTemplate outcomes that carry unresolvedComponents as-is', async () => {
    const resolver = vi.fn(
      async (uri: string) => fakeTemplate(uri, ['mov.danabra.ProfilePosts']) as ResolveResult
    );
    _setResolverForTest(resolver);

    const map = await resolveAttachedTemplates([component('c1', URI_A)]);

    const result = map.get('c1') as ResolvedTemplate;
    expect(result.uri).toBe(URI_A);
    expect(result.unresolvedComponents).toEqual(['mov.danabra.ProfilePosts']);
  });

  it('shares cached results across components that point at the same URI', async () => {
    const resolver = vi.fn(async (uri: string) => fakeTemplate(uri) as ResolveResult);
    _setResolverForTest(resolver);

    const map = await resolveAttachedTemplates([
      component('c1', URI_A),
      component('c2', URI_A),
    ]);

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(map.get('c1')).toBe(map.get('c2'));
  });
});
