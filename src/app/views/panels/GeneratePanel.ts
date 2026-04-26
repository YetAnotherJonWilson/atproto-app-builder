/**
 * Generate panel — workspace content for the Generate section.
 *
 * Collects app identity (name, description, author), shows a review
 * summary of the user's work, and provides a Download ZIP button that
 * generates and downloads the AT Protocol app.
 */

import { getWizardState, saveWizardState } from '../../state/WizardState';
import { updateAccordionSummaries, isNarrowViewport } from '../WorkspaceLayout';
import { generateApp } from '../../export/OutputGenerator';
import { computeRecordTypeNsid, generateRecordLexicon } from '../../../generator/Lexicon';
import { publishLexicons } from '../../services/LexiconPublisher';
import type { RecordType } from '../../../types/wizard';
import type { PublishResult } from '../../services/LexiconPublisher';

/** Display NSID for a record type, or a placeholder when not yet configured. */
function displayNsid(rt: RecordType): string {
  if (rt.source === 'adopted' && rt.adoptedNsid) return rt.adoptedNsid;
  if (rt.namespaceOption) return computeRecordTypeNsid(rt);
  return `[namespace].${rt.name}`;
}

// ── Helpers ───────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedUpdate(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    updateReviewSection();
    updateGenerateSidebar();
    updateAccordionSummaries();
    updateDownloadButtonState();
  }, 300);
}

// ── Render ────────────────────────────────────────────────────────────

export function renderGeneratePanel(): string {
  const { appInfo } = getWizardState();

  const desc = `<div class="workspace-desc">
    Configure your app's identity and download the generated AT Protocol application.
  </div>`;

  const appInfoSection = renderAppInfoSection(appInfo);
  const reviewSection = `<div id="generate-review-container">${renderReviewSection()}</div>`;
  const exportSection = renderExportSection();

  return desc + appInfoSection + reviewSection + exportSection;
}

function renderAppInfoSection(appInfo: { appName: string; description: string; authorName: string }): string {
  return `<div class="generate-section">
  <h3 class="generate-section-title">App Identity</h3>
  <div class="form-group">
    <label for="gen-app-name">App Name <span class="required">*</span></label>
    <input type="text" id="gen-app-name" placeholder="e.g., My Cool App"
      value="${escapeHtml(appInfo.appName)}">
    <div class="form-hint">Used in package.json, page title, and ZIP filename.</div>
  </div>
  <div class="form-group">
    <label for="gen-description">Description</label>
    <textarea id="gen-description" rows="2"
      placeholder="A short description of your app">${escapeHtml(appInfo.description)}</textarea>
    <div class="form-hint">Appears in package.json and README.</div>
  </div>
  <div class="form-group">
    <label for="gen-author">Author</label>
    <input type="text" id="gen-author" placeholder="Your name"
      value="${escapeHtml(appInfo.authorName)}">
    <div class="form-hint">Appears in package.json and README.</div>
  </div>
</div>`;
}

