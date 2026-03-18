// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock AuthService
vi.mock('../../src/app/auth/AuthService', () => ({
  signIn: vi.fn().mockResolvedValue(undefined),
}));

// Mock HeaderAuth — use spyOn so real functions run (producing real DOM) while remaining trackable
import * as HeaderAuth from '../../src/app/auth/HeaderAuth';

import {
  renderLoginDialog,
  setupLoginDialog,
  setupLoginButton,
} from '../../src/app/auth/LoginDialog';
import { signIn } from '../../src/app/auth/AuthService';

// jsdom doesn't implement showModal/close natively
function polyfillDialog(dlg: HTMLDialogElement): void {
  dlg.showModal = vi.fn(() => {
    dlg.setAttribute('open', '');
  });
  dlg.close = vi.fn(() => {
    dlg.removeAttribute('open');
    dlg.dispatchEvent(new Event('close'));
  });
}

describe('LoginDialog', () => {
  let dlg: HTMLDialogElement;

  let showSigningInSpy: ReturnType<typeof vi.spyOn>;
  let showLoggedOutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.innerHTML = `
      <nav class="menu-nav"></nav>
      ${renderLoginDialog()}`;
    HeaderAuth.showLoggedOut();
    dlg = document.getElementById('login-dialog') as HTMLDialogElement;
    polyfillDialog(dlg);
    setupLoginDialog();
    setupLoginButton();
    showSigningInSpy = vi.spyOn(HeaderAuth, 'showSigningIn');
    showLoggedOutSpy = vi.spyOn(HeaderAuth, 'showLoggedOut');
  });

  describe('opening the dialog', () => {
    it('opens the dialog when Log in is clicked', () => {
      document.getElementById('menu-login')!.click();
      expect(dlg.showModal).toHaveBeenCalled();
    });

    it('shows options view by default', () => {
      document.getElementById('menu-login')!.click();
      const optionsView = document.getElementById(
        'login-options-view',
      ) as HTMLElement;
      const handleView = document.getElementById(
        'login-handle-view',
      ) as HTMLElement;
      expect(optionsView.style.display).toBe('');
      expect(handleView.style.display).toBe('none');
    });
  });

  describe('options view', () => {
    it('transitions to handle view when sign-in option is clicked', () => {
      document.getElementById('login-option-signin')!.click();
      const optionsView = document.getElementById(
        'login-options-view',
      ) as HTMLElement;
      const handleView = document.getElementById(
        'login-handle-view',
      ) as HTMLElement;
      expect(optionsView.style.display).toBe('none');
      expect(handleView.style.display).toBe('');
    });

    it('opens bsky.app in new tab when register is clicked', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      document.getElementById('login-option-register')!.click();
      expect(openSpy).toHaveBeenCalledWith('https://bsky.app', '_blank');
      openSpy.mockRestore();
    });

    it('closes dialog when skip is clicked', () => {
      document.getElementById('menu-login')!.click();
      document.getElementById('login-option-skip')!.click();
      expect(dlg.close).toHaveBeenCalled();
    });
  });

  describe('handle view', () => {
    beforeEach(() => {
      document.getElementById('login-option-signin')!.click();
    });

    it('returns to options view when Back is clicked', () => {
      document.getElementById('login-back')!.click();
      const optionsView = document.getElementById(
        'login-options-view',
      ) as HTMLElement;
      const handleView = document.getElementById(
        'login-handle-view',
      ) as HTMLElement;
      expect(optionsView.style.display).toBe('');
      expect(handleView.style.display).toBe('none');
    });

    it('clears handle input when Back is clicked', () => {
      const input = document.getElementById(
        'login-handle-input',
      ) as HTMLInputElement;
      input.value = 'alice.bsky.social';
      document.getElementById('login-back')!.click();
      expect(input.value).toBe('');
    });

    it('shows validation error for empty handle', () => {
      const form = document.getElementById(
        'login-handle-form',
      ) as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      const error = document.getElementById('login-error') as HTMLElement;
      expect(error.textContent).toBe('Please enter your handle');
      expect(error.style.display).toBe('');
    });

    it('does not call signIn for empty handle', () => {
      const form = document.getElementById(
        'login-handle-form',
      ) as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      expect(signIn).not.toHaveBeenCalled();
    });

    it('calls signIn with the entered handle', async () => {
      const input = document.getElementById(
        'login-handle-input',
      ) as HTMLInputElement;
      input.value = 'alice.bsky.social';
      const form = document.getElementById(
        'login-handle-form',
      ) as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      expect(vi.isMockFunction(signIn)).toBe(true);
      // Allow async to resolve
      await vi.waitFor(() => {
        expect(signIn).toHaveBeenCalledWith('alice.bsky.social');
      });
    });

    it('shows signing-in state in header when submitting', async () => {
      const input = document.getElementById(
        'login-handle-input',
      ) as HTMLInputElement;
      input.value = 'alice.bsky.social';
      const form = document.getElementById(
        'login-handle-form',
      ) as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      await vi.waitFor(() => {
        expect(showSigningInSpy).toHaveBeenCalled();
      });
    });

    it('shows error and reverts header when signIn fails', async () => {
      vi.mocked(signIn).mockRejectedValueOnce(new Error('Invalid handle'));
      const input = document.getElementById(
        'login-handle-input',
      ) as HTMLInputElement;
      input.value = 'bad-handle';
      const form = document.getElementById(
        'login-handle-form',
      ) as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      await vi.waitFor(() => {
        const error = document.getElementById('login-error') as HTMLElement;
        expect(error.textContent).toBe('Invalid handle');
        expect(showLoggedOutSpy).toHaveBeenCalled();
      });
    });
  });

  describe('dialog reset on close', () => {
    it('resets to options view when dialog closes', () => {
      // Navigate to handle view
      document.getElementById('login-option-signin')!.click();
      const input = document.getElementById(
        'login-handle-input',
      ) as HTMLInputElement;
      input.value = 'some.handle';
      // Close dialog
      dlg.close();
      // Verify reset
      const optionsView = document.getElementById(
        'login-options-view',
      ) as HTMLElement;
      const handleView = document.getElementById(
        'login-handle-view',
      ) as HTMLElement;
      expect(optionsView.style.display).toBe('');
      expect(handleView.style.display).toBe('none');
      expect(input.value).toBe('');
    });

    it('clears error messages on close', () => {
      // Show an error
      const error = document.getElementById('login-error') as HTMLElement;
      error.textContent = 'Some error';
      error.style.display = '';
      // Close dialog
      dlg.close();
      expect(error.textContent).toBe('');
      expect(error.style.display).toBe('none');
    });
  });
});
