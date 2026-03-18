import { signIn } from './AuthService';
import { showSigningIn, showLoggedOut } from './HeaderAuth';

const dialog = () =>
  document.getElementById('login-dialog') as HTMLDialogElement | null;

export function renderLoginDialog(): string {
  return `<dialog id="login-dialog" class="wizard-dialog">
  <button type="button" class="dialog-close" id="login-close-x">&times;</button>
  <div class="dialog-content">
    <h2>Log In</h2>
    <div id="login-options-view">
      <div class="dialog-buttons">
        <button type="button" class="dialog-button" id="login-option-signin">
          Log in with your AT Protocol handle
          <span class="dialog-button-desc">Already have a Bluesky or AT Protocol account? Sign in here.</span>
        </button>
        <button type="button" class="dialog-button" id="login-option-register">
          Create an AT Protocol account
          <span class="dialog-button-desc">AT Protocol is an open network. Register with Bluesky to get started.</span>
        </button>
        <button type="button" class="dialog-button" id="login-option-skip">
          Continue without logging in
          <span class="dialog-button-desc">The app wizard works without login, but your projects won&apos;t be saved to your personal data store.</span>
        </button>
      </div>
    </div>
    <div id="login-handle-view" style="display: none">
      <p>Enter your AT Protocol handle (e.g., your Bluesky username).</p>
      <form id="login-handle-form" class="wizard-form">
        <div class="wizard-field">
          <label for="login-handle-input">Handle</label>
          <input type="text" id="login-handle-input" class="wizard-input" placeholder="you.bsky.social" autocomplete="username" autocapitalize="none" spellcheck="false" />
        </div>
        <div id="login-error" class="login-error" style="display: none"></div>
        <div class="dialog-buttons">
          <button type="submit" class="dialog-button" id="login-submit-btn">Sign in</button>
          <button type="button" class="dialog-cancel" id="login-back">Back</button>
        </div>
      </form>
    </div>
  </div>
</dialog>`;
}

export function setupLoginDialog(): void {
  const dlg = dialog();
  if (!dlg) return;

  // Backdrop click to close
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) {
      dlg.close();
    }
  });

  // Close button
  dlg.querySelector('#login-close-x')?.addEventListener('click', () => {
    dlg.close();
  });

  // Reset to options view when dialog closes
  dlg.addEventListener('close', () => {
    resetDialog();
  });

  // Option buttons
  dlg.querySelector('#login-option-signin')?.addEventListener('click', () => {
    showHandleView();
  });

  dlg.querySelector('#login-option-register')?.addEventListener('click', () => {
    window.open('https://bsky.app', '_blank');
  });

  dlg.querySelector('#login-option-skip')?.addEventListener('click', () => {
    dlg.close();
  });

  // Handle form
  const form = dlg.querySelector('#login-handle-form') as HTMLFormElement | null;
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSignIn();
  });

  // Back button
  dlg.querySelector('#login-back')?.addEventListener('click', () => {
    showOptionsView();
  });
}

export function setupLoginButton(): void {
  document.getElementById('menu-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    openLoginDialog();
  });
}

function openLoginDialog(): void {
  const dlg = dialog();
  if (!dlg) return;
  resetDialog();
  dlg.showModal();
}

function resetDialog(): void {
  const dlg = dialog();
  if (!dlg) return;

  // Show options view, hide handle view
  const optionsView = dlg.querySelector('#login-options-view') as HTMLElement;
  const handleView = dlg.querySelector('#login-handle-view') as HTMLElement;
  if (optionsView) optionsView.style.display = '';
  if (handleView) handleView.style.display = 'none';

  // Clear form state
  const input = dlg.querySelector('#login-handle-input') as HTMLInputElement;
  if (input) input.value = '';

  // Clear error/validation messages
  const error = dlg.querySelector('#login-error') as HTMLElement;
  if (error) {
    error.textContent = '';
    error.style.display = 'none';
  }

  // Reset button state
  const btn = dlg.querySelector('#login-submit-btn') as HTMLButtonElement;
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = 'Sign in';
  }
  const backLink = dlg.querySelector('#login-back') as HTMLElement;
  if (backLink) {
    backLink.classList.remove('disabled');
    (backLink as HTMLButtonElement).disabled = false;
  }
}

function showHandleView(): void {
  const dlg = dialog();
  if (!dlg) return;
  const optionsView = dlg.querySelector('#login-options-view') as HTMLElement;
  const handleView = dlg.querySelector('#login-handle-view') as HTMLElement;
  if (optionsView) optionsView.style.display = 'none';
  if (handleView) handleView.style.display = '';

  // Focus the input
  const input = dlg.querySelector('#login-handle-input') as HTMLInputElement;
  input?.focus();
}

function showOptionsView(): void {
  const dlg = dialog();
  if (!dlg) return;
  const optionsView = dlg.querySelector('#login-options-view') as HTMLElement;
  const handleView = dlg.querySelector('#login-handle-view') as HTMLElement;
  if (optionsView) optionsView.style.display = '';
  if (handleView) handleView.style.display = 'none';

  // Clear input and errors
  const input = dlg.querySelector('#login-handle-input') as HTMLInputElement;
  if (input) input.value = '';
  const error = dlg.querySelector('#login-error') as HTMLElement;
  if (error) {
    error.textContent = '';
    error.style.display = 'none';
  }
}

function showError(message: string): void {
  const dlg = dialog();
  if (!dlg) return;
  const error = dlg.querySelector('#login-error') as HTMLElement;
  if (error) {
    error.textContent = message;
    error.style.display = '';
  }
}

function setLoading(loading: boolean): void {
  const dlg = dialog();
  if (!dlg) return;

  const btn = dlg.querySelector('#login-submit-btn') as HTMLButtonElement;
  const backLink = dlg.querySelector('#login-back') as HTMLButtonElement;
  const input = dlg.querySelector('#login-handle-input') as HTMLInputElement;

  if (btn) {
    btn.disabled = loading;
    btn.innerHTML = loading
      ? '<span class="spinner spinner--sm"></span> Signing in\u2026'
      : 'Sign in';
  }
  if (backLink) {
    backLink.classList.toggle('disabled', loading);
    backLink.disabled = loading;
  }
  if (input) {
    input.disabled = loading;
  }
}

async function handleSignIn(): Promise<void> {
  const dlg = dialog();
  if (!dlg) return;

  const input = dlg.querySelector('#login-handle-input') as HTMLInputElement;
  const handle = input?.value.trim() ?? '';

  // Clear previous error
  const error = dlg.querySelector('#login-error') as HTMLElement;
  if (error) {
    error.textContent = '';
    error.style.display = 'none';
  }

  // Client-side validation
  if (!handle) {
    showError('Please enter your handle');
    return;
  }

  setLoading(true);

  try {
    // Close dialog before redirect
    dlg.close();
    // Show signing-in state in header
    showSigningIn();
    await signIn(handle);
    // If signIn succeeds, the browser redirects away — this code won't run
  } catch (err: any) {
    // signIn failed — reopen dialog with error
    setLoading(false);
    dlg.showModal();
    showHandleView();
    // Restore the handle the user typed
    if (input) input.value = handle;
    const message =
      err?.message || 'Unable to sign in. Please check your handle and try again.';
    showError(message);
    // Also revert header since we set it to signing-in state
    showLoggedOut();
  }
}
