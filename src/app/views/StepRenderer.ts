/**
 * Main renderer — dispatches between the landing page (Step 0) and the
 * wizard workspace layout based on `currentStep` (0 or 2). Steps 3–7 no
 * longer exist; all in-wizard navigation flows through
 * `WorkspaceLayout.switchSection`.
 */

import { getWizardState } from '../state/WizardState';
import { setupTooltips } from '../bootstrap/Initialization';
import { renderStep0 } from './Step0';
import { renderWorkspaceLayout, wireWorkspaceLayout } from './WorkspaceLayout';

export function renderCurrentStep(): void {
  const wizardState = getWizardState();
  const container = document.getElementById('wizard-step-content');
  if (!container) return;

  // Swap header text based on whether we're on the landing page
  const headerH1 = document.querySelector('header h1');
  if (headerH1) {
    headerH1.textContent =
      wizardState.currentStep === 0 ? 'RecLaIm The Web' : 'the App Wizard';
  }

  // Toggle body class for wizard-specific layout
  document.body.classList.toggle('state-wizard', wizardState.currentStep >= 2);

  if (wizardState.currentStep >= 2) {
    container.innerHTML = renderWorkspaceLayout();
    wireWorkspaceLayout();
  } else {
    container.innerHTML = renderStep0();
    setupTooltips();
  }
}
