/**
 * Reusable prompt dialog — styled text input dialog that matches the app.
 * Returns the entered text, or null if cancelled.
 *
 * An optional `validate` callback can reject values — it returns an error
 * message string to display, or null when the value is acceptable.
 */
export function showPromptDialog(
  message: string,
  defaultValue = '',
  placeholder = '',
  validate?: (value: string) => string | null,
): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'wizard-dialog';
    dialog.style.maxWidth = '420px';
    dialog.innerHTML = `<div class="dialog-content">
  <button type="button" class="dialog-close" id="prompt-close-x">&times;</button>
  <h2>Enter a name</h2>
  <p>${message}</p>
  <input type="text" id="prompt-input" class="delete-confirm-input"
    style="border-color: var(--border-accent); margin-bottom: 0.25rem;"
    placeholder="${placeholder}" value="${defaultValue}">
  <p id="prompt-error" style="color: var(--text-error, #e53e3e); font-size: 0.85rem; min-height: 1.2em; margin: 0 0 0.75rem 0;"></p>
  <div class="dialog-buttons">
    <button type="button" class="dialog-button" id="prompt-ok" ${defaultValue ? '' : 'disabled'}>OK</button>
    <button type="button" class="dialog-cancel" id="prompt-cancel">Cancel</button>
  </div>
</div>`;

    document.body.appendChild(dialog);

    const input = dialog.querySelector('#prompt-input') as HTMLInputElement;
    const okBtn = dialog.querySelector('#prompt-ok') as HTMLButtonElement;
    const cancelBtn = dialog.querySelector('#prompt-cancel') as HTMLButtonElement;
    const closeX = dialog.querySelector('#prompt-close-x') as HTMLButtonElement;
    const errorEl = dialog.querySelector('#prompt-error') as HTMLParagraphElement;

    const close = (result: string | null) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };

    const checkValidity = () => {
      const val = input.value.trim();
      if (!val) {
        okBtn.disabled = true;
        errorEl.textContent = '';
        return;
      }
      if (validate) {
        const err = validate(val);
        errorEl.textContent = err ?? '';
        okBtn.disabled = !!err;
      } else {
        okBtn.disabled = false;
        errorEl.textContent = '';
      }
    };

    input.addEventListener('input', checkValidity);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim() && !okBtn.disabled) {
        close(input.value.trim());
      }
    });

    okBtn.addEventListener('click', () => close(input.value.trim()));
    cancelBtn.addEventListener('click', () => close(null));
    closeX.addEventListener('click', () => close(null));
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close(null);
    });

    dialog.showModal();
    input.focus();
    input.select();

    // Run initial validation (default value may already be invalid)
    checkValidity();
  });
}
