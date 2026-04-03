import {
  BrowserOAuthClient,
  atprotoLoopbackClientMetadata,
} from '@atproto/oauth-client-browser';
import { Agent } from '@atproto/api';
import { getConfig } from '../../config/environment';

export interface UserProfile {
  displayName: string;
  handle: string;
  did: string;
}

// Capture OAuth callback params at module load time.
// The URL hash can be stripped by other code (e.g. Vite HMR, routers) before
// our async init runs, so we grab it synchronously at import time.
const _earlyCallbackParams = (() => {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (hash.has('state') && (hash.has('code') || hash.has('error'))) {
    return hash;
  }
  const query = new URLSearchParams(window.location.search);
  if (query.has('state') && (query.has('code') || query.has('error'))) {
    return query;
  }
  return null;
})();

let oauthClient: BrowserOAuthClient;
let session: ({ sub: string } & Record<string, any>) | null = null;

export async function initOAuthClient(): Promise<void> {
  const config = getConfig();

  if (config.isDev) {
    oauthClient = new BrowserOAuthClient({
      handleResolver: config.oauth.handleResolver,
      clientMetadata: atprotoLoopbackClientMetadata(config.oauth.clientId),
    });
  } else {
    oauthClient = await BrowserOAuthClient.load({
      clientId: config.oauth.clientId,
      handleResolver: config.oauth.handleResolver,
    });
  }
}

export function isOAuthCallback(): boolean {
  return _earlyCallbackParams !== null;
}

export async function restoreSession(): Promise<boolean> {
  let result;

  if (_earlyCallbackParams) {
    // Use the params captured at module load — by now the URL may be clean.
    result = await oauthClient.initCallback(_earlyCallbackParams);
  } else {
    // Normal path: restore existing session from IndexedDB.
    result = await oauthClient.init();
  }

  if (result) {
    session = result.session as any;
    return true;
  }
  return false;
}

function isScopeRejection(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message ?? '';
  return msg.includes('invalid_client_metadata') && /unsupported.scope/i.test(msg);
}

export async function signIn(handle: string): Promise<void> {
  if (!handle) {
    throw new Error('Please enter your handle');
  }

  const signInOptions = {
    state: JSON.stringify({ returnTo: window.location.href }),
    signal: new AbortController().signal,
  };

  try {
    await oauthClient.signIn(handle, signInOptions);
  } catch (err) {
    if (!isScopeRejection(err)) throw err;

    // Older PDS doesn't support granular scopes — retry with compat client
    const config = getConfig();
    let compatClient: BrowserOAuthClient;

    if (config.isDev) {
      compatClient = new BrowserOAuthClient({
        handleResolver: config.oauth.handleResolver,
        clientMetadata: atprotoLoopbackClientMetadata(config.oauth.compatClientId),
      });
    } else {
      compatClient = await BrowserOAuthClient.load({
        clientId: config.oauth.compatClientId,
        handleResolver: config.oauth.handleResolver,
      });
    }

    await compatClient.signIn(handle, signInOptions);
  }
}

export async function signOut(): Promise<void> {
  if (session) {
    await oauthClient.revoke(session.sub);
  }
  session = null;
}

export async function getUserProfile(): Promise<UserProfile> {
  if (!session) {
    throw new Error('No active session');
  }

  const did = session.sub;

  try {
    // getProfile is public via the AppView — no auth needed
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
    );
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json() as { displayName?: string; handle: string };
    return {
      displayName: data.displayName ?? '',
      handle: data.handle,
      did,
    };
  } catch {
    // Fallback for loopback/dev mode where profile API may not be available
    return {
      displayName: '',
      handle: did,
      did,
    };
  }
}

export function getSession() {
  return session;
}

/**
 * Get an authenticated Agent for making XRPC calls.
 * Returns null if no session is active.
 */
export function getAgent(): Agent | null {
  if (!session) return null;
  return new Agent(session as any);
}
