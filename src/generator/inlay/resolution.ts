/**
 * Generation-time resolution of attached Inlay template components.
 *
 * Walks the wizard's components, fetches each one's `inlayComponentRef`
 * via the session-scoped cache, and returns a map keyed by component id
 * holding the raw `ResolveResult`. Both successes and `ResolveError`
 * outcomes are kept on the map so downstream view generation can pick
 * the right branch (compiled HTML vs. failure placeholder) without
 * re-fetching.
 */

import type { Component } from '../../types/wizard';
import { resolveInlayTemplateCached } from '../../inlay/resolve-cache';
import type { ResolveResult } from '../../inlay/resolve';

export type InlayResolutionMap = Map<string, ResolveResult>;

export async function resolveAttachedTemplates(
  components: Component[]
): Promise<InlayResolutionMap> {
  const attached = components.filter(
    (c): c is Component & { inlayComponentRef: string } =>
      typeof c.inlayComponentRef === 'string' && c.inlayComponentRef.length > 0
  );

  const entries = await Promise.all(
    attached.map(
      async (c): Promise<[string, ResolveResult]> => [
        c.id,
        await resolveInlayTemplateCached(c.inlayComponentRef),
      ]
    )
  );

  return new Map(entries);
}
