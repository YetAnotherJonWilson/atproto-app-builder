/**
 * Wizard entry and exit — transitions between the landing page and the
 * wizard workspace. The wizard no longer has linear step navigation; see
 * `WorkspaceLayout.switchSection` and `HistoryManager` for in-wizard
 * navigation.
 */

import { getWizardState, saveWizardState } from '../state/WizardState';
import { renderCurrentStep } from '../views/StepRenderer';
import { transitionToWizard, transitionToLanding } from '../views/WorkspaceLayout';
import { promptForAppName } from '../dialogs/AppNameDialog';
import {
  pushSectionToHistory,
  pushLandingToHistory,
  guardedLeaveWizard,
} from './HistoryManager';

/**
 * Transition from the landing page into the wizard workspace.
 * Prompts for an app name if one hasn't been set yet.
 */
export async function enterWizard(): Promise<void> {
  const wizardState = getWizardState();

  if (wizardState.currentStep >= 2) return; // already in wizard

  if (!wizardState.appInfo.appName.trim()) {
    const name = await promptForAppName();
    if (!name) return; // user cancelled
    wizardState.appInfo.appName = name;
  }

  transitionToWizard(() => {
    wizardState.currentStep = 2;
    saveWizardState(wizardState);
    renderCurrentStep();
    pushSectionToHistory(wizardState.activeSection);
  });
}

/**
 * Transition from the wizard back to the landing page, gated by the
 * leave-wizard confirmation dialog if the state is non-empty.
 */
export function leaveWizard(): void {
  const wizardState = getWizardState();
  if (wizardState.currentStep === 0) return;

  guardedLeaveWizard(() => {
    transitionToLanding(() => {
      wizardState.currentStep = 0;
      saveWizardState(wizardState);
      renderCurrentStep();
      pushLandingToHistory();
    });
  });
}
