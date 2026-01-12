/**
 * Dialog helper utilities
 */

import { getWizardState } from '../state/WizardState';
import { renderCurrentStep } from '../views/StepRenderer';

export function populateRecordTypeSelect(selectId: string, includeNone: boolean = false): void {
  const wizardState = getWizardState();
  const select = document.getElementById(selectId) as HTMLSelectElement;
  if (!select) return;

  const currentValue = select.value;

  select.innerHTML = '';

  if (includeNone) {
    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.textContent = 'None';
    select.appendChild(noneOption);
  }

  wizardState.recordTypes.forEach(record => {
    const option = document.createElement('option');
    option.value = record.name;
    option.textContent = record.name;
    select.appendChild(option);
  });

  if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
    select.value = currentValue;
  }
}

export function changeCurrentRecord(): void {
  const wizardState = getWizardState();
  const selector = document.getElementById('current-record-selector') as HTMLSelectElement;
  if (selector) {
    wizardState.currentRecordTypeIndex = parseInt(selector.value);
    renderCurrentStep();
  }
}
