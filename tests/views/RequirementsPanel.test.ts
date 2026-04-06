// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  renderRequirementsPanel,
  wireRequirementsPanel,
  updateSidebar,
  updateDataSidebar,
  getDisplayText,
  getSidebarText,
} from '../../src/app/views/panels/RequirementsPanel';
import {
  getWizardState,
  saveWizardState,
  setWizardState,
  initializeWizardState,
} from '../../src/app/state/WizardState';
import type { Requirement, RecordType, NonDataElement, View } from '../../src/types/wizard';

// jsdom lacks HTMLDialogElement.showModal/close — polyfill for tests
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequirement(
  overrides: Partial<Requirement> & { type: Requirement['type'] },
): Requirement {
  return { id: `test-${Date.now()}-${Math.random()}`, ...overrides };
}

function setStateWithRequirements(reqs: Requirement[]): void {
  const state = initializeWizardState();
  state.requirements = reqs;
  setWizardState(state);
}

/** Simulate selecting a value from the custom type dropdown. */
function selectType(value: string): void {
  const option = document.querySelector(
    `#req-type-dropdown .custom-select-option[data-value="${value}"]`,
  ) as HTMLElement | null;
  if (option) option.click();
}

/** Read the current value of the custom type dropdown. */
function getTypeValue(): string {
  return (document.getElementById('req-type-select') as HTMLInputElement)?.value ?? '';
}

/** Check if the custom type dropdown is disabled. */
function isTypeDisabled(): boolean {
  return (document.getElementById('req-type-trigger') as HTMLButtonElement)?.disabled ?? false;
}

// ── Display text ───────────────────────────────────────────────────────

describe('getDisplayText', () => {
  it('returns text for know type', () => {
    const req = makeRequirement({ type: 'know', text: 'how this app works' });
    expect(getDisplayText(req)).toBe('how this app works');
  });

  it('returns description for do type', () => {
    const req = makeRequirement({ type: 'do', description: 'create a bookmark' });
    expect(getDisplayText(req)).toBe('create a bookmark');
  });

  it('returns "ViewA → ViewB" for direct navigate type with view IDs', () => {
    const state = getWizardState();
    state.views = [
      { id: 'v1', name: 'Home', blockIds: [] },
      { id: 'v2', name: 'Detail', blockIds: [] },
    ];
    const req = makeRequirement({ type: 'navigate', navType: 'direct', fromView: 'v1', toView: 'v2' });
    expect(getDisplayText(req)).toBe('Home → Detail');
  });

  it('returns "[deleted view]" when a referenced view no longer exists', () => {
    const state = getWizardState();
    state.views = [{ id: 'v1', name: 'Home', blockIds: [] }];
    const req = makeRequirement({ type: 'navigate', navType: 'direct', fromView: 'v1', toView: 'gone' });
    expect(getDisplayText(req)).toBe('Home → [deleted view]');
  });

  it('returns "Navigation menu: all views" for menu with includeAllViews', () => {
    const req = makeRequirement({ type: 'navigate', navType: 'menu', menuIncludeAllViews: true });
    expect(getDisplayText(req)).toBe('Navigation menu: all views');
  });

  it('returns "Navigation menu: ViewA, ViewB" for menu with manual items', () => {
    const state = getWizardState();
    state.views = [
      { id: 'v1', name: 'Home', blockIds: [] },
      { id: 'v2', name: 'Profile', blockIds: [] },
    ];
    const req = makeRequirement({
      type: 'navigate', navType: 'menu',
      menuIncludeAllViews: false, menuItems: ['v1', 'v2'],
    });
    expect(getDisplayText(req)).toBe('Navigation menu: Home, Profile');
  });

  it('includes menuLabel in display text when set', () => {
    const req = makeRequirement({
      type: 'navigate', navType: 'menu',
      menuLabel: 'Main Nav', menuIncludeAllViews: true,
    });
    expect(getDisplayText(req)).toBe('Main Nav: Navigation menu: all views');
  });

  it('returns "Forward/back navigation (arrows)" for forward-back with arrows', () => {
    const req = makeRequirement({ type: 'navigate', navType: 'forward-back', navControlType: 'arrows' });
    expect(getDisplayText(req)).toBe('Forward/back navigation (arrows)');
  });

  it('returns "Forward/back navigation (buttons)" for forward-back with buttons', () => {
    const req = makeRequirement({ type: 'navigate', navType: 'forward-back', navControlType: 'buttons' });
    expect(getDisplayText(req)).toBe('Forward/back navigation (buttons)');
  });

  it('defaults to arrows when navControlType is missing for forward-back', () => {
    const req = makeRequirement({ type: 'navigate', navType: 'forward-back' });
    expect(getDisplayText(req)).toBe('Forward/back navigation (arrows)');
  });

  it('handles navigate with no navType as direct link', () => {
    const state = getWizardState();
    state.views = [
      { id: 'v1', name: 'Home', blockIds: [] },
      { id: 'v2', name: 'Detail', blockIds: [] },
    ];
    const req = makeRequirement({ type: 'navigate', fromView: 'v1', toView: 'v2' });
    expect(getDisplayText(req)).toBe('Home → Detail');
  });

  it('handles missing fields gracefully', () => {
    const req = makeRequirement({ type: 'know' });
    expect(getDisplayText(req)).toBe('');
  });

  it('returns description for do type with widget', () => {
    const state = getWizardState();
    state.nonDataElements = [{ id: 'el-1', name: 'Timer' }];
    const req = makeRequirement({
      type: 'do',
      description: 'set the Timer',
      elementId: 'el-1',
    });
    expect(getDisplayText(req)).toBe('set the Timer');
  });

  it('returns empty string for do type with no description', () => {
    const req = makeRequirement({ type: 'do' });
    expect(getDisplayText(req)).toBe('');
  });
});

describe('getSidebarText', () => {
  it('returns truncated "Know: [text]"', () => {
    const req = makeRequirement({ type: 'know', text: 'how this app works' });
    expect(getSidebarText(req)).toBe('Know: how this app works');
  });

  it('returns truncated "Do: [description]"', () => {
    const req = makeRequirement({ type: 'do', description: 'create a bookmark' });
    expect(getSidebarText(req)).toBe('Do: create a bookmark');
  });

  it('returns "Nav: ViewA → ViewB" for direct navigate with view IDs', () => {
    const state = getWizardState();
    state.views = [
      { id: 'v1', name: 'Home', blockIds: [] },
      { id: 'v2', name: 'Detail', blockIds: [] },
    ];
    const req = makeRequirement({ type: 'navigate', navType: 'direct', fromView: 'v1', toView: 'v2' });
    expect(getSidebarText(req)).toBe('Nav: Home → Detail');
  });

  it('returns "Nav: menu, all views" for menu with includeAllViews', () => {
    const req = makeRequirement({ type: 'navigate', navType: 'menu', menuIncludeAllViews: true });
    expect(getSidebarText(req)).toBe('Nav: menu, all views');
  });

  it('returns "Nav: menu, ViewA, ViewB" for menu with manual items', () => {
    const state = getWizardState();
    state.views = [
      { id: 'v1', name: 'Home', blockIds: [] },
      { id: 'v2', name: 'Profile', blockIds: [] },
    ];
    const req = makeRequirement({
      type: 'navigate', navType: 'menu',
      menuIncludeAllViews: false, menuItems: ['v1', 'v2'],
    });
    expect(getSidebarText(req)).toBe('Nav: menu, Home, Profile');
  });

  it('includes menuLabel in sidebar text when set', () => {
    const req = makeRequirement({
      type: 'navigate', navType: 'menu',
      menuLabel: 'Main Nav', menuIncludeAllViews: true,
    });
    expect(getSidebarText(req)).toBe('Nav: Main Nav, all views');
  });

  it('returns "Nav: Fwd/Back" for forward-back navigate', () => {
    const req = makeRequirement({ type: 'navigate', navType: 'forward-back' });
    expect(getSidebarText(req)).toBe('Nav: Fwd/Back');
  });

  it('truncates long text with ellipsis', () => {
    const req = makeRequirement({
      type: 'know',
      text: 'a very long piece of text that exceeds the maximum',
    });
    const result = getSidebarText(req);
    expect(result.length).toBeLessThanOrEqual(36); // "Know: " (6) + 30
    expect(result).toContain('…');
  });

  it('returns "Do: [description]" for do type with widget', () => {
    const state = getWizardState();
    state.nonDataElements = [{ id: 'el-1', name: 'Timer' }];
    const req = makeRequirement({
      type: 'do',
      description: 'set the Timer',
      elementId: 'el-1',
    });
    expect(getSidebarText(req)).toBe('Do: set the Timer');
  });
});

// ── Rendering ──────────────────────────────────────────────────────────

