import { signOut, getUserProfile } from './AuthService';
import type { UserProfile } from './AuthService';

const menuNav = () => document.querySelector('.menu-nav') as HTMLElement | null;

export function showSigningIn(): void {
  const nav = menuNav();
  if (!nav) return;
  nav.innerHTML = `
    <span class="header-auth-status">
      <span class="spinner spinner--sm"></span>
      <span class="header-auth-text">Signing in\u2026</span>
    </span>
  `;
}

export function showLoggedIn(profile: UserProfile): void {
  const nav = menuNav();
  if (!nav) return;
  const name = profile.displayName || profile.handle || profile.did;
  nav.innerHTML = `
    <span class="header-auth-user">${escapeHtml(name)}</span>
    <span class="header-auth-sep">\u00b7</span>
    <a href="#" class="login-btn" id="menu-logout">Log out</a>
  `;
  document
    .getElementById('menu-logout')
    ?.addEventListener('click', handleLogout);
}

let onLoggedOut: (() => void) | null = null;

/** Register a callback to re-wire the login button after logout or error. */
export function setOnLoggedOut(cb: () => void): void {
  onLoggedOut = cb;
}

export function showLoggedOut(): void {
  const nav = menuNav();
  if (!nav) return;
  nav.innerHTML = `<a href="#" class="login-btn" id="menu-login">Log in</a>`;
  onLoggedOut?.();
}

export function showError(message: string): void {
  const nav = menuNav();
  if (!nav) return;
  nav.innerHTML = `
    <span class="header-auth-error">${escapeHtml(message)}</span>
    <a href="#" class="login-btn" id="menu-login">Log in</a>
  `;
  // Auto-fade the error after 4 seconds
  const errorEl = nav.querySelector('.header-auth-error');
  if (errorEl) {
    setTimeout(() => errorEl.remove(), 4000);
  }
}

export async function completeLogin(): Promise<void> {
  try {
    const profile = await getUserProfile();
    showLoggedIn(profile);
  } catch {
    showLoggedIn({ displayName: '', handle: '', did: 'unknown' });
  }
}

async function handleLogout(e: Event): Promise<void> {
  e.preventDefault();
  try {
    await signOut();
  } catch {
    // Ignore revocation errors — clear UI regardless
  }
  showLoggedOut();
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
