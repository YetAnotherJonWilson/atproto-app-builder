/**
 * Step navigation for the wizard
 */

import { getWizardState, saveWizardState } from '../state/WizardState';
import { collectCurrentStepData } from '../state/DataCollector';
import { validateCurrentStep } from '../validation/StepValidator';
import { renderCurrentStep } from '../views/StepRenderer';
import { generateApp } from '../export/OutputGenerator';

const STEP_NAMES = [
  'App Information',
  'Record Types',
  'Record Fields',
  'Query Methods',
  'Procedure Methods',
  'App Configuration',
  'Generate App',
];

export function goToNextStep(): void {
  const wizardState = getWizardState();
  const errors = validateCurrentStep();

  if (errors.length > 0) {
    alert('Please fix the following errors:\n\n' + errors.join('\n'));
    return;
  }

  collectCurrentStepData();

  if (wizardState.currentStep < 7) {
    wizardState.currentStep++;
    saveWizardState(wizardState);
    renderCurrentStep();
    updateProgressBar();
  } else {
    // Final step - generate app
    generateApp();
  }
}

export function goToPreviousStep(): void {
  const wizardState = getWizardState();

  if (wizardState.currentStep > 0) {
    collectCurrentStepData();
    wizardState.currentStep--;
    saveWizardState(wizardState);
    renderCurrentStep();
    updateProgressBar();
  }
}

export function updateProgressBar(): void {
  const wizardState = getWizardState();
  const progress = ((wizardState.currentStep - 1) / 6) * 100;

  const progressFill = document.getElementById('wizard-progress-fill');
  if (progressFill) {
    progressFill.style.width = progress + '%';
  }

  const progressText = document.getElementById('wizard-progress-text');
  if (progressText) {
    progressText.textContent = `Step ${wizardState.currentStep} of 7: ${
      STEP_NAMES[wizardState.currentStep - 1]
    }`;
  }

  // Update button states
  const backBtn = document.getElementById('wizard-back') as HTMLButtonElement;
  if (backBtn) {
    backBtn.disabled = wizardState.currentStep === 0;
  }

  const nextBtn = document.getElementById('wizard-next');
  if (nextBtn) {
    nextBtn.textContent =
      wizardState.currentStep === 7 ? 'Generate App' : 'Next';
  }
}
