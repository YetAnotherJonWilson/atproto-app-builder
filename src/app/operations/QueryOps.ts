/**
 * CRUD operations for Query Methods
 */

import { getWizardState, saveWizardState, setCurrentEditingId, getCurrentEditingId } from '../state/WizardState';
import { renderCurrentStep } from '../views/StepRenderer';
import { generateId } from '../../utils';
import { populateRecordTypeSelect } from '../dialogs/DialogHelpers';

export function editQuery(id: string): void {
  setCurrentEditingId(id);
  const wizardState = getWizardState();
  const query = wizardState.queryMethods.find(q => q.id === id);
  if (!query) return;

  const title = document.getElementById('edit-query-title');
  const nameInput = document.getElementById('query-name') as HTMLInputElement;
  const descInput = document.getElementById('query-description') as HTMLTextAreaElement;
  const returnsSelect = document.getElementById('query-returns-record') as HTMLSelectElement;
  const listCheck = document.getElementById('query-returns-list') as HTMLInputElement;
  const dialog = document.getElementById('edit-query-dialog') as HTMLDialogElement;

  if (title) title.textContent = 'Edit Query Method';
  if (nameInput) nameInput.value = query.name;
  if (descInput) descInput.value = query.description || '';

  populateRecordTypeSelect('query-returns-record');
  if (returnsSelect) returnsSelect.value = query.returnsRecordType;
  if (listCheck) listCheck.checked = query.returnsList;

  if (dialog) dialog.showModal();
}

export function deleteQuery(id: string): void {
  if (!confirm('Are you sure you want to delete this query method?')) return;

  const wizardState = getWizardState();
  wizardState.queryMethods = wizardState.queryMethods.filter(q => q.id !== id);
  saveWizardState(wizardState);
  renderCurrentStep();
}

export function openQueryDialog(): void {
  setCurrentEditingId(null);

  const title = document.getElementById('edit-query-title');
  const nameInput = document.getElementById('query-name') as HTMLInputElement;
  const descInput = document.getElementById('query-description') as HTMLTextAreaElement;
  const listCheck = document.getElementById('query-returns-list') as HTMLInputElement;
  const dialog = document.getElementById('edit-query-dialog') as HTMLDialogElement;

  if (title) title.textContent = 'Add Query Method';
  if (nameInput) nameInput.value = '';
  if (descInput) descInput.value = '';
  if (listCheck) listCheck.checked = true;

  populateRecordTypeSelect('query-returns-record');

  if (dialog) dialog.showModal();
}

export function handleQueryFormSubmit(e: Event): void {
  e.preventDefault();

  const wizardState = getWizardState();
  const currentEditingId = getCurrentEditingId();

  const nameInput = document.getElementById('query-name') as HTMLInputElement;
  const descInput = document.getElementById('query-description') as HTMLTextAreaElement;
  const returnsSelect = document.getElementById('query-returns-record') as HTMLSelectElement;
  const listCheck = document.getElementById('query-returns-list') as HTMLInputElement;
  const dialog = document.getElementById('edit-query-dialog') as HTMLDialogElement;

  const name = nameInput?.value.trim() || '';
  const description = descInput?.value.trim() || '';
  const returnsRecordType = returnsSelect?.value || '';
  const returnsList = listCheck?.checked || false;

  if (currentEditingId) {
    // Edit existing
    const query = wizardState.queryMethods.find(q => q.id === currentEditingId);
    if (query) {
      query.name = name;
      query.description = description;
      query.returnsRecordType = returnsRecordType;
      query.returnsList = returnsList;
    }
  } else {
    // Add new
    wizardState.queryMethods.push({
      id: generateId(),
      name: name,
      description: description,
      returnsRecordType: returnsRecordType,
      returnsList: returnsList
    });
  }

  saveWizardState(wizardState);
  if (dialog) dialog.close();
  renderCurrentStep();
}
