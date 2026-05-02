/**
 * Tests for the Checklist component generator and the ViewPage placeholder
 * fallback when a checklist component's config is unresolvable.
 */

import { describe, it, expect } from 'vitest';
import {
  pickDefaultLabelField,
  pickDefaultCheckedField,
  pickDefaultChecklistConfig,
  resolveChecklistConfig,
  describeChecklistFailure,
  generateChecklistComponent,
} from '../../src/generator/components/Checklist';
import { generateViewPage } from '../../src/generator/views/ViewPage';
import type { InlayResolutionMap } from '../../src/generator/inlay/resolution';
import type {
  Component,
  Field,
  RecordType,
  Requirement,
  View,
  WizardState,
} from '../../src/types/wizard';

// ── Helpers ───────────────────────────────────────────────────────────

function field(overrides: Partial<Field> & { name: string; type: string }): Field {
  return {
    id: `field-${overrides.name}`,
    required: false,
    ...overrides,
  };
}

function makeRecordType(overrides: Partial<RecordType> & { id: string; name: string }): RecordType {
  return {
    displayName: overrides.name,
    description: '',
    fields: [],
    source: 'new',
    ...overrides,
  };
}

function makeDoRequirement(id: string, dataTypeIds: string[]): Requirement {
  return { id, type: 'do', dataTypeIds };
}

function makeComponent(id: string, overrides: Partial<Component> = {}): Component {
  return {
    id,
    name: id,
    requirementIds: [],
    ...overrides,
  };
}

function makeView(id: string, componentIds: string[]): View {
  return { id, name: id, componentIds };
}

function makeWizardState(parts: {
  recordTypes?: RecordType[];
  requirements?: Requirement[];
  components?: Component[];
  views?: View[];
}): WizardState {
  return {
    version: '1',
    lastSaved: '',
    currentStep: 0,
    activeSection: 'requirements',
    currentRecordTypeIndex: 0,
    appInfo: { appName: 'Test', description: '', authorName: '' },
    recordTypes: parts.recordTypes ?? [],
    queryMethods: [],
    procedureMethods: [],
    appConfig: {
      primaryRecordType: '',
      listDisplayFields: [],
      outputMethod: 'zip',
    },
    requirements: parts.requirements ?? [],
    nonDataElements: [],
    components: parts.components ?? [],
    views: parts.views ?? [],
    hasGenerated: false,
    hasSeenWelcome: true,
  };
}

// ── Default-pick convention ───────────────────────────────────────────

describe('pickDefaultLabelField()', () => {
  it('prefers required string over optional, regardless of order', () => {
    const rt = makeRecordType({
      id: 'rt',
      name: 'task',
      fields: [
        field({ name: 'notes', type: 'string', required: false }),
        field({ name: 'text', type: 'string', required: true }),
        field({ name: 'done', type: 'boolean', required: false }),
      ],
    });
    expect(pickDefaultLabelField(rt)).toBe('text');
  });

  it('falls back to first non-system string when none required', () => {
    const rt = makeRecordType({
      id: 'rt',
      name: 'task',
      fields: [
        field({ name: 'notes', type: 'string', required: false }),
        field({ name: 'extra', type: 'string', required: false }),
      ],
    });
    expect(pickDefaultLabelField(rt)).toBe('notes');
  });

  it('skips system string fields', () => {
    const rt = makeRecordType({
      id: 'rt',
      name: 'task',
      fields: [
        field({ name: 'createdAt', type: 'string', required: true, isSystem: true }),
        field({ name: 'text', type: 'string', required: false }),
      ],
    });
    expect(pickDefaultLabelField(rt)).toBe('text');
  });

  it('returns null when no string fields exist', () => {
    const rt = makeRecordType({
      id: 'rt',
      name: 'task',
      fields: [field({ name: 'count', type: 'integer' })],
    });
    expect(pickDefaultLabelField(rt)).toBeNull();
  });
});

