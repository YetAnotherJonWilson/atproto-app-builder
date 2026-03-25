/**
 * Blocks panel — workspace content for the Blocks section.
 *
 * Turns requirements into buildable UI pieces. A block wraps one or more
 * requirements. Single-requirement blocks map to simple elements (paragraph,
 * link, etc.); multi-requirement blocks become composite components.
 *
 * Panel states:
 *   A — Empty (no requirements at all): guidance text
 *   B — Has requirements: block grid + unassigned list + quick-create shortcuts
 *   C — Form open: inline form with chip-based requirement selector
 */

import { getWizardState, saveWizardState } from '../../state/WizardState';
import { generateId } from '../../../utils/id';
import { updateAccordionSummaries, switchSection, isNarrowViewport } from '../WorkspaceLayout';
import {
  getDisplayText,
  getSidebarText,
} from './RequirementsPanel';
import type { Block, BlockType, Requirement } from '../../../types/wizard';

// ── Module-level state ────────────────────────────────────────────────

let editingBlockId: string | null = null;
let selectedReqIds: string[] = [];

// ── Quick-create name options by requirement type ─────────────────────

interface QuickNameOption {
  label: string;
  blockType?: BlockType;
}

const QUICK_NAMES: Record<string, QuickNameOption[]> = {
  know: [
    { label: 'Paragraph', blockType: 'text' },
    { label: 'Section', blockType: 'text' },
    { label: 'Heading', blockType: 'text' },
    { label: 'Info Box', blockType: 'text' },
    { label: 'Banner', blockType: 'text' },
  ],
  'do-data': [
    { label: 'Form', blockType: 'form' },
    { label: 'List', blockType: 'list' },
    { label: 'Card', blockType: 'card' },
    { label: 'Table', blockType: 'table' },
    { label: 'Detail View', blockType: 'detail' },
  ],
  'do-element': [
    { label: 'Widget' },
    { label: 'Tool' },
    { label: 'Control' },
  ],
  navigate: [
    { label: 'Menu', blockType: 'menu' },
    { label: 'Link' },
    { label: 'Button' },
    { label: 'Menu Item' },
    { label: 'Tab' },
  ],
};

function getQuickNames(req: Requirement): QuickNameOption[] | null {
  if (req.type === 'do') {
    if (req.elementId) return null; // auto-name from element
    return QUICK_NAMES['do-data'];
  }
  return QUICK_NAMES[req.type] ?? [];
}

function getElementAutoName(req: Requirement): string | null {
  if (req.type !== 'do' || !req.elementId) return null;
  const { nonDataElements } = getWizardState();
  const el = nonDataElements.find((e) => e.id === req.elementId);
  return el?.name ?? null;
}

