/**
 * Wizard state management - initialization, persistence, and retrieval
 */

import type { WizardState, LoadedState } from '../../types/wizard';

const STORAGE_KEY = 'atproto-wizard-state';
const STALE_DAYS = 30;

export let wizardState: WizardState | null = null;
export let currentEditingId: string | null = null;

export function setCurrentEditingId(id: string | null): void {
  currentEditingId = id;
}

export function getCurrentEditingId(): string | null {
  return currentEditingId;
}

export function initializeWizardState(): WizardState {
  return {
    version: "1.0",
    lastSaved: new Date().toISOString(),
    currentStep: 0,
    activeSection: 'requirements',
    currentRecordTypeIndex: 0,
    appInfo: {
      appName: '',
      domain: '',
      description: '',
      authorName: ''
    },
    recordTypes: [],
    queryMethods: [],
    procedureMethods: [],
    appConfig: {
      primaryRecordType: '',
      listDisplayFields: [],
      outputMethod: 'zip'
    },
    requirements: [],
    nonDataElements: [],
    blocks: []
  };
}

export function setWizardState(state: WizardState): void {
  // Migrate: ensure activeSection exists for old saved states
  if (!state.activeSection) {
    state.activeSection = 'requirements';
  }
  // Migrate: ensure requirements array exists for old saved states
  if (!state.requirements) {
    state.requirements = [];
  }
  // Migrate: ensure nonDataElements array exists for old saved states
  if (!state.nonDataElements) {
    state.nonDataElements = [];
  }
  // Migrate: ensure blocks array exists for old saved states
  if (!state.blocks) {
    state.blocks = [];
  }
  // Migrate: ensure recordTypes have displayName and identity fields for old saved states
  if (state.recordTypes) {
    for (const rt of state.recordTypes) {
      if (!rt.displayName) {
        rt.displayName = rt.name || '';
      }
      if (!rt.source) {
        rt.source = 'new';
      }
      if (!rt.recordKeyType) {
        rt.recordKeyType = 'tid';
      }
    }
  }
  wizardState = state;
}

export function getWizardState(): WizardState {
  if (!wizardState) {
    wizardState = initializeWizardState();
  }
  return wizardState;
}

export function saveWizardState(state: WizardState): void {
  state.lastSaved = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  showSaveConfirmation();
}

export function loadWizardState(): LoadedState | null {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;

  try {
    const state = JSON.parse(saved) as WizardState;
    const savedDate = new Date(state.lastSaved);
    const daysDiff = (Date.now() - savedDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > STALE_DAYS) {
      return { state, isStale: true };
    }
    return { state, isStale: false };
  } catch (e) {
    console.error('Failed to load wizard state:', e);
    return null;
  }
}

export function clearWizardState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if state has meaningful data worth resuming.
 * Step 0 is the landing page with no user data.
 * We only consider sessions worth resuming if they're on step 2+
 * or have any actual wizard data entered.
 */
export function hasMeaningfulState(state: WizardState): boolean {
  // If we're on step 2 or higher, there's likely meaningful data
  if (state.currentStep >= 2) {
    return true;
  }

  // Even on early steps, check if any actual data was entered
  const hasAppInfo = state.appInfo.appName.trim() !== '' ||
                     state.appInfo.domain.trim() !== '' ||
                     state.appInfo.description.trim() !== '' ||
                     state.appInfo.authorName.trim() !== '';
  const hasRecordTypes = state.recordTypes.length > 0;
  const hasQueryMethods = state.queryMethods.length > 0;
  const hasProcedureMethods = state.procedureMethods.length > 0;

  const hasRequirements = (state.requirements ?? []).length > 0;

  return hasAppInfo || hasRecordTypes || hasQueryMethods || hasProcedureMethods || hasRequirements;
}

export function showSaveConfirmation(): void {
  const progressText = document.getElementById('wizard-progress-text');
  if (!progressText) return;

  const originalText = progressText.textContent;
  progressText.textContent = 'Progress saved!';
  setTimeout(() => {
    progressText.textContent = originalText;
  }, 2000);
}
