// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderViewsPanel,
  wireViewsPanel,
  updateViewsSidebar,
} from '../../src/app/views/panels/ViewsPanel';
import {
  getWizardState,
  setWizardState,
  initializeWizardState,
} from '../../src/app/state/WizardState';
import type { Component, View } from '../../src/types/wizard';

// ── Helpers ────────────────────────────────────────────────────────────

function makeComponent(
  overrides: Partial<Component> & { name: string },
): Component {
  return { id: `component-${Date.now()}-${Math.random()}`, requirementIds: [], ...overrides };
}

function makeView(
  overrides: Partial<View> & { name: string },
): View {
  return { id: `view-${Date.now()}-${Math.random()}`, componentIds: [], ...overrides };
}

function setupState(opts: {
  components?: Component[];
  views?: View[];
}): void {
  const state = initializeWizardState();
  state.components = opts.components ?? [];
  if (opts.views !== undefined) {
    state.views = opts.views;
  }
  // else keep the seeded Home view from initializeWizardState
  setWizardState(state);
}

function renderAndWire(): void {
  document.body.innerHTML = `
    <div class="sidebar-section" data-section="views">
      <div class="badge">0</div>
      <div class="sidebar-items"></div>
    </div>
    <div id="workspace-panel-body">${renderViewsPanel()}</div>
  `;
  wireViewsPanel();
}

// ── Seeding ──────────────────────────────────────────────────────────

describe('ViewsPanel — seeding', () => {
  it('seeds a Home view on initial state creation', () => {
    const state = initializeWizardState();
    expect(state.views.length).toBe(1);
    expect(state.views[0].name).toBe('Home');
    expect(state.views[0].componentIds).toEqual([]);
  });

  it('migrates old state without views by adding Home view', () => {
    const state = initializeWizardState();
    // Simulate old state without views
    (state as any).views = undefined;
    setWizardState(state);

    const loaded = getWizardState();
    expect(loaded.views.length).toBe(1);
    expect(loaded.views[0].name).toBe('Home');
  });

  it('migrates old state with empty views array', () => {
    const state = initializeWizardState();
    state.views = [];
    setWizardState(state);

    const loaded = getWizardState();
    expect(loaded.views.length).toBe(1);
    expect(loaded.views[0].name).toBe('Home');
  });
});

// ── Initial render ───────────────────────────────────────────────────

describe('ViewsPanel — initial state', () => {
  beforeEach(() => {
    setupState({});
  });

  it('shows the Home view card', () => {
    const html = renderViewsPanel();
    expect(html).toContain('Home');
    expect(html).toContain('view-card');
  });

  it('shows description text', () => {
    const html = renderViewsPanel();
    expect(html).toContain('Views are the pages of your app');
  });

  it('shows "No components assigned" on Home card', () => {
    const html = renderViewsPanel();
    expect(html).toContain('No components assigned');
  });

  it('does not show delete button when only 1 view exists', () => {
    const html = renderViewsPanel();
    expect(html).not.toContain('view-delete-btn');
  });

  it('shows + New View button', () => {
    const html = renderViewsPanel();
    expect(html).toContain('views-add-btn');
    expect(html).toContain('+ New View');
  });
});

// ── View creation via form ────────────────────────────────────────────