// ── Helpers ───────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getRequirementShortText(req: Requirement): string {
  switch (req.type) {
    case 'know':
      return truncate(req.text ?? '', 40);
    case 'do':
      return truncate(req.description ?? '', 40);
    case 'navigate':
      switch (req.navType) {
        case 'menu':
          return 'Navigation menu';
        case 'forward-back':
          return `Fwd/back (${req.navControlType === 'buttons' ? 'buttons' : 'arrows'})`;
        default: {
          const { views } = getWizardState();
          const fromName = views.find(v => v.id === req.fromView)?.name ?? '?';
          const toName = views.find(v => v.id === req.toView)?.name ?? '?';
          return `${fromName} → ${toName}`;
        }
      }
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

function getTypeLabel(req: Requirement): string {
  if (req.type === 'know') return 'know';
  if (req.type === 'do') return 'do';
  return 'nav';
}

function getUnassignedRequirements(): Requirement[] {
  const { requirements, blocks } = getWizardState();
  const assignedIds = new Set<string>();
  for (const block of blocks) {
    for (const rid of block.requirementIds) {
      assignedIds.add(rid);
    }
  }
  return requirements.filter((r) => !assignedIds.has(r.id));
}

// ── Render ────────────────────────────────────────────────────────────

export function renderBlocksPanel(): string {
  const { requirements, blocks } = getWizardState();

  if (requirements.length === 0) {
    return `
      <div class="empty-workspace">
        <div class="empty-icon">&#9634;</div>
        <p>No blocks yet. Define some requirements first, then come back to
        turn them into blocks.</p>
      </div>
    `;
  }

  const desc = `<div class="workspace-desc">
    Turn your requirements into buildable pieces. Create a block from one
    requirement for simple elements, or combine multiple requirements into
    a composite component.
  </div>`;

  const addBtn = `<button class="add-btn" id="blocks-add-btn">+ New Block</button>`;

  const formHtml = `<div class="inline-form" id="blocks-form" style="display:none;"></div>`;

  const gridHtml = blocks.length > 0
    ? `<div class="block-grid" id="blocks-grid">${blocks.map(renderBlockCard).join('')}</div>`
    : '';

  const unassigned = getUnassignedRequirements();
  const unassignedHtml = unassigned.length > 0
    ? renderUnassignedSection(unassigned)
    : '';

  const nextStep = `
    <div class="next-step">
      <div class="next-step-card" id="blocks-next-step" data-section="views">
        <div>
          <div class="next-step-label">Next step</div>
          <div class="next-step-title">Arrange blocks into Views</div>
        </div>
        <div class="next-step-arrow">&rarr;</div>
      </div>
    </div>`;

  return desc + addBtn + formHtml + gridHtml + unassignedHtml + nextStep;
}

function renderBlockCard(block: Block): string {
  const { requirements } = getWizardState();
  const validReqs = block.requirementIds
    .map((id) => requirements.find((r) => r.id === id))
    .filter((r): r is Requirement => r !== undefined);

  const showReorder = validReqs.length > 1;

  const reqItems = validReqs
    .map((req, i) => {
      const reorderHtml = showReorder
        ? `<span class="reorder-btns">
            <button class="block-reorder-up" data-block-id="${block.id}" data-req-index="${i}"
              title="Move up"${i === 0 ? ' disabled' : ''}>&#9650;</button>
            <button class="block-reorder-down" data-block-id="${block.id}" data-req-index="${i}"
              title="Move down"${i === validReqs.length - 1 ? ' disabled' : ''}>&#9660;</button>
          </span>`
        : '';

      return `<li class="block-card-req">
        <span class="req-order">${i + 1}</span>
        <span class="req-type-badge">${getTypeLabel(req)}</span>
        <span>${escapeHtml(getRequirementShortText(req))}</span>
        ${reorderHtml}
      </li>`;
    })
    .join('');

  return `<div class="block-card" data-block-id="${block.id}">
    <div class="block-card-header">
      <div class="block-card-name">${escapeHtml(block.name)}</div>
      <div class="block-card-actions">
        <button class="block-edit-btn" data-block-id="${block.id}" title="Edit">&#9998;</button>
        <button class="block-delete-btn" data-block-id="${block.id}" title="Delete">&#10005;</button>
      </div>
    </div>
    <ul class="block-card-requirements">${reqItems}</ul>
  </div>`;
}

function renderUnassignedSection(unassigned: Requirement[]): string {
  const items = unassigned
    .map((req) => {
      const quickNames = getQuickNames(req);
      const autoName = getElementAutoName(req);

      // do/element: auto-name from element, no dropdown needed
      const quickHtml = autoName
        ? `<button class="quick-btn quick-btn-auto" data-req-id="${req.id}" data-auto-name="${escapeHtml(autoName)}">+ Block</button>`
        : `<div class="quick-create-wrapper">
            <button class="quick-btn" data-req-id="${req.id}">+ Block</button>
            <div class="quick-create-dropdown" data-req-id="${req.id}">
              ${(quickNames ?? [])
                .map((n) => `<button class="quick-create-option" data-name="${escapeHtml(n.label)}"${n.blockType ? ` data-block-type="${n.blockType}"` : ''} data-req-id="${req.id}">${escapeHtml(n.label)}</button>`)
                .join('')}
            </div>
          </div>`;

      return `<li class="available-item" data-req-id="${req.id}">
        <span class="avail-type">${getTypeLabel(req)}</span>
        <span class="avail-text">${escapeHtml(getRequirementShortText(req))}</span>
        ${quickHtml}
      </li>`;
    })
    .join('');

  return `<div class="unassigned-section" id="blocks-unassigned">
    <div class="available-list-label">
      Unassigned Requirements
      <span class="unassigned-count">&nbsp;&mdash; ${unassigned.length} remaining</span>
    </div>
    <div class="form-hint">
      Click &ldquo;+ Block&rdquo; on any requirement to quickly create a single-requirement
      block, or use &ldquo;+ New Block&rdquo; above to combine multiple requirements.
    </div>
    <ul class="available-list" id="blocks-unassigned-list">${items}</ul>
  </div>`;
}

function renderInlineForm(): string {
  const { requirements } = getWizardState();
  const block = editingBlockId
    ? getWizardState().blocks.find((b) => b.id === editingBlockId)
    : null;

  const nameValue = block ? escapeHtml(block.name) : '';

  // Build chips
  const chipsHtml = selectedReqIds
    .map((rid, i) => {
      const req = requirements.find((r) => r.id === rid);
      if (!req) return '';
      return `<span class="chip" data-req-id="${rid}">
        <span class="chip-order">${i + 1}</span>
        ${escapeHtml(getRequirementShortText(req))}
        <button class="chip-remove" data-req-id="${rid}">&#10005;</button>
      </span>`;
    })
    .join('');

  // Build available list — all requirements, mark selected
  const availItems = requirements
    .map((req) => {
      const isSelected = selectedReqIds.includes(req.id);
      return `<li class="available-item${isSelected ? ' selected' : ''}" data-req-id="${req.id}">
        <span class="avail-check"></span>
        <span class="avail-type">${getTypeLabel(req)}</span>
        <span class="avail-text">${escapeHtml(getRequirementShortText(req))}</span>
      </li>`;
    })
    .join('');

  const saveDisabled = !nameValue || selectedReqIds.length === 0;

  return `
    <div class="form-group">
      <label for="block-name-input">Block Name</label>
      <input type="text" id="block-name-input"
        placeholder="e.g., Post Feed, Search Bar, Nav Menu"
        value="${nameValue}">
    </div>
    <div class="form-group">
      <label>Requirements</label>
      <div class="selected-chips" id="block-selected-chips">
        ${chipsHtml || '<span class="chips-placeholder">Click requirements below to add them</span>'}
      </div>
      <div class="form-hint">
        Selected requirements will be combined in the order shown. Click &#10005; to remove.
      </div>
      <div class="available-list-label">Available Requirements</div>
      <ul class="available-list" id="block-available-list">${availItems}</ul>
    </div>
    <div class="form-footer">
      <button class="btn-primary" id="block-save-btn"${saveDisabled ? ' disabled' : ''}>
        ${editingBlockId ? 'Update Block' : 'Save Block'}
      </button>
      <button class="btn-ghost" id="block-cancel-btn">Cancel</button>
    </div>`;
}

// ── Wire ──────────────────────────────────────────────────────────────

export function wireBlocksPanel(): void {
  // Add button
  const addBtn = document.getElementById('blocks-add-btn');
  addBtn?.addEventListener('click', openNewForm);

  // Block card actions (delegation on grid)
  const grid = document.getElementById('blocks-grid');
  grid?.addEventListener('click', handleGridClick);

  // Unassigned section (delegation)
  const unassignedList = document.getElementById('blocks-unassigned-list');
  unassignedList?.addEventListener('click', handleUnassignedClick);

  // Next step card
  const nextStep = document.getElementById('blocks-next-step');
  nextStep?.addEventListener('click', () => {
    switchSection('views');
  });

  // Close any open quick-create dropdown on outside click
  document.addEventListener('click', handleDocumentClick);

  // Close dropdown on Escape
  document.addEventListener('keydown', handleEscapeKey);
}

function handleGridClick(e: Event): void {
  const target = e.target as HTMLElement;

  // Edit button
  const editBtn = target.closest('.block-edit-btn') as HTMLElement | null;
  if (editBtn) {
    const blockId = editBtn.dataset.blockId!;
    openEditForm(blockId);
    return;
  }

  // Delete button
  const deleteBtn = target.closest('.block-delete-btn') as HTMLElement | null;
  if (deleteBtn) {
    const blockId = deleteBtn.dataset.blockId!;
    deleteBlock(blockId);
    return;
  }

  // Reorder up
  const upBtn = target.closest('.block-reorder-up') as HTMLElement | null;
  if (upBtn && !(upBtn as HTMLButtonElement).disabled) {
    reorderRequirement(upBtn.dataset.blockId!, parseInt(upBtn.dataset.reqIndex!, 10), -1);
    return;
  }

  // Reorder down
  const downBtn = target.closest('.block-reorder-down') as HTMLElement | null;
  if (downBtn && !(downBtn as HTMLButtonElement).disabled) {
    reorderRequirement(downBtn.dataset.blockId!, parseInt(downBtn.dataset.reqIndex!, 10), 1);
    return;
  }
}

function handleUnassignedClick(e: Event): void {
  const target = e.target as HTMLElement;

  // Quick-create option (from dropdown)
  const option = target.closest('.quick-create-option') as HTMLElement | null;
  if (option) {
    e.stopPropagation();
    const name = option.dataset.name!;
    const reqId = option.dataset.reqId!;
    const blockType = option.dataset.blockType as BlockType | undefined;
    quickCreateBlock(name, reqId, blockType);
    return;
  }

  // Quick-create button — auto-name (do/element) or toggle dropdown
  const quickBtn = target.closest('.quick-btn') as HTMLElement | null;
  if (quickBtn) {
    e.stopPropagation();
    const reqId = quickBtn.dataset.reqId!;
    const autoName = quickBtn.dataset.autoName;
    if (autoName) {
      quickCreateBlock(autoName, reqId);
    } else {
      toggleQuickDropdown(reqId);
    }
    return;
  }
}

function handleDocumentClick(): void {
  closeAllDropdowns();
}

function handleEscapeKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    closeAllDropdowns();
  }
}