function renderReviewSection(): string {
  const { recordTypes, views, components, requirements } = getWizardState();

  // Record types with NSIDs
  let recordTypesValue: string;
  if (recordTypes.length === 0) {
    recordTypesValue = '0';
  } else {
    const items = recordTypes.map((rt) => {
      const nsid = displayNsid(rt);
      return `${escapeHtml(rt.displayName || rt.name)} (${escapeHtml(nsid)})`;
    });
    recordTypesValue = `${recordTypes.length} &mdash; ${items.join(', ')}`;
  }

  // Lexicon previews — only render for records with a fully configured namespace.
  let lexiconPreviews = '';
  if (recordTypes.length > 0) {
    lexiconPreviews = recordTypes
      .filter((rt) => (rt.source === 'adopted' && rt.adoptedNsid) || rt.namespaceOption)
      .map((rt) => {
        const nsid = displayNsid(rt);
        const lexicon = generateRecordLexicon(rt, recordTypes);
        return `<details>
  <summary>${escapeHtml(nsid)}</summary>
  <pre class="wizard-code">${escapeHtml(JSON.stringify(lexicon, null, 2))}</pre>
</details>`;
      })
      .join('');
  }

  // Views
  const viewsValue = views.length === 0
    ? '0'
    : `${views.length} &mdash; ${views.map((v) => escapeHtml(v.name)).join(', ')}`;

  // Warning for no record types
  const warning = recordTypes.length === 0
    ? `<div class="generate-warning">
  No data types defined &mdash; your generated app will have no AT Protocol records.
  You can still generate, but the app won&rsquo;t do much.
</div>`
    : '';

  return `<div class="generate-section">
  <h3 class="generate-section-title">Review</h3>
  <div class="generate-review">
    <div class="generate-review-item">
      <div class="generate-review-label">Record Types</div>
      <div class="generate-review-value">${recordTypesValue}</div>
    </div>
    ${lexiconPreviews}
    <div class="generate-review-item">
      <div class="generate-review-label">Views</div>
      <div class="generate-review-value">${viewsValue}</div>
    </div>
    <div class="generate-review-item">
      <div class="generate-review-label">Components</div>
      <div class="generate-review-value">${components.length}</div>
    </div>
    <div class="generate-review-item">
      <div class="generate-review-label">Requirements</div>
      <div class="generate-review-value">${requirements.length}</div>
    </div>
  </div>
  ${warning}
</div>`;
}

function renderExportSection(): string {
  const { appInfo } = getWizardState();
  const disabled = !appInfo.appName.trim();

  return `<div class="generate-section">
  <h3 class="generate-section-title">Export</h3>
  <div class="generate-btn-wrapper">
    <button class="generate-btn" id="gen-download-btn"${disabled ? ' disabled' : ''}>
      Download ZIP
    </button>
    <div class="form-hint">
      Generates a complete AT Protocol app ready to run with npm install &amp;&amp; npm run dev.
    </div>
  </div>
</div>`;
}

// ── Wire ──────────────────────────────────────────────────────────────

export function wireGeneratePanel(): void {
  const appNameInput = document.getElementById('gen-app-name') as HTMLInputElement | null;
  const descInput = document.getElementById('gen-description') as HTMLTextAreaElement | null;
  const authorInput = document.getElementById('gen-author') as HTMLInputElement | null;

  const persistAndUpdate = () => {
    const state = getWizardState();
    if (appNameInput) state.appInfo.appName = appNameInput.value;
    if (descInput) state.appInfo.description = descInput.value;
    if (authorInput) state.appInfo.authorName = authorInput.value;
    saveWizardState(state);
    debouncedUpdate();
  };

  appNameInput?.addEventListener('input', persistAndUpdate);
  descInput?.addEventListener('input', persistAndUpdate);
  authorInput?.addEventListener('input', persistAndUpdate);

  // Download button
  const downloadBtn = document.getElementById('gen-download-btn') as HTMLButtonElement | null;
  downloadBtn?.addEventListener('click', handleDownload);
}

/**
 * Returns record types eligible for publishing:
 * source === 'new', namespaceOption === 'thelexfiles-temp',
 * and both lexUsername and name are non-empty.
 */
function getPublishableRecordTypes(): RecordType[] {
  const { recordTypes } = getWizardState();
  return recordTypes.filter(
    (rt) =>
      rt.source === 'new' &&
      rt.namespaceOption === 'thelexfiles-temp' &&
      rt.lexUsername?.trim() &&
      rt.name?.trim(),
  );
}

function handleDownload(): void {
  showConfirmationDialog();
}

// ── Confirmation dialog ──────────────────────────────────────────────

