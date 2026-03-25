// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  renderBlocksPanel,
  wireBlocksPanel,
  updateBlocksSidebar,
} from '../../src/app/views/panels/BlocksPanel';
import {
  getWizardState,
  saveWizardState,
  setWizardState,
  initializeWizardState,
} from '../../src/app/state/WizardState';
import type { Requirement, Block } from '../../src/types/wizard';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequirement(
  overrides: Partial<Requirement> & { type: Requirement['type'] },
): Requirement {
  return { id: `req-${Date.now()}-${Math.random()}`, ...overrides };
}

function makeBlock(
  overrides: Partial<Block> & { name: string; requirementIds: string[] },
): Block {
  return { id: `block-${Date.now()}-${Math.random()}`, ...overrides };
}

function setupState(opts: {
  requirements?: Requirement[];
  blocks?: Block[];
}): void {
  const state = initializeWizardState();
  state.requirements = opts.requirements ?? [];
  state.blocks = opts.blocks ?? [];
  setWizardState(state);
}

function renderAndWire(): void {
  document.body.innerHTML = `
    <div class="sidebar-section" data-section="components">
      <div class="badge">0</div>
      <div class="sidebar-items"></div>
    </div>
    <div id="workspace-panel-body">${renderBlocksPanel()}</div>
  `;
  wireBlocksPanel();
}

// ── Empty state ─────────────────────────────────────────────────────

describe('BlocksPanel — empty state', () => {
  beforeEach(() => {
    setupState({});
  });

  it('shows guidance when no requirements exist', () => {
    const html = renderBlocksPanel();
    expect(html).toContain('No blocks yet');
    expect(html).toContain('Define some requirements first');
  });
});

// ── Panel with requirements but no blocks ────────────────────────────

describe('BlocksPanel — requirements, no blocks', () => {
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
    const html = renderBlocksPanel();
    expect(html).toContain('Turn your requirements into buildable pieces');
  });

  it('shows all requirements in unassigned section', () => {
    const html = renderBlocksPanel();
    expect(html).toContain('Unassigned Requirements');
    expect(html).toContain('3 remaining');
    expect(html).toContain('App description');
    expect(html).toContain('create Post');
  });

  it('shows quick-create buttons for unassigned requirements', () => {
    const html = renderBlocksPanel();
    expect(html).toContain('+ Block');
    expect(html).toContain('quick-create-dropdown');
  });

  it('shows correct quick-create options for know type', () => {
    const html = renderBlocksPanel();
    expect(html).toContain('Paragraph');
    expect(html).toContain('Section');
    expect(html).toContain('Heading');
  });

  it('shows correct quick-create options for do type', () => {
    const html = renderBlocksPanel();
    expect(html).toContain('Form');
    expect(html).toContain('List');
    expect(html).toContain('Card');
  });

  it('shows correct quick-create options for navigate type', () => {
    const html = renderBlocksPanel();
    expect(html).toContain('Link');
    expect(html).toContain('Button');
    expect(html).toContain('Menu Item');
  });

  it('shows hint text explaining shortcuts', () => {
    const html = renderBlocksPanel();
    expect(html).toContain('Click');
    expect(html).toContain('+ New Block');
  });
});

// ── Panel with blocks ────────────────────────────────────────────────

