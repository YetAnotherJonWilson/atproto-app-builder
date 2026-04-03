/**
 * Auth service generator
 */

export function generateAuthTs(): string {
  return `import {
  BrowserOAuthClient,
  OAuthSession,
} from '@atproto/oauth-client-browser';
import { atprotoLoopbackClientMetadata } from '@atproto/oauth-types';
import { Agent } from '@atproto/api';
import { getOAuthConfig } from '../config/environment';

// OAuth client and session state
let oauthClient: BrowserOAuthClient;
export let session: OAuthSession | null = null;

// User profile data interface
export interface UserProfile {
  displayName: string;
  handle: string;
  did: string;
}

// Session restoration result
export interface SessionRestoreResult {
  session: OAuthSession;
  state?: string;
}

/**
 * Initialize the OAuth client.
 * In development, uses loopback authentication (no server needed).
 * In production, loads client metadata from the configured URL.
 */
export async function initOAuthClient(): Promise<void> {
  const config = getOAuthConfig();

  if (config.isDev) {
    oauthClient = new BrowserOAuthClient({
      handleResolver: config.handleResolver,
      clientMetadata: atprotoLoopbackClientMetadata(config.clientId),
    });
  } else {
    oauthClient = await BrowserOAuthClient.load({
      clientId: config.clientId,
      handleResolver: config.handleResolver,
    });
  }
}

function isScopeRejection(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message ?? '';
  return msg.includes('invalid_client_metadata') && /unsupported.scope/i.test(msg);
}

/**
 * Sign in with AT Protocol handle.
 * Falls back to transition:generic scope if the PDS rejects granular scopes.
 */
export async function signIn(handle: string): Promise<void> {
  if (!handle) {
    throw new Error('Handle is required');
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
    const config = getOAuthConfig();
    let compatClient: BrowserOAuthClient;

    if (config.isDev) {
      compatClient = new BrowserOAuthClient({
        handleResolver: config.handleResolver,
        clientMetadata: atprotoLoopbackClientMetadata(config.compatClientId),
      });
    } else {
      compatClient = await BrowserOAuthClient.load({
        clientId: config.compatClientId,
        handleResolver: config.handleResolver,
      });
    }

    await compatClient.signIn(handle, signInOptions);
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  if (session) {
    await oauthClient.revoke(session.sub);
  }
  session = null;
}

/**
 * Restore session from browser storage
 */
export async function restoreSession(): Promise<SessionRestoreResult | null> {
  const result = await oauthClient.init();

  if (result) {
    session = result.session;
    return {
      session: result.session,
      state: result.state ?? undefined,
    };
  }

  return null;
}

/**
 * Get the current user's profile information.
 * Uses unauthenticated fetch since getProfile is a public endpoint.
 */
export async function getUserProfile(): Promise<UserProfile> {
  if (!session) {
    throw new Error('No active session');
  }

  const did = session.sub;

  try {
    // getProfile is public via the AppView — no auth needed
    const res = await fetch(
      \`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=\${encodeURIComponent(did)}\`,
    );
    if (!res.ok) throw new Error(\`\${res.status}\`);
    const data = await res.json() as { displayName?: string; handle: string };
    return {
      displayName: data.displayName ?? '',
      handle: data.handle,
      did,
    };
  } catch {
    // Fallback for loopback mode
    return {
      displayName: '',
      handle: did,
      did,
    };
  }
}

/**
 * Get the current session
 */
export function getSession(): OAuthSession | null {
  return session;
}
`;
}
