/**
 * Requirements panel — workspace content for the Requirements section.
 *
 * Renders an inline CRUD interface for three requirement types:
 * "know" (information), "do" (data interactions), and "navigate" (view navigation).
 *
 * Navigation has three subtypes selectable via a "Type of Navigation" dropdown:
 *   - Direct Link: from/to view dropdowns
 *   - Navigation Menu: checkbox lists for menu items and visibility
 *   - Forward/Back: page order list with up/down buttons + control type
 *
 * Panel states:
 *   A — Empty (no requirements): intro content + "Add Your First Requirement"
 *   B — Has requirements: description + add button + list + next-step card
 *   C — Form: inline form with Type dropdown + type-specific fields
 */

import { getWizardState, saveWizardState } from '../../state/WizardState';
import { generateId } from '../../../utils/id';
import { updateAccordionSummaries } from '../WorkspaceLayout';
import type {
  Requirement,
  RequirementType,
  RecordType,
  NavType,
} from '../../../types/wizard';

const MAX_REQUIREMENTS = 100;

// ── Rendering ──────────────────────────────────────────────────────────

export function renderRequirementsPanel(): string {
  const { requirements } = getWizardState();

  if (requirements.length === 0) {
    return renderEmptyState();
  }
  return renderListState(requirements);
}

function renderEmptyState(): string {
  return `
    <div class="empty-workspace">
      <div class="empty-icon">&#9634;</div>
      <h3>Build a Decentralized Web App</h3>
      <p>You're building an app where users log in with an identity they own
      and store data in a personal data server (PDS) they control.</p>
      <p><strong>Need inspiration?</strong></p>
      <ul style="list-style: none; padding: 0; text-align: left; display: inline-block;">
        <li style="margin-bottom: 0.5rem;">&#8226; A meditation tracker with sessions stored in your PDS</li>
        <li style="margin-bottom: 0.5rem;">&#8226; A grocery list shared with family members via PDS</li>
        <li style="margin-bottom: 0.5rem;">&#8226; An event planner tracking RSVPs and tasks in your PDS</li>
      </ul>
      <p>Start by defining what your app needs to do.</p>
      <button class="add-btn" id="req-add-btn">+ Add Your First Requirement</button>
    </div>
    <div id="req-form-area"></div>
  `;
}

function renderListState(requirements: Requirement[]): string {
  const atLimit = requirements.length >= MAX_REQUIREMENTS;
  const addBtnDisabled = atLimit ? ' disabled' : '';

  return `
    <p class="workspace-desc">Define what your app needs to do. Think about what users
    need to know, what data they interact with, and how they navigate between views.</p>
    <button class="add-btn" id="req-add-btn"${addBtnDisabled}>+ Add Requirement</button>
    <div id="req-form-area"></div>
    <div class="item-grid" id="req-list">
      ${requirements.map(renderRequirementItem).join('')}
    </div>
    <div class="next-step">
      <div class="next-step-card" id="req-next-step">
        <div>
          <div class="next-step-label">Next step</div>
          <div class="next-step-title">Define Data</div>
          <div class="next-step-desc">Create the record types and fields your app will use.</div>
        </div>
        <button class="next-step-btn">Continue <span class="next-step-arrow">&rarr;</span></button>
      </div>
    </div>
  `;
}

function renderRequirementItem(req: Requirement): string {
  return `
    <div class="item-card" data-req-id="${req.id}">
      <div>
        <div class="item-name">${escapeHtml(getDisplayText(req))}</div>
        <div class="item-meta">${getTypeLabel(req)}</div>
      </div>
      <div class="item-actions">
        <button class="req-edit-btn" data-req-id="${req.id}" aria-label="Edit requirement" title="Edit">&#9998;</button>
        <button class="req-delete-btn" data-req-id="${req.id}" aria-label="Delete requirement" title="Delete">&#10005;</button>
      </div>
    </div>
  `;
}

