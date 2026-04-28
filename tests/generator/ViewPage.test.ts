/**
 * Tests for src/generator/views/ViewPage.ts focused on the inlay branch
 * introduced in the inlay-template-components spec, step 6.
 *
 * Coverage:
 *   - View with no inlay components — none of the inlay-only imports
 *     leak into the generated file.
 *   - Inlay-success branch (NowPlaying / no DID binding) — emits compiled
 *     HTML, an inline bindComponent<i> function, Store + Api imports.
 *   - Inlay-success branch (AviHandle / DID binding) — also imports the
 *     identity helper.
 *   - Inlay-error branch — emits the visible failure placeholder and
 *     skips bind-function/import emission entirely.
 *   - Successful resolution carrying unresolvedComponents — same failure
 *     placeholder shape, no bind function emitted.
 *   - Bound RecordType missing — falls into the failure placeholder
 *     branch rather than crashing.
 */

import { describe, it, expect } from 'vitest';
import { deserializeTree } from '@inlay/core';
import { generateViewPage } from '../../src/generator/views/ViewPage';
import type { InlayResolutionMap } from '../../src/generator/inlay/resolution';
import type {
  ResolvedTemplate,
  ResolveError,
  ResolveResult,
} from '../../src/inlay/resolve';
import type { InlayElement } from '../../src/inlay/element';
import type {
  Component,
  RecordType,
  Requirement,
  View,
  WizardState,
} from '../../src/types/wizard';
import nowplayingFixture from '../fixtures/inlay/nowplaying.json';
import avihandleFixture from '../fixtures/inlay/avihandle.json';

// ── Helpers ───────────────────────────────────────────────────────────

const NOWPLAYING_URI =
  'at://did:plc:fpruhuo22xkm5o7ttr2ktxdo/at.inlay.component/mov.danabra.NowPlaying';
const AVIHANDLE_URI =
  'at://did:plc:rm4mmytequowusm6smpw53ez/at.inlay.component/mov.danabra.AviHandle';

function fixtureToResolved(fixture: typeof nowplayingFixture, uri: string): ResolvedTemplate {
  return {
    templateTree: deserializeTree(fixture.value.body.node) as InlayElement,
    view: fixture.value.view as Record<string, unknown>,
    imports: fixture.value.imports as string[],
    uri,
    unresolvedComponents: [],
  };
}

function makeRecordType(id: string, name: string): RecordType {
  return {
    id,
    name,
    displayName: name,
    description: '',
    fields: [],
    source: 'new',
  };
}

function makeDoRequirement(id: string, dataTypeIds: string[]): Requirement {
  return { id, type: 'do', dataTypeIds };
}

