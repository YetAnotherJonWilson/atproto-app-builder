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
import type { Requirement, RecordType } from '../../src/types/wizard';

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

// ── Display text ───────────────────────────────────────────────────────

describe('getDisplayText', () => {
  it('returns text for know type', () => {
    const req = makeRequirement({ type: 'know', text: 'how this app works' });
    expect(getDisplayText(req)).toBe('how this app works');
  });

  it('returns "I need to [verb] [data]" for do type', () => {
    const req = makeRequirement({ type: 'do', verb: 'create', data: 'a bookmark' });
    expect(getDisplayText(req)).toBe('I need to create a bookmark');
  });

  it('returns "I need to go from [A] to [B]" for direct navigate type', () => {
    const req = makeRequirement({ type: 'navigate', navType: 'direct', fromView: 'Home', toView: 'Detail' });
    expect(getDisplayText(req)).toBe('I need to go from Home to Detail');
  });

  it('returns "Navigation menu" for menu navigate type', () => {
    const req = makeRequirement({ type: 'navigate', navType: 'menu' });
    expect(getDisplayText(req)).toBe('Navigation menu');
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
    const req = makeRequirement({ type: 'navigate', fromView: 'Home', toView: 'Detail' });
    expect(getDisplayText(req)).toBe('I need to go from Home to Detail');
  });

  it('handles missing fields gracefully', () => {
    const req = makeRequirement({ type: 'know' });
    expect(getDisplayText(req)).toBe('');
  });
});