function getTypeLabel(req: Requirement): string {
  switch (req.type) {
    case 'know':
      return 'Information';
    case 'do':
      return 'Data Interaction';
    case 'navigate':
      switch (req.navType) {
        case 'menu':
          return 'Navigation Menu';
        case 'forward-back':
          return 'Forward/Back Navigation';
        default:
          return 'Direct Link';
      }
  }
}

// ── Inline form rendering ─────────────────────────────────────────────

function renderInlineForm(
  type: RequirementType,
  existing?: Requirement,
): string {
  const saveLabel = existing ? 'Save' : 'Add Requirement';
  const knowSelected = type === 'know' ? ' selected' : '';
  const doSelected = type === 'do' ? ' selected' : '';
  const navSelected = type === 'navigate' ? ' selected' : '';
  const typeDisabled = existing ? ' disabled' : '';

  return `
    <div class="inline-form open" id="req-form">
      <div class="form-row">
        <div class="form-group">
          <label>Type</label>
          <select id="req-type-select"${typeDisabled}>
            <option value="know"${knowSelected}>Information</option>
            <option value="do"${doSelected}>Data Interaction</option>
            <option value="navigate"${navSelected}>Navigation</option>
          </select>
        </div>
        <div class="form-group" id="req-header-right">
          ${renderHeaderRight(type, existing)}
        </div>
      </div>
      <div id="req-type-fields">
        ${renderTypeFields(type, existing)}
      </div>
      <div class="form-actions">
        <button class="btn-primary req-save-btn" disabled>${saveLabel}</button>
        <button class="btn-ghost req-cancel-btn">Cancel</button>
      </div>
    </div>
  `;
}

function renderHeaderRight(
  type: RequirementType,
  existing?: Requirement,
): string {
  if (type === 'navigate') {
    return renderNavTypeDropdown(existing);
  }
  const relatedView = existing?.relatedView ?? '';
  return `
    <label>Related View</label>
    <select id="req-related-view" disabled>
      <option value=""${!relatedView ? ' selected' : ''}>&mdash; none &mdash;</option>
    </select>
  `;
}

function renderNavTypeDropdown(existing?: Requirement): string {
  const { requirements } = getWizardState();
  const hasMenu = requirements.some(
    (r) => r.type === 'navigate' && r.navType === 'menu' && r.id !== editingId,
  );
  const hasForwardBack = requirements.some(
    (r) =>
      r.type === 'navigate' &&
      r.navType === 'forward-back' &&
      r.id !== editingId,
  );

  const navType = existing?.navType ?? 'direct';

  return `
    <label>Type of Navigation</label>
    <select id="req-nav-type-select">
      <option value="direct"${navType === 'direct' ? ' selected' : ''}>Direct Link</option>
      <option value="menu"${navType === 'menu' ? ' selected' : ''}${hasMenu ? ' disabled' : ''}>Navigation Menu</option>
      <option value="forward-back"${navType === 'forward-back' ? ' selected' : ''}${hasForwardBack ? ' disabled' : ''}>Forward/Back Buttons/Arrows</option>
    </select>
  `;
}

// ── Type-specific fields ──────────────────────────────────────────────

