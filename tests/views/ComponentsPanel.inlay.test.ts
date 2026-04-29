// @vitest-environment jsdom
/**
 * Tests for the Inlay attach control on component cards
 * (spec: inlay-template-components, step 7 — picker UI + broken-template badge).
 *
 * The picker dialog itself is mocked because jsdom's <dialog> support is
 * limited and the picker's compatibility filtering is covered by its own
 * unit tests. These tests focus on the panel-side wiring: when the attach
 * control appears, the change/remove flow, and the broken-template badge.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/app/dialogs/InlayComponentPickerDialog', () => ({
  showInlayComponentPicker: vi.fn(),
}));

import {
  renderComponentsPanel,
  wireComponentsPanel,
  _resetComponentsPanelResolution,
} from '../../src/app/views/panels/ComponentsPanel';
import {
  getWizardState,
  setWizardState,
  initializeWizardState,
} from '../../src/app/state/WizardState';
import {
  _resetResolveCache,
  _setResolverForTest,
} from '../../src/inlay/resolve-cache';
import { showInlayComponentPicker } from '../../src/app/dialogs/InlayComponentPickerDialog';
import type {
  Component,
  RecordType,
  Requirement,
  WizardState,
} from '../../src/types/wizard';
import type { ResolveError, ResolvedTemplate } from '../../src/inlay/resolve';

const mockedPicker = vi.mocked(showInlayComponentPicker);

const ATTACHED_URI =
  'at://did:plc:fpruhuo22xkm5o7ttr2ktxdo/at.inlay.component/mov.danabra.AviHandle';

function makeRecordType(overrides: Partial<RecordType> = {}): RecordType {
  return {
    id: 'rt-1',
    name: 'profile',
    displayName: 'Profile',
    description: '',
    fields: [],
    source: 'new',
    namespaceOption: 'thelexfiles',
    lexUsername: 'jon',
    ...overrides,
  };
}

function setStateWithDoComponent(opts: {
  recordType?: RecordType;
  inlayRef?: string;
  componentId?: string;
} = {}): WizardState {
  const state = initializeWizardState();
  const rt = opts.recordType ?? makeRecordType();
  state.recordTypes = [rt];
  const req: Requirement = {
    id: 'req-do',
    type: 'do',
    description: 'browse profile',
    dataTypeIds: [rt.id],
  };
  state.requirements = [req];
  const component: Component = {
    id: opts.componentId ?? 'cmp-1',
    name: 'Profile Card',
    requirementIds: [req.id],
    ...(opts.inlayRef ? { inlayComponentRef: opts.inlayRef } : {}),
  };
  state.components = [component];
  setWizardState(state);
  return state;
}

function setStateWithKnowComponent(): void {
  const state = initializeWizardState();
  state.requirements = [{ id: 'req-know', type: 'know', text: 'About this app' }];
  state.components = [
    {
      id: 'cmp-text',
      name: 'About',
      requirementIds: ['req-know'],
      componentType: 'text',
    },
  ];
  setWizardState(state);
}

function renderAndWire(): void {
  document.body.innerHTML = `
    <div class="sidebar-section" data-section="components">
      <div class="badge">0</div>
      <div class="sidebar-items"></div>
    </div>
    <div id="workspace-panel-body">${renderComponentsPanel()}</div>
  `;
  wireComponentsPanel();
}

beforeEach(() => {
  mockedPicker.mockReset();
  _resetResolveCache();
  _resetComponentsPanelResolution();
});

describe('ComponentsPanel — Inlay attach control visibility', () => {
  it('renders the Attach button when component has do+dataTypeIds + published NSID', () => {
    setStateWithDoComponent();
    const html = renderComponentsPanel();
    expect(html).toContain('inlay-attach-add-btn');
    expect(html).toContain('Attach Inlay component');
  });

  it('hides the attach control when component has no do requirement', () => {
    setStateWithKnowComponent();
    const html = renderComponentsPanel();
    expect(html).not.toContain('inlay-attach-add-btn');
    expect(html).not.toContain('inlay-attach-change-btn');
  });

  it('hides the attach control when the data type has no published NSID', () => {
    const rt = makeRecordType({ namespaceOption: undefined, lexUsername: undefined });
    setStateWithDoComponent({ recordType: rt });
    const html = renderComponentsPanel();
    expect(html).not.toContain('inlay-attach-add-btn');
  });

  it('shows Change/Remove buttons when inlayComponentRef is set', () => {
    setStateWithDoComponent({ inlayRef: ATTACHED_URI });
    const html = renderComponentsPanel();
    expect(html).toContain('inlay-attach-change-btn');
    expect(html).toContain('inlay-attach-remove-btn');
    expect(html).not.toContain('inlay-attach-add-btn');
    expect(html).toContain('mov.danabra.AviHandle');
  });
});

describe('ComponentsPanel — Inlay attach interactions', () => {
  it('opens the picker when Attach is clicked and stores the chosen URI', async () => {
    setStateWithDoComponent();
    mockedPicker.mockResolvedValue(ATTACHED_URI);
    renderAndWire();

    const attachBtn = document.querySelector('.inlay-attach-add-btn') as HTMLButtonElement;
    attachBtn.click();

    // Allow the picker promise to resolve and the panel to re-render.
    await vi.waitFor(() => {
      expect(getWizardState().components[0].inlayComponentRef).toBe(ATTACHED_URI);
    });
  });

  it('does not write any ref when the picker is cancelled', async () => {
    setStateWithDoComponent();
    mockedPicker.mockResolvedValue(null);
    renderAndWire();

    const attachBtn = document.querySelector('.inlay-attach-add-btn') as HTMLButtonElement;
    attachBtn.click();

    // Wait a microtask so the cancellation path runs.
    await Promise.resolve();
    expect(getWizardState().components[0].inlayComponentRef).toBeUndefined();
  });

  it('clears inlayComponentRef when Remove is clicked', () => {
    setStateWithDoComponent({ inlayRef: ATTACHED_URI });
    renderAndWire();

    const removeBtn = document.querySelector('.inlay-attach-remove-btn') as HTMLButtonElement;
    removeBtn.click();

    expect(getWizardState().components[0].inlayComponentRef).toBeUndefined();
  });
});

describe('ComponentsPanel — broken-template badge', () => {
  it('renders the red badge after the resolver returns a ResolveError', async () => {
    setStateWithDoComponent({ inlayRef: ATTACHED_URI });
    const error: ResolveError = { error: 'gone', code: 'network' };
    _setResolverForTest(async () => error);

    renderAndWire();

    // First render — resolver hasn't settled yet, badge is "Checking…".
    expect(document.querySelector('.inlay-attach-badge')).toBeNull();
    expect(document.querySelector('.inlay-attach-checking')).not.toBeNull();

    await vi.waitFor(() => {
      expect(document.querySelector('.inlay-attach-badge')).not.toBeNull();
    });
    expect(document.querySelector('.inlay-attach-badge')?.textContent).toContain(
      'Template no longer available',
    );
  });

  it('does not render the badge after a successful resolve (even with unresolvedComponents)', async () => {
    setStateWithDoComponent({ inlayRef: ATTACHED_URI });
    const ok: ResolvedTemplate = {
      templateTree: { type: 'org.atsui.Stack', props: {} },
      view: undefined,
      imports: [],
      uri: ATTACHED_URI,
      unresolvedComponents: ['mov.danabra.SomeNested'],
    };
    _setResolverForTest(async () => ok);

    renderAndWire();

    await vi.waitFor(() => {
      // Either the panel re-rendered with resolution complete, or it
      // settled before the panel could query — assert by absence of
      // both checking and error states.
      expect(document.querySelector('.inlay-attach-checking')).toBeNull();
    });
    expect(document.querySelector('.inlay-attach-badge')).toBeNull();
  });
});
