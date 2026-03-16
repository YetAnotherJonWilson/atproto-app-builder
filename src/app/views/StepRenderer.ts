/**
 * Main step renderer - routes to appropriate step view
 */

import { getWizardState } from '../state/WizardState';
import { setupTooltips } from '../bootstrap/Initialization';
import { renderStep0 } from './Step0';
import { renderWorkspaceLayout, wireWorkspaceLayout } from './WorkspaceLayout';
import { renderStep3, wireStep3Events } from './deprecatedStep3Fields';
import { renderStep4, wireStep4Events } from './deprecatedStep4Queries';
import { renderStep5, wireStep5Events } from './deprecatedStep5Procedures';
import { renderStep6, wireStep6Events } from './deprecatedStep6Config';
import { renderStep7, wireStep7Events } from './deprecatedStep7Generate';

export function renderCurrentStep(): void {
  const wizardState = getWizardState();
  const container = document.getElementById('wizard-step-content');
  if (!container) return;

  // Swap header text based on current step
  const headerH1 = document.querySelector('header h1');
  if (headerH1) {
    headerH1.textContent =
      wizardState.currentStep === 0 ? 'RecLaIm The Web' : 'the App Wizard';
  }

  // Toggle body class for wizard-specific layout
  document.body.classList.toggle('state-wizard', wizardState.currentStep >= 2);

  switch (wizardState.currentStep) {
    case 0:
      container.innerHTML = renderStep0();
      setupTooltips();
      break;
    case 2:
      container.innerHTML = renderWorkspaceLayout();
      wireWorkspaceLayout();
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
