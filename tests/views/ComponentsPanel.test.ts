// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  renderComponentsPanel,
  wireComponentsPanel,
  updateComponentsSidebar,
} from '../../src/app/views/panels/ComponentsPanel';
import {
  getWizardState,
  saveWizardState,
  setWizardState,
  initializeWizardState,
} from '../../src/app/state/WizardState';
import type { Requirement, Component } from '../../src/types/wizard';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequirement(
  overrides: Partial<Requirement> & { type: Requirement['type'] },
): Requirement {
  return { id: `req-${Date.now()}-${Math.random()}`, ...overrides };
}

function makeComponent(
  overrides: Partial<Component> & { name: string; requirementIds: string[] },
): Component {
  return { id: `component-${Date.now()}-${Math.random()}`, ...overrides };
}

function setupState(opts: {
  requirements?: Requirement[];
  components?: Component[];
}): void {
  const state = initializeWizardState();
  state.requirements = opts.requirements ?? [];
  state.components = opts.components ?? [];
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

// ── Empty state ─────────────────────────────────────────────────────

describe('ComponentsPanel — empty state', () => {
  beforeEach(() => {
    setupState({});
  });

  it('shows guidance when no requirements exist', () => {
    const html = renderComponentsPanel();
    expect(html).toContain('No components yet');
    expect(html).toContain('Define some requirements first');
  });
});

// ── Panel with requirements but no components ────────────────────────────

describe('ComponentsPanel — requirements, no components', () => {
  let reqs: Requirement[];

  beforeEach(() => {
    reqs = [
      makeRequirement({ type: 'know', text: 'App description' }),
      makeRequirement({ type: 'do', verb: 'create', data: 'Post' }),
      makeRequirement({ type: 'navigate', navType: 'direct', fromView: 'Home', toView: 'Profile' }),
    ];
    setupState({ requirements: reqs });
  });

  it('renders the workspace description', () => {
    const html = renderComponentsPanel();
    expect(html).toContain('Turn your requirements into buildable pieces');
  });

  it('shows all requirements in unassigned section', () => {
    const html = renderComponentsPanel();
    expect(html).toContain('Unassigned Requirements');
    expect(html).toContain('3 remaining');
    expect(html).toContain('App description');
    expect(html).toContain('create Post');
  });

  it('shows quick-create buttons for unassigned requirements', () => {
    const html = renderComponentsPanel();
    expect(html).toContain('+ Component');
    expect(html).toContain('quick-create-dropdown');
  });

  it('shows correct quick-create options for know type', () => {
    const html = renderComponentsPanel();
    expect(html).toContain('Paragraph');
    expect(html).toContain('Section');
    expect(html).toContain('Heading');
  });

  it('shows correct quick-create options for do type', () => {
    const html = renderComponentsPanel();
    expect(html).toContain('Form');
    expect(html).toContain('List');
    expect(html).toContain('Card');
  });

  it('shows correct quick-create options for navigate type', () => {
    const html = renderComponentsPanel();
    expect(html).toContain('Link');
    expect(html).toContain('Button');
    expect(html).toContain('Menu Item');
  });

  it('shows hint text explaining shortcuts', () => {
    const html = renderComponentsPanel();
    expect(html).toContain('Click');
    expect(html).toContain('+ New Component');
  });
});

// ── Panel with components ────────────────────────────────────────────────

describe('ComponentsPanel — with components', () => {
  let reqs: Requirement[];
  let components: Component[];

  beforeEach(() => {
    reqs = [
      makeRequirement({ type: 'know', text: 'App description' }),
      makeRequirement({ type: 'do', verb: 'create', data: 'Post' }),
      makeRequirement({ type: 'do', verb: 'search', data: 'Post' }),
      makeRequirement({ type: 'navigate', navType: 'direct', fromView: 'Home', toView: 'Profile' }),
    ];
    components = [
      makeComponent({ name: 'About Section', requirementIds: [reqs[0].id] }),
      makeComponent({ name: 'Post Feed', requirementIds: [reqs[1].id, reqs[2].id] }),
    ];
    setupState({ requirements: reqs, components });
  });

  it('renders component cards', () => {
    const html = renderComponentsPanel();
    expect(html).toContain('About Section');
    expect(html).toContain('Post Feed');
  });

  it('shows requirement details in component cards', () => {
    const html = renderComponentsPanel();
    expect(html).toContain('App description');
    expect(html).toContain('create Post');
    expect(html).toContain('search Post');
  });

  it('shows type badges on requirements', () => {
    const html = renderComponentsPanel();
    expect(html).toContain('know');
    expect(html).toContain('do');
  });

  it('shows numbered order on requirements', () => {
    const html = renderComponentsPanel();
    // Post Feed has 2 requirements
    expect(html).toContain('>1<');
    expect(html).toContain('>2<');
  });

  it('shows reorder buttons on multi-requirement components', () => {
    const html = renderComponentsPanel();
    expect(html).toContain('reorder-btns');
    expect(html).toContain('component-reorder-up');
    expect(html).toContain('component-reorder-down');
  });

  it('does not show reorder buttons on single-requirement components', () => {
    // About Section has 1 requirement — no reorder buttons
    const html = renderComponentsPanel();
    const aboutIdx = html.indexOf('About Section');
    const postFeedIdx = html.indexOf('Post Feed');
    const aboutSection = html.slice(aboutIdx, postFeedIdx);
    expect(aboutSection).not.toContain('reorder-btns');
  });

  it('shows edit and delete buttons on component cards', () => {
    const html = renderComponentsPanel();
    expect(html).toContain('component-edit-btn');
    expect(html).toContain('component-delete-btn');
  });

  it('shows unassigned section for remaining requirements', () => {
    const html = renderComponentsPanel();
    expect(html).toContain('Unassigned Requirements');
    expect(html).toContain('1 remaining');
  });

  it('hides unassigned section when all requirements assigned', () => {
    // Assign the nav requirement too
    const state = getWizardState();
    state.components.push(
      makeComponent({ name: 'Profile Link', requirementIds: [reqs[3].id] }),
    );
    const html = renderComponentsPanel();
    expect(html).not.toContain('Unassigned Requirements');
  });

  it('shows next step card', () => {
    const html = renderComponentsPanel();
    expect(html).toContain('Arrange components into Views');
  });
});

// ── Component creation via form ──────────────────────────────────────────

describe('ComponentsPanel — form interaction', () => {
  let reqs: Requirement[];

  beforeEach(() => {
    reqs = [
      makeRequirement({ type: 'know', text: 'App description' }),
      makeRequirement({ type: 'do', verb: 'create', data: 'Post' }),
    ];
    setupState({ requirements: reqs });
    renderAndWire();
  });

  it('opens inline form when add button is clicked', () => {
    const addBtn = document.getElementById('components-add-btn') as HTMLButtonElement;
    addBtn.click();

    const form = document.getElementById('components-form');
    expect(form?.style.display).toBe('block');
    expect(form?.innerHTML).toContain('component-name-input');
  });

  it('shows content editor when add button is clicked', () => {
    const addBtn = document.getElementById('components-add-btn') as HTMLButtonElement;
    addBtn.click();

    const nodesList = document.getElementById('content-nodes-list');
    expect(nodesList).toBeTruthy();
    const addContentBtn = document.getElementById('content-add-btn');
    expect(addContentBtn).toBeTruthy();
  });

  it('disables save button initially', () => {
    const addBtn = document.getElementById('components-add-btn') as HTMLButtonElement;
    addBtn.click();

    const saveBtn = document.getElementById('component-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('enables save button when name is entered', () => {
    const addBtn = document.getElementById('components-add-btn') as HTMLButtonElement;
    addBtn.click();

    const nameInput = document.getElementById('component-name-input') as HTMLInputElement;
    nameInput.value = 'About Section';
    nameInput.dispatchEvent(new Event('input'));

    const saveBtn = document.getElementById('component-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
  });

  it('adds content node via dropdown', () => {
    const addBtn = document.getElementById('components-add-btn') as HTMLButtonElement;
    addBtn.click();

    // Open dropdown and select Heading
    const addContentBtn = document.getElementById('content-add-btn') as HTMLButtonElement;
    addContentBtn.click();
    const option = document.querySelector('.content-add-option[data-node-type="heading"]') as HTMLElement;
    option.click();

    const cards = document.querySelectorAll('.content-node-card');
    expect(cards.length).toBe(1);
    expect(cards[0].querySelector('.content-node-type-label')?.textContent).toBe('Heading');
  });

  it('saves text component with content nodes and auto-creates requirement', () => {
    const addBtn = document.getElementById('components-add-btn') as HTMLButtonElement;
    addBtn.click();

    // Enter name
    const nameInput = document.getElementById('component-name-input') as HTMLInputElement;
    nameInput.value = 'About Section';
    nameInput.dispatchEvent(new Event('input'));

    // Add a heading node
    const addContentBtn = document.getElementById('content-add-btn') as HTMLButtonElement;
    addContentBtn.click();
    const option = document.querySelector('.content-add-option[data-node-type="heading"]') as HTMLElement;
    option.click();

    // Type text into the node
    const textarea = document.querySelector('.content-node-text') as HTMLTextAreaElement;
    textarea.value = 'Welcome';

    // Save
    const saveBtn = document.getElementById('component-save-btn') as HTMLButtonElement;
    saveBtn.click();

    const state = getWizardState();
    expect(state.components.length).toBe(1);
    expect(state.components[0].name).toBe('About Section');
    expect(state.components[0].componentType).toBe('text');
    expect(state.components[0].contentNodes).toEqual([{ type: 'heading', text: 'Welcome' }]);
    // Auto-created requirement
    expect(state.components[0].requirementIds.length).toBe(1);
    const autoReq = state.requirements.find(r => r.id === state.components[0].requirementIds[0]);
    expect(autoReq?.type).toBe('know');
    expect(autoReq?.text).toBe('About Section');
  });

  it('closes form after save', () => {
    const addBtn = document.getElementById('components-add-btn') as HTMLButtonElement;
    addBtn.click();

    const nameInput = document.getElementById('component-name-input') as HTMLInputElement;
    nameInput.value = 'Test Component';
    nameInput.dispatchEvent(new Event('input'));

    const saveBtn = document.getElementById('component-save-btn') as HTMLButtonElement;
    saveBtn.click();

    const form = document.getElementById('components-form');
    expect(form?.style.display).toBe('none');
  });

  it('cancels form without saving', () => {
    const addBtn = document.getElementById('components-add-btn') as HTMLButtonElement;
    addBtn.click();

    const cancelBtn = document.getElementById('component-cancel-btn') as HTMLButtonElement;
    cancelBtn.click();

    const form = document.getElementById('components-form');
    expect(form?.style.display).toBe('none');
    expect(getWizardState().components.length).toBe(0);
  });
});

// ── Component editing ────────────────────────────────────────────────────

describe('ComponentsPanel — editing', () => {
  let reqs: Requirement[];
  let component: Component;

  beforeEach(() => {
    reqs = [
      makeRequirement({ type: 'know', text: 'App description' }),
      makeRequirement({ type: 'do', verb: 'create', data: 'Post' }),
      makeRequirement({ type: 'do', verb: 'search', data: 'Post' }),
    ];
    component = makeComponent({ name: 'About Section', requirementIds: [reqs[0].id] });
    setupState({ requirements: reqs, components: [component] });
    renderAndWire();
  });

  it('opens form pre-populated when edit is clicked', () => {
    const editBtn = document.querySelector(`.component-edit-btn[data-component-id="${component.id}"]`) as HTMLButtonElement;
    editBtn.click();

    const nameInput = document.getElementById('component-name-input') as HTMLInputElement;
    expect(nameInput.value).toBe('About Section');

    const chips = document.querySelectorAll('.chip');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('App description');
  });

  it('saves edits to existing component', () => {
    const editBtn = document.querySelector(`.component-edit-btn[data-component-id="${component.id}"]`) as HTMLButtonElement;
    editBtn.click();

    // Change name
    const nameInput = document.getElementById('component-name-input') as HTMLInputElement;
    nameInput.value = 'Info Section';
    nameInput.dispatchEvent(new Event('input'));

    // Add another requirement
    const items = document.querySelectorAll('#component-available-list .available-item');
    (items[1] as HTMLElement).click(); // create Post

    const saveBtn = document.getElementById('component-save-btn') as HTMLButtonElement;
    saveBtn.click();

    const state = getWizardState();
    expect(state.components.length).toBe(1);
    expect(state.components[0].name).toBe('Info Section');
    expect(state.components[0].requirementIds).toEqual([reqs[0].id, reqs[1].id]);
  });

  it('shows Update Component label when editing', () => {
    const editBtn = document.querySelector(`.component-edit-btn[data-component-id="${component.id}"]`) as HTMLButtonElement;
    editBtn.click();

    const saveBtn = document.getElementById('component-save-btn') as HTMLButtonElement;
    expect(saveBtn.textContent?.trim()).toBe('Update Component');
  });
});

// ── Component deletion ───────────────────────────────────────────────────

describe('ComponentsPanel — deletion', () => {
  let reqs: Requirement[];
  let component: Component;

  beforeEach(() => {
    reqs = [
      makeRequirement({ type: 'know', text: 'App description' }),
    ];
    component = makeComponent({ name: 'About Section', requirementIds: [reqs[0].id] });
    setupState({ requirements: reqs, components: [component] });
    renderAndWire();
  });

  it('deletes component when delete button is clicked', () => {
    const deleteBtn = document.querySelector(`.component-delete-btn[data-component-id="${component.id}"]`) as HTMLButtonElement;
    deleteBtn.click();

    const state = getWizardState();
    expect(state.components.length).toBe(0);
  });

  it('does not delete requirements when component is deleted', () => {
    const deleteBtn = document.querySelector(`.component-delete-btn[data-component-id="${component.id}"]`) as HTMLButtonElement;
    deleteBtn.click();

    const state = getWizardState();
    expect(state.requirements.length).toBe(1);
    expect(state.requirements[0].text).toBe('App description');
  });
});

// ── Reordering ───────────────────────────────────────────────────────

describe('ComponentsPanel — reordering', () => {
  let reqs: Requirement[];
  let component: Component;

  beforeEach(() => {
    reqs = [
      makeRequirement({ type: 'do', verb: 'search', data: 'Post' }),
      makeRequirement({ type: 'do', verb: 'view', data: 'Post' }),
      makeRequirement({ type: 'do', verb: 'create', data: 'Post' }),
    ];
    component = makeComponent({
      name: 'Post Feed',
      requirementIds: [reqs[0].id, reqs[1].id, reqs[2].id],
    });
    setupState({ requirements: reqs, components: [component] });
    renderAndWire();
  });

  it('moves requirement down when down button is clicked', () => {
    const downBtn = document.querySelector(
      `.component-reorder-down[data-component-id="${component.id}"][data-req-index="0"]`,
    ) as HTMLButtonElement;
    downBtn.click();

    const state = getWizardState();
    expect(state.components[0].requirementIds).toEqual([
      reqs[1].id, reqs[0].id, reqs[2].id,
    ]);
  });

  it('moves requirement up when up button is clicked', () => {
    const upBtn = document.querySelector(
      `.component-reorder-up[data-component-id="${component.id}"][data-req-index="1"]`,
    ) as HTMLButtonElement;
    upBtn.click();

    const state = getWizardState();
    expect(state.components[0].requirementIds).toEqual([
      reqs[1].id, reqs[0].id, reqs[2].id,
    ]);
  });

  it('disables up button on first item', () => {
    const upBtn = document.querySelector(
      `.component-reorder-up[data-component-id="${component.id}"][data-req-index="0"]`,
    ) as HTMLButtonElement;
    expect(upBtn.disabled).toBe(true);
  });

  it('disables down button on last item', () => {
    const downBtn = document.querySelector(
      `.component-reorder-down[data-component-id="${component.id}"][data-req-index="2"]`,
    ) as HTMLButtonElement;
    expect(downBtn.disabled).toBe(true);
  });
});

// ── Multi-assignment ─────────────────────────────────────────────────

describe('ComponentsPanel — multi-assignment', () => {
  let reqs: Requirement[];

  beforeEach(() => {
    reqs = [
      makeRequirement({ type: 'do', verb: 'view', data: 'Post' }),
      makeRequirement({ type: 'do', verb: 'search', data: 'Post' }),
    ];
    const component1 = makeComponent({ name: 'Post Feed', requirementIds: [reqs[0].id, reqs[1].id] });
    setupState({ requirements: reqs, components: [component1] });
  });

  it('allows same requirement in multiple components', () => {
    const state = getWizardState();
    state.components.push(
      makeComponent({ name: 'Post Detail', requirementIds: [reqs[0].id] }),
    );

    const html = renderComponentsPanel();
    expect(html).toContain('Post Feed');
    expect(html).toContain('Post Detail');
  });

  it('does not show assigned requirement in unassigned list', () => {
    const html = renderComponentsPanel();
    // Both reqs are assigned
    expect(html).not.toContain('Unassigned Requirements');
  });

  it('opens content editor when creating new component', () => {
    renderAndWire();
    const addBtn = document.getElementById('components-add-btn') as HTMLButtonElement;
    addBtn.click();

    // New component form opens in content editor mode
    const nodesList = document.getElementById('content-nodes-list');
    expect(nodesList).toBeTruthy();
  });
});

// ── Deleted requirement handling ─────────────────────────────────────

describe('ComponentsPanel — deleted requirement handling', () => {
  it('filters out missing requirement ids from component cards', () => {
    const req = makeRequirement({ type: 'know', text: 'Still here' });
    const component = makeComponent({
      name: 'Mixed Component',
      requirementIds: [req.id, 'deleted-req-id'],
    });
    setupState({ requirements: [req], components: [component] });

    const html = renderComponentsPanel();
    expect(html).toContain('Still here');
    // Should not crash, should only show 1 requirement
    expect(html).toContain('>1<');
    // Should not contain a "2" order number
    expect(html).not.toContain('>2<');
  });
});

// ── Quick-create ─────────────────────────────────────────────────────

describe('ComponentsPanel — quick-create', () => {
  let reqs: Requirement[];

  beforeEach(() => {
    reqs = [
      makeRequirement({ type: 'know', text: 'App description' }),
      makeRequirement({ type: 'navigate', navType: 'direct', fromView: 'Home', toView: 'Profile' }),
    ];
    setupState({ requirements: reqs });
    renderAndWire();
  });

  it('creates component when quick-create option is clicked', () => {
    // Click the quick-create option
    const option = document.querySelector(
      `.quick-create-option[data-req-id="${reqs[0].id}"]`,
    ) as HTMLButtonElement;
    option.click();

    const state = getWizardState();
    expect(state.components.length).toBe(1);
    expect(state.components[0].name).toBe('App description'); // named from requirement text
    expect(state.components[0].requirementIds).toEqual([reqs[0].id]);
  });
});

// ── Sidebar ──────────────────────────────────────────────────────────

describe('ComponentsPanel — sidebar', () => {
  it('updates sidebar badge and items', () => {
    const reqs = [
      makeRequirement({ type: 'know', text: 'Desc' }),
    ];
    const components = [
      makeComponent({ name: 'About', requirementIds: [reqs[0].id] }),
      makeComponent({ name: 'Hero', requirementIds: [reqs[0].id] }),
    ];
    setupState({ requirements: reqs, components });

    document.body.innerHTML = `
      <div class="sidebar-section" data-section="components">
        <div class="badge">0</div>
        <div class="sidebar-items"></div>
      </div>
    `;

    updateComponentsSidebar();

    const badge = document.querySelector('.badge');
    expect(badge?.textContent).toBe('2');

    const items = document.querySelectorAll('.sidebar-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('About');
    expect(items[1].textContent).toContain('Hero');
  });

  it('shows "None yet" when no components exist', () => {
    setupState({});

    document.body.innerHTML = `
      <div class="sidebar-section" data-section="components">
        <div class="badge">0</div>
        <div class="sidebar-items"></div>
      </div>
    `;

    updateComponentsSidebar();

    const items = document.querySelector('.sidebar-items');
    expect(items?.textContent).toContain('None yet');
  });
});

// ── Non-data element requirements ────────────────────────────────────

describe('ComponentsPanel — non-data element requirements', () => {
  it('shows description for do requirements with widget', () => {
    const state = initializeWizardState();
    state.nonDataElements = [{ id: 'el-1', name: 'Timer' }];
    state.requirements = [
      makeRequirement({
        type: 'do',
        description: 'set the Timer',
        elementId: 'el-1',
      }),
    ];
    setWizardState(state);

    const html = renderComponentsPanel();
    expect(html).toContain('set the Timer');
  });

  it('auto-names component from element name for do requirements with widget', () => {
    const state = initializeWizardState();
    state.nonDataElements = [{ id: 'el-1', name: 'Timer' }];
    state.requirements = [
      makeRequirement({
        type: 'do',
        description: 'set the Timer',
        elementId: 'el-1',
      }),
    ];
    setWizardState(state);

    const html = renderComponentsPanel();
    // Should have auto-name button, not a dropdown
    expect(html).toContain('data-auto-name="Timer"');
  });
});
