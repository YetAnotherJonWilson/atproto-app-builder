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
import type { Block, BlockType, Requirement, ContentNode, ContentNodeType } from '../../../types/wizard';
import { renderToDOM } from '../../../inlay/host-runtime';
import { buildContentNodeTree } from '../../../inlay/text-variants';

// ── Module-level state ────────────────────────────────────────────────

let editingBlockId: string | null = null;
let selectedReqIds: string[] = [];
let editingContentNodes: ContentNode[] = [];
let isContentEditorMode = false;

// ── Quick-create name options by requirement type ─────────────────────

interface QuickNameOption {
  label: string;
  blockType?: BlockType;
  contentNodeType?: ContentNodeType;
}

const QUICK_NAMES: Record<string, QuickNameOption[]> = {
  know: [
    { label: 'Paragraph', blockType: 'text', contentNodeType: 'paragraph' },
    { label: 'Section', blockType: 'text', contentNodeType: 'heading' },
    { label: 'Heading', blockType: 'text', contentNodeType: 'heading' },
    { label: 'Info Box', blockType: 'text', contentNodeType: 'infoBox' },
    { label: 'Banner', blockType: 'text', contentNodeType: 'banner' },
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
      return truncate(req.text ?? '', 80);
    case 'do':
      return truncate(req.description ?? '', 80);
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

  // Check if this is a text block with content nodes for Inlay preview
  const hasInlayPreview = block.blockType === 'text' && (block.contentNodes?.length ?? 0) > 0;

  // Inlay preview container — filled in by wireBlocksPanel via DOM rendering
  const previewHtml = hasInlayPreview
    ? `<div class="block-card-inlay-preview inlay-root" data-block-id="${block.id}"></div>`
    : '';

  // For text blocks with contentNodes, show a "Fulfills" badge instead of the
  // full requirement list. Non-text blocks keep the old requirement list.
  let footerHtml: string;
  if (hasInlayPreview && validReqs.length > 0) {
    const fulfillsText = validReqs
      .filter(r => r.type === 'know')
      .map(r => escapeHtml(truncate(r.text ?? '', 50)))
      .join(', ');
    footerHtml = fulfillsText
      ? `<div class="block-card-fulfills">Fulfills: ${fulfillsText}</div>`
      : '';
  } else {
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
    footerHtml = `<ul class="block-card-requirements">${reqItems}</ul>`;
  }

  return `<div class="block-card" data-block-id="${block.id}">
    <div class="block-card-header">
      <div class="block-card-name">${escapeHtml(block.name)}</div>
      <div class="block-card-actions">
        <button class="block-edit-btn" data-block-id="${block.id}" title="Edit">&#9998;</button>
        <button class="block-delete-btn" data-block-id="${block.id}" title="Delete">&#10005;</button>
      </div>
    </div>
    ${previewHtml}
    ${footerHtml}
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
                .map((n) => `<button class="quick-create-option" data-name="${escapeHtml(n.label)}"${n.blockType ? ` data-block-type="${n.blockType}"` : ''}${n.contentNodeType ? ` data-content-node-type="${n.contentNodeType}"` : ''} data-req-id="${req.id}">${escapeHtml(n.label)}</button>`)
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
  if (isContentEditorMode) {
    return renderContentEditorForm();
  }
  return renderChipSelectorForm();
}

// ── Content editor form (text blocks) ───────────────────────────────

const CONTENT_NODE_TYPE_LABELS: { value: ContentNodeType; label: string }[] = [
  { value: 'heading', label: 'Heading' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'caption', label: 'Caption' },
  { value: 'infoBox', label: 'Info Box' },
  { value: 'banner', label: 'Banner' },
];

function renderContentEditorForm(): string {
  const block = editingBlockId
    ? getWizardState().blocks.find((b) => b.id === editingBlockId)
    : null;

  const nameValue = block ? escapeHtml(block.name) : '';

  // Show linked requirement as fulfills badge
  let fulfillsHtml = '';
  if (block && block.requirementIds.length > 0) {
    const { requirements } = getWizardState();
    const linked = block.requirementIds
      .map(id => requirements.find(r => r.id === id))
      .filter((r): r is Requirement => r !== undefined && r.type === 'know')
      .map(r => escapeHtml(truncate(r.text ?? '', 60)));
    if (linked.length > 0) {
      fulfillsHtml = `<div class="form-hint" style="margin-bottom:8px;">Fulfills: ${linked.join(', ')}</div>`;
    }
  }

  // Render content node cards
  const nodesHtml = editingContentNodes.length > 0
    ? editingContentNodes.map((node, i) => renderContentNodeCard(node, i)).join('')
    : '<div class="form-hint">No content yet. Click &ldquo;+ Add Content&rdquo; to get started.</div>';

  const saveDisabled = !nameValue;

  return `
    <div class="form-group">
      <label for="block-name-input">Block Name</label>
      <input type="text" id="block-name-input"
        placeholder="e.g., About This App, Welcome Section"
        value="${nameValue}">
    </div>
    ${fulfillsHtml}
    <div class="form-group">
      <label>Content</label>
      <div class="content-nodes-list" id="content-nodes-list">
        ${nodesHtml}
      </div>
      <div class="content-add-wrapper">
        <button class="quick-btn" id="content-add-btn">+ Add Content</button>
        <div class="quick-create-dropdown" id="content-add-dropdown">
          ${CONTENT_NODE_TYPE_LABELS.map(t =>
            `<button class="quick-create-option content-add-option" data-node-type="${t.value}">${escapeHtml(t.label)}</button>`
          ).join('')}
        </div>
      </div>
    </div>
    <div class="content-editor-preview inlay-root" id="content-editor-preview"></div>
    <div class="form-footer">
      <button class="btn-primary" id="block-save-btn"${saveDisabled ? ' disabled' : ''}>
        ${editingBlockId ? 'Update Block' : 'Save Block'}
      </button>
      <button class="btn-ghost" id="block-cancel-btn">Cancel</button>
    </div>`;
}

function renderContentNodeCard(node: ContentNode, index: number): string {
  const isFirst = index === 0;
  const isLast = index === editingContentNodes.length - 1;
  const showReorder = editingContentNodes.length > 1;

  const typeLabel = CONTENT_NODE_TYPE_LABELS.find(t => t.value === node.type)?.label
    ?? node.type.toUpperCase();
  const textValue = node.type === 'image' ? '' : escapeHtml(node.text);

  const reorderHtml = showReorder
    ? `<button class="content-node-up" data-node-index="${index}" title="Move up"${isFirst ? ' disabled' : ''}>&#9650;</button>
       <button class="content-node-down" data-node-index="${index}" title="Move down"${isLast ? ' disabled' : ''}>&#9660;</button>`
    : '';

  return `<div class="content-node-card" data-node-index="${index}">
    <div class="content-node-header">
      <span class="content-node-type-label">${escapeHtml(typeLabel)}</span>
      <span class="content-node-actions">
        ${reorderHtml}
        <button class="content-node-remove" data-node-index="${index}" title="Remove">&#10005;</button>
      </span>
    </div>
    <textarea class="content-node-text" data-node-index="${index}" rows="2"
      placeholder="Enter ${typeLabel.toLowerCase()} text...">${textValue}</textarea>
  </div>`;
}

// ── Chip selector form (non-text blocks) ────────────────────────────

function renderChipSelectorForm(): string {
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
  // Render Inlay previews into placeholder containers
  renderInlayPreviews();

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
    const contentNodeType = option.dataset.contentNodeType as ContentNodeType | undefined;
    quickCreateBlock(name, reqId, blockType, contentNodeType);
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
  editingContentNodes = [];
  isContentEditorMode = true; // new blocks default to content editor (text block)
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

  // Text blocks use content editor; others use chip selector
  if (block.blockType === 'text') {
    isContentEditorMode = true;
    editingContentNodes = block.contentNodes ? block.contentNodes.map(n => ({ ...n })) : [];
  } else {
    isContentEditorMode = false;
    editingContentNodes = [];
  }
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
  editingContentNodes = [];
  isContentEditorMode = false;
}

function wireForm(): void {
  // Name input — update save button state
  const nameInput = document.getElementById('block-name-input') as HTMLInputElement | null;
  nameInput?.addEventListener('input', updateSaveButtonState);

  if (isContentEditorMode) {
    wireContentEditorForm();
  } else {
    wireChipSelectorForm();
  }

  // Save button
  const saveBtn = document.getElementById('block-save-btn');
  saveBtn?.addEventListener('click', saveBlock);

  // Cancel button
  const cancelBtn = document.getElementById('block-cancel-btn');
  cancelBtn?.addEventListener('click', () => {
    hideForm();
  });
}

function wireContentEditorForm(): void {
  const nodesList = document.getElementById('content-nodes-list');
  nodesList?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Remove button
    const removeBtn = target.closest('.content-node-remove') as HTMLElement | null;
    if (removeBtn) {
      const idx = parseInt(removeBtn.dataset.nodeIndex!, 10);
      editingContentNodes.splice(idx, 1);
      refreshFormContents();
      return;
    }

    // Move up
    const upBtn = target.closest('.content-node-up') as HTMLElement | null;
    if (upBtn && !(upBtn as HTMLButtonElement).disabled) {
      const idx = parseInt(upBtn.dataset.nodeIndex!, 10);
      if (idx > 0) {
        [editingContentNodes[idx - 1], editingContentNodes[idx]] =
          [editingContentNodes[idx], editingContentNodes[idx - 1]];
        refreshFormContents();
      }
      return;
    }

    // Move down
    const downBtn = target.closest('.content-node-down') as HTMLElement | null;
    if (downBtn && !(downBtn as HTMLButtonElement).disabled) {
      const idx = parseInt(downBtn.dataset.nodeIndex!, 10);
      if (idx < editingContentNodes.length - 1) {
        [editingContentNodes[idx], editingContentNodes[idx + 1]] =
          [editingContentNodes[idx + 1], editingContentNodes[idx]];
        refreshFormContents();
      }
      return;
    }
  });

  // Text input — update node text on input and refresh preview
  nodesList?.addEventListener('input', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('content-node-text')) {
      const idx = parseInt(target.dataset.nodeIndex!, 10);
      const node = editingContentNodes[idx];
      if (node && node.type !== 'image') {
        node.text = (target as HTMLTextAreaElement).value;
        renderContentEditorPreview();
      }
    }
  });

  // Enter to confirm (blur) textarea; Shift+Enter for newline
  nodesList?.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('content-node-text') && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      (target as HTMLTextAreaElement).blur();
    }
  });

  // Add content button — toggle dropdown
  const addBtn = document.getElementById('content-add-btn');
  addBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('content-add-dropdown');
    dropdown?.classList.toggle('open');
  });

  // Add content dropdown options
  const dropdown = document.getElementById('content-add-dropdown');
  dropdown?.addEventListener('click', (e) => {
    e.stopPropagation();
    const option = (e.target as HTMLElement).closest('.content-add-option') as HTMLElement | null;
    if (!option) return;
    const nodeType = option.dataset.nodeType as ContentNodeType;
    if (nodeType === 'image') {
      editingContentNodes.push({ type: 'image', src: '', alt: '' });
    } else {
      editingContentNodes.push({ type: nodeType, text: '' });
    }
    dropdown.classList.remove('open');
    refreshFormContents();
    // Focus the newly added content node's textarea (query fresh DOM after re-render)
    const freshList = document.getElementById('content-nodes-list');
    const lastTextarea = freshList?.querySelector('.content-node-card:last-child .content-node-text') as HTMLTextAreaElement | null;
    lastTextarea?.focus();
  });

  // Render live preview
  renderContentEditorPreview();
}