describe('renderRequirementsPanel', () => {
  beforeEach(() => {
    setWizardState(initializeWizardState());
  });

  it('renders empty state when no requirements exist', () => {
    const html = renderRequirementsPanel();
    expect(html).toContain('Build a Decentralized Web App');
    expect(html).toContain('Add Your First Requirement');
    expect(html).toContain('meditation tracker');
    expect(html).toContain('grocery list');
    expect(html).toContain('event planner');
    expect(html).not.toContain('wizard-list');
  });

  it('renders list state when requirements exist', () => {
    const state = getWizardState();
    state.requirements = [
      makeRequirement({ type: 'know', text: 'how this works' }),
      makeRequirement({ type: 'do', description: 'track sessions' }),
    ];
    const html = renderRequirementsPanel();
    expect(html).not.toContain('Build a Decentralized Web App');
    expect(html).toContain('Add Requirement');
    expect(html).toContain('item-grid');
    expect(html).toContain('how this works');
    expect(html).toContain('track sessions');
  });

  it('renders item cards with type labels and accessible action buttons', () => {
    const req = makeRequirement({ type: 'know', text: 'something' });
    const state = getWizardState();
    state.requirements = [req];
    const html = renderRequirementsPanel();
    expect(html).toContain('item-card');
    expect(html).toContain('item-meta');
    expect(html).toContain('Information');
    expect(html).toContain('req-edit-btn');
    expect(html).toContain('req-delete-btn');
    expect(html).toContain(`data-req-id="${req.id}"`);
    expect(html).toContain('aria-label="Edit requirement"');
    expect(html).toContain('aria-label="Delete requirement"');
  });

  it('renders correct type labels for each requirement type', () => {
    const state = getWizardState();
    state.requirements = [
      makeRequirement({ type: 'know', text: 'something' }),
      makeRequirement({ type: 'do', description: 'track items' }),
      makeRequirement({ type: 'navigate', navType: 'direct' }),
    ];
    const html = renderRequirementsPanel();
    expect(html).toContain('Information');
    // "do" with no linked items shows "Interaction" as meta
    expect(html).toContain('Interaction');
    expect(html).toContain('Direct Link');
  });

  it('renders next-step card when requirements exist', () => {
    const state = getWizardState();
    state.requirements = [makeRequirement({ type: 'know', text: 'something' })];
    const html = renderRequirementsPanel();
    expect(html).toContain('next-step');
    expect(html).toContain('Define Data');
  });

  it('disables add button at 100 requirements', () => {
    const state = getWizardState();
    state.requirements = Array.from({ length: 100 }, (_, i) =>
      makeRequirement({ type: 'know', text: `item ${i}` }),
    );
    const html = renderRequirementsPanel();
    expect(html).toContain('disabled');
  });

  it('escapes HTML in requirement text', () => {
    const state = getWizardState();
    state.requirements = [
      makeRequirement({ type: 'know', text: '<script>alert("xss")</script>' }),
    ];
    const html = renderRequirementsPanel();
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

// ── DOM interaction ────────────────────────────────────────────────────

describe('wireRequirementsPanel (DOM)', () => {
  beforeEach(() => {
    setWizardState(initializeWizardState());
    localStorage.clear();
  });

  function mountPanel(): void {
    document.body.innerHTML = `
      <div id="workspace-panel-body">${renderRequirementsPanel()}</div>
      <div class="sidebar-section" data-section="requirements">
        <span class="badge">0</span>
        <div class="sidebar-items"><div class="sidebar-item-empty">None yet</div></div>
      </div>
      <div class="sidebar-section" data-section="data">
        <span class="badge">0</span>
        <div class="sidebar-items"><div class="sidebar-item-empty">None yet</div></div>
      </div>
    `;
    wireRequirementsPanel();
  }

  it('clicking add button shows inline form with Type dropdown', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    expect(document.getElementById('req-form')).not.toBeNull();
    expect(document.getElementById('req-type-select')).not.toBeNull();
  });

  it('Type dropdown defaults to "know" when adding new', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    expect(getTypeValue()).toBe('know');
    expect(document.getElementById('req-know-text')).not.toBeNull();
  });

  it('changing Type dropdown to "do" shows description and item buttons', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    selectType('do');
    expect(document.getElementById('req-do-description')).not.toBeNull();
    expect(document.getElementById('req-do-add-data')).not.toBeNull();
    expect(document.getElementById('req-do-add-widget')).not.toBeNull();
    expect(document.getElementById('req-know-text')).toBeNull();
  });

  // ── Navigate sub-form tests ───────────────────────────────────────

  it('changing Type to navigate shows Type of Navigation dropdown', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    selectType('navigate');
    expect(document.getElementById('req-nav-type-select')).not.toBeNull();
  });

  it('switching back from navigate to know removes nav type dropdown', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    selectType('navigate');
    expect(document.getElementById('req-nav-type-select')).not.toBeNull();

    selectType('know');
    expect(document.getElementById('req-nav-type-select')).toBeNull();
  });

  it('navigate defaults to Direct Link with populated From/To dropdowns (Home view is seeded)', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    selectType('navigate');

    const navTypeSelect = document.getElementById('req-nav-type-select') as HTMLSelectElement;
    expect(navTypeSelect.value).toBe('direct');
    const from = document.getElementById('req-nav-from') as HTMLSelectElement;
    const to = document.getElementById('req-nav-to') as HTMLSelectElement;
    expect(from).not.toBeNull();
    expect(from.disabled).toBe(false);
    expect(to.disabled).toBe(false);
    // placeholder + seeded Home view
    expect(from.querySelectorAll('option').length).toBe(2);
  });

  it('navigate Direct Link populates selects when views exist', () => {
    const state = getWizardState();
    state.views = [
      { id: 'v1', name: 'Home', blockIds: [] },
      { id: 'v2', name: 'Profile', blockIds: [] },
    ];
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    selectType('navigate');

    const from = document.getElementById('req-nav-from') as HTMLSelectElement;
    const to = document.getElementById('req-nav-to') as HTMLSelectElement;
    expect(from.disabled).toBe(false);
    expect(to.disabled).toBe(false);
    expect(from.querySelectorAll('option').length).toBe(3); // placeholder + 2 views
    expect(from.querySelector('option[value="v1"]')!.textContent).toBe('Home');
  });

  it('changing nav type to menu shows include-all toggle and checkbox lists (Home is seeded)', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    selectType('navigate');

    const navTypeSelect = document.getElementById('req-nav-type-select') as HTMLSelectElement;
    navTypeSelect.value = 'menu';
    navTypeSelect.dispatchEvent(new Event('change'));

    const fieldsArea = document.getElementById('req-type-fields')!;
    expect(fieldsArea.innerHTML).toContain('Include all views');
    expect(document.getElementById('menu-include-all-views')).not.toBeNull();
  });

  it('changing nav type to menu shows include-all toggle and checkbox lists when views exist', () => {
    const state = getWizardState();
    state.views = [
      { id: 'v1', name: 'Home', blockIds: [] },
      { id: 'v2', name: 'Profile', blockIds: [] },
    ];
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    selectType('navigate');

    const navTypeSelect = document.getElementById('req-nav-type-select') as HTMLSelectElement;
    navTypeSelect.value = 'menu';
    navTypeSelect.dispatchEvent(new Event('change'));

    const toggle = document.getElementById('menu-include-all-views') as HTMLInputElement;
    expect(toggle).not.toBeNull();
    expect(toggle.checked).toBe(true);
    // Preview should be visible, manual list hidden
    expect(document.getElementById('menu-items-preview')!.style.display).not.toBe('none');
    expect(document.getElementById('menu-items-manual')!.style.display).toBe('none');
  });

  it('changing nav type to forward-back shows page order and control type (Home is seeded)', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    selectType('navigate');

    const navTypeSelect = document.getElementById('req-nav-type-select') as HTMLSelectElement;
    navTypeSelect.value = 'forward-back';
    navTypeSelect.dispatchEvent(new Event('change'));

    const fieldsArea = document.getElementById('req-type-fields')!;
    expect(fieldsArea.innerHTML).toContain('Page Order');
    expect(fieldsArea.innerHTML).toContain('Control Type');
    expect(document.getElementById('req-nav-control-type')).not.toBeNull();
    expect((document.getElementById('req-nav-control-type') as HTMLSelectElement).disabled).toBe(false);
    // Page order should show seeded Home view
    expect(document.querySelectorAll('#req-page-order .reorder-item').length).toBe(1);
  });

  it('Navigation Menu option is not disabled when a menu already exists (multiple allowed)', () => {
    const menuReq = makeRequirement({ type: 'navigate', navType: 'menu' });
    const state = getWizardState();
    state.requirements = [menuReq];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    selectType('navigate');

    const navTypeSelect = document.getElementById('req-nav-type-select') as HTMLSelectElement;
    const menuOption = navTypeSelect.querySelector('option[value="menu"]') as HTMLOptionElement;
    expect(menuOption.disabled).toBe(false);
  });

  it('Forward/Back option is disabled when a forward-back requirement already exists', () => {
    const fbReq = makeRequirement({ type: 'navigate', navType: 'forward-back' });
    const state = getWizardState();
    state.requirements = [fbReq];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    selectType('navigate');

    const navTypeSelect = document.getElementById('req-nav-type-select') as HTMLSelectElement;
    const fbOption = navTypeSelect.querySelector('option[value="forward-back"]') as HTMLOptionElement;
    expect(fbOption.disabled).toBe(true);
  });

  it('Direct Link option is never disabled (multiple allowed)', () => {
    const directReq = makeRequirement({ type: 'navigate', navType: 'direct', fromView: 'A', toView: 'B' });
    const state = getWizardState();
    state.requirements = [directReq];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    selectType('navigate');

    const navTypeSelect = document.getElementById('req-nav-type-select') as HTMLSelectElement;
    const directOption = navTypeSelect.querySelector('option[value="direct"]') as HTMLOptionElement;
    expect(directOption.disabled).toBe(false);
  });

  // ── Standard form behavior tests ──────────────────────────────────

  it('Type dropdown is set to requirement type when editing', () => {
    const state = getWizardState();
    state.recordTypes = [{ id: 'rt-1', name: '', displayName: 'bookmark', description: '', fields: [], source: 'new' as const }];
    const req = makeRequirement({ type: 'do', description: 'create a bookmark', dataTypeIds: ['rt-1'] });
    state.requirements = [req];
    mountPanel();

    (document.querySelector('.req-edit-btn') as HTMLElement).click();
    expect(getTypeValue()).toBe('do');
    expect(document.getElementById('req-do-description')).not.toBeNull();
    expect((document.getElementById('req-do-description') as HTMLTextAreaElement).value).toBe('create a bookmark');
    // Chips should show the linked data type
    const chips = document.querySelectorAll('.item-chip');
    expect(chips).toHaveLength(1);
  });

  it('save button is disabled initially for know form', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('save button enables when know textarea has content', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const textarea = document.getElementById('req-know-text') as HTMLTextAreaElement;
    textarea.value = 'how this works';
    textarea.dispatchEvent(new Event('input'));
    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
  });

  it('save button stays disabled when only description is filled for do type', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    selectType('do');
    const desc = document.getElementById('req-do-description') as HTMLTextAreaElement;
    desc.value = 'create something';
    desc.dispatchEvent(new Event('input'));
    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true); // no items added
  });

  it('save button enables when description filled and item added', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    selectType('do');
    const desc = document.getElementById('req-do-description') as HTMLTextAreaElement;
    desc.value = 'create a bookmark';
    desc.dispatchEvent(new Event('input'));
    // Add a data type via the pick-then-type flow
    document.getElementById('req-do-add-data')!.click();
    const input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.value = 'bookmark';
    input.dispatchEvent(new Event('input'));
    // Click the "Create" option in the dropdown
    const createItem = document.querySelector('#req-do-item-dropdown .combobox-create') as HTMLElement;
    createItem.dispatchEvent(new MouseEvent('mousedown'));
    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
  });

  it('save button disabled for direct link until both views selected, enabled for menu/fwd-back with seeded view', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    selectType('navigate');
    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    // Direct link: disabled until both from/to selected
    expect(saveBtn.disabled).toBe(true);

    // Menu: enabled (include-all default + seeded Home view in visible-on)
    const navTypeSelect = document.getElementById('req-nav-type-select') as HTMLSelectElement;
    navTypeSelect.value = 'menu';
    navTypeSelect.dispatchEvent(new Event('change'));
    expect(saveBtn.disabled).toBe(false);

    // Forward/back: enabled (seeded Home view in page order)
    navTypeSelect.value = 'forward-back';
    navTypeSelect.dispatchEvent(new Event('change'));
    expect(saveBtn.disabled).toBe(false);
  });

  it('saving a know requirement adds it to state and re-renders', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const textarea = document.getElementById('req-know-text') as HTMLTextAreaElement;
    textarea.value = 'how this works';
    textarea.dispatchEvent(new Event('input'));
    (document.querySelector('.req-save-btn') as HTMLElement).click();

    const state = getWizardState();
    expect(state.requirements).toHaveLength(1);
    expect(state.requirements[0].type).toBe('know');
    expect(state.requirements[0].text).toBe('how this works');
    expect(document.body.innerHTML).toContain('how this works');
  });

  it('saving a do requirement adds it to state', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    selectType('do');
    const desc = document.getElementById('req-do-description') as HTMLTextAreaElement;
    desc.value = 'track meditation sessions';
    desc.dispatchEvent(new Event('input'));
    // Add a data type chip
    document.getElementById('req-do-add-data')!.click();
    const input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.value = 'meditation session';
    input.dispatchEvent(new Event('input'));
    (document.querySelector('#req-do-item-dropdown .combobox-create') as HTMLElement).dispatchEvent(new MouseEvent('mousedown'));
    (document.querySelector('.req-save-btn') as HTMLElement).click();

    const state = getWizardState();
    expect(state.requirements).toHaveLength(1);
    expect(state.requirements[0].type).toBe('do');
    expect(state.requirements[0].description).toBe('track meditation sessions');
    expect(state.requirements[0].dataTypeIds).toHaveLength(1);
  });

  it('deleting a requirement removes it from state and re-renders', async () => {
    const req = makeRequirement({ type: 'know', text: 'something' });
    const state = getWizardState();
    state.requirements = [req];
    mountPanel();

    const deleteBtn = document.querySelector('.req-delete-btn') as HTMLElement;
    deleteBtn.click();

    // Confirm the delete dialog
    await vi.waitFor(() => expect(document.querySelector('#confirm-yes')).not.toBeNull());
    (document.querySelector('#confirm-yes') as HTMLElement).click();
    await vi.waitFor(() => expect(getWizardState().requirements).toHaveLength(0));

    expect(document.body.innerHTML).toContain('Build a Decentralized Web App');
  });

  it('editing a requirement pre-fills the form and updates in place', () => {
    const req1 = makeRequirement({ type: 'know', text: 'first' });
    const state = getWizardState();
    state.recordTypes = [{ id: 'rt-1', name: '', displayName: 'bookmark', description: '', fields: [], source: 'new' as const }];
    const req2 = makeRequirement({ type: 'do', description: 'create a bookmark', dataTypeIds: ['rt-1'] });
    const req3 = makeRequirement({ type: 'know', text: 'third' });
    state.requirements = [req1, req2, req3];
    mountPanel();

    const editBtns = document.querySelectorAll('.req-edit-btn');
    (editBtns[1] as HTMLElement).click();

    expect(getTypeValue()).toBe('do');

    const desc = document.getElementById('req-do-description') as HTMLTextAreaElement;
    expect(desc.value).toBe('create a bookmark');

    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.textContent).toBe('Save');

    desc.value = 'save a bookmark';
    desc.dispatchEvent(new Event('input'));
    saveBtn.click();

    const updated = getWizardState().requirements;
    expect(updated).toHaveLength(3);
    expect(updated[0].id).toBe(req1.id);
    expect(updated[1].id).toBe(req2.id);
    expect(updated[1].description).toBe('save a bookmark');
    expect(updated[2].id).toBe(req3.id);
  });

  it('cancel from form does not save anything', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const textarea = document.getElementById('req-know-text') as HTMLTextAreaElement;
    textarea.value = 'should not be saved';
    textarea.dispatchEvent(new Event('input'));
    (document.querySelector('.req-cancel-btn') as HTMLElement).click();

    expect(getWizardState().requirements).toHaveLength(0);
  });
});

