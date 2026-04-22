import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveInlayTemplateCached,
  _resetResolveCache,
  _setResolverForTest,
} from '../../src/inlay/resolve-cache';
import type { ResolveResult, ResolvedTemplate, ResolveError } from '../../src/inlay/resolve';

const URI_A = 'at://did:plc:fpruhuo22xkm5o7ttr2ktxdo/at.inlay.component/mov.danabra.NowPlaying';
const URI_B = 'at://did:plc:fpruhuo22xkm5o7ttr2ktxdo/at.inlay.component/mov.danabra.AviHandle';

function fakeTemplate(uri: string): ResolvedTemplate {
  return {
    templateTree: { type: 'org.atsui.Stack', props: {} },
    view: undefined,
    imports: [],
    uri,
    unresolvedComponents: [],
  };
}

function fakeError(): ResolveError {
  return { error: 'boom', code: 'network' };
}

describe('resolveInlayTemplateCached()', () => {
  beforeEach(() => {
    _resetResolveCache();
  });

  it('returns the resolver result on first call (cache miss)', async () => {
    const resolver = vi.fn(async (uri: string) => fakeTemplate(uri));
    _setResolverForTest(resolver);

    const result = await resolveInlayTemplateCached(URI_A);
    expect(resolver).toHaveBeenCalledTimes(1);
    expect((result as ResolvedTemplate).uri).toBe(URI_A);
  });

  it('reuses cached results across repeat calls (cache hit)', async () => {
    const resolver = vi.fn(async (uri: string) => fakeTemplate(uri));
    _setResolverForTest(resolver);

    const first = await resolveInlayTemplateCached(URI_A);
    const second = await resolveInlayTemplateCached(URI_A);
    const third = await resolveInlayTemplateCached(URI_A);

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('caches different URIs independently', async () => {
    const resolver = vi.fn(async (uri: string) => fakeTemplate(uri));
    _setResolverForTest(resolver);

    const a = await resolveInlayTemplateCached(URI_A);
    const b = await resolveInlayTemplateCached(URI_B);

    expect(resolver).toHaveBeenCalledTimes(2);
    expect((a as ResolvedTemplate).uri).toBe(URI_A);
    expect((b as ResolvedTemplate).uri).toBe(URI_B);
  });

  it('caches ResolveError outcomes — broken URIs are not retried', async () => {
    const resolver = vi.fn(async () => fakeError() as ResolveResult);
    _setResolverForTest(resolver);

    const first = await resolveInlayTemplateCached(URI_A);
    const second = await resolveInlayTemplateCached(URI_A);

    expect(resolver).toHaveBeenCalledTimes(1);
    expect((first as ResolveError).code).toBe('network');
    expect(first).toBe(second);
  });

  it('shares in-flight promises between concurrent callers', async () => {
    let resolveFn: (r: ResolveResult) => void = () => {};
    const pending = new Promise<ResolveResult>((r) => { resolveFn = r; });
    const resolver = vi.fn(() => pending);
    _setResolverForTest(resolver);

    const p1 = resolveInlayTemplateCached(URI_A);
    const p2 = resolveInlayTemplateCached(URI_A);
    expect(p1).toBe(p2);
    expect(resolver).toHaveBeenCalledTimes(1);

    resolveFn(fakeTemplate(URI_A));
    await expect(p1).resolves.toMatchObject({ uri: URI_A });
  });

  it('_resetResolveCache() clears entries so the resolver is called again', async () => {
    const resolver = vi.fn(async (uri: string) => fakeTemplate(uri));
    _setResolverForTest(resolver);

    await resolveInlayTemplateCached(URI_A);
    expect(resolver).toHaveBeenCalledTimes(1);

    _resetResolveCache();
    // Reset restores the default resolver — re-inject the spy.
    _setResolverForTest(resolver);

    await resolveInlayTemplateCached(URI_A);
    expect(resolver).toHaveBeenCalledTimes(2);
  });
});