function renderContentEditorPreview(): void {
  const container = document.getElementById('content-editor-preview');
  if (!container) return;
  container.innerHTML = '';

  const nonEmptyNodes = editingContentNodes.filter(n =>
    n.type === 'image' ? !!n.src : !!n.text
  );
  if (nonEmptyNodes.length === 0) return;

  const tree = buildContentNodeTree(nonEmptyNodes);
  if (!tree) return;

  const dom = renderToDOM(tree);
  container.appendChild(dom);
}

function wireChipSelectorForm(): void {
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

  // For content editor, sync textarea values to state before re-render
  if (isContentEditorMode) {
    document.querySelectorAll('.content-node-text').forEach(el => {
      const idx = parseInt((el as HTMLElement).dataset.nodeIndex!, 10);
      const node = editingContentNodes[idx];
      if (node && node.type !== 'image') {
        node.text = (el as HTMLTextAreaElement).value;
      }
    });
  }

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
  if (isContentEditorMode) {
    // Content editor only requires a name — content can be empty
    saveBtn.disabled = !hasName;
  } else {
    saveBtn.disabled = !(hasName && selectedReqIds.length > 0);
  }
}

// ── CRUD operations ──────────────────────────────────────────────────

function saveBlock(): void {
  const nameInput = document.getElementById('block-name-input') as HTMLInputElement | null;
  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) return;

  // Sync textarea values one final time for content editor
  if (isContentEditorMode) {
    document.querySelectorAll('.content-node-text').forEach(el => {
      const idx = parseInt((el as HTMLElement).dataset.nodeIndex!, 10);
      const node = editingContentNodes[idx];
      if (node && node.type !== 'image') {
        node.text = (el as HTMLTextAreaElement).value;
      }
    });
  }

  const state = getWizardState();

  if (isContentEditorMode) {
    if (editingBlockId) {
      // Update existing text block
      const block = state.blocks.find((b) => b.id === editingBlockId);
      if (block) {
        block.name = name;
        block.contentNodes = [...editingContentNodes];
      }
    } else {
      // Create new text block from scratch
      // Auto-create a know requirement if none is linked
      const reqId = generateId();
      state.requirements.push({
        id: reqId,
        type: 'know',
        text: name,
      });

      const block: Block = {
        id: generateId(),
        name,
        requirementIds: [reqId],
        blockType: 'text',
        contentNodes: [...editingContentNodes],
      };
      state.blocks.push(block);
    }
  } else {
    // Chip selector mode (non-text blocks)
    if (selectedReqIds.length === 0) return;

    if (editingBlockId) {
      const block = state.blocks.find((b) => b.id === editingBlockId);
      if (block) {
        block.name = name;
        block.requirementIds = [...selectedReqIds];
      }
    } else {
      const block: Block = {
        id: generateId(),
        name,
        requirementIds: [...selectedReqIds],
      };
      state.blocks.push(block);
    }
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

function quickCreateBlock(fallbackName: string, reqId: string, blockType?: BlockType, contentNodeType?: ContentNodeType): void {
  const state = getWizardState();
  const req = state.requirements.find(r => r.id === reqId);

  // Use the requirement's title as the block name, falling back to the dropdown label
  const name = req ? getRequirementShortText(req) : fallbackName;

  // Build contentNodes from the linked requirement's text
  let contentNodes: ContentNode[] | undefined;
  if (contentNodeType) {
    const text = req?.text ?? '';
    if (contentNodeType === 'image') {
      contentNodes = [{ type: 'image', src: '', alt: text }];
    } else {
      contentNodes = [{ type: contentNodeType, text }];
    }
  }

  const block: Block = {
    id: generateId(),
    name,
    requirementIds: [reqId],
    ...(blockType && { blockType }),
    ...(contentNodes && { contentNodes }),
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

// ── Inlay preview rendering ──────────────────────────────────────────

function renderInlayPreviews(): void {
  const containers = document.querySelectorAll('.block-card-inlay-preview');
  const { blocks } = getWizardState();

  containers.forEach(container => {
    const blockId = (container as HTMLElement).dataset.blockId;
    if (!blockId) return;

    const block = blocks.find(b => b.id === blockId);
    if (!block?.contentNodes?.length) return;

    const tree = buildContentNodeTree(block.contentNodes);
    if (!tree) return;

    const dom = renderToDOM(tree);
    container.appendChild(dom);
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
