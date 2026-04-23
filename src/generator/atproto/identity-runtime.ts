/**
 * Resolves a DID to its profile avatar URL via the public Bluesky
 * AppView (`app.bsky.actor.getProfile`).
 *
 * Results — including `null` — are cached in memory for the lifetime of
 * the page, so each DID triggers at most one `getProfile` request per
 * session. Concurrent calls for the same DID share a single in-flight
 * request. All failure modes (network error, non-OK status, malformed
 * response, missing `avatar`) resolve to `null` and are logged, never
 * thrown.
 *
 * Emitted verbatim into generated apps as `src/atproto/identity.ts`.
 */

const avatarCache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

export async function resolveDidToAvatar(did: string): Promise<string | null> {
  if (avatarCache.has(did)) {
    return avatarCache.get(did) ?? null;
  }

  const pending = inflight.get(did);
  if (pending) return pending;

  const request = fetchAvatar(did);
  inflight.set(did, request);
  try {
    const result = await request;
    avatarCache.set(did, result);
    return result;
  } finally {
    inflight.delete(did);
  }
}

async function fetchAvatar(did: string): Promise<string | null> {
  const url = `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`resolveDidToAvatar: ${did} returned ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { avatar?: unknown };
    return typeof data.avatar === 'string' ? data.avatar : null;
  } catch (err) {
    console.warn(`resolveDidToAvatar: failed for ${did}`, err);
    return null;
  }
}