// ── Form operations ──────────────────────────────────────────────────

function openNewForm(): void {
  editingBlockId = null;
  selectedReqIds = [];
  showForm();
}

function openEditForm(blockId: string): void {
  const block = getWizardState().blocks.find((b) => b.id === blockId);
  if (!block) return;

  editingBlockId = blockId;
  // Filter out deleted requirement ids
  const { requirements } = getWizardState();
  const validIds = new Set(requirements.map((r) => r.id));
  selectedReqIds = block.requirementIds.filter((id) => validIds.has(id));
  showForm();
}

function showForm(): void {
  const form = document.getElementById('blocks-form');
  if (!form) return;

  form.innerHTML = renderInlineForm();
  form.style.display = 'block';

  // Hide add button while form is open
  const addBtn = document.getElementById('blocks-add-btn');
  if (addBtn) addBtn.style.display = 'none';

  wireForm();

  // Focus the name input
  const nameInput = document.getElementById('block-name-input') as HTMLInputElement | null;
  nameInput?.focus();

  // Scroll form into view
  form.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
}

function hideForm(): void {
  const form = document.getElementById('blocks-form');
  if (form) {
    form.innerHTML = '';
    form.style.display = 'none';
  }

  // Show add button again
  const addBtn = document.getElementById('blocks-add-btn');
  if (addBtn) addBtn.style.display = '';

  editingBlockId = null;
  selectedReqIds = [];
}