describe('getSidebarText', () => {
  it('returns truncated "Know: [text]"', () => {
    const req = makeRequirement({ type: 'know', text: 'how this app works' });
    expect(getSidebarText(req)).toBe('Know: how this app works');
  });

  it('returns truncated "Do: [verb] [data]"', () => {
    const req = makeRequirement({ type: 'do', verb: 'create', data: 'a bookmark' });
    expect(getSidebarText(req)).toBe('Do: create a bookmark');
  });

  it('returns "Nav: [A] → [B]" for direct navigate', () => {
    const req = makeRequirement({ type: 'navigate', navType: 'direct', fromView: 'Home', toView: 'Detail' });
    expect(getSidebarText(req)).toBe('Nav: Home → Detail');
  });

  it('returns "Nav: Menu" for menu navigate', () => {
    const req = makeRequirement({ type: 'navigate', navType: 'menu' });
    expect(getSidebarText(req)).toBe('Nav: Menu');
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
      makeRequirement({ type: 'do', verb: 'track', data: 'sessions' }),
    ];
    const html = renderRequirementsPanel();
    expect(html).not.toContain('Build a Decentralized Web App');
    expect(html).toContain('Add Requirement');
    expect(html).toContain('item-grid');
    expect(html).toContain('how this works');
    expect(html).toContain('I need to track sessions');
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
      makeRequirement({ type: 'do', verb: 'track', data: 'items' }),
      makeRequirement({ type: 'navigate', navType: 'direct' }),
    ];
    const html = renderRequirementsPanel();
    expect(html).toContain('Information');
    expect(html).toContain('Data Interaction');
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
    expect(document.getElementById('req-related-view')).not.toBeNull();
  });

  it('Type dropdown defaults to "know" when adding new', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    expect(typeSelect.value).toBe('know');
    expect(document.getElementById('req-know-text')).not.toBeNull();
  });

  it('changing Type dropdown to "do" shows verb and data fields', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    typeSelect.value = 'do';
    typeSelect.dispatchEvent(new Event('change'));
    expect(document.getElementById('req-do-verb')).not.toBeNull();
    expect(document.getElementById('req-do-data')).not.toBeNull();
    expect(document.getElementById('req-know-text')).toBeNull();
  });

  // ── Navigate sub-form tests ───────────────────────────────────────

  it('changing Type to navigate shows Type of Navigation dropdown instead of Related View', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    typeSelect.value = 'navigate';
    typeSelect.dispatchEvent(new Event('change'));
    // Related View should be gone, nav type dropdown should appear
    expect(document.getElementById('req-related-view')).toBeNull();
    expect(document.getElementById('req-nav-type-select')).not.toBeNull();
  });

  it('switching back from navigate to know restores Related View dropdown', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    typeSelect.value = 'navigate';
    typeSelect.dispatchEvent(new Event('change'));
    expect(document.getElementById('req-related-view')).toBeNull();

    typeSelect.value = 'know';
    typeSelect.dispatchEvent(new Event('change'));
    expect(document.getElementById('req-related-view')).not.toBeNull();
    expect(document.getElementById('req-nav-type-select')).toBeNull();
  });

  it('navigate defaults to Direct Link with disabled From/To dropdowns', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    typeSelect.value = 'navigate';
    typeSelect.dispatchEvent(new Event('change'));

    const navTypeSelect = document.getElementById('req-nav-type-select') as HTMLSelectElement;
    expect(navTypeSelect.value).toBe('direct');
    expect(document.getElementById('req-nav-from')).not.toBeNull();
    expect((document.getElementById('req-nav-from') as HTMLSelectElement).disabled).toBe(true);
    expect((document.getElementById('req-nav-to') as HTMLSelectElement).disabled).toBe(true);
  });

  it('changing nav type to menu shows explanatory text and checkbox placeholders', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    typeSelect.value = 'navigate';
    typeSelect.dispatchEvent(new Event('change'));

    const navTypeSelect = document.getElementById('req-nav-type-select') as HTMLSelectElement;
    navTypeSelect.value = 'menu';
    navTypeSelect.dispatchEvent(new Event('change'));

    const fieldsArea = document.getElementById('req-type-fields')!;
    expect(fieldsArea.innerHTML).toContain('navigation menu');
    expect(fieldsArea.innerHTML).toContain('Menu Items');
    expect(fieldsArea.innerHTML).toContain('Show Menu On');
    expect(fieldsArea.querySelectorAll('.checkbox-list-placeholder')).toHaveLength(2);
  });

  it('changing nav type to forward-back shows page order and control type', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    typeSelect.value = 'navigate';
    typeSelect.dispatchEvent(new Event('change'));

    const navTypeSelect = document.getElementById('req-nav-type-select') as HTMLSelectElement;
    navTypeSelect.value = 'forward-back';
    navTypeSelect.dispatchEvent(new Event('change'));

    const fieldsArea = document.getElementById('req-type-fields')!;
    expect(fieldsArea.innerHTML).toContain('Page Order');
    expect(fieldsArea.innerHTML).toContain('Control Type');
    expect(document.getElementById('req-nav-control-type')).not.toBeNull();
    expect((document.getElementById('req-nav-control-type') as HTMLSelectElement).disabled).toBe(true);
  });

  it('Navigation Menu option is disabled when a menu requirement already exists', () => {
    const menuReq = makeRequirement({ type: 'navigate', navType: 'menu' });
    const state = getWizardState();
    state.requirements = [menuReq];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    typeSelect.value = 'navigate';
    typeSelect.dispatchEvent(new Event('change'));

    const navTypeSelect = document.getElementById('req-nav-type-select') as HTMLSelectElement;
    const menuOption = navTypeSelect.querySelector('option[value="menu"]') as HTMLOptionElement;
    expect(menuOption.disabled).toBe(true);
  });

  it('Forward/Back option is disabled when a forward-back requirement already exists', () => {
    const fbReq = makeRequirement({ type: 'navigate', navType: 'forward-back' });
    const state = getWizardState();
    state.requirements = [fbReq];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    typeSelect.value = 'navigate';
    typeSelect.dispatchEvent(new Event('change'));

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
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    typeSelect.value = 'navigate';
    typeSelect.dispatchEvent(new Event('change'));

    const navTypeSelect = document.getElementById('req-nav-type-select') as HTMLSelectElement;
    const directOption = navTypeSelect.querySelector('option[value="direct"]') as HTMLOptionElement;
    expect(directOption.disabled).toBe(false);
  });

  // ── Standard form behavior tests ──────────────────────────────────

  it('Type dropdown is set to requirement type when editing', () => {
    const req = makeRequirement({ type: 'do', verb: 'create', data: 'a bookmark' });
    const state = getWizardState();
    state.requirements = [req];
    mountPanel();

    (document.querySelector('.req-edit-btn') as HTMLElement).click();
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    expect(typeSelect.value).toBe('do');
    expect(document.getElementById('req-do-verb')).not.toBeNull();
    expect((document.getElementById('req-do-verb') as HTMLInputElement).value).toBe('create');
    expect((document.getElementById('req-do-data') as HTMLInputElement).value).toBe('a bookmark');
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

  it('save button stays disabled when only verb is filled for do type', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    typeSelect.value = 'do';
    typeSelect.dispatchEvent(new Event('change'));
    const verb = document.getElementById('req-do-verb') as HTMLInputElement;
    verb.value = 'create';
    verb.dispatchEvent(new Event('input'));
    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('save button enables when both verb and data are filled', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    typeSelect.value = 'do';
    typeSelect.dispatchEvent(new Event('change'));
    const verb = document.getElementById('req-do-verb') as HTMLInputElement;
    const data = document.getElementById('req-do-data') as HTMLInputElement;
    verb.value = 'create';
    verb.dispatchEvent(new Event('input'));
    data.value = 'a bookmark';
    data.dispatchEvent(new Event('input'));
    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
  });

  it('save button stays disabled for all navigate sub-forms (views not yet available)', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    typeSelect.value = 'navigate';
    typeSelect.dispatchEvent(new Event('change'));
    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    // Change to menu — still disabled
    const navTypeSelect = document.getElementById('req-nav-type-select') as HTMLSelectElement;
    navTypeSelect.value = 'menu';
    navTypeSelect.dispatchEvent(new Event('change'));
    expect(saveBtn.disabled).toBe(true);

    // Change to forward-back — still disabled
    navTypeSelect.value = 'forward-back';
    navTypeSelect.dispatchEvent(new Event('change'));
    expect(saveBtn.disabled).toBe(true);
  });

  it('saving a know requirement adds it to state and re-renders', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const textarea = document.getElementById('req-know-text') as HTMLTextAreaElement;
    textarea.value = 'how this works';
    textarea.dispatchEvent(new Event('input'));
    const contentArea = document.getElementById('req-know-content') as HTMLTextAreaElement;
    contentArea.value = 'A quick-start guide';
    contentArea.dispatchEvent(new Event('input'));
    (document.querySelector('.req-save-btn') as HTMLElement).click();

    const state = getWizardState();
    expect(state.requirements).toHaveLength(1);
    expect(state.requirements[0].type).toBe('know');
    expect(state.requirements[0].text).toBe('how this works');
    expect(state.requirements[0].content).toBe('A quick-start guide');
    expect(document.body.innerHTML).toContain('how this works');
  });

  it('saving a do requirement adds it to state', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    typeSelect.value = 'do';
    typeSelect.dispatchEvent(new Event('change'));
    const verb = document.getElementById('req-do-verb') as HTMLInputElement;
    const data = document.getElementById('req-do-data') as HTMLInputElement;
    verb.value = 'track';
    verb.dispatchEvent(new Event('input'));
    data.value = 'meditation sessions';
    data.dispatchEvent(new Event('input'));
    (document.querySelector('.req-save-btn') as HTMLElement).click();

    const state = getWizardState();
    expect(state.requirements).toHaveLength(1);
    expect(state.requirements[0].type).toBe('do');
    expect(state.requirements[0].verb).toBe('track');
    expect(state.requirements[0].data).toBe('meditation sessions');
  });

  it('deleting a requirement removes it from state and re-renders', () => {
    const req = makeRequirement({ type: 'know', text: 'something' });
    const state = getWizardState();
    state.requirements = [req];
    mountPanel();

    const deleteBtn = document.querySelector('.req-delete-btn') as HTMLElement;
    deleteBtn.click();

    expect(getWizardState().requirements).toHaveLength(0);
    expect(document.body.innerHTML).toContain('Build a Decentralized Web App');
  });

  it('editing a requirement pre-fills the form and updates in place', () => {
    const req1 = makeRequirement({ type: 'know', text: 'first' });
    const req2 = makeRequirement({ type: 'do', verb: 'create', data: 'a bookmark' });
    const req3 = makeRequirement({ type: 'know', text: 'third' });
    const state = getWizardState();
    state.requirements = [req1, req2, req3];
    mountPanel();

    const editBtns = document.querySelectorAll('.req-edit-btn');
    (editBtns[1] as HTMLElement).click();

    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    expect(typeSelect.value).toBe('do');

    const verb = document.getElementById('req-do-verb') as HTMLInputElement;
    const data = document.getElementById('req-do-data') as HTMLInputElement;
    expect(verb.value).toBe('create');
    expect(data.value).toBe('a bookmark');

    const saveBtn = document.querySelector('.req-save-btn') as HTMLButtonElement;
    expect(saveBtn.textContent).toBe('Save');

    verb.value = 'save';
    verb.dispatchEvent(new Event('input'));
    saveBtn.click();

    const updated = getWizardState().requirements;
    expect(updated).toHaveLength(3);
    expect(updated[0].id).toBe(req1.id);
    expect(updated[1].id).toBe(req2.id);
    expect(updated[1].verb).toBe('save');
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
      makeRequirement({ type: 'do', verb: 'track', data: 'sessions' }),
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
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    typeSelect.value = 'do';
    typeSelect.dispatchEvent(new Event('change'));
  }

  function fillDoForm(verb: string, data: string): void {
    const verbEl = document.getElementById('req-do-verb') as HTMLInputElement;
    const dataEl = document.getElementById('req-do-data') as HTMLInputElement;
    verbEl.value = verb;
    verbEl.dispatchEvent(new Event('input'));
    dataEl.value = data;
    dataEl.dispatchEvent(new Event('input'));
  }

  function saveForm(): void {
    (document.querySelector('.req-save-btn') as HTMLElement).click();
  }

  // ── Combobox rendering ──────────────────────────────────────────────

  it('shows combobox with hint text when type is "do"', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();

    expect(document.getElementById('req-do-data-combobox')).not.toBeNull();
    expect(document.getElementById('req-do-data-dropdown')).not.toBeNull();
    const hint = document.querySelector('#req-type-fields .form-hint:last-child');
    expect(hint?.textContent).toContain('What kind of thing');
  });

  it('dropdown does not appear when no record types exist', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();

    const input = document.getElementById('req-do-data') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    const dropdown = document.getElementById('req-do-data-dropdown')!;
    expect(dropdown.style.display).toBe('none');
  });

  // ── Seeding ─────────────────────────────────────────────────────────

  it('saving a "do" requirement with new name seeds a RecordType', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDoForm('create', 'book');
    saveForm();

    const state = getWizardState();
    expect(state.recordTypes).toHaveLength(1);
    expect(state.recordTypes[0].displayName).toBe('book');
    expect(state.recordTypes[0].name).toBe('');
    // Should have system createdAt field
    expect(state.recordTypes[0].fields).toHaveLength(1);
    expect(state.recordTypes[0].fields[0].name).toBe('createdAt');
    expect(state.recordTypes[0].fields[0].isSystem).toBe(true);
    expect(state.requirements[0].dataTypeId).toBe(state.recordTypes[0].id);
  });

  it('saving a second "do" requirement with new name seeds another RecordType', () => {
    mountPanel();
    // First requirement
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDoForm('create', 'book');
    saveForm();

    // Second requirement
    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDoForm('list', 'grocery item');
    saveForm();

    const state = getWizardState();
    expect(state.recordTypes).toHaveLength(2);
    expect(state.recordTypes[0].displayName).toBe('book');
    expect(state.recordTypes[1].displayName).toBe('grocery item');
    expect(state.requirements[1].dataTypeId).toBe(state.recordTypes[1].id);
  });

  it('exact name match reuses existing RecordType (no duplicate)', () => {
    const state = getWizardState();
    state.recordTypes = [{
      id: 'existing-book',
      name: '',
      displayName: 'book',
      description: '',
      fields: [],
    }];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDoForm('update', 'book');
    saveForm();

    const updated = getWizardState();
    expect(updated.recordTypes).toHaveLength(1);
    expect(updated.requirements[0].dataTypeId).toBe('existing-book');
  });

  it('exact name match is case-insensitive', () => {
    const state = getWizardState();
    state.recordTypes = [{
      id: 'existing-book',
      name: '',
      displayName: 'Book',
      description: '',
      fields: [],
    }];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    switchToDo();
    fillDoForm('update', 'book');
    saveForm();

    const updated = getWizardState();
    expect(updated.recordTypes).toHaveLength(1);
    expect(updated.requirements[0].dataTypeId).toBe('existing-book');
  });

  it('editing a "do" requirement and changing data type creates new RecordType', () => {
    const state = getWizardState();
    state.recordTypes = [{
      id: 'rt-book',
      name: '',
      displayName: 'book',
      description: '',
      fields: [],
    }];
    state.requirements = [{
      id: 'req-1',
      type: 'do',
      verb: 'create',
      data: 'book',
      dataTypeId: 'rt-book',
    }];
    mountPanel();

    // Edit the requirement
    (document.querySelector('.req-edit-btn') as HTMLElement).click();
    const dataEl = document.getElementById('req-do-data') as HTMLInputElement;
    dataEl.value = 'novel';
    dataEl.dispatchEvent(new Event('input'));
    saveForm();

    const updated = getWizardState();
    // Old "book" RecordType is preserved (orphaned)
    expect(updated.recordTypes).toHaveLength(2);
    expect(updated.recordTypes[0].displayName).toBe('book');
    expect(updated.recordTypes[1].displayName).toBe('novel');
    expect(updated.requirements[0].dataTypeId).toBe(updated.recordTypes[1].id);
  });

  it('deleting a "do" requirement does not delete its RecordType', () => {
    const state = getWizardState();
    state.recordTypes = [{
      id: 'rt-book',
      name: '',
      displayName: 'book',
      description: '',
      fields: [],
    }];
    state.requirements = [{
      id: 'req-1',
      type: 'do',
      verb: 'create',
      data: 'book',
      dataTypeId: 'rt-book',
    }];
    mountPanel();

    (document.querySelector('.req-delete-btn') as HTMLElement).click();

    const updated = getWizardState();
    expect(updated.requirements).toHaveLength(0);
    expect(updated.recordTypes).toHaveLength(1);
    expect(updated.recordTypes[0].displayName).toBe('book');
  });

  // ── Type dropdown locking ───────────────────────────────────────────

  it('type dropdown is disabled when editing an existing requirement', () => {
    const state = getWizardState();
    state.requirements = [makeRequirement({ type: 'do', verb: 'create', data: 'book' })];
    mountPanel();

    (document.querySelector('.req-edit-btn') as HTMLElement).click();
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    expect(typeSelect.disabled).toBe(true);
  });

  it('type dropdown is enabled when adding a new requirement', () => {
    mountPanel();
    document.getElementById('req-add-btn')!.click();
    const typeSelect = document.getElementById('req-type-select') as HTMLSelectElement;
    expect(typeSelect.disabled).toBe(false);
  });

  // ── Dropdown behavior ──────────────────────────────────────────────

  it('dropdown shows existing record types on focus', () => {
    const state = getWizardState();
    state.recordTypes = [
      { id: 'rt-1', name: '', displayName: 'book', description: '', fields: [] },
      { id: 'rt-2', name: '', displayName: 'grocery item', description: '', fields: [] },
    ];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    switchToDo();

    const input = document.getElementById('req-do-data') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));

    const dropdown = document.getElementById('req-do-data-dropdown')!;
    expect(dropdown.style.display).toBe('block');
    const items = dropdown.querySelectorAll('.combobox-item');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('book');
    expect(items[1].textContent).toBe('grocery item');
  });

  it('dropdown filters items as user types', () => {
    const state = getWizardState();
    state.recordTypes = [
      { id: 'rt-1', name: '', displayName: 'book', description: '', fields: [] },
      { id: 'rt-2', name: '', displayName: 'grocery item', description: '', fields: [] },
    ];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    switchToDo();

    const input = document.getElementById('req-do-data') as HTMLInputElement;
    input.value = 'boo';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('focus'));

    const dropdown = document.getElementById('req-do-data-dropdown')!;
    const items = dropdown.querySelectorAll('.combobox-item:not(.combobox-create)');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toBe('book');

    // "Create" option should appear since "boo" is not an exact match
    const createItem = dropdown.querySelector('.combobox-create');
    expect(createItem).not.toBeNull();
  });

  it('exact match suppresses "Create" option', () => {
    const state = getWizardState();
    state.recordTypes = [
      { id: 'rt-1', name: '', displayName: 'book', description: '', fields: [] },
    ];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    switchToDo();

    const input = document.getElementById('req-do-data') as HTMLInputElement;
    input.value = 'book';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('focus'));

    const dropdown = document.getElementById('req-do-data-dropdown')!;
    const createItem = dropdown.querySelector('.combobox-create');
    expect(createItem).toBeNull();
  });

  it('clicking a dropdown item selects existing RecordType', () => {
    const state = getWizardState();
    state.recordTypes = [
      { id: 'rt-1', name: '', displayName: 'book', description: '', fields: [] },
    ];
    mountPanel();

    document.getElementById('req-add-btn')!.click();
    switchToDo();

    const input = document.getElementById('req-do-data') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));

    const dropdown = document.getElementById('req-do-data-dropdown')!;
    const item = dropdown.querySelector('.combobox-item') as HTMLElement;
    item.dispatchEvent(new MouseEvent('mousedown'));

    expect(input.value).toBe('book');

    // Fill verb and save
    const verb = document.getElementById('req-do-verb') as HTMLInputElement;
    verb.value = 'update';
    verb.dispatchEvent(new Event('input'));
    saveForm();

    const updated = getWizardState();
    expect(updated.recordTypes).toHaveLength(1);
    expect(updated.requirements[0].dataTypeId).toBe('rt-1');
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
