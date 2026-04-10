/**
 * Browser history management for section-based wizard navigation.
 *
 * URL scheme:
 *   /                        → landing page
 *   /wizard?section=<name>   → wizard on the given section
 *
 * Each sidebar section switch pushes a new history entry. Browser back/
 * forward cycles through visited sections and eventually returns to the
 * landing page. Back navigation from the wizard to the landing page is
 * gated by the `guardedLeaveWizard` confirmation dialog when the wizard
 * has meaningful state.
 *
 * Legacy `?step=N` URLs (from before Phase 7) are silently redirected to
 * the canonical `?section=<name>` form via `history.replaceState`.
 */

import {
  getWizardState,
  saveWizardState,
  hasMeaningfulState,
} from '../state/WizardState';
import { renderCurrentStep } from '../views/StepRenderer';
import {
  switchSection,
  transitionToWizard,
  transitionToLanding,
} from '../views/WorkspaceLayout';
import type { SectionName } from '../../types/wizard';

const SECTION_PARAM = 'section';
const VALID_SECTIONS: readonly SectionName[] = [
  'requirements',
  'data',
  'components',
  'views',
  'generate',
];
const DEFAULT_SECTION: SectionName = 'requirements';

type LocationTarget =
  | { kind: 'landing' }
  | { kind: 'wizard'; section: SectionName | null };

/** Parse the current URL into a location target. */
function parseLocation(): LocationTarget {
  const { pathname, search } = window.location;
  if (!pathname.startsWith('/wizard')) {
    return { kind: 'landing' };
  }
  const params = new URLSearchParams(search);
  const sectionParam = params.get(SECTION_PARAM);
  const section = isValidSection(sectionParam) ? sectionParam : null;
  return { kind: 'wizard', section };
}

function isValidSection(value: string | null): value is SectionName {
  return value !== null && (VALID_SECTIONS as readonly string[]).includes(value);
}

/** Resolve a section from a URL parse, falling back to saved state or default. */
function resolveSection(fromUrl: SectionName | null): SectionName {
  if (fromUrl) return fromUrl;
  const saved = getWizardState().activeSection;
  return saved ?? DEFAULT_SECTION;
}

/** Build the canonical URL for a wizard section. */
function sectionUrl(section: SectionName): string {
  return `/wizard?${SECTION_PARAM}=${section}`;
}

/** Push a new history entry for the given section. */
export function pushSectionToHistory(section: SectionName): void {
  window.history.pushState({ section }, '', sectionUrl(section));
}

/** Replace the current history entry with the given section (no new entry). */
export function replaceSectionInHistory(section: SectionName): void {
  window.history.replaceState({ section }, '', sectionUrl(section));
}

/** Push a new history entry for the landing page. */
export function pushLandingToHistory(): void {
  window.history.pushState({ landing: true }, '', '/');
}

/** Replace the current history entry with the landing URL. */
export function replaceLandingInHistory(): void {
  window.history.replaceState({ landing: true }, '', '/');
}

// --- Leave-wizard confirmation dialog ---

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

// --- popstate handler ---

function handlePopState(_event: PopStateEvent): void {
  const target = parseLocation();
  const wizardState = getWizardState();

  if (target.kind === 'landing') {
    if (wizardState.currentStep >= 2) {
      // URL just became "/" because the user pressed back from a wizard
      // section. Immediately push the current section URL to "undo" that
      // navigation, so a cancel leaves the user where they were.
      pushSectionToHistory(wizardState.activeSection);
      guardedLeaveWizard(() => {
        transitionToLanding(() => {
          wizardState.currentStep = 0;
          saveWizardState(wizardState);
          renderCurrentStep();
          pushLandingToHistory();
        });
      });
    }
    return;
  }

  // target.kind === 'wizard'
  const targetSection = resolveSection(target.section);

  if (wizardState.currentStep < 2) {
    // History forward from landing into the wizard.
    transitionToWizard(() => {
      wizardState.currentStep = 2;
      wizardState.activeSection = targetSection;
      saveWizardState(wizardState);
      renderCurrentStep();
    });
    return;
  }

  // Already in the wizard — switch sections without pushing history
  // (the URL change already happened via popstate).
  switchSection(targetSection, { skipHistory: true });
}

/**
 * Initialize history management.
 * Must be called once during app initialization, before renderCurrentStep().
 *
 * Parses the current URL, syncs `currentStep` and `activeSection` in state,
 * and stamps the canonical URL via `history.replaceState`. Handles legacy
 * `?step=N` URLs and invalid/missing `?section` values by falling back to
 * the saved section or the default.
 */
export function initializeHistoryManager(): void {
  window.addEventListener('popstate', handlePopState);

  const target = parseLocation();
  const wizardState = getWizardState();

  if (target.kind === 'landing') {
    wizardState.currentStep = 0;
    replaceLandingInHistory();
  } else {
    const section = resolveSection(target.section);
    wizardState.currentStep = 2;
    wizardState.activeSection = section;
    replaceSectionInHistory(section);
  }
  saveWizardState(wizardState);
}
