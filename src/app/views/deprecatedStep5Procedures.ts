/**
 * Step 5: Define Procedure Methods
 */

import { getWizardState } from '../state/WizardState';
import { escapeHtml } from '../../utils';

export function renderStep5(): string {
  const wizardState = getWizardState();

  const proceduresHtml = wizardState.procedureMethods.length === 0
    ? '<p class="wizard-empty-message">No procedure methods defined yet. Click "Add Procedure" to get started.</p>'
    : wizardState.procedureMethods.map(proc => `
        <div class="wizard-list-item" data-id="${proc.id}">
          <div class="wizard-list-item-header">
            <h3>${escapeHtml(proc.name)}</h3>
            <div class="wizard-list-item-actions">
              <button
                type="button"
                class="wizard-button-icon"
                onclick="window.wizardOps.editProcedure('${proc.id}')"
              >Edit</button>
              <button
                type="button"
                class="wizard-button-icon wizard-button-danger"
                onclick="window.wizardOps.deleteProcedure('${proc.id}')"
              >Delete</button>
            </div>
          </div>
          <p class="wizard-list-item-description">
            ${escapeHtml(proc.description || 'No description')}
          </p>
          <p class="wizard-list-item-meta">
            Input: ${escapeHtml(proc.inputRecordType || 'None')} |
            Output: ${proc.outputType === 'record' ? escapeHtml(proc.outputRecordType || 'Unknown') : proc.outputType}
          </p>
        </div>
      `).join('');

  return `
    <div class="wizard-step">
      <h2 class="wizard-step-title">Define Procedure Methods</h2>
      <p class="wizard-step-description">
        Procedures are POST endpoints that create, update, or delete data.
        Examples: "createTodo", "updatePost", "deleteBookmark"
      </p>

      <div class="wizard-form">
        <div id="procedures-list" class="wizard-list">
          ${proceduresHtml}
        </div>

        <button
          type="button"
          id="add-procedure"
          class="wizard-button wizard-button-secondary"
        >
          + Add Procedure
        </button>
      </div>
    </div>
  `;
}

export function wireStep5Events(): void {
  const addBtn = document.getElementById('add-procedure');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      window.wizardOps.openProcedureDialog();
    });
  }
}