describe('BlocksPanel — with blocks', () => {
  let reqs: Requirement[];
  let blocks: Block[];

  beforeEach(() => {
    reqs = [
      makeRequirement({ type: 'know', text: 'App description' }),
      makeRequirement({ type: 'do', verb: 'create', data: 'Post' }),
      makeRequirement({ type: 'do', verb: 'search', data: 'Post' }),
      makeRequirement({ type: 'navigate', navType: 'direct', fromView: 'Home', toView: 'Profile' }),
    ];
    blocks = [
      makeBlock({ name: 'About Section', requirementIds: [reqs[0].id] }),
      makeBlock({ name: 'Post Feed', requirementIds: [reqs[1].id, reqs[2].id] }),
    ];
    setupState({ requirements: reqs, blocks });
  });

  it('renders block cards', () => {
    const html = renderBlocksPanel();
    expect(html).toContain('About Section');
    expect(html).toContain('Post Feed');
  });

  it('shows requirement details in block cards', () => {
    const html = renderBlocksPanel();
    expect(html).toContain('App description');
    expect(html).toContain('create Post');
    expect(html).toContain('search Post');
  });

  it('shows type badges on requirements', () => {
    const html = renderBlocksPanel();
    expect(html).toContain('know');
    expect(html).toContain('do');
  });

  it('shows numbered order on requirements', () => {
    const html = renderBlocksPanel();
    // Post Feed has 2 requirements
    expect(html).toContain('>1<');
    expect(html).toContain('>2<');
  });

  it('shows reorder buttons on multi-requirement blocks', () => {
    const html = renderBlocksPanel();
    expect(html).toContain('reorder-btns');
    expect(html).toContain('block-reorder-up');
    expect(html).toContain('block-reorder-down');
  });

  it('does not show reorder buttons on single-requirement blocks', () => {
    // About Section has 1 requirement — no reorder buttons
    const html = renderBlocksPanel();
    const aboutIdx = html.indexOf('About Section');
    const postFeedIdx = html.indexOf('Post Feed');
    const aboutSection = html.slice(aboutIdx, postFeedIdx);
    expect(aboutSection).not.toContain('reorder-btns');
  });

  it('shows edit and delete buttons on block cards', () => {
    const html = renderBlocksPanel();
    expect(html).toContain('block-edit-btn');
    expect(html).toContain('block-delete-btn');
  });

  it('shows unassigned section for remaining requirements', () => {
    const html = renderBlocksPanel();
    expect(html).toContain('Unassigned Requirements');
    expect(html).toContain('1 remaining');
  });

  it('hides unassigned section when all requirements assigned', () => {
    // Assign the nav requirement too
    const state = getWizardState();
    state.blocks.push(
      makeBlock({ name: 'Profile Link', requirementIds: [reqs[3].id] }),
    );
    const html = renderBlocksPanel();
    expect(html).not.toContain('Unassigned Requirements');
  });

  it('shows next step card', () => {
    const html = renderBlocksPanel();
    expect(html).toContain('Arrange blocks into Views');
  });
});

// ── Block creation via form ──────────────────────────────────────────

