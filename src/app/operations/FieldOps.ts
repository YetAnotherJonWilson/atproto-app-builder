/**
 * CRUD operations for Fields
 */

import { getWizardState, saveWizardState, setCurrentEditingId, getCurrentEditingId } from '../state/WizardState';
import { renderCurrentStep } from '../views/StepRenderer';
import { generateId } from '../../utils';

export function editField(id: string): void {
  const wizardState = getWizardState();
  const currentRecord = wizardState.recordTypes[wizardState.currentRecordTypeIndex];
  const field = currentRecord?.fields.find(f => f.id === id);
  if (!field) return;

  setCurrentEditingId(id);

  const title = document.getElementById('edit-field-title');
  const nameInput = document.getElementById('field-name') as HTMLInputElement;
  const typeSelect = document.getElementById('field-type') as HTMLSelectElement;
  const formatSelect = document.getElementById('field-format') as HTMLSelectElement;
  const maxlengthInput = document.getElementById('field-maxlength') as HTMLInputElement;
  const mediaTypeSelect = document.getElementById('field-media-type') as HTMLSelectElement;
  const descInput = document.getElementById('field-description') as HTMLTextAreaElement;
  const requiredCheck = document.getElementById('field-required') as HTMLInputElement;
  const dialog = document.getElementById('edit-field-dialog') as HTMLDialogElement;

  if (title) title.textContent = 'Edit Field';
  if (nameInput) nameInput.value = field.name;
  if (typeSelect) typeSelect.value = field.type;
  if (formatSelect) formatSelect.value = field.format || '';
  if (maxlengthInput) maxlengthInput.value = field.maxLength?.toString() || '';
  if (mediaTypeSelect) mediaTypeSelect.value = field.mediaType || 'image';
  if (descInput) descInput.value = field.description || '';
  if (requiredCheck) requiredCheck.checked = field.required;

  // Show/hide type-specific fields
  updateFieldTypeOptions(field.type);

  if (dialog) dialog.showModal();
}

export function deleteField(id: string): void {
  if (!confirm('Are you sure you want to delete this field?')) return;

  const wizardState = getWizardState();
  const currentRecord = wizardState.recordTypes[wizardState.currentRecordTypeIndex];
  if (currentRecord) {
    currentRecord.fields = currentRecord.fields.filter(f => f.id !== id);
    saveWizardState(wizardState);
    renderCurrentStep();
  }
}

export function openFieldDialog(): void {
  setCurrentEditingId(null);

  const title = document.getElementById('edit-field-title');
  const nameInput = document.getElementById('field-name') as HTMLInputElement;
  const typeSelect = document.getElementById('field-type') as HTMLSelectElement;
  const formatSelect = document.getElementById('field-format') as HTMLSelectElement;
  const maxlengthInput = document.getElementById('field-maxlength') as HTMLInputElement;
  const mediaTypeSelect = document.getElementById('field-media-type') as HTMLSelectElement;
  const descInput = document.getElementById('field-description') as HTMLTextAreaElement;
  const requiredCheck = document.getElementById('field-required') as HTMLInputElement;
  const dialog = document.getElementById('edit-field-dialog') as HTMLDialogElement;

  if (title) title.textContent = 'Add Field';
  if (nameInput) nameInput.value = '';
  if (typeSelect) typeSelect.value = 'string';
  if (formatSelect) formatSelect.value = '';
  if (maxlengthInput) maxlengthInput.value = '';
  if (mediaTypeSelect) mediaTypeSelect.value = 'image';
  if (descInput) descInput.value = '';
  if (requiredCheck) requiredCheck.checked = false;

  updateFieldTypeOptions('string');

  if (dialog) dialog.showModal();
}

export function updateFieldTypeOptions(type: string): void {
  const formatContainer = document.getElementById('field-format-container');
  const maxlengthContainer = document.getElementById('field-maxlength-container');
  const mediaTypeContainer = document.getElementById('field-media-type-container');

  // Reset all
  if (formatContainer) formatContainer.style.display = 'none';
  if (maxlengthContainer) maxlengthContainer.style.display = 'none';
  if (mediaTypeContainer) mediaTypeContainer.style.display = 'none';

  if (type === 'string') {
    if (formatContainer) formatContainer.style.display = 'block';
    if (maxlengthContainer) maxlengthContainer.style.display = 'block';
  } else if (type === 'media-url') {
    if (mediaTypeContainer) mediaTypeContainer.style.display = 'block';
  }
  // Array types don't need additional options for now
}

export function handleFieldFormSubmit(e: Event): void {
  e.preventDefault();

  const wizardState = getWizardState();
  const currentEditingId = getCurrentEditingId();

  const nameInput = document.getElementById('field-name') as HTMLInputElement;
  const typeSelect = document.getElementById('field-type') as HTMLSelectElement;
  const formatSelect = document.getElementById('field-format') as HTMLSelectElement;
  const maxlengthInput = document.getElementById('field-maxlength') as HTMLInputElement;
  const mediaTypeSelect = document.getElementById('field-media-type') as HTMLSelectElement;
  const descInput = document.getElementById('field-description') as HTMLTextAreaElement;
  const requiredCheck = document.getElementById('field-required') as HTMLInputElement;
  const dialog = document.getElementById('edit-field-dialog') as HTMLDialogElement;

  const name = nameInput?.value.trim() || '';
  const type = typeSelect?.value || 'string';
  const format = formatSelect?.value || '';
  const maxLength = maxlengthInput?.value || '';
  const mediaType = mediaTypeSelect?.value || 'image';
  const description = descInput?.value.trim() || '';
  const required = requiredCheck?.checked || false;

  const currentRecord = wizardState.recordTypes[wizardState.currentRecordTypeIndex];

  if (currentEditingId) {
    // Edit existing
    const field = currentRecord?.fields.find(f => f.id === currentEditingId);
    if (field) {
      field.name = name;
      field.type = type;
      field.format = type === 'string' ? (format || undefined) : undefined;
      field.maxLength = type === 'string' && maxLength ? parseInt(maxLength) : undefined;
      field.mediaType = type === 'media-url' ? mediaType : undefined;
      field.description = description;
      field.required = required;
    }
  } else {
    // Add new
    currentRecord?.fields.push({
      id: generateId(),
      name: name,
      type: type,
      format: type === 'string' ? (format || undefined) : undefined,
      maxLength: type === 'string' && maxLength ? parseInt(maxLength) : undefined,
      mediaType: type === 'media-url' ? mediaType : undefined,
      description: description,
      required: required
    });
  }

  saveWizardState(wizardState);
  if (dialog) dialog.close();
  renderCurrentStep();
}
