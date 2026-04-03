/**
 * Environment config generator for generated apps.
 * Produces src/config/environment.ts with dev/prod OAuth switching.
 */

export function generateEnvironmentTs(scope: string): string {
  return `const DEV_REDIRECT_URI = 'http://127.0.0.1:8080';
const SCOPE = '${scope}';
const COMPAT_SCOPE = 'atproto transition:generic';
const HANDLE_RESOLVER = 'https://bsky.social';

export interface OAuthConfig {
  clientId: string;
  compatClientId: string;
  redirectUri: string;
  scope: string;
  handleResolver: string;
  isDev: boolean;
}

function buildLoopbackClientId(redirectUri: string, scope: string): string {
  const params = new URLSearchParams([
    ['redirect_uri', redirectUri],
    ['scope', scope],
  ]);
  return \`http://localhost?\${params}\`;
}

function buildDevConfig(): OAuthConfig {
  return {
    clientId: buildLoopbackClientId(DEV_REDIRECT_URI, SCOPE),
    compatClientId: buildLoopbackClientId(DEV_REDIRECT_URI, COMPAT_SCOPE),
    redirectUri: DEV_REDIRECT_URI,
    scope: SCOPE,
    handleResolver: HANDLE_RESOLVER,
    isDev: true,
  };
}

function buildProdConfig(): OAuthConfig {
  const origin = window.location.origin;
  return {
    clientId: import.meta.env.VITE_OAUTH_CLIENT_ID || \`\${origin}/client-metadata.json\`,
    compatClientId: \`\${origin}/client-metadata-compat.json\`,
    redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI || origin,
    scope: SCOPE,
    handleResolver: HANDLE_RESOLVER,
    isDev: false,
  };
}

let cached: OAuthConfig | null = null;

export function getOAuthConfig(): OAuthConfig {
  if (cached) return cached;
  cached = import.meta.env.MODE === 'production' ? buildProdConfig() : buildDevConfig();
  return cached;
}
`;
}