describe('BlocksPanel — form interaction', () => {
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
    const addBtn = document.getElementById('blocks-add-btn') as HTMLButtonElement;
    addBtn.click();

    const form = document.getElementById('blocks-form');
    expect(form?.style.display).toBe('block');
    expect(form?.innerHTML).toContain('block-name-input');
  });

  it('shows all requirements in available list', () => {
    const addBtn = document.getElementById('blocks-add-btn') as HTMLButtonElement;
    addBtn.click();

    const availList = document.getElementById('block-available-list');
    const items = availList?.querySelectorAll('.available-item');
    expect(items?.length).toBe(2);
  });

  it('shows placeholder text when no chips selected', () => {
    const addBtn = document.getElementById('blocks-add-btn') as HTMLButtonElement;
    addBtn.click();

    const chips = document.getElementById('block-selected-chips');
    expect(chips?.textContent).toContain('Click requirements below to add them');
  });

  it('disables save button initially', () => {
    const addBtn = document.getElementById('blocks-add-btn') as HTMLButtonElement;
    addBtn.click();

    const saveBtn = document.getElementById('block-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('adds chip when requirement is clicked', () => {
    const addBtn = document.getElementById('blocks-add-btn') as HTMLButtonElement;
    addBtn.click();

    const items = document.querySelectorAll('#block-available-list .available-item');
    (items[0] as HTMLElement).click();

    const chips = document.querySelectorAll('.chip');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('App description');
  });

  it('marks selected item in available list', () => {
    const addBtn = document.getElementById('blocks-add-btn') as HTMLButtonElement;
    addBtn.click();

    const items = document.querySelectorAll('#block-available-list .available-item');
    (items[0] as HTMLElement).click();

    const refreshedItems = document.querySelectorAll('#block-available-list .available-item');
    expect(refreshedItems[0].classList.contains('selected')).toBe(true);
  });

  it('removes chip when clicked again in available list', () => {
    const addBtn = document.getElementById('blocks-add-btn') as HTMLButtonElement;
    addBtn.click();

    // Select
    const items = document.querySelectorAll('#block-available-list .available-item');
    (items[0] as HTMLElement).click();
    // Deselect
    const refreshedItems = document.querySelectorAll('#block-available-list .available-item');
    (refreshedItems[0] as HTMLElement).click();

    const chips = document.querySelectorAll('.chip');
    expect(chips.length).toBe(0);
  });

  it('saves block with name and selected requirements', () => {
    const addBtn = document.getElementById('blocks-add-btn') as HTMLButtonElement;
    addBtn.click();

    // Enter name
    const nameInput = document.getElementById('block-name-input') as HTMLInputElement;
    nameInput.value = 'About Section';
    nameInput.dispatchEvent(new Event('input'));

    // Select a requirement
    const items = document.querySelectorAll('#block-available-list .available-item');
    (items[0] as HTMLElement).click();

    // Save
    const saveBtn = document.getElementById('block-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
    saveBtn.click();

    const state = getWizardState();
    expect(state.blocks.length).toBe(1);
    expect(state.blocks[0].name).toBe('About Section');
    expect(state.blocks[0].requirementIds).toEqual([reqs[0].id]);
  });

  it('closes form after save', () => {
    const addBtn = document.getElementById('blocks-add-btn') as HTMLButtonElement;
    addBtn.click();

    const nameInput = document.getElementById('block-name-input') as HTMLInputElement;
    nameInput.value = 'Test Block';
    nameInput.dispatchEvent(new Event('input'));

    const items = document.querySelectorAll('#block-available-list .available-item');
    (items[0] as HTMLElement).click();

    const saveBtn = document.getElementById('block-save-btn') as HTMLButtonElement;
    saveBtn.click();

    const form = document.getElementById('blocks-form');
    expect(form?.style.display).toBe('none');
  });

  it('cancels form without saving', () => {
    const addBtn = document.getElementById('blocks-add-btn') as HTMLButtonElement;
    addBtn.click();

    const cancelBtn = document.getElementById('block-cancel-btn') as HTMLButtonElement;
    cancelBtn.click();

    const form = document.getElementById('blocks-form');
    expect(form?.style.display).toBe('none');
    expect(getWizardState().blocks.length).toBe(0);
  });
});

// ── Block editing ────────────────────────────────────────────────────

describe('BlocksPanel — editing', () => {
  let reqs: Requirement[];
  let block: Block;

  beforeEach(() => {
    reqs = [
      makeRequirement({ type: 'know', text: 'App description' }),
      makeRequirement({ type: 'do', verb: 'create', data: 'Post' }),
      makeRequirement({ type: 'do', verb: 'search', data: 'Post' }),
    ];
    block = makeBlock({ name: 'About Section', requirementIds: [reqs[0].id] });
    setupState({ requirements: reqs, blocks: [block] });
    renderAndWire();
  });

  it('opens form pre-populated when edit is clicked', () => {
    const editBtn = document.querySelector(`.block-edit-btn[data-block-id="${block.id}"]`) as HTMLButtonElement;
    editBtn.click();

    const nameInput = document.getElementById('block-name-input') as HTMLInputElement;
    expect(nameInput.value).toBe('About Section');

    const chips = document.querySelectorAll('.chip');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('App description');
  });

  it('saves edits to existing block', () => {
    const editBtn = document.querySelector(`.block-edit-btn[data-block-id="${block.id}"]`) as HTMLButtonElement;
    editBtn.click();

    // Change name
    const nameInput = document.getElementById('block-name-input') as HTMLInputElement;
    nameInput.value = 'Info Section';
    nameInput.dispatchEvent(new Event('input'));

    // Add another requirement
    const items = document.querySelectorAll('#block-available-list .available-item');
    (items[1] as HTMLElement).click(); // create Post

    const saveBtn = document.getElementById('block-save-btn') as HTMLButtonElement;
    saveBtn.click();

    const state = getWizardState();
    expect(state.blocks.length).toBe(1);
    expect(state.blocks[0].name).toBe('Info Section');
    expect(state.blocks[0].requirementIds).toEqual([reqs[0].id, reqs[1].id]);
  });

  it('shows Update Block label when editing', () => {
    const editBtn = document.querySelector(`.block-edit-btn[data-block-id="${block.id}"]`) as HTMLButtonElement;
    editBtn.click();

    const saveBtn = document.getElementById('block-save-btn') as HTMLButtonElement;
    expect(saveBtn.textContent?.trim()).toBe('Update Block');
  });
});