function makeComponent(
  id: string,
  overrides: Partial<Component> = {}
): Component {
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

function viewComponents(state: WizardState, view: View) {
  return view.componentIds
    .map(id => state.components.find(c => c.id === id))
    .filter((c): c is Component => c != null)
    .map(component => ({ component }));
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('generateViewPage() — inlay branch', () => {
  it('emits no inlay-only imports when no component has an attached template', () => {
    const recordType = makeRecordType('rt-status', 'status');
    const requirement = makeDoRequirement('req-1', ['rt-status']);
    const component = makeComponent('c1', {
      requirementIds: ['req-1'],
      // No componentType / no inlayComponentRef — exercises placeholder branch.
    });
    const view = makeView('home', ['c1']);
    const state = makeWizardState({
      recordTypes: [recordType],
      requirements: [requirement],
      components: [component],
      views: [view],
    });
    const inlayResolutions: InlayResolutionMap = new Map();

    const out = generateViewPage(view, 'renderHomeView', viewComponents(state, view), state, inlayResolutions);

    expect(out).not.toContain("from '../store'");
    expect(out).not.toContain("from '../atproto/api'");
    expect(out).not.toContain("from '../atproto/identity'");
    expect(out).not.toContain('bindComponent');
    expect(out).toContain("export function renderHomeView(container: HTMLElement, router: Router)");
  });

  it('inlay-success (NowPlaying) — emits HTML, bind function, Store + Api imports, no identity', () => {
    const recordType = makeRecordType('rt-status', 'status');
    const requirement = makeDoRequirement('req-1', ['rt-status']);
    const component = makeComponent('c1', {
      requirementIds: ['req-1'],
      inlayComponentRef: NOWPLAYING_URI,
    });
    const view = makeView('home', ['c1']);
    const state = makeWizardState({
      recordTypes: [recordType],
      requirements: [requirement],
      components: [component],
      views: [view],
    });
    const inlayResolutions: InlayResolutionMap = new Map([
      ['c1', fixtureToResolved(nowplayingFixture, NOWPLAYING_URI) as ResolveResult],
    ]);

    const out = generateViewPage(view, 'renderHomeView', viewComponents(state, view), state, inlayResolutions);

    // Imports
    expect(out).toContain("import Store, { storeManager } from '../store';");
    expect(out).toContain("import { getStatuss } from '../atproto/api';");
    expect(out).not.toContain("from '../atproto/identity'");

    // Bind function declared at module scope
    expect(out).toContain('async function bindComponent0(container: HTMLElement)');
    expect(out).toContain('await getStatuss()');
    expect(out).toContain('storeManager.setStatuss(resp.statuss)');

    // Render-function body
    expect(out).toContain("component0.className = 'app-component inlay-root';");
    expect(out).toContain('void bindComponent0(component0);');
    // Compiled HTML for NowPlaying contains the artist binding marker.
    expect(out).toContain('data-inlay-bind="record.item.artists.0.artistName"');
  });

  it('inlay-success (AviHandle) — also imports the identity helper', () => {
    const recordType = makeRecordType('rt-profile', 'profile');
    const requirement = makeDoRequirement('req-1', ['rt-profile']);
    const component = makeComponent('c1', {
      requirementIds: ['req-1'],
      inlayComponentRef: AVIHANDLE_URI,
    });
    const view = makeView('home', ['c1']);
    const state = makeWizardState({
      recordTypes: [recordType],
      requirements: [requirement],
      components: [component],
      views: [view],
    });
    const inlayResolutions: InlayResolutionMap = new Map([
      ['c1', fixtureToResolved(avihandleFixture, AVIHANDLE_URI) as ResolveResult],
    ]);

    const out = generateViewPage(view, 'renderHomeView', viewComponents(state, view), state, inlayResolutions);

    expect(out).toContain("import { resolveDidToAvatar } from '../atproto/identity';");
    expect(out).toContain("import { getProfiles } from '../atproto/api';");
    expect(out).toContain('async function bindComponent0(container: HTMLElement)');
    // The AviHandle bind code special-cases data-inlay-bind-did.
    expect(out).toContain('resolveDidToAvatar');
  });

  it('inlay-error — emits failure placeholder and no bind-function/imports', () => {
    const recordType = makeRecordType('rt-status', 'status');
    const requirement = makeDoRequirement('req-1', ['rt-status']);
    const component = makeComponent('c1', {
      requirementIds: ['req-1'],
      inlayComponentRef: NOWPLAYING_URI,
    });
    const view = makeView('home', ['c1']);
    const state = makeWizardState({
      recordTypes: [recordType],
      requirements: [requirement],
      components: [component],
      views: [view],
    });
    const error: ResolveError = { error: 'fetch failed', code: 'network' };
    const inlayResolutions: InlayResolutionMap = new Map([
      ['c1', error as ResolveResult],
    ]);

    const out = generateViewPage(view, 'renderHomeView', viewComponents(state, view), state, inlayResolutions);

    expect(out).toContain('inlay-unresolved-component');
    expect(out).toContain('failed (network)');
    expect(out).not.toContain('bindComponent0');
    expect(out).not.toContain("from '../store'");
    expect(out).not.toContain("from '../atproto/api'");
    expect(out).not.toContain("from '../atproto/identity'");
  });

  it('successful resolution carrying unresolvedComponents — failure placeholder, no bind', () => {
    const recordType = makeRecordType('rt-profile', 'profile');
    const requirement = makeDoRequirement('req-1', ['rt-profile']);
    const component = makeComponent('c1', {
      requirementIds: ['req-1'],
      inlayComponentRef: AVIHANDLE_URI,
    });
    const view = makeView('home', ['c1']);
    const state = makeWizardState({
      recordTypes: [recordType],
      requirements: [requirement],
      components: [component],
      views: [view],
    });
    const resolved: ResolvedTemplate = {
      ...fixtureToResolved(avihandleFixture, AVIHANDLE_URI),
      unresolvedComponents: ['mov.danabra.ProfilePosts'],
    };
    const inlayResolutions: InlayResolutionMap = new Map([
      ['c1', resolved as ResolveResult],
    ]);

    const out = generateViewPage(view, 'renderHomeView', viewComponents(state, view), state, inlayResolutions);

    expect(out).toContain('inlay-unresolved-component');
    expect(out).toContain('mov.danabra.ProfilePosts');
    expect(out).not.toContain('bindComponent0');
    expect(out).not.toContain("from '../atproto/api'");
  });

  it('attached component without a "do" requirement falls into the failure branch', () => {
    // No requirement at all — picker UI normally prevents this, but the
    // generator should emit the failure placeholder instead of crashing.
    const component = makeComponent('c1', {
      requirementIds: [],
      inlayComponentRef: NOWPLAYING_URI,
    });
    const view = makeView('home', ['c1']);
    const state = makeWizardState({
      recordTypes: [],
      requirements: [],
      components: [component],
      views: [view],
    });
    const inlayResolutions: InlayResolutionMap = new Map([
      ['c1', fixtureToResolved(nowplayingFixture, NOWPLAYING_URI) as ResolveResult],
    ]);

    const out = generateViewPage(view, 'renderHomeView', viewComponents(state, view), state, inlayResolutions);

    expect(out).toContain('inlay-unresolved-component');
    expect(out).toContain('requires a &quot;do&quot; requirement');
    expect(out).not.toContain('bindComponent0');
  });

  it('mixed view — multiple inlay components dedupe Api imports', () => {
    // Two inlay components bound to the same record type. Both
    // bindComponent functions appear; the api import lists getStatuss once.
    const recordType = makeRecordType('rt-status', 'status');
    const requirement = makeDoRequirement('req-1', ['rt-status']);
    const c1 = makeComponent('c1', {
      requirementIds: ['req-1'],
      inlayComponentRef: NOWPLAYING_URI,
    });
    const c2 = makeComponent('c2', {
      requirementIds: ['req-1'],
      inlayComponentRef: NOWPLAYING_URI,
    });
    const view = makeView('home', ['c1', 'c2']);
    const state = makeWizardState({
      recordTypes: [recordType],
      requirements: [requirement],
      components: [c1, c2],
      views: [view],
    });
    const inlayResolutions: InlayResolutionMap = new Map([
      ['c1', fixtureToResolved(nowplayingFixture, NOWPLAYING_URI) as ResolveResult],
      ['c2', fixtureToResolved(nowplayingFixture, NOWPLAYING_URI) as ResolveResult],
    ]);

    const out = generateViewPage(view, 'renderHomeView', viewComponents(state, view), state, inlayResolutions);

    expect(out).toContain('async function bindComponent0(');
    expect(out).toContain('async function bindComponent1(');
    expect(out).toContain('void bindComponent0(component0);');
    expect(out).toContain('void bindComponent1(component1);');

    // The api import should list getStatuss exactly once.
    const apiImports = out.match(/import \{ ([^}]+) \} from '\.\.\/atproto\/api'/);
    expect(apiImports).not.toBeNull();
    const list = apiImports![1];
    expect(list).toBe('getStatuss');
  });
});
