import { describe, it, expect } from 'vitest';
import { generateEnvironmentTs } from '../../src/generator/config/Environment';

describe('generateEnvironmentTs', () => {
  const result = generateEnvironmentTs('atproto repo:com.example.app.post');

  it('exports getOAuthConfig function', () => {
    expect(result).toContain('export function getOAuthConfig()');
  });

  it('checks import.meta.env.MODE for environment detection', () => {
    expect(result).toContain("import.meta.env.MODE === 'production'");
  });

  it('uses loopback redirect URI for dev config', () => {
    expect(result).toContain("http://127.0.0.1:8080");
  });

  it('falls back to window.location.origin in prod config', () => {
    expect(result).toContain('window.location.origin');
  });

  it('reads VITE_OAUTH_CLIENT_ID env var in prod config', () => {
    expect(result).toContain('import.meta.env.VITE_OAUTH_CLIENT_ID');
  });

  it('reads VITE_OAUTH_REDIRECT_URI env var in prod config', () => {
    expect(result).toContain('import.meta.env.VITE_OAUTH_REDIRECT_URI');
  });

  it('exports OAuthConfig interface', () => {
    expect(result).toContain('export interface OAuthConfig');
  });

  it('includes isDev flag in config', () => {
    expect(result).toContain('isDev: true');
    expect(result).toContain('isDev: false');
  });
});