// ── Sidebar updates ────────────────────────────────────────────────────

describe('updateSidebar', () => {
  beforeEach(() => {
    setWizardState(initializeWizardState());
  });

  function mountSidebar(): void {
    document.body.innerHTML = `
      <div class="sidebar-section" data-section="requirements">
        <span class="badge">0</span>
        <div class="sidebar-items"><div class="sidebar-item-empty">None yet</div></div>
      </div>
    `;
  }

  it('shows "None yet" and badge 0 when empty', () => {
    mountSidebar();
    updateSidebar();
    expect(document.querySelector('.badge')!.textContent).toBe('0');
    expect(document.querySelector('.sidebar-item-empty')).not.toBeNull();
  });

  it('shows item count and sidebar items when requirements exist', () => {
    const state = getWizardState();
    state.requirements = [
      makeRequirement({ type: 'know', text: 'how this works' }),
      makeRequirement({ type: 'do', description: 'track sessions' }),
    ];
    mountSidebar();
    updateSidebar();
    expect(document.querySelector('.badge')!.textContent).toBe('2');
    expect(document.querySelector('.sidebar-item-empty')).toBeNull();
    const items = document.querySelectorAll('.sidebar-item');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Know:');
    expect(items[1].textContent).toContain('Do:');
  });

  it('adds has-items class when requirements exist', () => {
    const state = getWizardState();
    state.requirements = [makeRequirement({ type: 'know', text: 'x' })];
    mountSidebar();
    updateSidebar();
    expect(document.querySelector('[data-section="requirements"]')!.classList.contains('has-items')).toBe(true);
  });

  it('removes has-items class when requirements are empty', () => {
    mountSidebar();
    document.querySelector('[data-section="requirements"]')!.classList.add('has-items');
    updateSidebar();
    expect(document.querySelector('[data-section="requirements"]')!.classList.contains('has-items')).toBe(false);
  });
});

