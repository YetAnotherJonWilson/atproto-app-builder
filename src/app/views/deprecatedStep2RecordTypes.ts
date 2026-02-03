/**
 * Step 2: Define Record Types
 */

import { getWizardState } from '../state/WizardState';
import { escapeHtml } from '../../utils';

export function renderStep2(): string {
  const wizardState = getWizardState();

  const recordsHtml =
    wizardState.recordTypes.length === 0
      ? '<p class="wizard-empty-message">No record types defined yet. Click "Add Record Type" to get started.</p>'
      : wizardState.recordTypes
          .map(
            (record) => `
        <div class="wizard-list-item" data-id="${record.id}">
          <div class="wizard-list-item-header">
            <h3>${escapeHtml(record.name || 'Untitled Record')}</h3>
            <div class="wizard-list-item-actions">
              <button
                type="button"
                class="wizard-button-icon"
                onclick="window.wizardOps.editRecordType('${record.id}')"
              >Edit</button>
              <button
                type="button"
                class="wizard-button-icon wizard-button-danger"
                onclick="window.wizardOps.deleteRecordType('${record.id}')"
              >Delete</button>
            </div>
          </div>
          <p class="wizard-list-item-description">
            ${escapeHtml(record.description || 'No description')}
          </p>
          <p class="wizard-list-item-meta">
            ${record.fields.length} field(s) defined
          </p>
        </div>
      `
          )
          .join('');

  return `
    <div class="wizard-narrow">
      <div class="wizard-step">
        <h2 class="wizard-step-title">Define Record Types</h2>
        <p class="wizard-step-description">
          Record types are the data structures your app will store.
          Examples: "todo", "post", "bookmark", "note"
        </p>
        <div class="wizard-form">
          <div id="record-types-list" class="wizard-list">
            ${recordsHtml}
          </div>
          <button
            type="button"
            id="add-record-type"
            class="wizard-button wizard-button-secondary"
          >
            + Add Record Type
          </button>
        </div>
      </div>
    </div>
  `;
}

export function wireStep2Events(): void {
  const addBtn = document.getElementById('add-record-type');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      window.wizardOps.openRecordDialog();
    });
  }
}
