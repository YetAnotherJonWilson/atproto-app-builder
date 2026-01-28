/**
 * Step 6: App Configuration
 */

import { getWizardState } from '../state/WizardState';
import { escapeHtml } from '../../utils';

export function renderStep6(): string {
  const wizardState = getWizardState();

  // App Configuration step
  const primaryRecord = wizardState.appConfig.primaryRecordType ||
    (wizardState.recordTypes.length > 0 ? wizardState.recordTypes[0].name : '');

  const recordOptions = wizardState.recordTypes.map(record => `
    <option value="${escapeHtml(record.name)}" ${record.name === primaryRecord ? 'selected' : ''}>
      ${escapeHtml(record.name)}
    </option>
  `).join('');

  // Get fields for the primary record
  const currentPrimaryRecord = wizardState.recordTypes.find(r => r.name === primaryRecord) || wizardState.recordTypes[0];
  const fieldCheckboxes = currentPrimaryRecord ? currentPrimaryRecord.fields.map(field => {
    const checked = wizardState.appConfig.listDisplayFields.includes(field.name) ? 'checked' : '';
    return `
      <label class="wizard-checkbox-label">
        <input type="checkbox" name="list-field" value="${escapeHtml(field.name)}" ${checked} />
        ${escapeHtml(field.name)} <span class="wizard-badge">${escapeHtml(field.type)}</span>
      </label>
    `;
  }).join('') : '<p>No fields available</p>';

  return `
    <div class="wizard-step">
      <h2 class="wizard-step-title">App Configuration</h2>
      <p class="wizard-step-description">
        Configure how your app will display and interact with your data.
      </p>

      <div class="wizard-form">
        <div class="wizard-field">
          <label for="primary-record">Primary Record Type *</label>
          <select id="primary-record" class="wizard-select" required>
            ${recordOptions}
          </select>
          <span class="wizard-field-help">
            This is the main data type your app will display in the list view.
          </span>
        </div>

        <div class="wizard-field">
          <label>Fields to Display in List</label>
          <div id="list-fields-container" class="wizard-checkbox-group">
            ${fieldCheckboxes}
          </div>
          <span class="wizard-field-help">
            Select which fields to show when viewing the list of records.
          </span>
        </div>
      </div>
    </div>
  `;
}

export function wireStep6Events(): void {
  const wizardState = getWizardState();

  // Update field checkboxes when primary record changes
  const primaryRecord = document.getElementById('primary-record');
  if (primaryRecord) {
    primaryRecord.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const selectedRecord = wizardState.recordTypes.find(r => r.name === target.value);
      if (selectedRecord) {
        const container = document.getElementById('list-fields-container');
        if (container) {
          container.innerHTML = selectedRecord.fields.map(field => `
            <label class="wizard-checkbox-label">
              <input type="checkbox" name="list-field" value="${escapeHtml(field.name)}" />
              ${escapeHtml(field.name)} <span class="wizard-badge">${escapeHtml(field.type)}</span>
            </label>
          `).join('');
        }
      }
    });
  }
}
