/**
 * Wizard state management - initialization, persistence, and retrieval
 */

import type { WizardState, LoadedState, ContentNode, TextVariant } from '../../types/wizard';
import { generateId } from '../../utils/id';

const STORAGE_KEY = 'atproto-wizard-state';
const STALE_DAYS = 30;

export let wizardState: WizardState | null = null;
export let currentEditingId: string | null = null;

// --- PDS project tracking (persisted in localStorage) ---
const ACTIVE_RKEY_KEY = 'atproto-wizard-active-rkey';
const LAST_PDS_SAVE_KEY = 'atproto-wizard-last-pds-save';
const PDS_CONTENT_HASH_KEY = 'atproto-wizard-pds-content-hash';

let activeProjectRkey: string | null = localStorage.getItem(ACTIVE_RKEY_KEY);
let lastPdsSaveTimestamp: string | null = localStorage.getItem(LAST_PDS_SAVE_KEY);
let lastPdsContentHash: string | null = localStorage.getItem(PDS_CONTENT_HASH_KEY);
let _isLoggedIn = false;

export function getActiveProjectRkey(): string | null {
  return activeProjectRkey;
}

export function setActiveProjectRkey(rkey: string | null): void {
  activeProjectRkey = rkey;
  if (rkey) {
    localStorage.setItem(ACTIVE_RKEY_KEY, rkey);
  } else {
    localStorage.removeItem(ACTIVE_RKEY_KEY);
  }
}

export function getLastPdsSaveTimestamp(): string | null {
  return lastPdsSaveTimestamp;
}

export function setLastPdsSaveTimestamp(ts: string | null): void {
  lastPdsSaveTimestamp = ts;
  if (ts) {
    localStorage.setItem(LAST_PDS_SAVE_KEY, ts);
  } else {
    localStorage.removeItem(LAST_PDS_SAVE_KEY);
  }
}

/**
 * Serialize the content-bearing fields of a WizardState into a stable
 * string for comparison. Excludes UI/navigation state that changes
 * during normal browsing without affecting the saved project:
 * `lastSaved`, `currentStep`, `activeSection`, `currentRecordTypeIndex`,
 * `hasSeenWelcome`.
 */
export function getContentFingerprint(state: WizardState): string {
  const {
    lastSaved: _lastSaved,
    currentStep: _currentStep,
    activeSection: _activeSection,
    currentRecordTypeIndex: _currentRecordTypeIndex,
    hasSeenWelcome: _hasSeenWelcome,
    ...content
  } = state;
  return JSON.stringify(content);
}

/**
 * Snapshot the current state content so we can detect real changes later.
 * Call this after every successful PDS save or load.
 */
export function snapshotPdsContent(state: WizardState): void {
  lastPdsContentHash = getContentFingerprint(state);
  localStorage.setItem(PDS_CONTENT_HASH_KEY, lastPdsContentHash);
}

export function clearPdsContentSnapshot(): void {
  lastPdsContentHash = null;
  localStorage.removeItem(PDS_CONTENT_HASH_KEY);
}

export function setLoggedIn(loggedIn: boolean): void {
  _isLoggedIn = loggedIn;
}

export function isLoggedIn(): boolean {
  return _isLoggedIn;
}

/**
 * Check if the current project has unsaved PDS changes.
 * Compares actual content (not timestamps) against the last PDS save snapshot.
 */
export function hasUnsavedPdsChanges(): boolean {
  if (!_isLoggedIn) return false;
  const state = wizardState;
  if (!state) return false;

  // Never saved to PDS — only flag if there's meaningful content
  if (!lastPdsContentHash) {
    return hasMeaningfulState(state);
  }

  return getContentFingerprint(state) !== lastPdsContentHash;
}

/** Callback invoked after every localStorage save to trigger PDS auto-save. */
let _onSaveCallback: (() => void) | null = null;

export function setOnSaveCallback(cb: (() => void) | null): void {
  _onSaveCallback = cb;
}

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
    components: [],
    views: [{ id: generateId(), name: 'Home', componentIds: [] }],
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
  // Migrate: rename legacy `blocks` field to `components` (and migrate per-
  // component `blockType` → `componentType`). Applies to both localStorage
  // and PDS-loaded state. After this block runs, only `components` is used.
  {
    const legacy = state as unknown as Record<string, unknown>;
    if (Array.isArray(legacy.blocks) && !Array.isArray(legacy.components)) {
      const migrated = (legacy.blocks as Array<Record<string, unknown>>).map(b => {
        const comp: Record<string, unknown> = { ...b };
        if ('blockType' in comp) {
          if (comp.componentType === undefined) {
            comp.componentType = comp.blockType;
          }
          delete comp.blockType;
        }
        return comp;
      });
      legacy.components = migrated;
    }
    // Drop the legacy field in all cases so it doesn't get re-saved.
    if ('blocks' in legacy) {
      delete legacy.blocks;
    }
    if (!Array.isArray(legacy.components)) {
      legacy.components = [];
    }
  }
  // Migrate: rename legacy `blockIds` on views to `componentIds`.
  if (Array.isArray(state.views)) {
    for (const view of state.views as unknown as Array<Record<string, unknown>>) {
      if ('blockIds' in view && !('componentIds' in view)) {
        view.componentIds = view.blockIds;
      }
      if ('blockIds' in view) {
        delete view.blockIds;
      }
      if (!Array.isArray(view.componentIds)) {
        view.componentIds = [];
      }
    }
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
    state.views = [{ id: generateId(), name: 'Home', componentIds: [] }];
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
  // Migrate: seed contentNodes on text components from linked know requirements'
  // legacy fields (textVariant/text/content). Must run BEFORE requirement cleanup.
  if (state.components && state.requirements) {
    for (const component of state.components) {
      if (component.componentType !== 'text') continue;
      if (component.contentNodes) continue; // already migrated

      const nodes: ContentNode[] = [];
      for (const rid of component.requirementIds) {
        const req = state.requirements.find(r => r.id === rid);
        if (!req || req.type !== 'know' || !req.text) continue;

        const variant: TextVariant = req.textVariant ?? 'paragraph';
        switch (variant) {
          case 'paragraph':
            nodes.push({ type: 'paragraph', text: req.text });
            if (req.content) nodes.push({ type: 'paragraph', text: req.content });
            break;
          case 'heading':
            nodes.push({ type: 'heading', text: req.text });
            if (req.content) nodes.push({ type: 'paragraph', text: req.content });
            break;
          case 'section':
            nodes.push({ type: 'heading', text: req.text });
            if (req.content) nodes.push({ type: 'paragraph', text: req.content });
            break;
          case 'infoBox':
            nodes.push({ type: 'infoBox', text: req.text });
            if (req.content) nodes.push({ type: 'paragraph', text: req.content });
            break;
          case 'banner':
            nodes.push({ type: 'banner', text: req.text });
            if (req.content) nodes.push({ type: 'caption', text: req.content });
            break;
        }
      }
      component.contentNodes = nodes;
    }
  }

  // Migrate: clean up legacy content/textVariant on know requirements
  // (runs after component seeding so components can read legacy fields first)
  if (state.requirements) {
    for (const req of state.requirements) {
      if (req.type !== 'know') continue;
      const legacy = req as unknown as Record<string, unknown>;

      if (req.content) {
        req.text = `${req.text ?? ''} — ${req.content}`;
        delete legacy.content;
      }
      if (legacy.textVariant !== undefined) {
        delete legacy.textVariant;
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
  _onSaveCallback?.();
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

