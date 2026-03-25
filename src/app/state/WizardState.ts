/**
 * Wizard state management - initialization, persistence, and retrieval
 */

import type { WizardState, LoadedState } from '../../types/wizard';
import { generateId } from '../../utils/id';

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
    blocks: [],
    views: [{ id: generateId(), name: 'Home', blockIds: [] }],
    hasGenerated: false,
    hasSeenWelcome: false
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
  // Migrate: ensure hasGenerated exists for old saved states
  if (state.hasGenerated === undefined) {
    state.hasGenerated = false;
  }
  // Migrate: ensure hasSeenWelcome exists for old saved states
  if (state.hasSeenWelcome === undefined) {
    state.hasSeenWelcome = false;
  }
  // Migrate: ensure views array exists with seeded Home view for old saved states
  if (!state.views || state.views.length === 0) {
    state.views = [{ id: generateId(), name: 'Home', blockIds: [] }];
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
  // Migrate: convert old do-requirement fields to new description + dataTypeIds format
  if (state.requirements) {
    for (const req of state.requirements) {
      if (req.type !== 'do') continue;
      const legacy = req as unknown as Record<string, unknown>;

      // verb + data → description
      if (legacy.verb !== undefined && legacy.description === undefined) {
        const verb = (legacy.verb as string) || '';
        const data = (legacy.data as string) || '';
        req.description = (verb + (data ? ` ${data}` : '')).trim();
        delete legacy.verb;
        delete legacy.data;
      }

      // dataTypeId (single) → dataTypeIds (array)
      if (legacy.dataTypeId !== undefined && req.dataTypeIds === undefined) {
        const ids: string[] = [];
        if (legacy.dataTypeId) ids.push(legacy.dataTypeId as string);
        // Merge usesDataTypeId into the array if present and not duplicate
        if (legacy.usesDataTypeId && !ids.includes(legacy.usesDataTypeId as string)) {
          ids.push(legacy.usesDataTypeId as string);
        }
        req.dataTypeIds = ids;
        delete legacy.dataTypeId;
      } else if (legacy.usesDataTypeId !== undefined && !legacy.dataTypeId) {
        // Element-only requirement with usesDataTypeId but no dataTypeId
        const ids = req.dataTypeIds ?? [];
        if (!ids.includes(legacy.usesDataTypeId as string)) {
          ids.push(legacy.usesDataTypeId as string);
        }
        req.dataTypeIds = ids;
      }

      // Clean up removed fields
      delete legacy.interactionTarget;
      delete legacy.usesDataTypeId;
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
