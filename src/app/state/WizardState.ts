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
    currentStep: 1,
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
    }
  };
}

export function setWizardState(state: WizardState): void {
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

export function showSaveConfirmation(): void {
  const progressText = document.getElementById('wizard-progress-text');
  if (!progressText) return;

  const originalText = progressText.textContent;
  progressText.textContent = 'Progress saved!';
  setTimeout(() => {
    progressText.textContent = originalText;
  }, 2000);
}