// ── Data type combobox & seeding ──────────────────────────────────────

describe('data type combobox and seeding', () => {
  beforeEach(() => {
    setWizardState(initializeWizardState());
    localStorage.clear();
  });

  function mountPanel(): void {
    document.body.innerHTML = `
      <div id="workspace-panel-body">${renderRequirementsPanel()}</div>
      <div class="sidebar-section" data-section="requirements">
        <span class="badge">0</span>
        <div class="sidebar-items"><div class="sidebar-item-empty">None yet</div></div>
      </div>
      <div class="sidebar-section" data-section="data">
        <span class="badge">0</span>
        <div class="sidebar-items"><div class="sidebar-item-empty">None yet</div></div>
      </div>
    `;
    wireRequirementsPanel();
  }

  function switchToDo(): void {
    selectType('do');
  }

  function fillDescription(text: string): void {
    const desc = document.getElementById('req-do-description') as HTMLTextAreaElement;
    desc.value = text;
    desc.dispatchEvent(new Event('input'));
  }

  function addDataTypeChip(name: string): void {
    document.getElementById('req-do-add-data')!.click();
    const input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.value = name;
    input.dispatchEvent(new Event('input'));
    const createItem = document.querySelector('#req-do-item-dropdown .combobox-create') as HTMLElement;
    if (createItem) {
      createItem.dispatchEvent(new MouseEvent('mousedown'));
    } else {
      // Exact match — click the matching item
      const item = document.querySelector('#req-do-item-dropdown .combobox-item') as HTMLElement;
      if (item) item.dispatchEvent(new MouseEvent('mousedown'));
    }
  }

  function selectExistingDataType(name: string): void {
    document.getElementById('req-do-add-data')!.click();
    const input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.value = name;
    input.dispatchEvent(new Event('input'));
    const items = document.querySelectorAll('#req-do-item-dropdown .combobox-item:not(.combobox-create)');
    const match = Array.from(items).find(el => el.textContent === name) as HTMLElement;
    if (match) match.dispatchEvent(new MouseEvent('mousedown'));
  }

  function saveForm(): void {
    (document.querySelector('.req-save-btn') as HTMLElement).click();
  }

  // ── Form rendering ──────────────────────────────────────────────────

  it('shows description and item buttons when type is "do"', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();

    expect(document.getElementById('req-do-description')).not.toBeNull();
    expect(document.getElementById('req-do-add-data')).not.toBeNull();
    expect(document.getElementById('req-do-add-widget')).not.toBeNull();
    const hints = document.querySelectorAll('#req-type-fields .form-hint');
    const hintTexts = Array.from(hints).map(h => h.textContent);
    expect(hintTexts.some(t => t?.includes('Add at least one'))).toBe(true);
  });

  it('clicking + Data Type shows combobox, no dropdown when no types exist', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();

    document.getElementById('req-do-add-data')!.click();
    expect(document.getElementById('req-do-item-input')).not.toBeNull();
    const input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    const dropdown = document.getElementById('req-do-item-dropdown')!;
    expect(dropdown.style.display).toBe('none');
  });

  // ── Seeding ─────────────────────────────────────────────────────────

  it('saving a "do" requirement with new name seeds a RecordType', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('create a book');
    addDataTypeChip('book');
    saveForm();

    const state = getWizardState();
    expect(state.recordTypes).toHaveLength(1);
    expect(state.recordTypes[0].displayName).toBe('book');
    expect(state.recordTypes[0].name).toBe('');
    expect(state.recordTypes[0].fields).toHaveLength(1);
    expect(state.recordTypes[0].fields[0].name).toBe('createdAt');
    expect(state.recordTypes[0].fields[0].isSystem).toBe(true);
    expect(state.requirements[0].dataTypeIds).toEqual([state.recordTypes[0].id]);
  });

  it('saving a second "do" requirement with new name seeds another RecordType', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('create a book');
    addDataTypeChip('book');
    saveForm();

    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('list grocery items');
    addDataTypeChip('grocery item');
    saveForm();

    const state = getWizardState();
    expect(state.recordTypes).toHaveLength(2);
    expect(state.recordTypes[0].displayName).toBe('book');
    expect(state.recordTypes[1].displayName).toBe('grocery item');
    expect(state.requirements[1].dataTypeIds).toEqual([state.recordTypes[1].id]);
  });

  it('exact name match reuses existing RecordType (no duplicate)', () => {
    const state = getWizardState();
    state.recordTypes = [{
      id: 'existing-book',
      name: '',
      displayName: 'book',
      description: '',
      fields: [],
      source: 'new' as const,
    }];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('update a book');
    selectExistingDataType('book');
    saveForm();

    const updated = getWizardState();
    expect(updated.recordTypes).toHaveLength(1);
    expect(updated.requirements[0].dataTypeIds).toEqual(['existing-book']);
  });

  it('exact name match is case-insensitive', () => {
    const state = getWizardState();
    state.recordTypes = [{
      id: 'existing-book',
      name: '',
      displayName: 'Book',
      description: '',
      fields: [],
      source: 'new' as const,
    }];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('update a book');
    // Type lowercase "book" — should match existing "Book"
    addDataTypeChip('book');
    saveForm();

    const updated = getWizardState();
    expect(updated.recordTypes).toHaveLength(1);
    expect(updated.requirements[0].dataTypeIds).toEqual(['existing-book']);
  });

  it('editing a "do" requirement and changing data type creates new RecordType', () => {
    const state = getWizardState();
    state.recordTypes = [{
      id: 'rt-book',
      name: '',
      displayName: 'book',
      description: '',
      fields: [],
      source: 'new' as const,
    }];
    state.requirements = [{
      id: 'req-1',
      type: 'do' as const,
      description: 'create a book',
      dataTypeIds: ['rt-book'],
    }];
    mountPanel();

    (document.querySelector('.req-edit-btn') as HTMLElement).click();
    // Remove existing chip
    (document.querySelector('.item-chip-remove') as HTMLElement).click();
    // Add a new one
    addDataTypeChip('novel');
    saveForm();

    const updated = getWizardState();
    expect(updated.recordTypes).toHaveLength(2);
    expect(updated.recordTypes[0].displayName).toBe('book');
    expect(updated.recordTypes[1].displayName).toBe('novel');
    expect(updated.requirements[0].dataTypeIds).toEqual([updated.recordTypes[1].id]);
  });

  it('deleting a "do" requirement does not delete its RecordType', async () => {
    const state = getWizardState();
    state.recordTypes = [{
      id: 'rt-book',
      name: '',
      displayName: 'book',
      description: '',
      fields: [],
      source: 'new' as const,
    }];
    state.requirements = [{
      id: 'req-1',
      type: 'do' as const,
      description: 'create a book',
      dataTypeIds: ['rt-book'],
    }];
    mountPanel();

    (document.querySelector('.req-delete-btn') as HTMLElement).click();

    await vi.waitFor(() => expect(document.querySelector('#confirm-yes')).not.toBeNull());
    (document.querySelector('#confirm-yes') as HTMLElement).click();
    await vi.waitFor(() => expect(getWizardState().requirements).toHaveLength(0));

    const updated = getWizardState();
    expect(updated.recordTypes).toHaveLength(1);
    expect(updated.recordTypes[0].displayName).toBe('book');
  });

  // ── Type dropdown locking ───────────────────────────────────────────

  it('type dropdown is disabled when editing an existing requirement', () => {
    const state = getWizardState();
    state.requirements = [makeRequirement({ type: 'do', description: 'create a book' })];
    mountPanel();

    (document.querySelector('.req-edit-btn') as HTMLElement).click();
    expect(isTypeDisabled()).toBe(true);
  });

  it('type dropdown is enabled when adding a new requirement', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    expect(isTypeDisabled()).toBe(false);
  });

  // ── Dropdown behavior ──────────────────────────────────────────────

  it('dropdown shows existing record types when + Data Type clicked', () => {
    const state = getWizardState();
    state.recordTypes = [
      { id: 'rt-1', name: '', displayName: 'book', description: '', fields: [], source: 'new' as const },
      { id: 'rt-2', name: '', displayName: 'grocery item', description: '', fields: [], source: 'new' as const },
    ];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    switchToDo();

    document.getElementById('req-do-add-data')!.click();
    const input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));

    const dropdown = document.getElementById('req-do-item-dropdown')!;
    expect(dropdown.style.display).toBe('block');
    const items = dropdown.querySelectorAll('.combobox-item');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('book');
    expect(items[1].textContent).toBe('grocery item');
  });

  it('dropdown filters items as user types', () => {
    const state = getWizardState();
    state.recordTypes = [
      { id: 'rt-1', name: '', displayName: 'book', description: '', fields: [], source: 'new' as const },
      { id: 'rt-2', name: '', displayName: 'grocery item', description: '', fields: [], source: 'new' as const },
    ];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    switchToDo();

    document.getElementById('req-do-add-data')!.click();
    const input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.value = 'boo';
    input.dispatchEvent(new Event('input'));

    const dropdown = document.getElementById('req-do-item-dropdown')!;
    const items = dropdown.querySelectorAll('.combobox-item:not(.combobox-create)');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toBe('book');

    const createItem = dropdown.querySelector('.combobox-create');
    expect(createItem).not.toBeNull();
  });

  it('exact match suppresses "Create" option', () => {
    const state = getWizardState();
    state.recordTypes = [
      { id: 'rt-1', name: '', displayName: 'book', description: '', fields: [], source: 'new' as const },
    ];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    switchToDo();

    document.getElementById('req-do-add-data')!.click();
    const input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.value = 'book';
    input.dispatchEvent(new Event('input'));

    const dropdown = document.getElementById('req-do-item-dropdown')!;
    const createItem = dropdown.querySelector('.combobox-create');
    expect(createItem).toBeNull();
  });

  it('clicking a dropdown item selects existing RecordType', () => {
    const state = getWizardState();
    state.recordTypes = [
      { id: 'rt-1', name: '', displayName: 'book', description: '', fields: [], source: 'new' as const },
    ];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('update a book');

    selectExistingDataType('book');
    // A chip should appear
    expect(document.querySelectorAll('.item-chip')).toHaveLength(1);

    saveForm();

    const updated = getWizardState();
    expect(updated.recordTypes).toHaveLength(1);
    expect(updated.requirements[0].dataTypeIds).toEqual(['rt-1']);
  });
});