function showConfirmationDialog(): void {
  const publishable = getPublishableRecordTypes();
  const hasPublishable = publishable.length > 0;

  // Build NSID list
  const nsidListHtml = hasPublishable
    ? `<li>Publish your lexicons as experimental (.temp) versions via the AT Protocol:
        <ul class="dialog-nsid-list">
          ${publishable.map((rt) => `<li><code>${escapeHtml(computeRecordTypeNsid(rt))}</code></li>`).join('')}
        </ul>
      </li>`
    : '';

  const confirmLabel = hasPublishable ? 'Generate &amp; Publish' : 'Download ZIP';

  const dialog = document.createElement('dialog');
  dialog.className = 'wizard-dialog';
  dialog.innerHTML = `<div class="dialog-content">
  <button type="button" class="dialog-close" id="gen-confirm-close-x">&times;</button>
  <h2>${hasPublishable ? 'Generate &amp; Publish' : 'Download ZIP'}</h2>
  <p>This will:</p>
  <ul class="dialog-action-list">
    <li>Download a scaffolded version of your app, with placeholders for content that cannot be generated</li>
    ${nsidListHtml}
  </ul>
  <div class="dialog-warning">
    <strong>&#9888;</strong> Data stored in AT Protocol Personal Data Servers is not yet private. Use these apps for experimentation, not for storing private data.
  </div>
  <div id="gen-confirm-status"></div>
  <div class="dialog-buttons">
    <button type="button" class="dialog-button" id="gen-confirm-btn">${confirmLabel}</button>
    <button type="button" class="dialog-cancel" id="gen-confirm-cancel">Cancel</button>
  </div>
</div>`;

  document.body.appendChild(dialog);

  const confirmBtn = dialog.querySelector('#gen-confirm-btn') as HTMLButtonElement;
  const cancelBtn = dialog.querySelector('#gen-confirm-cancel') as HTMLButtonElement;
  const closeX = dialog.querySelector('#gen-confirm-close-x') as HTMLButtonElement;
  const statusDiv = dialog.querySelector('#gen-confirm-status') as HTMLDivElement;

  const close = () => {
    dialog.close();
    dialog.remove();
  };

  cancelBtn.addEventListener('click', close);
  closeX.addEventListener('click', close);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  confirmBtn.onclick = () => {
    executePublishAndGenerate(dialog, confirmBtn, cancelBtn, statusDiv, publishable, hasPublishable);
  };

  dialog.showModal();
}

async function executePublishAndGenerate(
  dialog: HTMLDialogElement,
  confirmBtn: HTMLButtonElement,
  cancelBtn: HTMLButtonElement,
  statusDiv: HTMLDivElement,
  publishable: RecordType[],
  hasPublishable: boolean,
): Promise<void> {
  confirmBtn.disabled = true;
  cancelBtn.style.display = 'none';

  // Phase 1: Publish lexicons
  let publishResult: PublishResult | null = null;
  if (hasPublishable) {
    confirmBtn.textContent = 'Publishing...';

    const { recordTypes } = getWizardState();
    const entries = publishable.map((rt) => ({
      nsid: computeRecordTypeNsid(rt),
      schema: generateRecordLexicon(rt, recordTypes),
    }));

    try {
      publishResult = await publishLexicons(entries);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      statusDiv.innerHTML = `<div class="dialog-error">Failed to publish lexicons: ${escapeHtml(message)}</div>`;
      showFailureActions(dialog, confirmBtn, cancelBtn);
      return;
    }

    // Check for partial failures
    if (publishResult.failed.length > 0) {
      const failedList = publishResult.failed
        .map((f) => `<li><code>${escapeHtml(f.nsid)}</code>: ${escapeHtml(f.error)}</li>`)
        .join('');
      const successCount = publishResult.published.length;
      statusDiv.innerHTML = `<div class="dialog-error">
        ${successCount > 0 ? `${successCount} lexicon${successCount > 1 ? 's' : ''} published. ` : ''}
        ${publishResult.failed.length} failed:<ul>${failedList}</ul>
      </div>`;
      showFailureActions(dialog, confirmBtn, cancelBtn);
      return;
    }
  }

  // Phase 2: Generate ZIP
  confirmBtn.textContent = 'Generating...';

  try {
    const state = getWizardState();
    state.appConfig.outputMethod = 'zip';
    saveWizardState(state);

    await generateApp();

    // Mark as generated
    const updatedState = getWizardState();
    updatedState.hasGenerated = true;
    saveWizardState(updatedState);
    updateGenerateSidebar();
    updateAccordionSummaries();

    // Show success
    const pubCount = publishResult?.published.length ?? 0;
    const pubMsg = pubCount > 0 ? ` and ${pubCount} lexicon${pubCount > 1 ? 's' : ''} published` : '';
    statusDiv.innerHTML = `<div class="dialog-success">Your app has been downloaded${pubMsg}.</div>`;
    confirmBtn.textContent = 'OK';
    confirmBtn.disabled = false;
    confirmBtn.onclick = () => {
      dialog.close();
      dialog.remove();
    };
  } catch {
    statusDiv.innerHTML = `<div class="dialog-error">ZIP generation failed.</div>`;
    confirmBtn.textContent = 'OK';
    confirmBtn.disabled = false;
    confirmBtn.onclick = () => {
      dialog.close();
      dialog.remove();
    };
  }
}

