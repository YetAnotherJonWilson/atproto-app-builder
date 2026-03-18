const DEV_REDIRECT_URI = 'http://127.0.0.1:8080';
const DEV_SCOPE = 'atproto transition:generic';
const HANDLE_RESOLVER = 'https://bsky.social';
const APP_NAME = 'AT Protocol App Wizard';

export type Environment = 'development' | 'production';

export interface OAuthConfig {
  redirectUri: string;
  clientId: string;
  scope: string;
  handleResolver: string;
}

export interface AppConfig {
  baseUrl: string;
  name: string;
}

export interface Config {
  environment: Environment;
  isDev: boolean;
  oauth: OAuthConfig;
  app: AppConfig;
}

function buildLoopbackClientId(redirectUri: string, scope: string): string {
  const params = new URLSearchParams([
    ['redirect_uri', redirectUri],
    ['scope', scope],
  ]);
  return `http://localhost?${params}`;
}

function buildDevConfig(): Config {
  const scope = DEV_SCOPE;
  const redirectUri = DEV_REDIRECT_URI;

  return {
    environment: 'development',
    isDev: true,
    oauth: {
      redirectUri,
      clientId: buildLoopbackClientId(redirectUri, scope),
      scope,
      handleResolver: HANDLE_RESOLVER,
    },
    app: {
      baseUrl: redirectUri,
      name: APP_NAME,
    },
  };
}

function buildProdConfig(): Config {
  const redirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI as string | undefined;
  const clientId = import.meta.env.VITE_OAUTH_CLIENT_ID as string | undefined;
  const baseUrl = import.meta.env.VITE_APP_BASE_URL as string | undefined;

  const missing: string[] = [];
  if (!redirectUri) missing.push('VITE_OAUTH_REDIRECT_URI');
  if (!clientId) missing.push('VITE_OAUTH_CLIENT_ID');
  if (!baseUrl) missing.push('VITE_APP_BASE_URL');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for production: ${missing.join(', ')}. ` +
        'See .env.example for the full list.',
    );
  }

  return {
    environment: 'production',
    isDev: false,
    oauth: {
      redirectUri: redirectUri!,
      clientId: clientId!,
      scope: DEV_SCOPE,
      handleResolver: HANDLE_RESOLVER,
    },
    app: {
      baseUrl: baseUrl!,
      name: APP_NAME,
    },
  };
}

export function createConfig(
  overrides: Partial<{
    environment: Environment;
    oauth: Partial<OAuthConfig>;
    app: Partial<AppConfig>;
  }> = {},
): Config {
  const base = buildDevConfig();
  const environment = overrides.environment ?? base.environment;

  return {
    environment,
    isDev: environment === 'development',
    oauth: { ...base.oauth, ...overrides.oauth },
    app: { ...base.app, ...overrides.app },
  };
}

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (cachedConfig) return cachedConfig;

  const mode = import.meta.env.MODE as string;
  cachedConfig = mode === 'production' ? buildProdConfig() : buildDevConfig();
  return cachedConfig;
}

/** Reset cached config — for testing only. */
export function _resetConfig(): void {
  cachedConfig = null;
}