// ── Block deletion ───────────────────────────────────────────────────

describe('BlocksPanel — deletion', () => {
  let reqs: Requirement[];
  let block: Block;

  beforeEach(() => {
    reqs = [
      makeRequirement({ type: 'know', text: 'App description' }),
    ];
    block = makeBlock({ name: 'About Section', requirementIds: [reqs[0].id] });
    setupState({ requirements: reqs, blocks: [block] });
    renderAndWire();
  });

  it('deletes block when delete button is clicked', () => {
    const deleteBtn = document.querySelector(`.block-delete-btn[data-block-id="${block.id}"]`) as HTMLButtonElement;
    deleteBtn.click();

    const state = getWizardState();
    expect(state.blocks.length).toBe(0);
  });

  it('does not delete requirements when block is deleted', () => {
    const deleteBtn = document.querySelector(`.block-delete-btn[data-block-id="${block.id}"]`) as HTMLButtonElement;
    deleteBtn.click();

    const state = getWizardState();
    expect(state.requirements.length).toBe(1);
    expect(state.requirements[0].text).toBe('App description');
  });
});

// ── Reordering ───────────────────────────────────────────────────────

describe('BlocksPanel — reordering', () => {
  let reqs: Requirement[];
  let block: Block;

  beforeEach(() => {
    reqs = [
      makeRequirement({ type: 'do', verb: 'search', data: 'Post' }),
      makeRequirement({ type: 'do', verb: 'view', data: 'Post' }),
      makeRequirement({ type: 'do', verb: 'create', data: 'Post' }),
    ];
    block = makeBlock({
      name: 'Post Feed',
      requirementIds: [reqs[0].id, reqs[1].id, reqs[2].id],
    });
    setupState({ requirements: reqs, blocks: [block] });
    renderAndWire();
  });

  it('moves requirement down when down button is clicked', () => {
    const downBtn = document.querySelector(
      `.block-reorder-down[data-block-id="${block.id}"][data-req-index="0"]`,
    ) as HTMLButtonElement;
    downBtn.click();

    const state = getWizardState();
    expect(state.blocks[0].requirementIds).toEqual([
      reqs[1].id, reqs[0].id, reqs[2].id,
    ]);
  });

  it('moves requirement up when up button is clicked', () => {
    const upBtn = document.querySelector(
      `.block-reorder-up[data-block-id="${block.id}"][data-req-index="1"]`,
    ) as HTMLButtonElement;
    upBtn.click();

    const state = getWizardState();
    expect(state.blocks[0].requirementIds).toEqual([
      reqs[1].id, reqs[0].id, reqs[2].id,
    ]);
  });

  it('disables up button on first item', () => {
    const upBtn = document.querySelector(
      `.block-reorder-up[data-block-id="${block.id}"][data-req-index="0"]`,
    ) as HTMLButtonElement;
    expect(upBtn.disabled).toBe(true);
  });

  it('disables down button on last item', () => {
    const downBtn = document.querySelector(
      `.block-reorder-down[data-block-id="${block.id}"][data-req-index="2"]`,
    ) as HTMLButtonElement;
    expect(downBtn.disabled).toBe(true);
  });
});

// ── Multi-assignment ─────────────────────────────────────────────────