// ── Enter key in combobox ──────────────────────────────────────────────

describe('combobox Enter key', () => {
  beforeEach(() => {
    setWizardState(initializeWizardState());
    localStorage.clear();
  });

  function mountPanel(): void {
    document.body.innerHTML = `
      <div id="workspace-panel-body">${renderRequirementsPanel()}</div>
      <div class="sidebar-section" data-section="requirements">
        <span class="badge">0</span>
        <div class="sidebar-items"><div class="sidebar-item-empty">None yet</div></div>
      </div>
      <div class="sidebar-section" data-section="data">
        <span class="badge">0</span>
        <div class="sidebar-items"><div class="sidebar-item-empty">None yet</div></div>
      </div>
    `;
    wireRequirementsPanel();
  }

  function openDataCombobox(): HTMLInputElement {
    document.getElementById('req-add-btn')!.click();
    selectType('do');
    document.getElementById('req-do-add-data')!.click();
    return document.getElementById('req-do-item-input') as HTMLInputElement;
  }

  function pressEnter(input: HTMLInputElement): void {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  it('creates a new item when Enter is pressed and Create option is visible', () => {
    mountPanel();
    const input = openDataCombobox();
    input.value = 'movie';
    input.dispatchEvent(new Event('input'));

    const dropdown = document.getElementById('req-do-item-dropdown')!;
    expect(dropdown.querySelector('.combobox-create')).not.toBeNull();

    pressEnter(input);

    const chips = document.querySelectorAll('.item-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toContain('movie');
  });

  it('selects existing item when Enter is pressed and no Create option', () => {
    const state = getWizardState();
    state.recordTypes = [
      { id: 'rt-1', name: '', displayName: 'book', description: '', fields: [], source: 'new' as const },
    ];
    mountPanel();
    const input = openDataCombobox();
    input.value = 'book';
    input.dispatchEvent(new Event('input'));

    const dropdown = document.getElementById('req-do-item-dropdown')!;
    expect(dropdown.querySelector('.combobox-create')).toBeNull();

    pressEnter(input);

    const chips = document.querySelectorAll('.item-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toContain('book');
  });

  it('does nothing when Enter is pressed with dropdown hidden', () => {
    mountPanel();
    const input = openDataCombobox();
    // Empty input — no dropdown shown
    input.dispatchEvent(new Event('focus'));
    const dropdown = document.getElementById('req-do-item-dropdown')!;
    expect(dropdown.style.display).toBe('none');

    pressEnter(input);

    const chips = document.querySelectorAll('.item-chip');
    expect(chips).toHaveLength(0);
  });
});

// ── Data sidebar updates ──────────────────────────────────────────────

describe('updateDataSidebar', () => {
  beforeEach(() => {
    setWizardState(initializeWizardState());
  });

  function mountDataSidebar(): void {
    document.body.innerHTML = `
      <div class="sidebar-section" data-section="data">
        <span class="badge">0</span>
        <div class="sidebar-items"><div class="sidebar-item-empty">None yet</div></div>
      </div>
    `;
  }

  it('shows badge count matching recordTypes length', () => {
    const state = getWizardState();
    state.recordTypes = [
      { id: 'rt-1', name: '', displayName: 'book', description: '', fields: [] },
      { id: 'rt-2', name: '', displayName: 'grocery item', description: '', fields: [] },
    ];
    mountDataSidebar();
    updateDataSidebar();

    expect(document.querySelector('.badge')!.textContent).toBe('2');
  });

  it('shows displayName for each RecordType in sidebar items', () => {
    const state = getWizardState();
    state.recordTypes = [
      { id: 'rt-1', name: '', displayName: 'book', description: '', fields: [] },
    ];
    mountDataSidebar();
    updateDataSidebar();

    const items = document.querySelectorAll('.sidebar-item');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toBe('book');
  });

  it('adds has-items class when recordTypes exist', () => {
    const state = getWizardState();
    state.recordTypes = [
      { id: 'rt-1', name: '', displayName: 'book', description: '', fields: [] },
    ];
    mountDataSidebar();
    updateDataSidebar();

    expect(document.querySelector('[data-section="data"]')!.classList.contains('has-items')).toBe(true);
  });

  it('shows "None yet" when no recordTypes exist', () => {
    mountDataSidebar();
    updateDataSidebar();

    expect(document.querySelector('.badge')!.textContent).toBe('0');
    expect(document.querySelector('.sidebar-item-empty')).not.toBeNull();
  });
});

// ── Widget and mixed interactions ──────────────────────────────────────

describe('widget and mixed interactions', () => {
  beforeEach(() => {
    setWizardState(initializeWizardState());
    localStorage.clear();
  });

  function mountPanel(): void {
    document.body.innerHTML = `
      <div id="workspace-panel-body">${renderRequirementsPanel()}</div>
      <div class="sidebar-section" data-section="requirements">
        <span class="badge">0</span>
        <div class="sidebar-items"><div class="sidebar-item-empty">None yet</div></div>
      </div>
      <div class="sidebar-section" data-section="data">
        <span class="badge">0</span>
        <div class="sidebar-items"><div class="sidebar-item-empty">None yet</div></div>
      </div>
    `;
    wireRequirementsPanel();
  }

  function switchToDo(): void {
    selectType('do');
  }

  function fillDescription(text: string): void {
    const desc = document.getElementById('req-do-description') as HTMLTextAreaElement;
    desc.value = text;
    desc.dispatchEvent(new Event('input'));
  }

  function addWidgetChip(name: string): void {
    document.getElementById('req-do-add-widget')!.click();
    const input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.value = name;
    input.dispatchEvent(new Event('input'));
    const createItem = document.querySelector('#req-do-item-dropdown .combobox-create') as HTMLElement;
    if (createItem) {
      createItem.dispatchEvent(new MouseEvent('mousedown'));
    } else {
      const item = document.querySelector('#req-do-item-dropdown .combobox-item') as HTMLElement;
      if (item) item.dispatchEvent(new MouseEvent('mousedown'));
    }
  }

  function addDataTypeChip(name: string): void {
    document.getElementById('req-do-add-data')!.click();
    const input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.value = name;
    input.dispatchEvent(new Event('input'));
    const createItem = document.querySelector('#req-do-item-dropdown .combobox-create') as HTMLElement;
    if (createItem) {
      createItem.dispatchEvent(new MouseEvent('mousedown'));
    } else {
      const item = document.querySelector('#req-do-item-dropdown .combobox-item') as HTMLElement;
      if (item) item.dispatchEvent(new MouseEvent('mousedown'));
    }
  }

  function saveForm(): void {
    (document.querySelector('.req-save-btn') as HTMLElement).click();
  }

  // ── No target dropdown ──────────────────────────────────────────────

  it('no target dropdown exists for "do" type (replaced by pick-then-type)', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    expect(document.getElementById('req-do-target-select')).toBeNull();
  });

  it('both + Data Type and + Widget buttons shown for "do" type', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    expect(document.getElementById('req-do-add-data')).not.toBeNull();
    expect(document.getElementById('req-do-add-widget')).not.toBeNull();
  });

  it('no target dropdown for "know" type', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    expect(document.getElementById('req-do-target-select')).toBeNull();
  });

  // ── Widget button state ─────────────────────────────────────────────

  it('+ Widget button disables after a widget is added', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    addWidgetChip('Timer');
    const widgetBtn = document.getElementById('req-do-add-widget') as HTMLButtonElement;
    expect(widgetBtn.disabled).toBe(true);
  });

  it('+ Widget button re-enables when widget chip is removed', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    addWidgetChip('Timer');
    // Remove the widget chip
    (document.querySelector('.item-chip-remove') as HTMLElement).click();
    const widgetBtn = document.getElementById('req-do-add-widget') as HTMLButtonElement;
    expect(widgetBtn.disabled).toBe(false);
  });

  // ── Validation ──────────────────────────────────────────────────────

  it('save button disabled when description filled but no items', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('set the Timer');
    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('save button enables with description and widget', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('set the Timer');
    addWidgetChip('Timer');
    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
  });

  it('save button enables with description and data type', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('track meditation sessions');
    addDataTypeChip('meditation session');
    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
  });

  // ── Saving widget requirements ──────────────────────────────────────

  it('saving creates a NonDataElement and links the requirement', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('set the Timer');
    addWidgetChip('Timer');
    saveForm();

    const state = getWizardState();
    expect(state.nonDataElements).toHaveLength(1);
    expect(state.nonDataElements[0].name).toBe('Timer');
    expect(state.requirements).toHaveLength(1);
    expect(state.requirements[0].elementId).toBe(state.nonDataElements[0].id);
    expect(state.requirements[0].description).toBe('set the Timer');
    expect(state.recordTypes).toHaveLength(0);
  });

  it('saving widget-only does not create a RecordType', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('start the Timer');
    addWidgetChip('Timer');
    saveForm();

    expect(getWizardState().recordTypes).toHaveLength(0);
  });

  it('reuses existing NonDataElement by name', () => {
    const state = getWizardState();
    state.nonDataElements = [{ id: 'el-timer', name: 'Timer' }];

    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('start the Timer');
    addWidgetChip('Timer');
    saveForm();

    const updated = getWizardState();
    expect(updated.nonDataElements).toHaveLength(1);
    expect(updated.requirements[0].elementId).toBe('el-timer');
  });

  it('saving with widget and data type creates both', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('set Timer using Preferences');
    addWidgetChip('Timer');
    addDataTypeChip('Preferences');
    saveForm();

    const state = getWizardState();
    expect(state.nonDataElements).toHaveLength(1);
    expect(state.recordTypes).toHaveLength(1);
    expect(state.recordTypes[0].displayName).toBe('Preferences');
    expect(state.requirements[0].elementId).toBe(state.nonDataElements[0].id);
    expect(state.requirements[0].dataTypeIds).toEqual([state.recordTypes[0].id]);
  });

  it('saving with existing RecordType reuses it via dataTypeIds', () => {
    const state = getWizardState();
    state.recordTypes = [{
      id: 'rt-settings',
      name: '',
      displayName: 'Settings',
      description: '',
      fields: [],
      source: 'new' as const,
    }];

    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('configure Timer with Settings');
    addWidgetChip('Timer');
    addDataTypeChip('Settings');
    saveForm();

    const updated = getWizardState();
    expect(updated.recordTypes).toHaveLength(1);
    expect(updated.requirements[0].dataTypeIds).toEqual(['rt-settings']);
  });

  // ── Editing ─────────────────────────────────────────────────────────

  it('editing pre-fills description and chips', () => {
    const state = getWizardState();
    state.nonDataElements = [{ id: 'el-1', name: 'Timer' }];
    state.recordTypes = [{
      id: 'rt-1',
      name: '',
      displayName: 'Settings',
      description: '',
      fields: [],
      source: 'new' as const,
    }];
    state.requirements = [{
      id: 'req-1',
      type: 'do' as const,
      description: 'set Timer with Settings',
      elementId: 'el-1',
      dataTypeIds: ['rt-1'],
    }];
    mountPanel();

    (document.querySelector('.req-edit-btn') as HTMLElement).click();
    expect((document.getElementById('req-do-description') as HTMLTextAreaElement).value).toBe('set Timer with Settings');
    const chips = document.querySelectorAll('.item-chip');
    expect(chips).toHaveLength(2);
  });

  // ── Deleting ────────────────────────────────────────────────────────

  it('deleting a widget requirement preserves the NonDataElement', async () => {
    const state = getWizardState();
    state.nonDataElements = [{ id: 'el-1', name: 'Timer' }];
    state.requirements = [{
      id: 'req-1',
      type: 'do' as const,
      description: 'set the Timer',
      elementId: 'el-1',
    }];
    mountPanel();

    (document.querySelector('.req-delete-btn') as HTMLElement).click();

    await vi.waitFor(() => expect(document.querySelector('#confirm-yes')).not.toBeNull());
    (document.querySelector('#confirm-yes') as HTMLElement).click();
    await vi.waitFor(() => expect(getWizardState().requirements).toHaveLength(0));

    const updated = getWizardState();
    expect(updated.nonDataElements).toHaveLength(1);
    expect(updated.nonDataElements[0].name).toBe('Timer');
  });

  // ── Widget dropdown ─────────────────────────────────────────────────

  it('widget dropdown shows existing elements on focus', () => {
    const state = getWizardState();
    state.nonDataElements = [
      { id: 'el-1', name: 'Timer' },
      { id: 'el-2', name: 'Canvas' },
    ];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    switchToDo();

    document.getElementById('req-do-add-widget')!.click();
    const input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));

    const dropdown = document.getElementById('req-do-item-dropdown')!;
    expect(dropdown.style.display).toBe('block');
    const items = dropdown.querySelectorAll('.combobox-item');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('Timer');
    expect(items[1].textContent).toBe('Canvas');
  });

  it('widget dropdown does not appear when no elements exist', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();

    document.getElementById('req-do-add-widget')!.click();
    const input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    const dropdown = document.getElementById('req-do-item-dropdown')!;
    expect(dropdown.style.display).toBe('none');
  });

  it('exact widget name match suppresses "Create" option', () => {
    const state = getWizardState();
    state.nonDataElements = [{ id: 'el-1', name: 'Timer' }];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    switchToDo();

    document.getElementById('req-do-add-widget')!.click();
    const input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.value = 'timer';
    input.dispatchEvent(new Event('input'));

    const dropdown = document.getElementById('req-do-item-dropdown')!;
    const createItem = dropdown.querySelector('.combobox-create');
    expect(createItem).toBeNull();
  });

  it('clicking a widget dropdown item selects it', () => {
    const state = getWizardState();
    state.nonDataElements = [{ id: 'el-1', name: 'Timer' }];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('start the Timer');

    document.getElementById('req-do-add-widget')!.click();
    const input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));

    const dropdown = document.getElementById('req-do-item-dropdown')!;
    const item = dropdown.querySelector('.combobox-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('mousedown'));

    // Chip should appear
    expect(document.querySelectorAll('.item-chip')).toHaveLength(1);

    saveForm();

    const updated = getWizardState();
    expect(updated.nonDataElements).toHaveLength(1);
    expect(updated.requirements[0].elementId).toBe('el-1');
  });

  // ── Duplicate data type prevention ───────────────────────────────────

  it('already-selected data type is excluded from combobox dropdown', () => {
    const state = getWizardState();
    state.recordTypes = [
      { id: 'rt-1', name: '', displayName: 'book', description: '', fields: [], source: 'new' as const },
      { id: 'rt-2', name: '', displayName: 'grocery item', description: '', fields: [], source: 'new' as const },
    ];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('manage books and groceries');

    // Add "book" as a chip first
    document.getElementById('req-do-add-data')!.click();
    let input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    let items = document.querySelectorAll('#req-do-item-dropdown .combobox-item:not(.combobox-create)');
    expect(items).toHaveLength(2); // both available initially
    const bookItem = items[0] as HTMLElement;
    bookItem.dispatchEvent(new MouseEvent('mousedown'));

    // Now open combobox again — "book" should be excluded
    document.getElementById('req-do-add-data')!.click();
    input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    items = document.querySelectorAll('#req-do-item-dropdown .combobox-item:not(.combobox-create)');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toBe('grocery item');
  });

  // ── Multiple data types on one requirement ─────────────────────────

  it('supports multiple data type chips on one requirement', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('manage my grocery lists and items');
    addDataTypeChip('grocery item');
    addDataTypeChip('grocery list');

    const chips = document.querySelectorAll('.item-chip');
    expect(chips).toHaveLength(2);

    saveForm();

    const state = getWizardState();
    expect(state.requirements[0].dataTypeIds).toHaveLength(2);
    expect(state.recordTypes).toHaveLength(2);
    expect(state.recordTypes[0].displayName).toBe('grocery item');
    expect(state.recordTypes[1].displayName).toBe('grocery list');
  });

  // ── Chip removal re-validates ──────────────────────────────────────

  it('removing last chip disables save button', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('track something');
    addDataTypeChip('item');

    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);

    // Remove the only chip
    (document.querySelector('.item-chip-remove') as HTMLElement).click();
    expect(saveBtn.disabled).toBe(true);
  });

  it('removing one of two chips keeps save enabled', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDescription('manage stuff');
    addDataTypeChip('item A');
    addDataTypeChip('item B');

    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);

    // Remove first chip
    const removeButtons = document.querySelectorAll('.item-chip-remove');
    (removeButtons[0] as HTMLElement).click();

    expect(saveBtn.disabled).toBe(false);
    expect(document.querySelectorAll('.item-chip')).toHaveLength(1);
  });

  // ── Combobox cancel via Escape ─────────────────────────────────────

  it('pressing Escape closes combobox without adding a chip', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();

    document.getElementById('req-do-add-data')!.click();
    expect(document.getElementById('req-do-item-input')).not.toBeNull();

    const input = document.getElementById('req-do-item-input') as HTMLInputElement;
    input.value = 'something';
    input.dispatchEvent(new Event('input'));

    // Press Escape
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    // Combobox area should be cleared, no chip added
    expect(document.getElementById('req-do-item-input')).toBeNull();
    expect(document.querySelectorAll('.item-chip')).toHaveLength(0);
  });

  // ── Display ─────────────────────────────────────────────────────────

  it('renders widget requirement with description and widget meta', () => {
    const state = getWizardState();
    state.nonDataElements = [{ id: 'el-1', name: 'Timer' }];
    state.requirements = [{
      id: 'req-1',
      type: 'do' as const,
      description: 'set the Timer',
      elementId: 'el-1',
    }];
    const html = renderRequirementsPanel();
    expect(html).toContain('set the Timer');
    expect(html).toContain('Timer (widget)');
  });

  it('renders mixed requirement with data types and widget in meta', () => {
    const state = getWizardState();
    state.nonDataElements = [{ id: 'el-1', name: 'Timer' }];
    state.recordTypes = [
      { id: 'rt-1', name: '', displayName: 'presets', description: '', fields: [], source: 'new' as const },
    ];
    state.requirements = [{
      id: 'req-1',
      type: 'do' as const,
      description: 'set timer using saved presets',
      elementId: 'el-1',
      dataTypeIds: ['rt-1'],
    }];
    const html = renderRequirementsPanel();
    expect(html).toContain('set timer using saved presets');
    expect(html).toContain('presets');
    expect(html).toContain('Timer (widget)');
  });
});