describe('pickDefaultCheckedField()', () => {
  it('returns first boolean field', () => {
    const rt = makeRecordType({
      id: 'rt',
      name: 'task',
      fields: [
        field({ name: 'text', type: 'string' }),
        field({ name: 'pinned', type: 'boolean' }),
        field({ name: 'done', type: 'boolean' }),
      ],
    });
    expect(pickDefaultCheckedField(rt)).toBe('pinned');
  });

  it('returns null when no boolean field exists', () => {
    const rt = makeRecordType({
      id: 'rt',
      name: 'task',
      fields: [field({ name: 'text', type: 'string' })],
    });
    expect(pickDefaultCheckedField(rt)).toBeNull();
  });
});

// ── Resolution ────────────────────────────────────────────────────────

describe('resolveChecklistConfig()', () => {
  const compatibleRt = makeRecordType({
    id: 'rt-task',
    name: 'task',
    fields: [
      field({ name: 'text', type: 'string', required: true }),
      field({ name: 'notes', type: 'string', required: false }),
      field({ name: 'done', type: 'boolean' }),
    ],
  });

  it('returns ok with explicit config when both fields exist', () => {
    const c = makeComponent('c1', {
      checklistConfig: { labelField: 'notes', checkedField: 'done' },
    });
    const res = resolveChecklistConfig(c, compatibleRt);
    expect(res.kind).toBe('ok');
    if (res.kind === 'ok') {
      expect(res.config).toEqual({ labelField: 'notes', checkedField: 'done' });
    }
  });

  it('returns ok with default config when component has no checklistConfig', () => {
    const c = makeComponent('c1');
    const res = resolveChecklistConfig(c, compatibleRt);
    expect(res.kind).toBe('ok');
    if (res.kind === 'ok') {
      expect(res.config).toEqual({ labelField: 'text', checkedField: 'done' });
    }
  });

  it('returns missing-fields when no string field exists', () => {
    const rt = makeRecordType({
      id: 'rt',
      name: 'task',
      fields: [
        field({ name: 'count', type: 'integer' }),
        field({ name: 'done', type: 'boolean' }),
      ],
    });
    const c = makeComponent('c1');
    expect(resolveChecklistConfig(c, rt).kind).toBe('missing-fields');
  });

  it('returns missing-fields when no boolean field exists', () => {
    const rt = makeRecordType({
      id: 'rt',
      name: 'task',
      fields: [
        field({ name: 'text', type: 'string', required: true }),
        field({ name: 'count', type: 'integer' }),
      ],
    });
    const c = makeComponent('c1');
    expect(resolveChecklistConfig(c, rt).kind).toBe('missing-fields');
  });

  it('returns stale-label when configured label field no longer exists', () => {
    const c = makeComponent('c1', {
      checklistConfig: { labelField: 'wasText', checkedField: 'done' },
    });
    const res = resolveChecklistConfig(c, compatibleRt);
    expect(res.kind).toBe('stale-label');
    if (res.kind === 'stale-label') {
      expect(res.staleField).toBe('wasText');
    }
  });

  it('returns stale-checked when configured checked field no longer exists', () => {
    const c = makeComponent('c1', {
      checklistConfig: { labelField: 'text', checkedField: 'wasDone' },
    });
    const res = resolveChecklistConfig(c, compatibleRt);
    expect(res.kind).toBe('stale-checked');
    if (res.kind === 'stale-checked') {
      expect(res.staleField).toBe('wasDone');
    }
  });
});

describe('describeChecklistFailure()', () => {
  const rt = makeRecordType({ id: 'rt', name: 'task', displayName: 'Task' });

  it('formats missing-fields message', () => {
    const msg = describeChecklistFailure({ kind: 'missing-fields', recordType: rt });
    expect(msg).toBe('Checklist needs a string field and a boolean field on `Task`.');
  });

  it('formats stale-label message', () => {
    const msg = describeChecklistFailure({
      kind: 'stale-label',
      staleField: 'text',
      recordType: rt,
    });
    expect(msg).toBe('Checklist label field `text` no longer exists on `Task`.');
  });

  it('formats stale-checked message', () => {
    const msg = describeChecklistFailure({
      kind: 'stale-checked',
      staleField: 'done',
      recordType: rt,
    });
    expect(msg).toBe('Checklist checked field `done` no longer exists on `Task`.');
  });
});

