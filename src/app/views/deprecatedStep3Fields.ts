/**
 * Step 3: Define Fields for Record Types
 */

import { getWizardState } from '../state/WizardState';
import { escapeHtml } from '../../utils';

export function renderStep3(): string {
  const wizardState = getWizardState();

  if (wizardState.recordTypes.length === 0) {
    return `
      <div class="wizard-step">
        <h2 class="wizard-step-title">Define Fields</h2>
        <p class="wizard-step-description">
          No record types defined yet. Go back to add record types first.
        </p>
      </div>
    `;
  }

  const currentRecordIndex = wizardState.currentRecordTypeIndex || 0;
  let currentRecord = wizardState.recordTypes[currentRecordIndex];

  if (!currentRecord) {
    wizardState.currentRecordTypeIndex = 0;
    currentRecord = wizardState.recordTypes[0];
  }

  const fieldsHtml = currentRecord.fields.length === 0
    ? '<p class="wizard-empty-message">No fields defined yet. Click "Add Field" to get started.</p>'
    : currentRecord.fields.map(field => {
        // Build type display text
        let typeDisplay = field.type;
        if (field.type === 'media-url' && field.mediaType) {
          typeDisplay = `media-url (${field.mediaType})`;
        } else if (field.type === 'array-string') {
          typeDisplay = 'string[]';
        } else if (field.type === 'array-number') {
          typeDisplay = 'number[]';
        }

        return `
          <div class="wizard-list-item" data-id="${field.id}">
            <div class="wizard-list-item-header">
              <h3>${escapeHtml(field.name)}</h3>
              <span class="wizard-badge">${escapeHtml(typeDisplay)}</span>
              ${field.required ? '<span class="wizard-badge wizard-badge-required">Required</span>' : ''}
              <div class="wizard-list-item-actions">
                <button
                  type="button"
                  class="wizard-button-icon"
                  onclick="window.wizardOps.editField('${field.id}')"
                >Edit</button>
                <button
                  type="button"
                  class="wizard-button-icon wizard-button-danger"
                  onclick="window.wizardOps.deleteField('${field.id}')"
                >Delete</button>
              </div>
            </div>
            <p class="wizard-list-item-description">
              ${escapeHtml(field.description || 'No description')}
            </p>
          </div>
        `;
      }).join('');

  const recordSelector = wizardState.recordTypes.length > 1 ? `
    <div class="wizard-field">
      <label>Editing record type:</label>
      <select id="current-record-selector" class="wizard-select" onchange="window.wizardOps.changeCurrentRecord()">
        ${wizardState.recordTypes.map((record, index) => `
          <option value="${index}" ${index === currentRecordIndex ? 'selected' : ''}>
            ${escapeHtml(record.name)}
          </option>
        `).join('')}
      </select>
    </div>
  ` : '';

  return `
    <div class="wizard-step">
      <h2 class="wizard-step-title">Define Fields for "${escapeHtml(currentRecord.name)}"</h2>
      <p class="wizard-step-description">
        Add fields to describe the data in this record type.
      </p>

      ${recordSelector}

      <div class="wizard-form">
        <div id="fields-list" class="wizard-list">
          ${fieldsHtml}
        </div>

        <button
          type="button"
          id="add-field"
          class="wizard-button wizard-button-secondary"
        >
          + Add Field
        </button>
      </div>
    </div>
  `;
}

export function wireStep3Events(): void {
  const addBtn = document.getElementById('add-field');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      window.wizardOps.openFieldDialog();
    });
  }
}