function showFailureActions(
  dialog: HTMLDialogElement,
  confirmBtn: HTMLButtonElement,
  cancelBtn: HTMLButtonElement,
): void {
  confirmBtn.textContent = 'Download ZIP Anyway';
  confirmBtn.disabled = false;
  cancelBtn.style.display = '';
  cancelBtn.textContent = 'Cancel';

  // Replace the confirm handler to skip publishing
  confirmBtn.onclick = async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Generating...';
    cancelBtn.style.display = 'none';
    const statusDiv = dialog.querySelector('#gen-confirm-status') as HTMLDivElement;

    try {
      const state = getWizardState();
      state.appConfig.outputMethod = 'zip';
      saveWizardState(state);

      await generateApp();

      const updatedState = getWizardState();
      updatedState.hasGenerated = true;
      saveWizardState(updatedState);
      updateGenerateSidebar();
      updateAccordionSummaries();

      statusDiv.innerHTML = `<div class="dialog-success">Your app has been downloaded.</div>`;
      confirmBtn.textContent = 'OK';
      confirmBtn.disabled = false;
      confirmBtn.onclick = () => {
        dialog.close();
        dialog.remove();
      };
    } catch {
      statusDiv.innerHTML = `<div class="dialog-error">ZIP generation failed.</div>`;
      confirmBtn.textContent = 'OK';
      confirmBtn.disabled = false;
      confirmBtn.onclick = () => {
        dialog.close();
        dialog.remove();
      };
    }
  };
}

// ── Sidebar ──────────────────────────────────────────────────────────

export function updateGenerateSidebar(): void {
  const { appInfo, hasGenerated } = getWizardState();
  const section = document.querySelector(
    '.sidebar-section[data-section="generate"]',
  );
  if (!section) return;

  // has-items: set when user has successfully generated
  if (hasGenerated) {
    section.classList.add('has-items');
  } else {
    section.classList.remove('has-items');
  }

  // Update sidebar items
  const itemsContainer = section.querySelector('.sidebar-items');
  if (!itemsContainer) return;

  const appName = appInfo.appName.trim();
  if (appName) {
    itemsContainer.innerHTML =
      `<div class="sidebar-item"><span class="dot"></span> ${escapeHtml(appName)}</div>`;
  } else {
    itemsContainer.innerHTML =
      '<div class="sidebar-item-empty">Configure &amp; generate</div>';
  }
}

// ── Update helpers ───────────────────────────────────────────────────

function updateReviewSection(): void {
  const container = document.getElementById('generate-review-container');
  if (container) {
    container.innerHTML = renderReviewSection();
  }
}

function updateDownloadButtonState(): void {
  const btn = document.getElementById('gen-download-btn') as HTMLButtonElement | null;
  if (!btn) return;
  const { appInfo } = getWizardState();
  btn.disabled = !appInfo.appName.trim();
}

// ── Re-render ────────────────────────────────────────────────────────

function rerender(): void {
  const body = isNarrowViewport()
    ? document.querySelector('.accordion-section[data-section="generate"] .accordion-body')
    : document.getElementById('workspace-panel-body');

  if (body) {
    body.innerHTML = renderGeneratePanel();
    wireGeneratePanel();
  }

  updateGenerateSidebar();
  updateAccordionSummaries();
}

// Export rerender for external use if needed
export { rerender as rerenderGeneratePanel };