// ── File generation ───────────────────────────────────────────────────

describe('generateChecklistComponent()', () => {
  const rt = makeRecordType({
    id: 'rt-task',
    name: 'task',
    displayName: 'Task',
    fields: [
      field({ name: 'text', type: 'string', required: true }),
      field({ name: 'notes', type: 'string', required: false }),
      field({ name: 'done', type: 'boolean' }),
      field({ name: 'createdAt', type: 'string', required: true, isSystem: true }),
    ],
  });

  it('includes the configured label and checked fields, not convention picks', () => {
    const c = makeComponent('c1', {
      name: 'My Checklist',
      checklistConfig: { labelField: 'notes', checkedField: 'done' },
    });
    const out = generateChecklistComponent(
      c,
      rt,
      { labelField: 'notes', checkedField: 'done' },
      'renderMyChecklist',
    );
    expect(out).toContain("LABEL_FIELD = 'notes'");
    expect(out).toContain("CHECKED_FIELD = 'done'");
    // Should not bind 'text' for the label.
    expect(out).not.toContain("LABEL_FIELD = 'text'");
  });

  it('imports and calls all CRUD helpers from the api', () => {
    const c = makeComponent('c1');
    const out = generateChecklistComponent(
      c,
      rt,
      { labelField: 'text', checkedField: 'done' },
      'renderTaskChecklist',
    );
    expect(out).toContain('createTask');
    expect(out).toContain('updateTask');
    expect(out).toContain('deleteTask');
    expect(out).toContain('getTasks');
    expect(out).toContain("from '../atproto/api'");
  });

  it('exports the named render function', () => {
    const c = makeComponent('c1');
    const out = generateChecklistComponent(
      c,
      rt,
      { labelField: 'text', checkedField: 'done' },
      'renderMyChecklist',
    );
    expect(out).toContain('export function renderMyChecklist(container: HTMLElement): void');
  });

  it('includes createdAt in the create payload when the record has it', () => {
    const c = makeComponent('c1');
    const out = generateChecklistComponent(
      c,
      rt,
      { labelField: 'text', checkedField: 'done' },
      'renderTaskChecklist',
    );
    expect(out).toContain('createdAt: new Date().toISOString()');
  });

  it('omits createdAt when the record type does not have it', () => {
    const rtNoCreatedAt = makeRecordType({
      id: 'rt-2',
      name: 'note',
      fields: [
        field({ name: 'text', type: 'string', required: true }),
        field({ name: 'done', type: 'boolean' }),
      ],
    });
    const c = makeComponent('c1');
    const out = generateChecklistComponent(
      c,
      rtNoCreatedAt,
      { labelField: 'text', checkedField: 'done' },
      'renderNoteChecklist',
    );
    expect(out).not.toContain('new Date().toISOString()');
  });
});

// ── ViewPage placeholder fallback ─────────────────────────────────────

