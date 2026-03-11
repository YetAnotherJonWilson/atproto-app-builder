/**
 * Step 4: Define Query Methods
 */

import { getWizardState } from '../state/WizardState';
import { escapeHtml } from '../../utils';

export function renderStep4(): string {
  const wizardState = getWizardState();

  const queriesHtml = wizardState.queryMethods.length === 0
    ? '<p class="wizard-empty-message">No query methods defined yet. Click "Add Query" to get started.</p>'
    : wizardState.queryMethods.map(query => `
        <div class="wizard-list-item" data-id="${query.id}">
          <div class="wizard-list-item-header">
            <h3>${escapeHtml(query.name)}</h3>
            <div class="wizard-list-item-actions">
              <button
                type="button"
                class="wizard-button-icon"
                onclick="window.wizardOps.editQuery('${query.id}')"
              >Edit</button>
              <button
                type="button"
                class="wizard-button-icon wizard-button-danger"
                onclick="window.wizardOps.deleteQuery('${query.id}')"
              >Delete</button>
            </div>
          </div>
          <p class="wizard-list-item-description">
            ${escapeHtml(query.description || 'No description')}
          </p>
          <p class="wizard-list-item-meta">
            Returns: ${query.returnsList ? 'List of ' : ''}${escapeHtml(query.returnsRecordType || 'Unknown')}
          </p>
        </div>
      `).join('');

  return `
    <div class="wizard-step">
      <h2 class="wizard-step-title">Define Query Methods</h2>
      <p class="wizard-step-description">
        Queries are GET endpoints that retrieve data.
        Examples: "listTodos", "getPost", "searchBookmarks"
      </p>

      <div class="wizard-form">
        <div id="queries-list" class="wizard-list">
          ${queriesHtml}
        </div>

        <button
          type="button"
          id="add-query"
          class="wizard-button wizard-button-secondary"
        >
          + Add Query
        </button>
      </div>
    </div>
  `;
}

export function wireStep4Events(): void {
  const addBtn = document.getElementById('add-query');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      window.wizardOps.openQueryDialog();
    });
  }
}
