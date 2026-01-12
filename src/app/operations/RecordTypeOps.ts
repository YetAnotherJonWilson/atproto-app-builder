/**
 * CRUD operations for Record Types
 */

import { getWizardState, saveWizardState, setCurrentEditingId, getCurrentEditingId } from '../state/WizardState';
import { renderCurrentStep } from '../views/StepRenderer';
import { generateId } from '../../utils';

export function editRecordType(id: string): void {
  setCurrentEditingId(id);
  const wizardState = getWizardState();
  const record = wizardState.recordTypes.find(r => r.id === id);
  if (!record) return;

  const title = document.getElementById('edit-record-title');
  const nameInput = document.getElementById('record-name') as HTMLInputElement;
  const descInput = document.getElementById('record-description') as HTMLTextAreaElement;
  const dialog = document.getElementById('edit-record-dialog') as HTMLDialogElement;

  if (title) title.textContent = 'Edit Record Type';
  if (nameInput) nameInput.value = record.name;
  if (descInput) descInput.value = record.description;
  if (dialog) dialog.showModal();
}

export function deleteRecordType(id: string): void {
  if (!confirm('Are you sure you want to delete this record type?')) return;

  const wizardState = getWizardState();
  wizardState.recordTypes = wizardState.recordTypes.filter(r => r.id !== id);
  saveWizardState(wizardState);
  renderCurrentStep();
}

export function openRecordDialog(): void {
  setCurrentEditingId(null);

  const title = document.getElementById('edit-record-title');
  const nameInput = document.getElementById('record-name') as HTMLInputElement;
  const descInput = document.getElementById('record-description') as HTMLTextAreaElement;
  const dialog = document.getElementById('edit-record-dialog') as HTMLDialogElement;

  if (title) title.textContent = 'Add Record Type';
  if (nameInput) nameInput.value = '';
  if (descInput) descInput.value = '';
  if (dialog) dialog.showModal();
}

export function handleRecordFormSubmit(e: Event): void {
  e.preventDefault();

  const wizardState = getWizardState();
  const nameInput = document.getElementById('record-name') as HTMLInputElement;
  const descInput = document.getElementById('record-description') as HTMLTextAreaElement;
  const dialog = document.getElementById('edit-record-dialog') as HTMLDialogElement;

  const name = nameInput?.value.trim() || '';
  const description = descInput?.value.trim() || '';

  const currentEditingId = getCurrentEditingId();

  if (currentEditingId) {
    // Edit existing
    const record = wizardState.recordTypes.find(r => r.id === currentEditingId);
    if (record) {
      record.name = name;
      record.description = description;
    }
  } else {
    // Add new
    wizardState.recordTypes.push({
      id: generateId(),
      name: name,
      description: description,
      fields: []
    });
  }

  saveWizardState(wizardState);
  if (dialog) dialog.close();
  renderCurrentStep();
}
