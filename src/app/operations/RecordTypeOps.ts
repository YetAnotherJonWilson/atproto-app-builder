/**
 * CRUD operations for Record Types
 */

import { getWizardState, saveWizardState, setCurrentEditingId, getCurrentEditingId } from '../state/WizardState';
import { renderCurrentStep } from '../views/StepRenderer';
import { generateId } from '../../utils';
import type { WizardState } from '../../types/wizard';

export interface RecordTypeReference {
  kind: 'requirement' | 'query' | 'procedure' | 'field';
  label: string; // human-readable description, e.g. "Requirement: Create a post"
}

/**
 * Find all references to a record type by ID across the wizard state.
 */
export function findRecordTypeReferences(
  id: string,
  state: WizardState,
): RecordTypeReference[] {
  const refs: RecordTypeReference[] = [];
  const rt = state.recordTypes.find((r) => r.id === id);

  // Requirements
  for (const req of state.requirements) {
    if (req.dataTypeId === id) {
      const desc = req.type === 'do'
        ? `"${req.verb ?? ''} ${req.data ?? ''}"`
        : `"${req.text ?? ''}"`;
      refs.push({ kind: 'requirement', label: `${desc.trim()} (in Requirements)` });
    }
    if (req.usesDataTypeId === id) {
      const desc = `"${req.verb ?? ''} ${req.data ?? ''}"`;
      refs.push({ kind: 'requirement', label: `${desc.trim()} uses this as a data source (in Requirements)` });
    }
  }

  // Queries
  for (const q of state.queryMethods) {
    if (q.returnsRecordType === id) {
      refs.push({ kind: 'query', label: `Query "${q.name}" returns this type` });
    }
  }

  // Procedures
  for (const p of state.procedureMethods) {
    if (p.inputRecordType === id) {
      refs.push({ kind: 'procedure', label: `Procedure "${p.name}" uses this as input` });
    }
    if (p.outputRecordType === id) {
      refs.push({ kind: 'procedure', label: `Procedure "${p.name}" outputs this type` });
    }
  }

  // Field ref targets in other record types
  for (const other of state.recordTypes) {
    if (other.id === id) continue;
    for (const field of other.fields) {
      if (field.refTarget === id) {
        refs.push({
          kind: 'field',
          label: `"${other.displayName}" has a field "${field.name}" that references this type`,
        });
      }
    }
  }

  return refs;
}

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
  const wizardState = getWizardState();
  const refs = findRecordTypeReferences(id, wizardState);

  if (refs.length > 0) {
    showCannotDeleteDialog(refs);
    return;
  }

  showConfirmDeleteDialog(id);
}

function performDelete(id: string): void {
  const wizardState = getWizardState();
  const rt = wizardState.recordTypes.find(r => r.id === id);
  wizardState.recordTypes = wizardState.recordTypes.filter(r => r.id !== id);

  // Auto-clear primaryRecordType if it pointed to the deleted record
  if (rt && wizardState.appConfig.primaryRecordType === rt.name) {
    wizardState.appConfig.primaryRecordType = '';
  }

  saveWizardState(wizardState);
  renderCurrentStep();
}

function showConfirmDeleteDialog(id: string): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'wizard-dialog';
  dialog.innerHTML = `
    <button type="button" class="dialog-close" id="confirm-delete-close-x">&times;</button>
    <div class="dialog-content">
      <h2>Delete data type?</h2>
      <p>This action cannot be undone.</p>
      <div class="dialog-buttons">
        <button type="button" class="dialog-button dialog-button--danger" id="confirm-delete-yes">Delete</button>
        <button type="button" class="dialog-cancel" id="confirm-delete-no">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const close = () => {
    dialog.close();
    dialog.remove();
  };

  dialog.querySelector('#confirm-delete-yes')!.addEventListener('click', () => {
    close();
    performDelete(id);
  });
  dialog.querySelector('#confirm-delete-no')!.addEventListener('click', close);
  dialog.querySelector('#confirm-delete-close-x')!.addEventListener('click', close);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  dialog.showModal();
}

function showCannotDeleteDialog(refs: RecordTypeReference[]): void {
  const refItems = refs.map((r) => `<li>${escapeHtml(r.label)}</li>`).join('');

  const dialog = document.createElement('dialog');
  dialog.className = 'wizard-dialog';
  dialog.innerHTML = `
    <button type="button" class="dialog-close" id="cannot-delete-close-x">&times;</button>
    <div class="dialog-content">
      <h2>Cannot delete data type</h2>
      <p>This data type is still being used. Remove these references first:</p>
      <ul class="cannot-delete-ref-list">${refItems}</ul>
      <div class="dialog-buttons">
        <button type="button" class="dialog-button" id="cannot-delete-ok">OK</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const close = () => {
    dialog.close();
    dialog.remove();
  };

  dialog.querySelector('#cannot-delete-close-x')!.addEventListener('click', close);
  dialog.querySelector('#cannot-delete-ok')!.addEventListener('click', close);
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
      displayName: name,
      description: description,
      fields: [],
      source: 'new',
    });
  }

  saveWizardState(wizardState);
  if (dialog) dialog.close();
  renderCurrentStep();
}
