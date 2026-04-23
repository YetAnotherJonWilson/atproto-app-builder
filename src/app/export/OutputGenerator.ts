/**
 * Output generator - orchestrates app generation
 */

import { getWizardState } from '../state/WizardState';
import { generateAllFiles } from '../../generator';
import { generateZipDownload } from './ZipExporter';
import { createGitHubRepo } from './GitHubExporter';
import type { RecordType } from '../../types/wizard';

export async function generateApp(): Promise<void> {
  const wizardState = getWizardState();

  // Validate all record types are complete
  const incomplete = wizardState.recordTypes.filter(rt => !isRecordTypeReady(rt));
  if (incomplete.length > 0) {
    showIncompleteDataTypesDialog(incomplete);
    throw new Error('validation');
  }

  // Ensure appConfig has a primary record type
  if (!wizardState.appConfig.primaryRecordType && wizardState.recordTypes.length > 0) {
    wizardState.appConfig.primaryRecordType = wizardState.recordTypes[0].name;
  }

  // Add domain to appConfig for generator
  wizardState.appConfig.domain = wizardState.appInfo.domain;

  // Generate all files using the generator
  const files = await generateAllFiles(wizardState, wizardState.appConfig);

  // Determine output method
  const outputMethod = wizardState.appConfig.outputMethod || 'zip';

  if (outputMethod === 'zip') {
    await generateZipDownload(files);
  } else if (outputMethod === 'github') {
    await createGitHubRepo(files);
  }
}

function isRecordTypeReady(rt: RecordType): boolean {
  if (rt.source === 'adopted' && rt.adoptedNsid) return true;
  return rt.name.length > 0 && !!(rt.namespaceOption || rt.adoptedNsid);
}

function showIncompleteDataTypesDialog(incomplete: RecordType[]): void {
  const items = incomplete
    .map(rt => `<li>${escapeHtml(rt.displayName)}</li>`)
    .join('');

  const dialog = document.createElement('dialog');
  dialog.className = 'wizard-dialog';
  dialog.innerHTML = `
    <button type="button" class="dialog-close" id="incomplete-close-x">&times;</button>
    <div class="dialog-content">
      <h2>Incomplete data types</h2>
      <p>These data types need to be completed or deleted before generating:</p>
      <ul class="cannot-delete-ref-list">${items}</ul>
      <div class="dialog-buttons">
        <button type="button" class="dialog-button" id="incomplete-ok">OK</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const close = () => {
    dialog.close();
    dialog.remove();
  };

  dialog.querySelector('#incomplete-close-x')!.addEventListener('click', close);
  dialog.querySelector('#incomplete-ok')!.addEventListener('click', close);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  dialog.showModal();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
