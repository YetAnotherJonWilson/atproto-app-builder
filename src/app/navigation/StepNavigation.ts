/**
 * Step navigation for the wizard
 */

import { getWizardState, saveWizardState } from '../state/WizardState';
import { collectCurrentStepData } from '../state/DataCollector';
import { validateCurrentStep } from '../validation/StepValidator';
import { renderCurrentStep } from '../views/StepRenderer';
import { generateApp } from '../export/OutputGenerator';
import { pushStepToHistory, guardedLeaveWizard } from './HistoryManager';
import { transitionToWizard } from '../views/WorkspaceLayout';

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

  if (wizardState.currentStep === 0) {
    // Animated transition from landing to wizard
    transitionToWizard(() => {
      wizardState.currentStep = 2;
      saveWizardState(wizardState);
      renderCurrentStep();
      pushStepToHistory(wizardState.currentStep);
      updateProgressBar();
    });
    return;
  }

  if (wizardState.currentStep < 7) {
    wizardState.currentStep++;
    if (wizardState.currentStep >= 2) {
      saveWizardState(wizardState);
    }
    renderCurrentStep();
    pushStepToHistory(wizardState.currentStep);
    updateProgressBar();
    window.scrollTo(0, 0);
  } else {
    // Final step - generate app
    generateApp();
  }
}

export function goToPreviousStep(): void {
  const wizardState = getWizardState();

  if (wizardState.currentStep <= 0) return;

  // Step 2 → 0: guard against leaving wizard with unsaved progress
  if (wizardState.currentStep === 2) {
    collectCurrentStepData();
    guardedLeaveWizard(() => {
      wizardState.currentStep = 0;
      renderCurrentStep();
      pushStepToHistory(0);
      updateProgressBar();
      window.scrollTo(0, 0);
    });
    return;
  }

  collectCurrentStepData();
  wizardState.currentStep--;
  if (wizardState.currentStep >= 2) {
    saveWizardState(wizardState);
  }
  renderCurrentStep();
  pushStepToHistory(wizardState.currentStep);
  updateProgressBar();
  window.scrollTo(0, 0);
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
    backBtn.style.display = wizardState.currentStep > 0 ? '' : 'none';
  }

  const nextBtn = document.getElementById('wizard-next');
  if (nextBtn) {
    if (wizardState.currentStep === 0) {
      nextBtn.textContent = 'Start Building \u2192';
    } else if (wizardState.currentStep === 7) {
      nextBtn.textContent = 'Generate App';
    } else {
      nextBtn.textContent = 'Next';
    }
    nextBtn.classList.toggle('wizard-solo', wizardState.currentStep === 0);
  }

}
