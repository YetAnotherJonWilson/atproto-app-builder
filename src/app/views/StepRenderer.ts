/**
 * Main step renderer - routes to appropriate step view
 */

import { getWizardState } from '../state/WizardState';
import { renderStep1 } from './Step1GettingStarted';
// import { renderStep1 } from './deprecatedStep1AppInfo';
import { renderStep2, wireStep2Events } from './deprecatedStep2RecordTypes';
import { renderStep3, wireStep3Events } from './deprecatedStep3Fields';
import { renderStep4, wireStep4Events } from './deprecatedStep4Queries';
import { renderStep5, wireStep5Events } from './deprecatedStep5Procedures';
import { renderStep6, wireStep6Events } from './deprecatedStep6Config';
import { renderStep7, wireStep7Events } from './deprecatedStep7Generate';

export function renderCurrentStep(): void {
  const wizardState = getWizardState();
  const container = document.getElementById('wizard-step-content');
  if (!container) return;

  switch (wizardState.currentStep) {
    case 1:
      container.innerHTML = renderStep1();
      break;
    case 2:
      container.innerHTML = renderStep2();
      wireStep2Events();
      break;
    case 3:
      container.innerHTML = renderStep3();
      wireStep3Events();
      break;
    case 4:
      container.innerHTML = renderStep4();
      wireStep4Events();
      break;
    case 5:
      container.innerHTML = renderStep5();
      wireStep5Events();
      break;
    case 6:
      container.innerHTML = renderStep6();
      wireStep6Events();
      break;
    case 7:
      container.innerHTML = renderStep7();
      wireStep7Events();
      break;
  }
}