describe('generateViewPage() — checklist branches', () => {
  const inlayResolutions: InlayResolutionMap = new Map();

  function viewComponentInfos(state: WizardState, view: View, withFunction: boolean) {
    return view.componentIds
      .map(id => state.components.find(c => c.id === id))
      .filter((c): c is Component => c != null)
      .map(component => {
        if (component.componentType === 'checklist' && withFunction) {
          return {
            component,
            componentFile: 'TaskChecklist',
            componentFunction: 'renderTaskChecklist',
          };
        }
        return { component };
      });
  }

  it('emits an import + call for a checklist component with a generated file', () => {
    const rt = makeRecordType({
      id: 'rt',
      name: 'task',
      displayName: 'Task',
      fields: [
        field({ name: 'text', type: 'string', required: true }),
        field({ name: 'done', type: 'boolean' }),
      ],
    });
    const req = makeDoRequirement('req-1', ['rt']);
    const c = makeComponent('c1', {
      requirementIds: ['req-1'],
      componentType: 'checklist',
      checklistConfig: { labelField: 'text', checkedField: 'done' },
    });
    const view = makeView('home', ['c1']);
    const state = makeWizardState({
      recordTypes: [rt],
      requirements: [req],
      components: [c],
      views: [view],
    });
    const out = generateViewPage(
      view,
      'renderHomeView',
      viewComponentInfos(state, view, true),
      state,
      inlayResolutions,
    );
    expect(out).toContain("import { renderTaskChecklist } from '../components/TaskChecklist';");
    expect(out).toContain('renderTaskChecklist(component0)');
  });

  it('emits placeholder when record type has no boolean field', () => {
    const rt = makeRecordType({
      id: 'rt',
      name: 'note',
      displayName: 'Note',
      fields: [
        field({ name: 'text', type: 'string', required: true }),
        field({ name: 'count', type: 'integer' }),
      ],
    });
    const req = makeDoRequirement('req-1', ['rt']);
    const c = makeComponent('c1', {
      requirementIds: ['req-1'],
      componentType: 'checklist',
    });
    const view = makeView('home', ['c1']);
    const state = makeWizardState({
      recordTypes: [rt],
      requirements: [req],
      components: [c],
      views: [view],
    });
    const out = generateViewPage(
      view,
      'renderHomeView',
      viewComponentInfos(state, view, false),
      state,
      inlayResolutions,
    );
    expect(out).toContain('app-component-placeholder');
    expect(out).toContain('Checklist needs a string field and a boolean field');
    expect(out).toContain('Note');
    expect(out).not.toContain("from '../components/");
  });

  it('emits placeholder when record type has no string field', () => {
    const rt = makeRecordType({
      id: 'rt',
      name: 'flag',
      displayName: 'Flag',
      fields: [
        field({ name: 'count', type: 'integer' }),
        field({ name: 'done', type: 'boolean' }),
      ],
    });
    const req = makeDoRequirement('req-1', ['rt']);
    const c = makeComponent('c1', {
      requirementIds: ['req-1'],
      componentType: 'checklist',
    });
    const view = makeView('home', ['c1']);
    const state = makeWizardState({
      recordTypes: [rt],
      requirements: [req],
      components: [c],
      views: [view],
    });
    const out = generateViewPage(
      view,
      'renderHomeView',
      viewComponentInfos(state, view, false),
      state,
      inlayResolutions,
    );
    expect(out).toContain('Checklist needs a string field and a boolean field');
    expect(out).toContain('Flag');
  });

  it('emits stale-label placeholder when configured field name no longer exists', () => {
    const rt = makeRecordType({
      id: 'rt',
      name: 'task',
      displayName: 'Task',
      fields: [
        field({ name: 'title', type: 'string', required: true }),
        field({ name: 'done', type: 'boolean' }),
      ],
    });
    const req = makeDoRequirement('req-1', ['rt']);
    const c = makeComponent('c1', {
      requirementIds: ['req-1'],
      componentType: 'checklist',
      // Stale: 'text' was renamed to 'title' in the data section.
      checklistConfig: { labelField: 'text', checkedField: 'done' },
    });
    const view = makeView('home', ['c1']);
    const state = makeWizardState({
      recordTypes: [rt],
      requirements: [req],
      components: [c],
      views: [view],
    });
    const out = generateViewPage(
      view,
      'renderHomeView',
      viewComponentInfos(state, view, false),
      state,
      inlayResolutions,
    );
    expect(out).toContain('Checklist label field');
    expect(out).toContain('text');
    expect(out).toContain('no longer exists on');
  });
});