function wireForm(): void {
  // Name input — update save button state
  const nameInput = document.getElementById('block-name-input') as HTMLInputElement | null;
  nameInput?.addEventListener('input', updateSaveButtonState);

  // Available list — click to toggle selection
  const availList = document.getElementById('block-available-list');
  availList?.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest('.available-item') as HTMLElement | null;
    if (!item) return;
    const reqId = item.dataset.reqId!;
    toggleRequirementSelection(reqId);
  });

  // Chip remove buttons (delegation on chips container)
  const chipsContainer = document.getElementById('block-selected-chips');
  chipsContainer?.addEventListener('click', (e) => {
    const removeBtn = (e.target as HTMLElement).closest('.chip-remove') as HTMLElement | null;
    if (!removeBtn) return;
    const reqId = removeBtn.dataset.reqId!;
    toggleRequirementSelection(reqId);
  });

  // Save button
  const saveBtn = document.getElementById('block-save-btn');
  saveBtn?.addEventListener('click', saveBlock);

  // Cancel button
  const cancelBtn = document.getElementById('block-cancel-btn');
  cancelBtn?.addEventListener('click', () => {
    hideForm();
  });
}

function toggleRequirementSelection(reqId: string): void {
  const idx = selectedReqIds.indexOf(reqId);
  if (idx >= 0) {
    selectedReqIds.splice(idx, 1);
  } else {
    selectedReqIds.push(reqId);
  }
  refreshFormContents();
}

function refreshFormContents(): void {
  const form = document.getElementById('blocks-form');
  if (!form) return;

  // Preserve name input value
  const nameInput = document.getElementById('block-name-input') as HTMLInputElement | null;
  const currentName = nameInput?.value ?? '';

  form.innerHTML = renderInlineForm();

  // Restore name
  const newNameInput = document.getElementById('block-name-input') as HTMLInputElement | null;
  if (newNameInput && currentName) {
    newNameInput.value = currentName;
  }

  wireForm();
  updateSaveButtonState();
}

