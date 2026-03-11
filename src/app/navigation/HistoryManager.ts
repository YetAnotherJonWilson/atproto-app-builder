/**
 * Browser history management for wizard step navigation
 * Enables back/forward button support and URL-based step navigation
 */

import { getWizardState, saveWizardState, hasMeaningfulState } from '../state/WizardState';
import { collectCurrentStepData } from '../state/DataCollector';
import { renderCurrentStep } from '../views/StepRenderer';
import { updateProgressBar } from './StepNavigation';

const STEP_PARAM = 'step';

interface HistoryState {
  step: number;
}

/**
 * Get the step number from the current URL
 * Landing page (/) returns 0, wizard steps (/wizard?step=N) return 1-7
 */
export function getStepFromURL(): number | null {
  const { pathname, search } = window.location;

  if (pathname.startsWith('/wizard')) {
    const params = new URLSearchParams(search);
    const stepParam = params.get(STEP_PARAM);
    if (stepParam !== null) {
      const step = parseInt(stepParam, 10);
      if (!isNaN(step) && step >= 1 && step <= 7) {
        return step;
      }
    }
    return 1;
  }

  return 0;
}

/**
 * Update the URL to reflect the current step
 * Step 0 → /, Steps 1-7 → /wizard?step=N
 * Uses replaceState for initial load, pushState for navigation
 */
export function updateURLForStep(step: number, replace: boolean = false): void {
  const url = step === 0
    ? '/'
    : `/wizard?${STEP_PARAM}=${step}`;

  const historyState: HistoryState = { step };

  if (replace) {
    window.history.replaceState(historyState, '', url);
  } else {
    window.history.pushState(historyState, '', url);
  }
}

/**
 * Navigate to a specific step (used by popstate handler)
 * This bypasses validation since we're going back to a previously visited step
 */
function navigateToStep(step: number): void {
  const wizardState = getWizardState();

  // Collect data from current step before navigating away
  collectCurrentStepData();

  // Update wizard state
  wizardState.currentStep = step;
  saveWizardState(wizardState);

  // Render the new step
  renderCurrentStep();
  updateProgressBar();
  window.scrollTo(0, 0);
}

/**
 * Warn users before closing/refreshing when they have meaningful wizard data
 */
function handleBeforeUnload(event: BeforeUnloadEvent): void {
  const wizardState = getWizardState();
  if (wizardState.currentStep >= 1 && hasMeaningfulState(wizardState)) {
    event.preventDefault();
  }
}

/** Stored callback for when user confirms leaving the wizard */
let leaveWizardCallback: (() => void) | null = null;

/**
 * Show a confirmation dialog before leaving the wizard, or leave immediately
 * if there's no meaningful state to lose.
 */
export function guardedLeaveWizard(onConfirm: () => void): void {
  const wizardState = getWizardState();
  if (hasMeaningfulState(wizardState)) {
    leaveWizardCallback = onConfirm;
    const dialog = document.getElementById('leave-wizard-dialog') as HTMLDialogElement;
    dialog?.showModal();
  } else {
    onConfirm();
  }
}

/** Called when user confirms leaving the wizard */
export function confirmLeaveWizard(): void {
  const dialog = document.getElementById('leave-wizard-dialog') as HTMLDialogElement;
  dialog?.close();
  const callback = leaveWizardCallback;
  leaveWizardCallback = null;
  callback?.();
}

/** Called when user cancels leaving the wizard */
export function cancelLeaveWizard(): void {
  const dialog = document.getElementById('leave-wizard-dialog') as HTMLDialogElement;
  dialog?.close();
  leaveWizardCallback = null;
}

/**
 * Handle browser back/forward navigation
 */
function handlePopState(event: PopStateEvent): void {
  const state = event.state as HistoryState | null;
  const targetStep = state?.step ?? getStepFromURL() ?? 0;
  const wizardState = getWizardState();

  // Intercept wizard→landing back-navigation
  if (targetStep === 0 && wizardState.currentStep >= 1 && hasMeaningfulState(wizardState)) {
    // Push current step back to undo the browser back
    updateURLForStep(wizardState.currentStep, false);
    guardedLeaveWizard(() => {
      navigateToStep(0);
      updateURLForStep(0, true);
    });
    return;
  }

  navigateToStep(targetStep);
}

/**
 * Initialize history management
 * Should be called once during app initialization
 */
export function initializeHistoryManager(): void {
  // Listen for browser back/forward navigation
  window.addEventListener('popstate', handlePopState);

  // Warn before browser close/refresh when wizard has meaningful data
  // window.addEventListener('beforeunload', handleBeforeUnload);

  // Check if URL contains a step parameter and sync state
  const urlStep = getStepFromURL();
  const wizardState = getWizardState();

  if (urlStep !== null && urlStep !== wizardState.currentStep) {
    // URL has a step that differs from saved state - use URL step
    wizardState.currentStep = urlStep;
    saveWizardState(wizardState);
  }

  // Set initial history state (replace current state, don't push)
  updateURLForStep(wizardState.currentStep, true);
}

/**
 * Push a new step to browser history
 * Called when navigating via Next/Back buttons
 */
export function pushStepToHistory(step: number): void {
  updateURLForStep(step, false);
}
