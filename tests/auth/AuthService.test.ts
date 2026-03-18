// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

// Mock the atproto libraries to avoid their browser API requirements in tests
vi.mock('@atproto/oauth-client-browser', () => ({
  BrowserOAuthClient: vi.fn(),
  atprotoLoopbackClientMetadata: vi.fn(),
}));
vi.mock('@atproto/api', () => ({
  Agent: vi.fn(),
}));

describe('isOAuthCallback', () => {
  const originalLocation = window.location;

  function setUrl(url: string): void {
    Object.defineProperty(window, 'location', {
      value: new URL(url),
      writable: true,
      configurable: true,
    });
  }

  beforeEach(() => {
    // Reset modules so _earlyCallbackParams is re-evaluated on next import
    vi.resetModules();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('returns true when code and state are in query params', async () => {
    setUrl('http://localhost:8080/?code=abc123&state=xyz');
    const { isOAuthCallback } = await import('../../src/app/auth/AuthService');
    expect(isOAuthCallback()).toBe(true);
  });

  it('returns true when error and state are in query params', async () => {
    setUrl('http://localhost:8080/?error=access_denied&state=xyz');
    const { isOAuthCallback } = await import('../../src/app/auth/AuthService');
    expect(isOAuthCallback()).toBe(true);
  });

  it('returns true when code and state are in hash fragment', async () => {
    setUrl('http://localhost:8080/#code=abc123&state=xyz');
    const { isOAuthCallback } = await import('../../src/app/auth/AuthService');
    expect(isOAuthCallback()).toBe(true);
  });

  it('returns true when error and state are in hash fragment', async () => {
    setUrl('http://localhost:8080/#error=access_denied&state=xyz');
    const { isOAuthCallback } = await import('../../src/app/auth/AuthService');
    expect(isOAuthCallback()).toBe(true);
  });

  it('returns false for a normal URL', async () => {
    setUrl('http://localhost:8080/');
    const { isOAuthCallback } = await import('../../src/app/auth/AuthService');
    expect(isOAuthCallback()).toBe(false);
  });

  it('returns false when unrelated params are present', async () => {
    setUrl('http://localhost:8080/?step=2&view=data');
    const { isOAuthCallback } = await import('../../src/app/auth/AuthService');
    expect(isOAuthCallback()).toBe(false);
  });
});
