// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock AuthService before importing HeaderAuth
vi.mock('../../src/app/auth/AuthService', () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
  getUserProfile: vi.fn().mockResolvedValue({
    displayName: 'Alice',
    handle: 'alice.bsky.social',
    did: 'did:plc:abc123',
  }),
  getSession: vi.fn().mockReturnValue({ sub: 'did:plc:abc123' }),
}));

import {
  showSigningIn,
  showLoggedIn,
  showLoggedOut,
  showError,
  completeLogin,
  setOnLoggedOut,
} from '../../src/app/auth/HeaderAuth';
import { getUserProfile } from '../../src/app/auth/AuthService';

describe('HeaderAuth', () => {
  let nav: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `<nav class="menu-nav"><a href="#" class="login-btn" id="menu-login">Log in</a></nav>`;
    nav = document.querySelector('.menu-nav') as HTMLElement;
    vi.clearAllMocks();
  });

  describe('showSigningIn', () => {
    it('shows spinner and "Signing in…" text', () => {
      showSigningIn();
      expect(nav.querySelector('.spinner')).not.toBeNull();
      expect(nav.textContent).toContain('Signing in');
    });

    it('removes the login button', () => {
      showSigningIn();
      expect(nav.querySelector('#menu-login')).toBeNull();
    });
  });

  describe('showLoggedIn', () => {
    it('shows display name when available', () => {
      showLoggedIn({ displayName: 'Alice', handle: 'alice.bsky.social', did: 'did:plc:abc123' });
      expect(nav.querySelector('.header-auth-user')?.textContent).toBe('Alice');
    });

    it('falls back to handle when no display name', () => {
      showLoggedIn({ displayName: '', handle: 'alice.bsky.social', did: 'did:plc:abc123' });
      expect(nav.querySelector('.header-auth-user')?.textContent).toBe('alice.bsky.social');
    });

    it('falls back to DID when no display name or handle', () => {
      showLoggedIn({ displayName: '', handle: '', did: 'did:plc:abc123' });
      expect(nav.querySelector('.header-auth-user')?.textContent).toBe('did:plc:abc123');
    });

    it('shows a Log out link', () => {
      showLoggedIn({ displayName: 'Alice', handle: 'alice.bsky.social', did: 'did:plc:abc123' });
      const logout = nav.querySelector('#menu-logout') as HTMLElement;
      expect(logout).not.toBeNull();
      expect(logout.textContent).toBe('Log out');
    });

    it('shows a separator between name and logout', () => {
      showLoggedIn({ displayName: 'Alice', handle: 'alice.bsky.social', did: 'did:plc:abc123' });
      expect(nav.querySelector('.header-auth-sep')).not.toBeNull();
    });

    it('escapes HTML in display name', () => {
      showLoggedIn({ displayName: '<script>alert("xss")</script>', handle: 'h', did: 'd' });
      expect(nav.innerHTML).not.toContain('<script>');
      expect(nav.querySelector('.header-auth-user')?.textContent).toBe('<script>alert("xss")</script>');
    });
  });

  describe('showLoggedOut', () => {
    it('shows the Log in link', () => {
      showLoggedIn({ displayName: 'Alice', handle: 'alice.bsky.social', did: 'did:plc:abc123' });
      showLoggedOut();
      const login = nav.querySelector('#menu-login') as HTMLElement;
      expect(login).not.toBeNull();
      expect(login.textContent).toBe('Log in');
    });

    it('calls the onLoggedOut callback', () => {
      const cb = vi.fn();
      setOnLoggedOut(cb);
      showLoggedOut();
      expect(cb).toHaveBeenCalledOnce();
    });
  });

  describe('showError', () => {
    it('shows error message and login link', () => {
      showError('Login failed');
      expect(nav.querySelector('.header-auth-error')?.textContent).toBe('Login failed');
      expect(nav.querySelector('#menu-login')).not.toBeNull();
    });
  });

  describe('completeLogin', () => {
    it('fetches profile and shows logged-in state', async () => {
      await completeLogin();
      expect(getUserProfile).toHaveBeenCalled();
      expect(nav.querySelector('.header-auth-user')?.textContent).toBe('Alice');
    });

    it('shows fallback when getUserProfile throws', async () => {
      vi.mocked(getUserProfile).mockRejectedValueOnce(new Error('fail'));
      await completeLogin();
      // Falls back to unknown DID
      expect(nav.querySelector('.header-auth-user')?.textContent).toBe('unknown');
    });
  });
});
