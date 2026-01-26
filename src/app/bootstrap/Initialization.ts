/**
 * App initialization and bootstrap
 */

import {
  loadWizardState,
  setWizardState,
  initializeWizardState,
  saveWizardState,
  getWizardState,
} from '../state/WizardState';
import { collectCurrentStepData } from '../state/DataCollector';
import {
  goToNextStep,
  goToPreviousStep,
  updateProgressBar,
} from '../navigation/StepNavigation';
import { renderCurrentStep } from '../views/StepRenderer';
import { setupDialogHandlers } from '../dialogs/DialogHandlers';
import { setupWizardOps } from './WizardOps';

export function startWizard(): void {
  const wizardContainer = document.getElementById('wizard-container');
  const mainSection = document.querySelector('main div');
  const getStartedContainer = document.getElementById('get-started-container');

  if (wizardContainer) wizardContainer.style.display = 'block';
  if (mainSection) (mainSection as HTMLElement).style.display = 'none';
  if (getStartedContainer) getStartedContainer.style.display = 'none';

  renderCurrentStep();
  updateProgressBar();
  window.scrollTo(0, 0);
}

export function initializeApp(): void {
  // Setup window.wizardOps for onclick handlers
  setupWizardOps();

  // Check for saved state
  const saved = loadWizardState();

  if (saved && !saved.isStale) {
    setWizardState(saved.state);
    // Show resume dialog
    const savedDate = new Date(saved.state.lastSaved);
    const resumeDate = document.getElementById('resume-date');
    if (resumeDate) {
      resumeDate.textContent = savedDate.toLocaleString();
    }
    const dialog = document.getElementById(
      'resume-dialog'
    ) as HTMLDialogElement;
    if (dialog) dialog.showModal();
  } else {
    setWizardState(initializeWizardState());
  }

  // Setup dialog handlers
  setupDialogHandlers();

  // Wire up "Start building" button
  const startBtn = document.getElementById('start-building-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      startWizard();
    });
  }

  // Wire up navigation buttons
  const nextBtn = document.getElementById('wizard-next');
  const backBtn = document.getElementById('wizard-back');
  const saveBtn = document.getElementById('wizard-save');

  if (nextBtn) {
    nextBtn.addEventListener('click', goToNextStep);
  }
  if (backBtn) {
    backBtn.addEventListener('click', goToPreviousStep);
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      collectCurrentStepData();
      saveWizardState(getWizardState());
    });
  }
}
