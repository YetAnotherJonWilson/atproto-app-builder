/**
 * Identity resolution service generator.
 *
 * Emits `src/atproto/identity.ts` into generated apps. The emitted file
 * exports `resolveDidToAvatar(did)` — an in-memory-cached wrapper around
 * the public Bluesky `getProfile` endpoint. Generated bind functions
 * call it to turn raw DIDs on `<img>` elements into avatar URLs.
 *
 * The source of truth is `identity-runtime.ts`, embedded here via Vite's
 * `?raw` import so there is exactly one copy of the runtime code.
 */

import runtimeSource from './identity-runtime.ts?raw';

export function generateIdentityTs(): string {
  return runtimeSource;
}
