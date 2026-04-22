/**
 * Session-scoped cache for `resolveInlayTemplate`.
 *
 * Both ComponentsPanel (to render "Template no longer available"
 * badges) and `generator/index.ts` (to build bind functions) resolve
 * the same template URIs. This module memoizes both success and error
 * outcomes for the lifetime of the session so a URI is fetched at most
 * once — and once known broken, is never retried.
 */

import { resolveInlayTemplate, type ResolveResult } from './resolve';

type Resolver = (uri: string) => Promise<ResolveResult>;

const cache = new Map<string, Promise<ResolveResult>>();
let resolver: Resolver = resolveInlayTemplate;

/**
 * Resolve an Inlay component URI, returning a cached result when one
 * exists. In-flight requests are also shared — concurrent callers for
 * the same URI receive the same promise. Both success and error
 * outcomes are cached, so a broken URI is never re-fetched within a
 * session.
 */
export function resolveInlayTemplateCached(uri: string): Promise<ResolveResult> {
  const existing = cache.get(uri);
  if (existing) return existing;
  const pending = resolver(uri);
  cache.set(uri, pending);
  return pending;
}

/** Test-only: wipe the cache and restore the default resolver. */
export function _resetResolveCache(): void {
  cache.clear();
  resolver = resolveInlayTemplate;
}

/** Test-only: inject a fake resolver. */
export function _setResolverForTest(fn: Resolver): void {
  resolver = fn;
}