function renderTypeFields(
  type: RequirementType,
  existing?: Requirement,
): string {
  if (type === 'know') {
    const val = existing?.text ?? '';
    const content = existing?.content ?? '';
    return `
      <div class="form-group">
        <label>Description</label>
        <textarea id="req-know-text" placeholder="e.g. I need to know how this app works">${escapeHtml(val)}</textarea>
      </div>
      <div class="form-group">
        <label>Content</label>
        <textarea id="req-know-content" placeholder="e.g. An overview of features and how to get started">${escapeHtml(content)}</textarea>
      </div>
    `;
  }

  if (type === 'do') {
    const verb = existing?.verb ?? '';
    let dataValue = existing?.data ?? '';
    if (existing?.dataTypeId) {
      const { recordTypes } = getWizardState();
      const linked = recordTypes.find((r) => r.id === existing.dataTypeId);
      if (linked) dataValue = linked.displayName;
    }
    return `
      <div class="form-hint">As a user of the app, I need to&hellip;</div>
      <div class="form-row">
        <div class="form-group">
          <label>Verb</label>
          <input id="req-do-verb" placeholder="search, list, create, update, etc." value="${escapeAttr(verb)}">
        </div>
        <div class="form-group">
          <label>Data Type</label>
          <div class="combobox" id="req-do-data-combobox">
            <input id="req-do-data" placeholder="e.g., grocery item, book, appointment"
                   autocomplete="off" value="${escapeAttr(dataValue)}">
            <div class="combobox-dropdown" id="req-do-data-dropdown">
            </div>
          </div>
          <div class="form-hint">What kind of thing does this action work with? Select an
          existing type or enter a new one. Focus on the thing being acted on &mdash; if your
          action involves two things (like &ldquo;add an item to a list&rdquo;), the item is the
          data type. The list is a separate type you&rsquo;ll connect later.</div>
        </div>
      </div>
    `;
  }

  // navigate — render based on navType
  const navType = existing?.navType ?? 'direct';
  return renderNavSubtypeFields(navType, existing);
}

function renderNavSubtypeFields(
  navType: NavType,
  existing?: Requirement,
): string {
  if (navType === 'direct') {
    return `
      <div class="form-row">
        <div class="form-group">
          <label>From View</label>
          <select id="req-nav-from" disabled>
            <option disabled selected>Create some views first</option>
          </select>
        </div>
        <div class="form-group">
          <label>To View</label>
          <select id="req-nav-to" disabled>
            <option disabled selected>Create some views first</option>
          </select>
        </div>
      </div>
    `;
  }

  if (navType === 'menu') {
    return `
      <p class="form-note">By default, every view gets a navigation menu linking to all other views. You can customize it or delete it below.</p>
      <div class="form-group">
        <label>Menu Items</label>
        <div class="checkbox-list-placeholder">Add some views first</div>
      </div>
      <div class="form-group">
        <label>Show Menu On</label>
        <div class="checkbox-list-placeholder">Add some views first</div>
      </div>
    `;
  }

  // forward-back
  const controlType = existing?.navControlType ?? 'arrows';
  const fwdText = existing?.buttonForwardText ?? '';
  const backText = existing?.buttonBackText ?? '';
  return `
    <div class="form-group">
      <label>Page Order</label>
      <div class="checkbox-list-placeholder">Add some views first</div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Control Type</label>
        <select id="req-nav-control-type" disabled>
          <option value="arrows"${controlType === 'arrows' ? ' selected' : ''}>Arrows</option>
          <option value="buttons"${controlType === 'buttons' ? ' selected' : ''}>Buttons</option>
        </select>
      </div>
    </div>
    <div class="form-row" id="req-nav-button-text-row" style="display:${controlType === 'buttons' ? 'grid' : 'none'}">
      <div class="form-group">
        <label>Forward Button Text</label>
        <input id="req-nav-forward-text" placeholder="Next" value="${escapeAttr(fwdText)}" disabled>
      </div>
      <div class="form-group">
        <label>Back Button Text</label>
        <input id="req-nav-back-text" placeholder="Previous" value="${escapeAttr(backText)}" disabled>
      </div>
    </div>
  `;
}

// ── Display text ───────────────────────────────────────────────────────

export function getDisplayText(req: Requirement): string {
  switch (req.type) {
    case 'know':
      return `${req.text ?? ''}`;
    case 'do':
      return `I need to ${req.verb ?? ''} ${req.data ?? ''}`;
    case 'navigate':
      switch (req.navType) {
        case 'menu':
          return 'Navigation menu';
        case 'forward-back':
          return `Forward/back navigation (${req.navControlType === 'buttons' ? 'buttons' : 'arrows'})`;
        default:
          return `I need to go from ${req.fromView ?? '?'} to ${req.toView ?? '?'}`;
      }
  }
}

