/**
 * Reusable confirmation dialog — replaces native confirm() with
 * styled wizard-dialog that matches the rest of the app.
 */
export function showConfirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'wizard-dialog';
    dialog.innerHTML = `
      <button type="button" class="dialog-close" id="confirm-close-x">&times;</button>
      <div class="dialog-content">
        <h2>Confirm</h2>
        <p>${message}</p>
        <div class="dialog-buttons">
          <button type="button" class="dialog-button" id="confirm-yes">Continue</button>
          <button type="button" class="dialog-cancel" id="confirm-no">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const close = (result: boolean) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };

    dialog.querySelector('#confirm-close-x')!.addEventListener('click', () => close(false));
    dialog.querySelector('#confirm-yes')!.addEventListener('click', () => close(true));
    dialog.querySelector('#confirm-no')!.addEventListener('click', () => close(false));
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close(false);
    });

    dialog.showModal();
  });
}
