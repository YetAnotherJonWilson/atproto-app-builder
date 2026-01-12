/**
 * Auth service generator
 */

export function generateAuthTs(): string {
  return `import {
  BrowserOAuthClient,
  OAuthSession,
} from '@atproto/oauth-client-browser';
import { Agent } from '@atproto/api';
import { atprotoLoopbackClientMetadata } from '@atproto/oauth-types';

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
 * Initialize the OAuth client
 */
export async function initOAuthClient(): Promise<void> {
  oauthClient = new BrowserOAuthClient({
    handleResolver: 'https://bsky.social',
    clientMetadata: atprotoLoopbackClientMetadata(
      \`http://localhost?\${new URLSearchParams([
        ['redirect_uri', \`http://127.0.0.1:8080\`],
        ['scope', \`atproto transition:generic\`],
      ])}\`
    ),
  });
}

/**
 * Sign in with AT Protocol handle
 */
export async function signIn(handle: string): Promise<void> {
  if (!handle) {
    throw new Error('Handle is required');
  }

  await oauthClient.signIn(handle, {
    state: JSON.stringify({ returnTo: window.location.href }),
    signal: new AbortController().signal,
  });
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
 * Get the current user's profile information
 */
export async function getUserProfile(): Promise<UserProfile> {
  if (!session) {
    throw new Error('No active session');
  }

  const agent = new Agent(session);

  try {
    const profile = await agent.app.bsky.actor.getProfile({
      actor: session.sub,
    });

    return {
      displayName: profile.data.displayName ?? '',
      handle: profile.data.handle,
      did: session.sub,
    };
  } catch (error) {
    // Fallback for loopback mode
    return {
      displayName: '',
      handle: session.sub,
      did: session.sub,
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