function updateSaveButtonState(): void {
  const nameInput = document.getElementById('block-name-input') as HTMLInputElement | null;
  const saveBtn = document.getElementById('block-save-btn') as HTMLButtonElement | null;
  if (!nameInput || !saveBtn) return;

  const hasName = nameInput.value.trim().length > 0;
  const hasReqs = selectedReqIds.length > 0;
  saveBtn.disabled = !(hasName && hasReqs);
}

// ── CRUD operations ──────────────────────────────────────────────────

function saveBlock(): void {
  const nameInput = document.getElementById('block-name-input') as HTMLInputElement | null;
  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name || selectedReqIds.length === 0) return;

  const state = getWizardState();

  if (editingBlockId) {
    // Update existing block
    const block = state.blocks.find((b) => b.id === editingBlockId);
    if (block) {
      block.name = name;
      block.requirementIds = [...selectedReqIds];
    }
  } else {
    // Create new block
    const block: Block = {
      id: generateId(),
      name,
      requirementIds: [...selectedReqIds],
    };
    state.blocks.push(block);
  }

  saveWizardState(state);
  hideForm();
  rerender();
}

function deleteBlock(blockId: string): void {
  const state = getWizardState();
  state.blocks = state.blocks.filter((b) => b.id !== blockId);
  saveWizardState(state);
  rerender();
}

function quickCreateBlock(name: string, reqId: string, blockType?: BlockType): void {
  const state = getWizardState();
  const block: Block = {
    id: generateId(),
    name,
    requirementIds: [reqId],
    ...(blockType && { blockType }),
  };
  state.blocks.push(block);
  saveWizardState(state);
  rerender();
}

function reorderRequirement(blockId: string, index: number, direction: -1 | 1): void {
  const state = getWizardState();
  const block = state.blocks.find((b) => b.id === blockId);
  if (!block) return;

  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= block.requirementIds.length) return;

  // Swap
  const temp = block.requirementIds[index];
  block.requirementIds[index] = block.requirementIds[newIndex];
  block.requirementIds[newIndex] = temp;

  saveWizardState(state);
  rerender();
}

// ── Quick-create dropdown ────────────────────────────────────────────

function toggleQuickDropdown(reqId: string): void {
  const dropdown = document.querySelector(
    `.quick-create-dropdown[data-req-id="${reqId}"]`,
  ) as HTMLElement | null;
  if (!dropdown) return;

  const isOpen = dropdown.classList.contains('open');
  closeAllDropdowns();
  if (!isOpen) {
    dropdown.classList.add('open');
  }
}

function closeAllDropdowns(): void {
  document.querySelectorAll('.quick-create-dropdown.open').forEach((d) => {
    d.classList.remove('open');
  });
}

// ── Sidebar ──────────────────────────────────────────────────────────

export function updateBlocksSidebar(): void {
  const { blocks } = getWizardState();
  const section = document.querySelector(
    '.sidebar-section[data-section="components"]',
  );
  if (!section) return;

  // Update badge
  const badge = section.querySelector('.badge');
  if (badge) badge.textContent = String(blocks.length);

  // Update has-items state
  if (blocks.length > 0) {
    section.classList.add('has-items');
  } else {
    section.classList.remove('has-items');
  }

  // Update sidebar items
  const itemsContainer = section.querySelector('.sidebar-items');
  if (!itemsContainer) return;

  if (blocks.length === 0) {
    itemsContainer.innerHTML =
      '<div class="sidebar-item-empty">None yet</div>';
  } else {
    itemsContainer.innerHTML = blocks
      .map(
        (b) =>
          `<div class="sidebar-item"><span class="dot"></span> ${escapeHtml(truncate(b.name, 25))}</div>`,
      )
      .join('');
  }
}

// ── Re-render ────────────────────────────────────────────────────────

function rerender(): void {
  // Re-render into the visible container (accordion on narrow, workspace on wide)
  const body = isNarrowViewport()
    ? document.querySelector('.accordion-section[data-section="components"] .accordion-body')
    : document.getElementById('workspace-panel-body');

  if (body) {
    body.innerHTML = renderBlocksPanel();
    wireBlocksPanel();
  }

  updateBlocksSidebar();
  updateAccordionSummaries();
}