export function getSidebarText(req: Requirement): string {
  switch (req.type) {
    case 'know':
      return `Know: ${truncate(req.text ?? '', 30)}`;
    case 'do':
      return `Do: ${truncate((req.verb ?? '') + ' ' + (req.data ?? ''), 30)}`;
    case 'navigate':
      switch (req.navType) {
        case 'menu':
          return 'Nav: Menu';
        case 'forward-back':
          return 'Nav: Fwd/Back';
        default:
          return `Nav: ${req.fromView ?? '?'} → ${req.toView ?? '?'}`;
      }
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

// ── HTML helpers ───────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Event wiring ───────────────────────────────────────────────────────

/** The ID of the requirement being edited, or null if adding new. */
let editingId: string | null = null;

/** Tracks the selected RecordType ID in the current combobox, or null for new type. */
let selectedDataTypeId: string | null = null;

export function wireRequirementsPanel(): void {
  editingId = null;

  wireAddButton();
  wireListButtons();
  wireNextStepButton();
}

function wireAddButton(): void {
  const addBtn = document.getElementById('req-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => showForm());
  }
}

function wireListButtons(): void {
  document.querySelectorAll('.req-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.reqId!;
      startEdit(id);
    });
  });
  document.querySelectorAll('.req-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.reqId!;
      deleteRequirement(id);
    });
  });
}

function wireNextStepButton(): void {
  const nextStep = document.getElementById('req-next-step');
  if (nextStep) {
    nextStep.addEventListener('click', () => {
      const dataHeader = document.querySelector(
        '.sidebar-header[data-target="data"]',
      ) as HTMLElement | null;
      if (dataHeader) dataHeader.click();
    });
  }
}

// ── Form lifecycle ─────────────────────────────────────────────────────