// ── Migration of old "do" requirement fields ─────────────────────────

describe('do requirement field migration', () => {
  it('migrates verb + data to description', () => {
    const oldState = initializeWizardState();
    // Simulate old-format requirement via cast
    const legacy = {
      id: 'req-1',
      type: 'do' as const,
      verb: 'create',
      data: 'book',
      dataTypeId: 'rt-1',
      interactionTarget: 'data',
    };
    oldState.requirements = [legacy as unknown as Requirement];
    setWizardState(oldState);

    const state = getWizardState();
    const req = state.requirements[0];
    expect(req.description).toBe('create book');
    expect(req.dataTypeIds).toEqual(['rt-1']);
    // Old fields should be removed
    const raw = req as unknown as Record<string, unknown>;
    expect(raw.verb).toBeUndefined();
    expect(raw.data).toBeUndefined();
    expect(raw.dataTypeId).toBeUndefined();
    expect(raw.interactionTarget).toBeUndefined();
  });

  it('migrates verb-only (no data) to description', () => {
    const oldState = initializeWizardState();
    const legacy = {
      id: 'req-1',
      type: 'do' as const,
      verb: 'set',
      dataTypeId: undefined,
      interactionTarget: 'element',
      elementId: 'el-1',
    };
    oldState.requirements = [legacy as unknown as Requirement];
    setWizardState(oldState);

    const req = getWizardState().requirements[0];
    expect(req.description).toBe('set');
    expect(req.elementId).toBe('el-1');
  });

  it('migrates usesDataTypeId into dataTypeIds array', () => {
    const oldState = initializeWizardState();
    const legacy = {
      id: 'req-1',
      type: 'do' as const,
      verb: 'set',
      data: 'Timer',
      dataTypeId: 'rt-1',
      interactionTarget: 'element',
      elementId: 'el-1',
      usesDataTypeId: 'rt-2',
    };
    oldState.requirements = [legacy as unknown as Requirement];
    setWizardState(oldState);

    const req = getWizardState().requirements[0];
    expect(req.dataTypeIds).toEqual(['rt-1', 'rt-2']);
    const raw = req as unknown as Record<string, unknown>;
    expect(raw.usesDataTypeId).toBeUndefined();
  });

  it('does not duplicate when usesDataTypeId equals dataTypeId', () => {
    const oldState = initializeWizardState();
    const legacy = {
      id: 'req-1',
      type: 'do' as const,
      verb: 'configure',
      data: 'settings',
      dataTypeId: 'rt-1',
      interactionTarget: 'element',
      elementId: 'el-1',
      usesDataTypeId: 'rt-1', // same as dataTypeId
    };
    oldState.requirements = [legacy as unknown as Requirement];
    setWizardState(oldState);

    const req = getWizardState().requirements[0];
    expect(req.dataTypeIds).toEqual(['rt-1']); // no duplicate
  });

  it('does not migrate know or navigate requirements', () => {
    const oldState = initializeWizardState();
    oldState.requirements = [
      { id: 'req-1', type: 'know' as const, text: 'some info' },
      { id: 'req-2', type: 'navigate' as const, navType: 'direct' as const, fromView: 'v1', toView: 'v2' },
    ];
    setWizardState(oldState);

    const state = getWizardState();
    expect(state.requirements[0].text).toBe('some info');
    expect(state.requirements[1].navType).toBe('direct');
    // No description field added to non-do requirements
    expect(state.requirements[0].description).toBeUndefined();
  });

  it('migrates element-only requirement with usesDataTypeId but no dataTypeId', () => {
    const oldState = initializeWizardState();
    const legacy = {
      id: 'req-1',
      type: 'do' as const,
      verb: 'set',
      interactionTarget: 'element',
      elementId: 'el-1',
      usesDataTypeId: 'rt-1',
    };
    oldState.requirements = [legacy as unknown as Requirement];
    setWizardState(oldState);

    const req = getWizardState().requirements[0];
    expect(req.description).toBe('set');
    expect(req.elementId).toBe('el-1');
    expect(req.dataTypeIds).toEqual(['rt-1']);
    const raw = req as unknown as Record<string, unknown>;
    expect(raw.usesDataTypeId).toBeUndefined();
    expect(raw.interactionTarget).toBeUndefined();
  });
});

