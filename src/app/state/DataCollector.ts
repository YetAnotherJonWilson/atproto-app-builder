/**
 * Data collection from wizard forms
 */

import { getWizardState } from './WizardState';

export function collectCurrentStepData(): void {
  const wizardState = getWizardState();

  switch (wizardState.currentStep) {
    case 1:
      collectStep1Data();
      break;
    case 6:
      collectStep6Data();
      break;
    case 7:
      collectStep7Data();
      break;
    // Steps 2-5 collect data through dialogs/events
  }
}

function collectStep1Data(): void {
  const wizardState = getWizardState();
  const appName = document.getElementById('app-name') as HTMLInputElement;
  const domain = document.getElementById('app-domain') as HTMLInputElement;
  const description = document.getElementById('app-description') as HTMLTextAreaElement;
  const authorName = document.getElementById('author-name') as HTMLInputElement;

  if (appName) wizardState.appInfo.appName = appName.value;
  if (domain) wizardState.appInfo.domain = domain.value;
  if (description) wizardState.appInfo.description = description.value;
  if (authorName) wizardState.appInfo.authorName = authorName.value;
}

function collectStep6Data(): void {
  const wizardState = getWizardState();
  const primaryRecord = document.getElementById('primary-record') as HTMLSelectElement;
  const checkboxes = document.querySelectorAll('input[name="list-field"]:checked');

  if (primaryRecord) {
    wizardState.appConfig.primaryRecordType = primaryRecord.value;
  }
  wizardState.appConfig.listDisplayFields = Array.from(checkboxes).map(
    (cb) => (cb as HTMLInputElement).value
  );
}

function collectStep7Data(): void {
  const wizardState = getWizardState();
  const outputMethod = document.querySelector('input[name="output-method"]:checked') as HTMLInputElement;

  wizardState.appConfig.outputMethod = outputMethod
    ? (outputMethod.value as 'zip' | 'github')
    : 'zip';
}