describe('ViewsPanel — form interaction', () => {
  let components: Component[];

  beforeEach(() => {
    components = [
      makeComponent({ name: 'Nav Menu' }),
      makeComponent({ name: 'Post Feed' }),
    ];
    setupState({ components });
    renderAndWire();
  });

  it('opens inline form when add button is clicked', () => {
    const addBtn = document.getElementById('views-add-btn') as HTMLButtonElement;
    addBtn.click();

    const form = document.getElementById('views-form');
    expect(form?.style.display).toBe('block');
    expect(form?.innerHTML).toContain('view-name-input');
  });

  it('shows all components in available list', () => {
    const addBtn = document.getElementById('views-add-btn') as HTMLButtonElement;
    addBtn.click();

    const availList = document.getElementById('view-available-list');
    const items = availList?.querySelectorAll('.available-item');
    expect(items?.length).toBe(2);
  });

  it('shows placeholder text when no chips selected', () => {
    const addBtn = document.getElementById('views-add-btn') as HTMLButtonElement;
    addBtn.click();

    const chips = document.getElementById('view-selected-chips');
    expect(chips?.textContent).toContain('Click components below to add them');
  });

  it('disables save button initially', () => {
    const addBtn = document.getElementById('views-add-btn') as HTMLButtonElement;
    addBtn.click();

    const saveBtn = document.getElementById('view-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('adds chip when component is clicked', () => {
    const addBtn = document.getElementById('views-add-btn') as HTMLButtonElement;
    addBtn.click();

    const items = document.querySelectorAll('#view-available-list .available-item');
    (items[0] as HTMLElement).click();

    const chips = document.querySelectorAll('.chip');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('Nav Menu');
  });

  it('marks selected item in available list', () => {
    const addBtn = document.getElementById('views-add-btn') as HTMLButtonElement;
    addBtn.click();

    const items = document.querySelectorAll('#view-available-list .available-item');
    (items[0] as HTMLElement).click();

    const refreshedItems = document.querySelectorAll('#view-available-list .available-item');
    expect(refreshedItems[0].classList.contains('selected')).toBe(true);
  });

  it('removes chip when clicked again in available list', () => {
    const addBtn = document.getElementById('views-add-btn') as HTMLButtonElement;
    addBtn.click();

    const items = document.querySelectorAll('#view-available-list .available-item');
    (items[0] as HTMLElement).click();
    const refreshedItems = document.querySelectorAll('#view-available-list .available-item');
    (refreshedItems[0] as HTMLElement).click();

    const chips = document.querySelectorAll('.chip');
    expect(chips.length).toBe(0);
  });

  it('enables save button when name is entered (components optional)', () => {
    const addBtn = document.getElementById('views-add-btn') as HTMLButtonElement;
    addBtn.click();

    const nameInput = document.getElementById('view-name-input') as HTMLInputElement;
    nameInput.value = 'Profile';
    nameInput.dispatchEvent(new Event('input'));

    const saveBtn = document.getElementById('view-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
  });

  it('saves view with name and selected components', () => {
    const addBtn = document.getElementById('views-add-btn') as HTMLButtonElement;
    addBtn.click();

    const nameInput = document.getElementById('view-name-input') as HTMLInputElement;
    nameInput.value = 'Profile';
    nameInput.dispatchEvent(new Event('input'));

    const items = document.querySelectorAll('#view-available-list .available-item');
    (items[0] as HTMLElement).click();

    const saveBtn = document.getElementById('view-save-btn') as HTMLButtonElement;
    saveBtn.click();

    const state = getWizardState();
    // Home + Profile
    expect(state.views.length).toBe(2);
    const profile = state.views.find((v) => v.name === 'Profile');
    expect(profile).toBeDefined();
    expect(profile!.componentIds).toEqual([components[0].id]);
  });

  it('saves view with no components', () => {
    const addBtn = document.getElementById('views-add-btn') as HTMLButtonElement;
    addBtn.click();

    const nameInput = document.getElementById('view-name-input') as HTMLInputElement;
    nameInput.value = 'Settings';
    nameInput.dispatchEvent(new Event('input'));

    const saveBtn = document.getElementById('view-save-btn') as HTMLButtonElement;
    saveBtn.click();

    const state = getWizardState();
    const settings = state.views.find((v) => v.name === 'Settings');
    expect(settings).toBeDefined();
    expect(settings!.componentIds).toEqual([]);
  });

  it('closes form after save', () => {
    const addBtn = document.getElementById('views-add-btn') as HTMLButtonElement;
    addBtn.click();

    const nameInput = document.getElementById('view-name-input') as HTMLInputElement;
    nameInput.value = 'Test';
    nameInput.dispatchEvent(new Event('input'));

    const saveBtn = document.getElementById('view-save-btn') as HTMLButtonElement;
    saveBtn.click();

    const form = document.getElementById('views-form');
    expect(form?.style.display).toBe('none');
  });

  it('cancels form without saving', () => {
    const addBtn = document.getElementById('views-add-btn') as HTMLButtonElement;
    addBtn.click();

    const cancelBtn = document.getElementById('view-cancel-btn') as HTMLButtonElement;
    cancelBtn.click();

    const form = document.getElementById('views-form');
    expect(form?.style.display).toBe('none');
    // Should still have just the seeded Home view
    expect(getWizardState().views.length).toBe(1);
  });
});

// ── Duplicate name validation ─────────────────────────────────────────

describe('ViewsPanel — duplicate name validation', () => {
  beforeEach(() => {
    const views = [
      makeView({ name: 'Home' }),
      makeView({ name: 'Profile' }),
    ];
    setupState({ views });
    renderAndWire();
  });

  it('disables save and shows message when name matches existing view', () => {
    const addBtn = document.getElementById('views-add-btn') as HTMLButtonElement;
    addBtn.click();

    const nameInput = document.getElementById('view-name-input') as HTMLInputElement;
    nameInput.value = 'Home';
    nameInput.dispatchEvent(new Event('input'));

    const saveBtn = document.getElementById('view-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    const validation = document.getElementById('view-name-validation');
    expect(validation?.textContent).toContain('A view with this name already exists');
  });

  it('allows current name during edit', () => {
    const state = getWizardState();
    const homeView = state.views[0];

    const editBtn = document.querySelector(`.view-edit-btn[data-view-id="${homeView.id}"]`) as HTMLButtonElement;
    editBtn.click();

    const saveBtn = document.getElementById('view-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
  });
});

// ── View editing ─────────────────────────────────────────────────────

describe('ViewsPanel — editing', () => {
  let components: Component[];
  let homeView: View;

  beforeEach(() => {
    components = [
      makeComponent({ name: 'Nav Menu' }),
      makeComponent({ name: 'About Section' }),
    ];
    homeView = makeView({ name: 'Home', componentIds: [components[0].id] });
    setupState({ components, views: [homeView] });
    renderAndWire();
  });

  it('opens form pre-populated when edit is clicked', () => {
    const editBtn = document.querySelector(`.view-edit-btn[data-view-id="${homeView.id}"]`) as HTMLButtonElement;
    editBtn.click();

    const nameInput = document.getElementById('view-name-input') as HTMLInputElement;
    expect(nameInput.value).toBe('Home');

    const chips = document.querySelectorAll('.chip');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('Nav Menu');
  });

  it('saves edits to existing view', () => {
    const editBtn = document.querySelector(`.view-edit-btn[data-view-id="${homeView.id}"]`) as HTMLButtonElement;
    editBtn.click();

    // Change name
    const nameInput = document.getElementById('view-name-input') as HTMLInputElement;
    nameInput.value = 'Dashboard';
    nameInput.dispatchEvent(new Event('input'));

    // Add another component
    const items = document.querySelectorAll('#view-available-list .available-item');
    (items[1] as HTMLElement).click(); // About Section

    const saveBtn = document.getElementById('view-save-btn') as HTMLButtonElement;
    saveBtn.click();

    const state = getWizardState();
    expect(state.views.length).toBe(1);
    expect(state.views[0].name).toBe('Dashboard');
    expect(state.views[0].componentIds).toEqual([components[0].id, components[1].id]);
  });

  it('shows Update View label when editing', () => {
    const editBtn = document.querySelector(`.view-edit-btn[data-view-id="${homeView.id}"]`) as HTMLButtonElement;
    editBtn.click();

    const saveBtn = document.getElementById('view-save-btn') as HTMLButtonElement;
    expect(saveBtn.textContent?.trim()).toBe('Update View');
  });
});

// ── View deletion ────────────────────────────────────────────────────

describe('ViewsPanel — deletion', () => {
  let components: Component[];
  let views: View[];

  beforeEach(() => {
    components = [makeComponent({ name: 'Post Feed' })];
    views = [
      makeView({ name: 'Home' }),
      makeView({ name: 'Profile', componentIds: [components[0].id] }),
    ];
    setupState({ components, views });
    renderAndWire();
  });

  it('deletes view when delete button is clicked', () => {
    const deleteBtn = document.querySelector(`.view-delete-btn[data-view-id="${views[1].id}"]`) as HTMLButtonElement;
    deleteBtn.click();

    const state = getWizardState();
    expect(state.views.length).toBe(1);
    expect(state.views[0].name).toBe('Home');
  });

  it('does not delete components when view is deleted', () => {
    const deleteBtn = document.querySelector(`.view-delete-btn[data-view-id="${views[1].id}"]`) as HTMLButtonElement;
    deleteBtn.click();

    const state = getWizardState();
    expect(state.components.length).toBe(1);
    expect(state.components[0].name).toBe('Post Feed');
  });

  it('hides delete button when only 1 view remains', () => {
    const deleteBtn = document.querySelector(`.view-delete-btn[data-view-id="${views[1].id}"]`) as HTMLButtonElement;
    deleteBtn.click();

    // After re-render, the remaining card should have no delete button
    const remainingDelete = document.querySelector('.view-delete-btn');
    expect(remainingDelete).toBeNull();
  });
});

// ── Reordering ───────────────────────────────────────────────────────

describe('ViewsPanel — reordering', () => {
  let components: Component[];
  let view: View;

  beforeEach(() => {
    components = [
      makeComponent({ name: 'Nav Menu' }),
      makeComponent({ name: 'Post Feed' }),
      makeComponent({ name: 'About Section' }),
    ];
    view = makeView({
      name: 'Home',
      componentIds: [components[0].id, components[1].id, components[2].id],
    });
    setupState({ components, views: [view] });
    renderAndWire();
  });

  it('moves component down when down button is clicked', () => {
    const downBtn = document.querySelector(
      `.view-reorder-down[data-view-id="${view.id}"][data-component-index="0"]`,
    ) as HTMLButtonElement;
    downBtn.click();

    const state = getWizardState();
    expect(state.views[0].componentIds).toEqual([
      components[1].id, components[0].id, components[2].id,
    ]);
  });

  it('moves component up when up button is clicked', () => {
    const upBtn = document.querySelector(
      `.view-reorder-up[data-view-id="${view.id}"][data-component-index="1"]`,
    ) as HTMLButtonElement;
    upBtn.click();

    const state = getWizardState();
    expect(state.views[0].componentIds).toEqual([
      components[1].id, components[0].id, components[2].id,
    ]);
  });

  it('disables up button on first item', () => {
    const upBtn = document.querySelector(
      `.view-reorder-up[data-view-id="${view.id}"][data-component-index="0"]`,
    ) as HTMLButtonElement;
    expect(upBtn.disabled).toBe(true);
  });

  it('disables down button on last item', () => {
    const downBtn = document.querySelector(
      `.view-reorder-down[data-view-id="${view.id}"][data-component-index="2"]`,
    ) as HTMLButtonElement;
    expect(downBtn.disabled).toBe(true);
  });
});

// ── Multi-assignment ─────────────────────────────────────────────────

describe('ViewsPanel — multi-assignment', () => {
  it('allows same component in multiple views', () => {
    const component = makeComponent({ name: 'Nav Menu' });
    const views = [
      makeView({ name: 'Home', componentIds: [component.id] }),
      makeView({ name: 'Profile', componentIds: [component.id] }),
    ];
    setupState({ components: [component], views });

    const html = renderViewsPanel();
    expect(html).toContain('Home');
    expect(html).toContain('Profile');
    // Component should appear in both cards
    const matches = html.match(/Nav Menu/g);
    expect(matches?.length).toBeGreaterThanOrEqual(2);
  });

  it('component in any view is not unassigned', () => {
    const component = makeComponent({ name: 'Nav Menu' });
    const views = [
      makeView({ name: 'Home', componentIds: [component.id] }),
    ];
    setupState({ components: [component], views });

    const html = renderViewsPanel();
    expect(html).not.toContain('Unassigned Components');
  });
});

// ── Deleted component handling ────────────────────────────────────────────

describe('ViewsPanel — deleted component handling', () => {
  it('filters out missing component ids from view cards', () => {
    const component = makeComponent({ name: 'Still here' });
    const view = makeView({
      name: 'Home',
      componentIds: [component.id, 'deleted-component-id'],
    });
    setupState({ components: [component], views: [view] });

    const html = renderViewsPanel();
    expect(html).toContain('Still here');
    // Should show only 1 component order number
    expect(html).toContain('>1<');
    expect(html).not.toContain('>2<');
  });
});

// ── Unassigned components ─────────────────────────────────────────────────

describe('ViewsPanel — unassigned components', () => {
  it('shows unassigned components section when components are not in any view', () => {
    const components = [
      makeComponent({ name: 'Nav Menu' }),
      makeComponent({ name: 'Post Feed' }),
    ];
    const view = makeView({ name: 'Home', componentIds: [components[0].id] });
    setupState({ components, views: [view] });

    const html = renderViewsPanel();
    expect(html).toContain('Unassigned Components');
    expect(html).toContain('1 remaining');
    expect(html).toContain('Post Feed');
  });

  it('hides unassigned section when all components are assigned', () => {
    const components = [makeComponent({ name: 'Nav Menu' })];
    const view = makeView({ name: 'Home', componentIds: [components[0].id] });
    setupState({ components, views: [view] });

    const html = renderViewsPanel();
    expect(html).not.toContain('Unassigned Components');
  });
});

// ── No components exist ──────────────────────────────────────────────────

describe('ViewsPanel — no components exist', () => {
  it('shows empty state message in available list when editing', () => {
    setupState({});
    renderAndWire();

    const state = getWizardState();
    const homeView = state.views[0];

    const editBtn = document.querySelector(`.view-edit-btn[data-view-id="${homeView.id}"]`) as HTMLButtonElement;
    editBtn.click();

    const availList = document.getElementById('view-available-list');
    expect(availList?.textContent).toContain('No components created yet');
  });
});

// ── Sidebar ──────────────────────────────────────────────────────────

describe('ViewsPanel — sidebar', () => {
  it('updates sidebar badge and items', () => {
    const views = [
      makeView({ name: 'Home' }),
      makeView({ name: 'Profile' }),
    ];
    setupState({ views });

    document.body.innerHTML = `
      <div class="sidebar-section" data-section="views">
        <div class="badge">0</div>
        <div class="sidebar-items"></div>
      </div>
    `;

    updateViewsSidebar();

    const badge = document.querySelector('.badge');
    expect(badge?.textContent).toBe('2');

    const items = document.querySelectorAll('.sidebar-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Home');
    expect(items[1].textContent).toContain('Profile');
  });

  it('does not add has-items when only seeded Home view with no components', () => {
    setupState({});

    document.body.innerHTML = `
      <div class="sidebar-section" data-section="views">
        <div class="badge">0</div>
        <div class="sidebar-items"></div>
      </div>
    `;

    updateViewsSidebar();

    const section = document.querySelector('.sidebar-section');
    expect(section?.classList.contains('has-items')).toBe(false);
  });

  it('adds has-items when user creates a second view', () => {
    const views = [
      makeView({ name: 'Home' }),
      makeView({ name: 'Profile' }),
    ];
    setupState({ views });

    document.body.innerHTML = `
      <div class="sidebar-section" data-section="views">
        <div class="badge">0</div>
        <div class="sidebar-items"></div>
      </div>
    `;

    updateViewsSidebar();

    const section = document.querySelector('.sidebar-section');
    expect(section?.classList.contains('has-items')).toBe(true);
  });

  it('adds has-items when a view has components assigned', () => {
    const component = makeComponent({ name: 'Nav' });
    const views = [makeView({ name: 'Home', componentIds: [component.id] })];
    setupState({ components: [component], views });

    document.body.innerHTML = `
      <div class="sidebar-section" data-section="views">
        <div class="badge">0</div>
        <div class="sidebar-items"></div>
      </div>
    `;

    updateViewsSidebar();

    const section = document.querySelector('.sidebar-section');
    expect(section?.classList.contains('has-items')).toBe(true);
  });
});