function showForm(type?: RequirementType, existing?: Requirement): void {
  if (!existing) {
    editingId = null;
    selectedDataTypeId = null;
  } else {
    selectedDataTypeId = existing.dataTypeId ?? null;
  }
  const formType = type ?? existing?.type ?? 'know';
  const area = document.getElementById('req-form-area');
  if (!area) return;
  area.innerHTML = renderInlineForm(formType, existing);

  wireTypeDropdown(existing);
  if (formType === 'navigate') {
    wireNavTypeDropdown(existing);
  }
  if (formType === 'do') {
    wireCombobox();
  }
  wireFormValidation(formType);
  wireFormButtons();

  if (existing) {
    validateForm(formType);
  }

  const form = document.getElementById('req-form');
  if (form?.scrollIntoView) {
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function wireTypeDropdown(existing?: Requirement): void {
  const typeSelect = document.getElementById(
    'req-type-select',
  ) as HTMLSelectElement | null;
  if (!typeSelect) return;

  typeSelect.addEventListener('change', () => {
    const newType = typeSelect.value as RequirementType;

    // Re-render header right (Related View or Type of Navigation)
    const headerRight = document.getElementById('req-header-right');
    if (headerRight) {
      const prefill = existing?.type === newType ? existing : undefined;
      headerRight.innerHTML = renderHeaderRight(newType, prefill);
      if (newType === 'navigate') {
        wireNavTypeDropdown(prefill);
      }
    }

    // Re-render type fields
    const fieldsArea = document.getElementById('req-type-fields');
    if (fieldsArea) {
      const prefill = existing?.type === newType ? existing : undefined;
      fieldsArea.innerHTML = renderTypeFields(newType, prefill);
      if (newType === 'do') {
        selectedDataTypeId = prefill?.dataTypeId ?? null;
        wireCombobox();
      }
    }

    wireFormValidation(newType);
    validateForm(newType);

    // Update save button text
    const saveBtn = document.querySelector('.req-save-btn');
    if (saveBtn && !editingId) {
      saveBtn.textContent = 'Add Requirement';
    }
  });
}

function wireNavTypeDropdown(existing?: Requirement): void {
  const navTypeSelect = document.getElementById(
    'req-nav-type-select',
  ) as HTMLSelectElement | null;
  if (!navTypeSelect) return;

  navTypeSelect.addEventListener('change', () => {
    const navType = navTypeSelect.value as NavType;
    const fieldsArea = document.getElementById('req-type-fields');
    if (!fieldsArea) return;

    const prefill = existing?.navType === navType ? existing : undefined;
    fieldsArea.innerHTML = renderNavSubtypeFields(navType, prefill);

    wireFormValidation('navigate');
    validateForm('navigate');
  });
}

// ── Combobox ────────────────────────────────────────────────────────────

function wireCombobox(): void {
  const input = document.getElementById('req-do-data') as HTMLInputElement | null;
  const dropdown = document.getElementById('req-do-data-dropdown');
  if (!input || !dropdown) return;

  function updateDropdown(): void {
    const { recordTypes } = getWizardState();
    if (recordTypes.length === 0) {
      dropdown!.style.display = 'none';
      return;
    }

    const query = input!.value.trim().toLowerCase();
    const filtered = query
      ? recordTypes.filter((rt) =>
          rt.displayName.toLowerCase().includes(query),
        )
      : recordTypes;

    const exactMatch =
      query &&
      recordTypes.some((rt) => rt.displayName.toLowerCase() === query);

    let html = filtered
      .map(
        (rt) =>
          `<div class="combobox-item" data-record-id="${rt.id}">${escapeHtml(rt.displayName)}</div>`,
      )
      .join('');

    if (query && !exactMatch) {
      html += `<div class="combobox-item combobox-create">Create &ldquo;${escapeHtml(input!.value.trim())}&rdquo;</div>`;
    }

    if (!html) {
      dropdown!.style.display = 'none';
      return;
    }

    dropdown!.innerHTML = html;
    dropdown!.style.display = 'block';

    // Wire click handlers on items
    dropdown!.querySelectorAll('.combobox-item').forEach((item) => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent blur before click registers
        const el = item as HTMLElement;
        const recordId = el.dataset.recordId;
        if (recordId) {
          selectedDataTypeId = recordId;
          const rt = getWizardState().recordTypes.find(
            (r) => r.id === recordId,
          );
          if (rt) input!.value = rt.displayName;
        } else {
          // "Create" option — keep typed text, clear selection
          selectedDataTypeId = null;
        }
        dropdown!.style.display = 'none';
        validateForm('do');
      });
    });
  }

  input.addEventListener('focus', () => updateDropdown());
  input.addEventListener('input', () => {
    selectedDataTypeId = null;
    updateDropdown();
    validateForm('do');
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      dropdown.style.display = 'none';
    }, 150);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdown.style.display = 'none';
    }
  });
}

function wireFormButtons(): void {
  const area = document.getElementById('req-form-area');
  if (!area) return;

  area.querySelectorAll('.req-cancel-btn').forEach((btn) => {
    btn.addEventListener('click', () => closeForm());
  });
  area.querySelectorAll('.req-save-btn').forEach((btn) => {
    btn.addEventListener('click', () => saveRequirement());
  });
}

function closeForm(): void {
  editingId = null;
  selectedDataTypeId = null;
  const area = document.getElementById('req-form-area');
  if (area) area.innerHTML = '';
}

function startEdit(id: string): void {
  const { requirements } = getWizardState();
  const req = requirements.find((r) => r.id === id);
  if (!req) return;
  editingId = id;
  showForm(req.type, req);
}

// ── Validation ─────────────────────────────────────────────────────────

