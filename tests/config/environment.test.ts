import { describe, it, expect } from 'vitest';
import { createConfig } from '../../src/config/environment';

describe('createConfig', () => {
  it('returns dev defaults with no overrides', () => {
    const config = createConfig();

    expect(config.environment).toBe('development');
    expect(config.isDev).toBe(true);
    expect(config.oauth.redirectUri).toBe('http://127.0.0.1:8080');
    expect(config.oauth.scope).toBe('atproto transition:generic');
    expect(config.oauth.handleResolver).toBe('https://bsky.social');
    expect(config.app.baseUrl).toBe('http://127.0.0.1:8080');
    expect(config.app.name).toBe('AT Protocol App Wizard');
  });

  it('generates a loopback client ID in dev mode', () => {
    const config = createConfig();

    expect(config.oauth.clientId).toContain('http://localhost?');
    expect(config.oauth.clientId).toContain('redirect_uri=');
    expect(config.oauth.clientId).toContain('scope=');
  });

  it('includes the redirect URI in the loopback client ID', () => {
    const config = createConfig();
    const url = new URL(config.oauth.clientId);
    const params = new URLSearchParams(url.search);

    expect(params.get('redirect_uri')).toBe('http://127.0.0.1:8080');
    expect(params.get('scope')).toBe('atproto transition:generic');
  });

  it('applies oauth overrides while keeping other defaults', () => {
    const config = createConfig({
      oauth: { redirectUri: 'http://test.local' },
    });

    expect(config.oauth.redirectUri).toBe('http://test.local');
    expect(config.oauth.scope).toBe('atproto transition:generic');
    expect(config.oauth.handleResolver).toBe('https://bsky.social');
    expect(config.app.name).toBe('AT Protocol App Wizard');
  });

  it('applies app overrides while keeping other defaults', () => {
    const config = createConfig({
      app: { baseUrl: 'https://custom.example.com' },
    });

    expect(config.app.baseUrl).toBe('https://custom.example.com');
    expect(config.app.name).toBe('AT Protocol App Wizard');
    expect(config.oauth.redirectUri).toBe('http://127.0.0.1:8080');
  });

  it('sets isDev to false when environment is production', () => {
    const config = createConfig({ environment: 'production' });

    expect(config.environment).toBe('production');
    expect(config.isDev).toBe(false);
  });

  it('sets isDev to true when environment is development', () => {
    const config = createConfig({ environment: 'development' });

    expect(config.environment).toBe('development');
    expect(config.isDev).toBe(true);
  });

  it('applies multiple overrides at once', () => {
    const config = createConfig({
      environment: 'production',
      oauth: {
        redirectUri: 'https://prod.example.com',
        clientId: 'https://prod.example.com/client-metadata.json',
      },
      app: {
        baseUrl: 'https://prod.example.com',
      },
    });

    expect(config.isDev).toBe(false);
    expect(config.oauth.redirectUri).toBe('https://prod.example.com');
    expect(config.oauth.clientId).toBe('https://prod.example.com/client-metadata.json');
    expect(config.app.baseUrl).toBe('https://prod.example.com');
    expect(config.oauth.scope).toBe('atproto transition:generic');
  });
});
