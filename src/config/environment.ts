import { APP_WIZARD_SCOPE, COMPAT_SCOPE } from '../shared/scopes';

const DEV_REDIRECT_URI = 'http://127.0.0.1:8080';
const HANDLE_RESOLVER = 'https://bsky.social';
const APP_NAME = 'AT Protocol App Wizard';

export type Environment = 'development' | 'production';

export interface OAuthConfig {
  redirectUri: string;
  clientId: string;
  compatClientId: string;
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
  const scope = APP_WIZARD_SCOPE;
  const redirectUri = DEV_REDIRECT_URI;

  return {
    environment: 'development',
    isDev: true,
    oauth: {
      redirectUri,
      clientId: buildLoopbackClientId(redirectUri, scope),
      compatClientId: buildLoopbackClientId(redirectUri, COMPAT_SCOPE),
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
  const origin = window.location.origin;
  const redirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI || origin;
  const clientId = import.meta.env.VITE_OAUTH_CLIENT_ID || `${origin}/client-metadata.json`;
  const baseUrl = import.meta.env.VITE_APP_BASE_URL || origin;

  return {
    environment: 'production',
    isDev: false,
    oauth: {
      redirectUri,
      clientId,
      compatClientId: `${origin}/client-metadata-compat.json`,
      scope: APP_WIZARD_SCOPE,
      handleResolver: HANDLE_RESOLVER,
    },
    app: {
      baseUrl,
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