describe('BlocksPanel — multi-assignment', () => {
  let reqs: Requirement[];

  beforeEach(() => {
    reqs = [
      makeRequirement({ type: 'do', verb: 'view', data: 'Post' }),
      makeRequirement({ type: 'do', verb: 'search', data: 'Post' }),
    ];
    const block1 = makeBlock({ name: 'Post Feed', requirementIds: [reqs[0].id, reqs[1].id] });
    setupState({ requirements: reqs, blocks: [block1] });
  });

  it('allows same requirement in multiple blocks', () => {
    const state = getWizardState();
    state.blocks.push(
      makeBlock({ name: 'Post Detail', requirementIds: [reqs[0].id] }),
    );

    const html = renderBlocksPanel();
    expect(html).toContain('Post Feed');
    expect(html).toContain('Post Detail');
  });

  it('does not show assigned requirement in unassigned list', () => {
    const html = renderBlocksPanel();
    // Both reqs are assigned
    expect(html).not.toContain('Unassigned Requirements');
  });

  it('shows requirement in available list when creating new block', () => {
    renderAndWire();
    const addBtn = document.getElementById('blocks-add-btn') as HTMLButtonElement;
    addBtn.click();

    // All requirements should be in the available list, even assigned ones
    const items = document.querySelectorAll('#block-available-list .available-item');
    expect(items.length).toBe(2);
  });
});

// ── Deleted requirement handling ─────────────────────────────────────

describe('BlocksPanel — deleted requirement handling', () => {
  it('filters out missing requirement ids from block cards', () => {
    const req = makeRequirement({ type: 'know', text: 'Still here' });
    const block = makeBlock({
      name: 'Mixed Block',
      requirementIds: [req.id, 'deleted-req-id'],
    });
    setupState({ requirements: [req], blocks: [block] });

    const html = renderBlocksPanel();
    expect(html).toContain('Still here');
    // Should not crash, should only show 1 requirement
    expect(html).toContain('>1<');
    // Should not contain a "2" order number
    expect(html).not.toContain('>2<');
  });
});

// ── Quick-create ─────────────────────────────────────────────────────

describe('BlocksPanel — quick-create', () => {
  let reqs: Requirement[];

  beforeEach(() => {
    reqs = [
      makeRequirement({ type: 'know', text: 'App description' }),
      makeRequirement({ type: 'navigate', navType: 'direct', fromView: 'Home', toView: 'Profile' }),
    ];
    setupState({ requirements: reqs });
    renderAndWire();
  });

  it('creates block when quick-create option is clicked', () => {
    // Click the quick-create option
    const option = document.querySelector(
      `.quick-create-option[data-req-id="${reqs[0].id}"]`,
    ) as HTMLButtonElement;
    option.click();

    const state = getWizardState();
    expect(state.blocks.length).toBe(1);
    expect(state.blocks[0].name).toBe('Paragraph'); // first option for know type
    expect(state.blocks[0].requirementIds).toEqual([reqs[0].id]);
  });
});

// ── Sidebar ──────────────────────────────────────────────────────────

describe('BlocksPanel — sidebar', () => {
  it('updates sidebar badge and items', () => {
    const reqs = [
      makeRequirement({ type: 'know', text: 'Desc' }),
    ];
    const blocks = [
      makeBlock({ name: 'About', requirementIds: [reqs[0].id] }),
      makeBlock({ name: 'Hero', requirementIds: [reqs[0].id] }),
    ];
    setupState({ requirements: reqs, blocks });

    document.body.innerHTML = `
      <div class="sidebar-section" data-section="components">
        <div class="badge">0</div>
        <div class="sidebar-items"></div>
      </div>
    `;

    updateBlocksSidebar();

    const badge = document.querySelector('.badge');
    expect(badge?.textContent).toBe('2');

    const items = document.querySelectorAll('.sidebar-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('About');
    expect(items[1].textContent).toContain('Hero');
  });

  it('shows "None yet" when no blocks exist', () => {
    setupState({});

    document.body.innerHTML = `
      <div class="sidebar-section" data-section="components">
        <div class="badge">0</div>
        <div class="sidebar-items"></div>
      </div>
    `;

    updateBlocksSidebar();

    const items = document.querySelector('.sidebar-items');
    expect(items?.textContent).toContain('None yet');
  });
});

// ── Non-data element requirements ────────────────────────────────────

describe('BlocksPanel — non-data element requirements', () => {
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

    const html = renderBlocksPanel();
    expect(html).toContain('set the Timer');
  });

  it('auto-names block from element name for do requirements with widget', () => {
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

    const html = renderBlocksPanel();
    // Should have auto-name button, not a dropdown
    expect(html).toContain('data-auto-name="Timer"');
  });
});
