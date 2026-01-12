/**
 * CRUD operations for Procedure Methods
 */

import { getWizardState, saveWizardState, setCurrentEditingId, getCurrentEditingId } from '../state/WizardState';
import { renderCurrentStep } from '../views/StepRenderer';
import { generateId } from '../../utils';
import { populateRecordTypeSelect } from '../dialogs/DialogHelpers';

export function editProcedure(id: string): void {
  setCurrentEditingId(id);
  const wizardState = getWizardState();
  const proc = wizardState.procedureMethods.find(p => p.id === id);
  if (!proc) return;

  const title = document.getElementById('edit-procedure-title');
  const nameInput = document.getElementById('procedure-name') as HTMLInputElement;
  const descInput = document.getElementById('procedure-description') as HTMLTextAreaElement;
  const inputSelect = document.getElementById('procedure-input-record') as HTMLSelectElement;
  const outputTypeSelect = document.getElementById('procedure-output-type') as HTMLSelectElement;
  const outputRecordSelect = document.getElementById('procedure-output-record') as HTMLSelectElement;
  const dialog = document.getElementById('edit-procedure-dialog') as HTMLDialogElement;

  if (title) title.textContent = 'Edit Procedure Method';
  if (nameInput) nameInput.value = proc.name;
  if (descInput) descInput.value = proc.description || '';

  populateRecordTypeSelect('procedure-input-record', true);
  populateRecordTypeSelect('procedure-output-record');

  if (inputSelect) inputSelect.value = proc.inputRecordType || '';
  if (outputTypeSelect) outputTypeSelect.value = proc.outputType;
  if (outputRecordSelect) outputRecordSelect.value = proc.outputRecordType || '';

  updateProcedureOutputOptions(proc.outputType);

  if (dialog) dialog.showModal();
}

export function deleteProcedure(id: string): void {
  if (!confirm('Are you sure you want to delete this procedure method?')) return;

  const wizardState = getWizardState();
  wizardState.procedureMethods = wizardState.procedureMethods.filter(p => p.id !== id);
  saveWizardState(wizardState);
  renderCurrentStep();
}

export function openProcedureDialog(): void {
  setCurrentEditingId(null);

  const title = document.getElementById('edit-procedure-title');
  const nameInput = document.getElementById('procedure-name') as HTMLInputElement;
  const descInput = document.getElementById('procedure-description') as HTMLTextAreaElement;
  const inputSelect = document.getElementById('procedure-input-record') as HTMLSelectElement;
  const outputTypeSelect = document.getElementById('procedure-output-type') as HTMLSelectElement;
  const outputRecordSelect = document.getElementById('procedure-output-record') as HTMLSelectElement;
  const dialog = document.getElementById('edit-procedure-dialog') as HTMLDialogElement;

  if (title) title.textContent = 'Add Procedure Method';
  if (nameInput) nameInput.value = '';
  if (descInput) descInput.value = '';
  if (inputSelect) inputSelect.value = '';
  if (outputTypeSelect) outputTypeSelect.value = 'success';
  if (outputRecordSelect) outputRecordSelect.value = '';

  populateRecordTypeSelect('procedure-input-record', true);
  populateRecordTypeSelect('procedure-output-record');
  updateProcedureOutputOptions('success');

  if (dialog) dialog.showModal();
}

export function updateProcedureOutputOptions(outputType: string): void {
  const outputRecordContainer = document.getElementById('procedure-output-record-container');
  if (outputRecordContainer) {
    outputRecordContainer.style.display = outputType === 'record' ? 'block' : 'none';
  }
}

export function handleProcedureFormSubmit(e: Event): void {
  e.preventDefault();

  const wizardState = getWizardState();
  const currentEditingId = getCurrentEditingId();

  const nameInput = document.getElementById('procedure-name') as HTMLInputElement;
  const descInput = document.getElementById('procedure-description') as HTMLTextAreaElement;
  const inputSelect = document.getElementById('procedure-input-record') as HTMLSelectElement;
  const outputTypeSelect = document.getElementById('procedure-output-type') as HTMLSelectElement;
  const outputRecordSelect = document.getElementById('procedure-output-record') as HTMLSelectElement;
  const dialog = document.getElementById('edit-procedure-dialog') as HTMLDialogElement;

  const name = nameInput?.value.trim() || '';
  const description = descInput?.value.trim() || '';
  const inputRecordType = inputSelect?.value || '';
  const outputType = (outputTypeSelect?.value || 'success') as 'success' | 'record';
  const outputRecordType = outputRecordSelect?.value || '';

  if (currentEditingId) {
    // Edit existing
    const proc = wizardState.procedureMethods.find(p => p.id === currentEditingId);
    if (proc) {
      proc.name = name;
      proc.description = description;
      proc.inputRecordType = inputRecordType || undefined;
      proc.outputType = outputType;
      proc.outputRecordType = outputType === 'record' ? outputRecordType : undefined;
    }
  } else {
    // Add new
    wizardState.procedureMethods.push({
      id: generateId(),
      name: name,
      description: description,
      inputRecordType: inputRecordType || undefined,
      outputType: outputType,
      outputRecordType: outputType === 'record' ? outputRecordType : undefined
    });
  }

  saveWizardState(wizardState);
  if (dialog) dialog.close();
  renderCurrentStep();
}