// ── Navigate wiring (with views) ─────────────────────────────────────

describe('navigate requirements with views', () => {
  function makeViews(): View[] {
    return [
      { id: 'v1', name: 'Home', blockIds: [] },
      { id: 'v2', name: 'Profile', blockIds: [] },
      { id: 'v3', name: 'Settings', blockIds: [] },
    ];
  }

  function mountPanelWithViews(): void {
    const state = initializeWizardState();
    state.views = makeViews();
    setWizardState(state);
    document.body.innerHTML = `
      <div id="workspace-panel-body">${renderRequirementsPanel()}</div>
      <div class="sidebar-section" data-section="requirements">
        <span class="badge">0</span>
        <div class="sidebar-items"><div class="sidebar-item-empty">None yet</div></div>
      </div>
      <div class="sidebar-section" data-section="data">
        <span class="badge">0</span>
        <div class="sidebar-items"><div class="sidebar-item-empty">None yet</div></div>
      </div>
    `;
    wireRequirementsPanel();
  }

  function openNavForm(navType: string): void {
    document.getElementById('req-add-btn')!.click();
    selectType('navigate');
    if (navType !== 'direct') {
      const navTypeSelect = document.getElementById('req-nav-type-select') as HTMLSelectElement;
      navTypeSelect.value = navType;
      navTypeSelect.dispatchEvent(new Event('change'));
    }
  }

  beforeEach(() => {
    localStorage.clear();
  });

  // ── Direct Link ──

  it('Direct Link: save enables when both views selected', () => {
    mountPanelWithViews();
    openNavForm('direct');

    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    const from = document.getElementById('req-nav-from') as HTMLSelectElement;
    const to = document.getElementById('req-nav-to') as HTMLSelectElement;
    from.value = 'v1';
    from.dispatchEvent(new Event('change'));
    expect(saveBtn.disabled).toBe(true); // still need "to"

    to.value = 'v2';
    to.dispatchEvent(new Event('change'));
    expect(saveBtn.disabled).toBe(false);
  });

  it('Direct Link: saves with view IDs', () => {
    mountPanelWithViews();
    openNavForm('direct');

    const from = document.getElementById('req-nav-from') as HTMLSelectElement;
    const to = document.getElementById('req-nav-to') as HTMLSelectElement;
    from.value = 'v1';
    from.dispatchEvent(new Event('change'));
    to.value = 'v2';
    to.dispatchEvent(new Event('change'));
    (document.querySelector('.req-save-btn') as HTMLElement).click();

    const req = getWizardState().requirements[0];
    expect(req.type).toBe('navigate');
    expect(req.navType).toBe('direct');
    expect(req.fromView).toBe('v1');
    expect(req.toView).toBe('v2');
  });

  // ── Navigation Menu ──

  it('Menu: save enables with include-all (default) and at least one visible-on', () => {
    mountPanelWithViews();
    openNavForm('menu');

    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    // Include all is checked, all visible-on are checked by default
    expect(saveBtn.disabled).toBe(false);
  });

  it('Menu: unchecking include-all shows manual checkbox list', () => {
    mountPanelWithViews();
    openNavForm('menu');

    const toggle = document.getElementById('menu-include-all-views') as HTMLInputElement;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));

    expect(document.getElementById('menu-items-preview')!.style.display).toBe('none');
    expect(document.getElementById('menu-items-manual')!.style.display).not.toBe('none');
  });

  it('Menu: save disabled when include-all unchecked and no items selected', () => {
    mountPanelWithViews();
    openNavForm('menu');

    const toggle = document.getElementById('menu-include-all-views') as HTMLInputElement;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));

    // Uncheck all menu items
    document.querySelectorAll('.menu-item-cb').forEach((cb) => {
      (cb as HTMLInputElement).checked = false;
      cb.dispatchEvent(new Event('change'));
    });

    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('Menu: saves with menuIncludeAllViews', () => {
    mountPanelWithViews();
    openNavForm('menu');

    (document.querySelector('.req-save-btn') as HTMLElement).click();

    const req = getWizardState().requirements[0];
    expect(req.navType).toBe('menu');
    expect(req.menuIncludeAllViews).toBe(true);
    expect(req.menuItems).toBeUndefined();
  });

  it('Menu: saves manual items when include-all unchecked', () => {
    mountPanelWithViews();
    openNavForm('menu');

    const toggle = document.getElementById('menu-include-all-views') as HTMLInputElement;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));

    // Uncheck the first menu item (Home)
    const cbs = document.querySelectorAll('.menu-item-cb') as NodeListOf<HTMLInputElement>;
    cbs[0].checked = false;
    cbs[0].dispatchEvent(new Event('change'));

    (document.querySelector('.req-save-btn') as HTMLElement).click();

    const req = getWizardState().requirements[0];
    expect(req.menuIncludeAllViews).toBe(false);
    expect(req.menuItems).toEqual(['v2', 'v3']);
  });

  // ── Forward/Back ──

  it('Forward/Back: save enables when views exist', () => {
    mountPanelWithViews();
    openNavForm('forward-back');

    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
  });

  it('Forward/Back: saves page order and control type', () => {
    mountPanelWithViews();
    openNavForm('forward-back');

    (document.querySelector('.req-save-btn') as HTMLElement).click();

    const req = getWizardState().requirements[0];
    expect(req.navType).toBe('forward-back');
    expect(req.pageOrder).toEqual(['v1', 'v2', 'v3']);
    expect(req.navControlType).toBe('arrows');
  });

  it('Forward/Back: reorder buttons swap items', () => {
    mountPanelWithViews();
    openNavForm('forward-back');

    // Move second item (Profile) up
    const downBtns = document.querySelectorAll('.page-order-up');
    (downBtns[1] as HTMLElement).click(); // index 1 up button

    const items = document.querySelectorAll('#req-page-order .reorder-item');
    expect((items[0] as HTMLElement).dataset.viewId).toBe('v2');
    expect((items[1] as HTMLElement).dataset.viewId).toBe('v1');
    expect((items[2] as HTMLElement).dataset.viewId).toBe('v3');
  });

  it('Forward/Back: control type toggle shows/hides button text fields', () => {
    mountPanelWithViews();
    openNavForm('forward-back');

    const controlType = document.getElementById('req-nav-control-type') as HTMLSelectElement;
    const textRow = document.getElementById('req-nav-button-text-row')!;

    expect(textRow.style.display).toBe('none');

    controlType.value = 'buttons';
    controlType.dispatchEvent(new Event('change'));
    expect(textRow.style.display).toBe('grid');
  });

  it('Forward/Back: saves button text when control type is buttons', () => {
    mountPanelWithViews();
    openNavForm('forward-back');

    const controlType = document.getElementById('req-nav-control-type') as HTMLSelectElement;
    controlType.value = 'buttons';
    controlType.dispatchEvent(new Event('change'));

    (document.getElementById('req-nav-forward-text') as HTMLInputElement).value = 'Next';
    (document.getElementById('req-nav-back-text') as HTMLInputElement).value = 'Previous';

    (document.querySelector('.req-save-btn') as HTMLElement).click();

    const req = getWizardState().requirements[0];
    expect(req.navControlType).toBe('buttons');
    expect(req.buttonForwardText).toBe('Next');
    expect(req.buttonBackText).toBe('Previous');
  });

  // ── Edit round-trip ──

  it('editing a Direct Link pre-fills from/to views', () => {
    const state = initializeWizardState();
    state.views = makeViews();
    state.requirements = [
      { id: 'req-dl', type: 'navigate', navType: 'direct', fromView: 'v1', toView: 'v3' },
    ];
    setWizardState(state);
    document.body.innerHTML = `
      <div id="workspace-panel-body">${renderRequirementsPanel()}</div>
      <div class="sidebar-section" data-section="requirements">
        <span class="badge">1</span>
        <div class="sidebar-items"></div>
      </div>
      <div class="sidebar-section" data-section="data">
        <span class="badge">0</span>
        <div class="sidebar-items"></div>
      </div>
    `;
    wireRequirementsPanel();

    (document.querySelector('.req-edit-btn') as HTMLElement).click();

    const from = document.getElementById('req-nav-from') as HTMLSelectElement;
    const to = document.getElementById('req-nav-to') as HTMLSelectElement;
    expect(from.value).toBe('v1');
    expect(to.value).toBe('v3');
  });

  it('editing a Menu pre-fills include-all toggle and visible-on', () => {
    const state = initializeWizardState();
    state.views = makeViews();
    state.requirements = [
      {
        id: 'req-menu',
        type: 'navigate',
        navType: 'menu',
        menuIncludeAllViews: false,
        menuItems: ['v1', 'v2'],
      },
    ];
    setWizardState(state);
    document.body.innerHTML = `
      <div id="workspace-panel-body">${renderRequirementsPanel()}</div>
      <div class="sidebar-section" data-section="requirements">
        <span class="badge">1</span>
        <div class="sidebar-items"></div>
      </div>
      <div class="sidebar-section" data-section="data">
        <span class="badge">0</span>
        <div class="sidebar-items"></div>
      </div>
    `;
    wireRequirementsPanel();

    (document.querySelector('.req-edit-btn') as HTMLElement).click();

    const toggle = document.getElementById('menu-include-all-views') as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    // Manual list should be visible
    expect(document.getElementById('menu-items-manual')!.style.display).not.toBe('none');

    const menuCbs = document.querySelectorAll('.menu-item-cb') as NodeListOf<HTMLInputElement>;
    expect(menuCbs[0].checked).toBe(true);  // v1
    expect(menuCbs[1].checked).toBe(true);  // v2
    expect(menuCbs[2].checked).toBe(false); // v3
  });

  // ── Include-all menu reflects current views ──

  it('menu with includeAllViews reflects views at render time', () => {
    const state = initializeWizardState();
    state.views = [
      { id: 'v1', name: 'Home', blockIds: [] },
      { id: 'v2', name: 'Profile', blockIds: [] },
    ];
    state.requirements = [
      { id: 'req-menu', type: 'navigate', navType: 'menu', menuIncludeAllViews: true },
    ];
    setWizardState(state);

    // Add a new view
    state.views.push({ id: 'v3', name: 'Settings', blockIds: [] });

    // Display text should show "all views" (derived, not stored)
    expect(getDisplayText(state.requirements[0])).toBe('Navigation menu: all views');
  });
});
