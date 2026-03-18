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
    oauthClient = new BrowserOAuthClient({
      handleResolver: config.oauth.handleResolver,
      clientMetadata: undefined as any, // prod uses client_id URL auto-discovery
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

export async function signIn(handle: string): Promise<void> {
  if (!handle) {
    throw new Error('Please enter your handle');
  }
  await oauthClient.signIn(handle, {
    state: JSON.stringify({ returnTo: window.location.href }),
    signal: new AbortController().signal,
  });
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

  const agent = new Agent(session as any);

  try {
    const profile = await agent.app.bsky.actor.getProfile({
      actor: session.sub,
    });
    return {
      displayName: profile.data.displayName ?? '',
      handle: profile.data.handle,
      did: session.sub,
    };
  } catch {
    // Fallback for loopback/dev mode where profile API may not be available
    return {
      displayName: '',
      handle: session.sub,
      did: session.sub,
    };
  }
}

export function getSession() {
  return session;
}
