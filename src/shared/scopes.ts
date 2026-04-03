/**
 * AT Protocol OAuth scope constants.
 *
 * Single source of truth for both the app wizard and the Cloudflare Worker.
 * The generator has its own scope-building logic since generated apps
 * derive scopes from their configured record types.
 */

/** Granular scope for the app wizard — identity + project collection CRUD only. */
export const APP_WIZARD_SCOPE = 'atproto repo:com.thelexfiles.appwizard.project';

/** Broad compat scope for older PDSes that don't support granular scopes. */
export const COMPAT_SCOPE = 'atproto transition:generic';

/**
 * Build a scope string from a list of record type NSIDs.
 * Returns `'atproto'` (identity only) if no NSIDs are provided.
 */
export function buildScopeFromNsids(nsids: string[]): string {
  if (nsids.length === 0) return 'atproto';
  const repoScopes = nsids.map(nsid => `repo:${nsid}`);
  return `atproto ${repoScopes.join(' ')}`;
}