function wireFormValidation(type: RequirementType): void {
  if (type === 'know') {
    const textarea = document.getElementById(
      'req-know-text',
    ) as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.addEventListener('input', () => validateForm(type));
    }
  } else if (type === 'do') {
    const verb = document.getElementById(
      'req-do-verb',
    ) as HTMLInputElement | null;
    const data = document.getElementById(
      'req-do-data',
    ) as HTMLInputElement | null;
    if (verb) verb.addEventListener('input', () => validateForm(type));
    if (data) data.addEventListener('input', () => validateForm(type));
  }
  // navigate: Save stays disabled until views exist (all sub-forms disabled)
}

function validateForm(type: RequirementType): void {
  const saveBtn = document.querySelector(
    '.req-save-btn',
  ) as HTMLButtonElement | null;
  if (!saveBtn) return;

  let valid = false;
  if (type === 'know') {
    const textarea = document.getElementById(
      'req-know-text',
    ) as HTMLTextAreaElement | null;
    valid = (textarea?.value.trim().length ?? 0) > 0;
  } else if (type === 'do') {
    const verb = document.getElementById(
      'req-do-verb',
    ) as HTMLInputElement | null;
    const data = document.getElementById(
      'req-do-data',
    ) as HTMLInputElement | null;
    valid =
      (verb?.value.trim().length ?? 0) > 0 &&
      (data?.value.trim().length ?? 0) > 0;
  }
  // navigate: valid stays false until views exist

  saveBtn.disabled = !valid;
}

// ── State mutations ────────────────────────────────────────────────────

function saveRequirement(): void {
  const typeSelect = document.getElementById(
    'req-type-select',
  ) as HTMLSelectElement | null;
  if (!typeSelect) return;
  const type = typeSelect.value as RequirementType;

  const wizardState = getWizardState();
  const req = buildRequirementFromForm(type, wizardState);
  if (!req) return;

  if (editingId) {
    const idx = wizardState.requirements.findIndex((r) => r.id === editingId);
    if (idx !== -1) {
      req.id = editingId;
      wizardState.requirements[idx] = req;
    }
  } else {
    wizardState.requirements.push(req);
  }

  saveWizardState(wizardState);
  closeForm();
  rerenderPanel();
}

function deleteRequirement(id: string): void {
  const wizardState = getWizardState();
  wizardState.requirements = wizardState.requirements.filter(
    (r) => r.id !== id,
  );
  saveWizardState(wizardState);
  rerenderPanel();
}

function buildRequirementFromForm(
  type: RequirementType,
  wizardState: import('../../../types/wizard').WizardState,
): Requirement | null {
  const base: Requirement = { id: generateId(), type };

  if (type === 'know') {
    // Read relatedView (only for know/do)
    const relatedViewEl = document.getElementById(
      'req-related-view',
    ) as HTMLSelectElement | null;
    const relatedView = relatedViewEl?.value ?? '';
    if (relatedView) base.relatedView = relatedView;

    const textarea = document.getElementById(
      'req-know-text',
    ) as HTMLTextAreaElement | null;
    const contentEl = document.getElementById(
      'req-know-content',
    ) as HTMLTextAreaElement | null;
    const text = textarea?.value.trim() ?? '';
    const content = contentEl?.value.trim() ?? '';
    if (!text) return null;
    base.text = text;
    if (content) base.content = content;
  } else if (type === 'do') {
    // Read relatedView (only for know/do)
    const relatedViewEl = document.getElementById(
      'req-related-view',
    ) as HTMLSelectElement | null;
    const relatedView = relatedViewEl?.value ?? '';
    if (relatedView) base.relatedView = relatedView;

    const verbEl = document.getElementById(
      'req-do-verb',
    ) as HTMLInputElement | null;
    const dataEl = document.getElementById(
      'req-do-data',
    ) as HTMLInputElement | null;
    const verb = verbEl?.value.trim() ?? '';
    const data = dataEl?.value.trim() ?? '';
    if (!verb || !data) return null;
    base.verb = verb;
    base.data = data;

    // Resolve or create a RecordType for this data type
    const dataTypeId = resolveOrCreateDataType(data, wizardState);
    base.dataTypeId = dataTypeId;
  } else {
    // navigate — read navType, currently can't save (all sub-forms disabled)
    const navTypeSelect = document.getElementById(
      'req-nav-type-select',
    ) as HTMLSelectElement | null;
    base.navType = (navTypeSelect?.value as NavType) ?? 'direct';
    return null;
  }

  return base;
}

/**
 * Resolve the data type to an existing RecordType or create a new one.
 * Returns the RecordType ID.
 */
function resolveOrCreateDataType(
  displayName: string,
  wizardState: import('../../../types/wizard').WizardState,
): string {
  // 1. If user selected an existing type via the combobox, use it
  if (selectedDataTypeId) {
    const existing = wizardState.recordTypes.find(
      (r) => r.id === selectedDataTypeId,
    );
    if (existing) return existing.id;
  }

  // 2. Check for exact match by displayName (case-insensitive)
  const exactMatch = wizardState.recordTypes.find(
    (r) => r.displayName.toLowerCase() === displayName.toLowerCase(),
  );
  if (exactMatch) return exactMatch.id;

  // 3. Create a new RecordType
  const newType: RecordType = {
    id: generateId(),
    name: '',
    displayName: displayName.trim(),
    description: '',
    fields: [],
  };
  wizardState.recordTypes.push(newType);
  return newType.id;
}

// ── Re-render ──────────────────────────────────────────────────────────

function rerenderPanel(): void {
  // Re-render into whichever container is visible (avoid duplicate IDs)
  const narrow =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 767px)').matches;

  if (narrow) {
    const accBody = document.querySelector(
      '.accordion-section[data-section="requirements"] .accordion-body',
    );
    if (accBody) accBody.innerHTML = renderRequirementsPanel();
  } else {
    const bodyEl = document.getElementById('workspace-panel-body');
    if (bodyEl) bodyEl.innerHTML = renderRequirementsPanel();
  }

  wireRequirementsPanel();
  updateSidebar();
  updateDataSidebar();
  updateAccordionSummaries();
}

export function updateSidebar(): void {
  const { requirements } = getWizardState();
  const section = document.querySelector(
    '.sidebar-section[data-section="requirements"]',
  );
  if (!section) return;

  // Update badge
  const badge = section.querySelector('.badge');
  if (badge) badge.textContent = String(requirements.length);

  // Update has-items class
  if (requirements.length > 0) {
    section.classList.add('has-items');
  } else {
    section.classList.remove('has-items');
  }

  // Update sidebar items
  const itemsContainer = section.querySelector('.sidebar-items');
  if (!itemsContainer) return;

  if (requirements.length === 0) {
    itemsContainer.innerHTML = '<div class="sidebar-item-empty">None yet</div>';
  } else {
    itemsContainer.innerHTML = requirements
      .map(
        (r) =>
          `<div class="sidebar-item">${escapeHtml(getSidebarText(r))}</div>`,
      )
      .join('');
  }
}

export function updateDataSidebar(): void {
  const { recordTypes } = getWizardState();
  const section = document.querySelector(
    '.sidebar-section[data-section="data"]',
  );
  if (!section) return;

  // Update badge
  const badge = section.querySelector('.badge');
  if (badge) badge.textContent = String(recordTypes.length);

  // Update has-items class
  if (recordTypes.length > 0) {
    section.classList.add('has-items');
  } else {
    section.classList.remove('has-items');
  }

  // Update sidebar items
  const itemsContainer = section.querySelector('.sidebar-items');
  if (!itemsContainer) return;

  if (recordTypes.length === 0) {
    itemsContainer.innerHTML = '<div class="sidebar-item-empty">None yet</div>';
  } else {
    itemsContainer.innerHTML = recordTypes
      .map(
        (rt) =>
          `<div class="sidebar-item">${escapeHtml(rt.displayName || rt.name)}</div>`,
      )
      .join('');
  }
}
