/**
 * Data panel — workspace content for the Data section.
 *
 * Panel states:
 *   A — Empty (no RecordTypes): guidance + "Go to Requirements" button
 *   B — Has RecordTypes: description + card grid
 *   C — Detail view: identity config for a single data type
 *
 * The detail view replaces the card grid when a card is clicked.
 * A "← Back to Data Types" link returns to the card grid.
 */

import { getWizardState, saveWizardState } from '../../state/WizardState';
import { getSession, getUserProfile } from '../../auth/AuthService';
import {
  searchLexicons,
  resolveLexicon,
} from '../../services/LexiconDiscovery';
import type { AutocompleteResult } from '../../services/LexiconDiscovery';
import {
  fetchLexiconCatalog,
  filterRecords,
  searchCatalog,
  getCachedCatalog,
  findByNsid,
} from '../../services/LexiStats';
import type { LexiStatEntry } from '../../services/LexiStats';
import { toCamelCase, toPascalCase } from '../../../utils/text';
import { showPromptDialog } from '../../dialogs/PromptDialog';
import type { RecordType, NamespaceOption } from '../../../types/wizard';
import type { LexiconSchema } from '../../../types/generation';
import { deleteRecordType } from '../../operations/RecordTypeOps';
import { showConfirmDialog } from '../../dialogs/ConfirmDialog';

// ── Module-level state ────────────────────────────────────────────────

let activeDetailRecordId: string | null = null;
let detailMode: 'choice' | 'create' | 'browse' = 'choice';
let guidanceChecklistOpen = false;

// Form working state — preserved when switching between create-new and browse
interface CreateNewFormState {
  name: string;
  description: string;
  namespaceOption: NamespaceOption;
  lexUsername: string;
  customDomain: string;
  recordKeyType: 'tid' | 'any';
}

let formState: CreateNewFormState | null = null;

// Snapshot of last-saved values for dirty detection
let savedFormSnapshot: CreateNewFormState | null = null;

// Browse/adopt state
let searchQuery = '';
let searchResults: AutocompleteResult[] = [];
let searchLexiOnly: LexiStatEntry[] = [];
let searchError = false;
let selectedSchema: LexiconSchema | null = null;
let selectedNsid: string | null = null;
let resolveError: string | null = null;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Browse sub-tab state
let browseTab: 'search' | 'popular' = 'search';
let popularLexicons: LexiStatEntry[] = [];
let popularLoading = false;
let popularError = false;
let popularCategory: string | null = null;
let popularSort: 'users' | 'events' | 'alpha' = 'users';
let popularShowCount = 20;

// ── Public API ────────────────────────────────────────────────────────

export function renderDataPanel(): string {
  const { recordTypes } = getWizardState();

  if (activeDetailRecordId) {
    const rt = recordTypes.find((r) => r.id === activeDetailRecordId);
    if (rt) return renderDetailView(rt);
    // Record was deleted while detail was open — fall back to grid
    activeDetailRecordId = null;
  }

  if (recordTypes.length === 0) {
    return renderEmptyState();
  }
  return renderCardGrid(recordTypes);
}

export function wireDataPanel(): void {
  if (activeDetailRecordId) {
    wireDetailView();
    return;
  }

  // Wire "Go to Requirements" button
  const goToReqBtn = document.getElementById('data-go-to-req-btn');
  if (goToReqBtn) {
    goToReqBtn.addEventListener('click', () => {
      const reqHeader = document.querySelector(
        '.sidebar-header[data-target="requirements"]',
      ) as HTMLElement | null;
      if (reqHeader) reqHeader.click();
    });
  }

  // Wire card click delegation
  const grid = document.getElementById('data-list');
  if (grid) {
    grid.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest(
        '.item-card[data-record-id]',
      ) as HTMLElement | null;
      if (!card) return;
      const id = card.dataset.recordId;
      if (id) openDetailView(id);
    });
  }
}

export { getCompletionStatus, getStatusBadge };

/** Reset detail view state — called when navigating to the Data section, and for testing. */
export function resetDetailState(): void {
  activeDetailRecordId = null;
  detailMode = 'choice';
  guidanceChecklistOpen = false;
  formState = null;
  savedFormSnapshot = null;
  searchQuery = '';
  searchResults = [];
  searchLexiOnly = [];
  searchError = false;
  selectedSchema = null;
  selectedNsid = null;
  resolveError = null;
  editingFieldId = null;
  deletingFieldId = null;
  browseTab = 'search';
  popularLexicons = [];
  popularLoading = false;
  popularError = false;
  popularCategory = null;
  popularSort = 'users';
  popularShowCount = 20;
}

// ── Card grid ─────────────────────────────────────────────────────────

function renderEmptyState(): string {
  return `
    <div class="empty-workspace">
      <div class="empty-icon">&#9634;</div>
      <p>Define the data your app works with.</p>
      <p>Data types are created automatically when you add "Data Interaction"
      requirements. Go to the Requirements section to get started.</p>
      <button class="add-btn" id="data-go-to-req-btn">Go to Requirements</button>
    </div>
  `;
}

function renderCardGrid(recordTypes: RecordType[]): string {
  return `
    <p class="workspace-desc">
      These are the types of data your app works with.
      Click a card to define what information it stores.
    </p>

    <details class="guidance-details">
      <summary>Tips on defining Data</summary>
      <div class="guidance-details-body">
        <p><strong>Lists of things should be separate data types</strong></p>
        <p>If one of your data types is a list of things that each have
        their own details (like items in a grocery list, or tasks in a
        project), those things should be their own data type. You can
        connect them later.</p>

        <p><strong>Name types as general concepts</strong></p>
        <p>Use &ldquo;grocery item&rdquo; not &ldquo;banana&rdquo;. Use &ldquo;playlist&rdquo; not &ldquo;my
        workout playlist&rdquo;. The data type is the category, not a
        specific instance.</p>

        <p><strong>When adding fields to a data type, ask: &ldquo;Does this have its own life?&rdquo;</strong></p>
        <p>If a field has its own properties, can have many instances,
        or would be useful on its own &mdash; it should probably be a
        separate data type. Look for the &ldquo;Field or data type?&rdquo; link
        when editing fields.</p>
      </div>
    </details>

    <div class="item-grid" id="data-list">
      ${recordTypes.map(renderDataTypeCard).join('')}
    </div>
  `;
}

function renderDataTypeCard(rt: RecordType): string {
  const badge = getStatusBadge(rt);
  return `
    <div class="item-card item-card--clickable" data-record-id="${rt.id}">
      <div>
        <div class="item-name">${escapeHtml(rt.displayName)}</div>
        <div class="item-meta">${getCompletionStatus(rt)}</div>
      </div>
      <span class="status-badge status-badge--${badge.class}">${badge.label}</span>
    </div>
  `;
}

// ── Completion status ─────────────────────────────────────────────────

function getCompletionStatus(rt: RecordType): string {
  const hasName = rt.name.length > 0;
  const userFields = rt.fields.filter((f) => !f.isSystem);
  const hasUserFields = userFields.length > 0;
  const totalFields = rt.fields.length;

  if (!hasName && !hasUserFields) return 'Name and fields needed';
  if (!hasName) return 'Lexicon name needed';
  if (!hasUserFields) return 'Fields needed';
  return `${totalFields} field${totalFields === 1 ? '' : 's'}`;
}

// ── Status badge ──────────────────────────────────────────────────────

function getStatusBadge(rt: RecordType): { label: string; class: string } {
  if (rt.source === 'adopted' && rt.adoptedNsid) {
    return { label: 'Adopted', class: 'adopted' };
  }
  const hasIdentity =
    rt.name.length > 0 && (rt.namespaceOption || rt.adoptedNsid);
  if (hasIdentity) {
    return { label: 'Ready', class: 'ready' };
  }
  return { label: 'Draft', class: 'draft' };
}

// ── Detail view ───────────────────────────────────────────────────────

function openDetailView(recordId: string): void {
  const { recordTypes } = getWizardState();
  const rt = recordTypes.find((r) => r.id === recordId);
  if (!rt) return;

  activeDetailRecordId = recordId;
  guidanceChecklistOpen = false;
  searchQuery = '';
  searchResults = [];
  searchLexiOnly = [];
  searchError = false;
  selectedSchema = null;
  selectedNsid = null;

  // Skip choice if identity already saved
  const hasIdentity =
    rt.name.length > 0 && (rt.namespaceOption || rt.adoptedNsid);
  detailMode = hasIdentity ? 'create' : 'choice';

  // Initialize form state from saved record
  initFormState(rt);

  rerenderPanel();
}

function initFormState(rt: RecordType): void {
  const state = getWizardState();
  const cachedUsername = state.appInfo.lexUsername ?? '';
  const cachedNamespace = state.appInfo.lastNamespaceOption ?? 'thelexfiles-temp';

  // Auto-suggest name from displayName if not yet set
  const suggestedName = rt.name || toCamelCase(rt.displayName);

  // Auto-fill username from cached value or auth handle
  let username = rt.lexUsername ?? cachedUsername;

  formState = {
    name: suggestedName,
    description: rt.description ?? '',
    namespaceOption: rt.namespaceOption ?? cachedNamespace,
    lexUsername: username,
    customDomain: rt.customDomain ?? '',
    recordKeyType: rt.recordKeyType ?? 'tid',
  };

  // Take a snapshot for dirty detection
  savedFormSnapshot = snapshotFromRecord(rt, cachedUsername, cachedNamespace);

  // Try to fill username from auth if empty
  if (!username) {
    tryAutoFillUsername();
  }
}

function snapshotFromRecord(
  rt: RecordType,
  cachedUsername: string,
  cachedNamespace: NamespaceOption,
): CreateNewFormState {
  return {
    name: rt.name || toCamelCase(rt.displayName),
    description: rt.description ?? '',
    namespaceOption: rt.namespaceOption ?? cachedNamespace,
    lexUsername: rt.lexUsername ?? cachedUsername,
    customDomain: rt.customDomain ?? '',
    recordKeyType: rt.recordKeyType ?? 'tid',
  };
}

async function tryAutoFillUsername(): Promise<void> {
  try {
    if (!getSession()) return;
    const profile = await getUserProfile();
    if (profile?.handle && formState && !formState.lexUsername) {
      formState.lexUsername = profile.handle.split('.')[0];
      // Keep snapshot in sync so auto-fill doesn't mark form dirty
      if (savedFormSnapshot && !savedFormSnapshot.lexUsername) {
        savedFormSnapshot.lexUsername = formState.lexUsername;
      }
      // Update the username input if it exists and is empty
      const input = document.getElementById(
        'dt-username',
      ) as HTMLInputElement | null;
      if (input && !input.value) {
        input.value = formState.lexUsername;
        updateNsidPreview();
      }
    }
  } catch {
    // Auth not available — skip auto-fill
  }
}

function renderDetailView(rt: RecordType): string {
  ensureSystemFields(rt);
  const badge = getStatusBadge(rt);

  let sourceSection: string;
  if (rt.source === 'adopted' && rt.adoptedNsid) {
    sourceSection = renderAdoptedState(rt);
  } else if (detailMode === 'browse') {
    sourceSection = renderBrowseUI();
  } else if (detailMode === 'create') {
    sourceSection = renderCreateNewForm(rt);
  } else {
    sourceSection = renderSourceChoice();
  }

  return `
    <div class="data-detail">
      ${detailMode !== 'browse' ? `
      <div class="data-detail-topbar">
        <a href="#" class="data-detail-back" id="dt-back-link">&larr; Back to Data Types</a>
        <button class="delete-link" id="dt-delete-record-btn">Delete</button>
      </div>` : ''}

      <div class="data-detail-header">
        <h3 class="data-detail-title">${escapeHtml(rt.displayName)}</h3>
        <span class="status-badge status-badge--${badge.class}">${badge.label}</span>
      </div>

      <div class="detail-section">
        <div id="dt-source-section">
          ${sourceSection}
        </div>
      </div>

      <div class="detail-section">
        ${renderFieldsSection(rt)}
      </div>
    </div>
  `;
}

// ── Fields section ─────────────────────────────────────────────────────

/** Module state for inline field editing */
let editingFieldId: string | null = null;
let deletingFieldId: string | null = null;

function renderFieldsSection(rt: RecordType): string {
  const isAdopted = rt.source === 'adopted' && !!rt.adoptedNsid;
  const hasIdentity =
    rt.name.length > 0 && (rt.namespaceOption || rt.adoptedNsid);

  const showAddBtn = !isAdopted && hasIdentity;
  const showGuidanceLink = !isAdopted && hasIdentity;

  return `
    <div class="fields-section-header">
      <div class="detail-section-heading">Fields</div>
      <div class="fields-header-actions">
        ${showGuidanceLink ? `<a href="#" class="guidance-help-link" id="dt-field-guidance-link" aria-expanded="${guidanceChecklistOpen}">Field or data type?</a>` : ''}
        ${showAddBtn ? '<button class="add-btn" id="dt-add-field-btn">+ Add Field</button>' : ''}
      </div>
    </div>
    ${showGuidanceLink && guidanceChecklistOpen ? renderGuidanceChecklist() : ''}
    ${isAdopted ? `<p class="form-note">These fields are defined by the adopted lexicon (${escapeHtml(rt.adoptedNsid ?? '')}). They cannot be modified.</p>` : ''}
    <div id="dt-field-form-area"></div>
    ${renderFieldList(rt, isAdopted)}
  `;
}

function renderGuidanceChecklist(): string {
  return `
    <div class="guidance-checklist" id="dt-field-guidance">
      <p><strong>Should this be its own data type, or a field?</strong></p>
      <p>It should probably be its <strong>own data type</strong> if:</p>
      <ul>
        <li>It has its own properties beyond just a name</li>
        <li>One thing can have many of them (e.g., a list has many items)</li>
        <li>Multiple data types reference it</li>
        <li>The list of them grows as users add data</li>
        <li>Users would want to view or search them on their own</li>
      </ul>
      <p>It should probably be a <strong>field</strong> if:</p>
      <ul>
        <li>It&rsquo;s a simple label (like a status or category)</li>
        <li>It&rsquo;s a single value (a name, date, number, yes/no)</li>
        <li>It only makes sense attached to something else</li>
      </ul>
    </div>
  `;
}

function renderFieldList(rt: RecordType, isAdopted: boolean): string {
  const userFields = rt.fields.filter((f) => !f.isSystem);
  const systemFields = rt.fields.filter((f) => f.isSystem);

  // Empty state for new lexicons with only system fields
  if (!isAdopted && userFields.length === 0) {
    return `
      <div class="field-empty-state">No fields defined yet. Click "+ Add Field" to describe what data this record stores.</div>
      ${systemFields.map((f) => renderFieldRow(f, true, isAdopted)).join('')}
    `;
  }

  // Render user fields first, system fields last
  const rows = [
    ...userFields.map((f) => renderFieldRow(f, false, isAdopted)),
    ...systemFields.map((f) => renderFieldRow(f, true, isAdopted)),
  ];

  return `<div id="dt-field-list">${rows.join('')}</div>`;
}

function renderFieldRow(
  field: Field,
  isSystem: boolean,
  isAdopted: boolean,
): string {
  const isDeleting = deletingFieldId === field.id;

  if (isDeleting) {
    return `
      <div class="field-row field-delete-confirm" data-field-id="${field.id}">
        <span>Delete field <strong>${escapeHtml(field.name)}</strong>?</span>
        <div class="field-row-actions">
          <button class="btn-primary field-confirm-delete-btn" data-field-id="${field.id}">Confirm</button>
          <button class="btn-ghost field-cancel-delete-btn" data-field-id="${field.id}">Cancel</button>
        </div>
      </div>
    `;
  }

  const typeLabel = getFieldTypeLabel(field);
  const showActions = !isSystem && !isAdopted;

  return `
    <div class="field-row" data-field-id="${field.id}">
      <div class="field-row-info">
        <span class="field-row-name">${escapeHtml(field.name)}</span>
        <span class="type-badge">${escapeHtml(typeLabel)}</span>
        ${field.required ? '<span class="required-badge">Required</span>' : ''}
        ${isSystem ? '<span class="system-badge">System</span>' : ''}
        ${field.type === 'ref' && field.refTarget ? `<span class="ref-target-label">&rarr; ${escapeHtml(resolveRefTargetName(field.refTarget))}</span>` : ''}
      </div>
      ${field.description ? `<div class="field-row-desc">${escapeHtml(field.description)}</div>` : ''}
      ${
        showActions
          ? `
        <div class="field-row-actions">
          <button class="field-edit-btn" data-field-id="${field.id}" aria-label="Edit field" title="Edit">&#9998;</button>
          <button class="field-delete-btn" data-field-id="${field.id}" aria-label="Delete field" title="Delete">&#10005;</button>
        </div>
      `
          : ''
      }
    </div>
  `;
}

function resolveRefTargetName(refTarget: string): string {
  const { recordTypes } = getWizardState();
  const rt = recordTypes.find((r) => r.id === refTarget);
  if (rt) return rt.displayName;
  return refTarget; // external NSID
}

/** Map internal type+format to user-facing label */
function getFieldTypeLabel(field: Field): string {
  if (field.type === 'string') {
    switch (field.format) {
      case 'datetime':
        return 'Date & Time';
      case 'uri':
        return 'Link (URI)';
      case 'at-uri':
        return 'AT Protocol Link';
      case 'handle':
        return 'Handle';
      case 'did':
        return 'DID';
      case 'language':
        return 'Language';
      case 'nsid':
        return 'NSID';
      case 'tid':
        return 'TID';
      case 'record-key':
        return 'Record Key';
      case 'cid':
        return 'CID String';
      default:
        return 'Text';
    }
  }
  switch (field.type) {
    case 'integer':
      return 'Number';
    case 'boolean':
      return 'True/False';
    case 'blob':
      return 'File Upload';
    case 'bytes':
      return 'Raw Bytes';
    case 'cid-link':
      return 'Content Hash';
    case 'array-string':
      return 'List of Text';
    case 'array-integer':
      return 'List of Numbers';
    case 'ref':
      return 'Reference';
    case 'union':
      return 'Union (complex)';
    case 'object':
      return 'Object (nested)';
    case 'unknown':
      return 'Unknown';
    default:
      return field.type;
  }
}

// ── Source choice ──────────────────────────────────────────────────────

function renderSourceChoice(): string {
  return `
    <div class="source-choice">
      <p class="source-intro">
        Each data type needs a definition &mdash; what information it contains
        and how it&rsquo;s structured. You can define your own or use one that
        other apps already share.
      </p>
      <div class="source-choice-cards">
        <button class="source-choice-card" id="dt-choice-create">
          <span class="source-choice-card-title">Define new</span>
          <span class="source-choice-card-desc">Create a custom definition for this data type</span>
        </button>
        <button class="source-choice-card" id="dt-choice-browse">
          <span class="source-choice-card-title">Use existing</span>
          <span class="source-choice-card-desc">Adopt a definition that other apps already use, so your data works across apps</span>
        </button>
      </div>
      <details class="guidance-details">
        <summary>How do I choose?</summary>
        <div class="guidance-details-body">
          <p><strong>Use an existing definition when:</strong></p>
          <ul>
            <li>You want your app&rsquo;s data to work with other apps (e.g., posts that show up on Bluesky)</li>
            <li>Someone has already defined a schema that fits your data</li>
            <li>You&rsquo;re building on top of an established ecosystem</li>
          </ul>
          <p><strong>Define your own when:</strong></p>
          <ul>
            <li>Your data is unique to your app</li>
            <li>Existing definitions don&rsquo;t match your needs</li>
            <li>You want full control over the schema</li>
          </ul>
          <p><strong>Important:</strong> Adopting a definition means your app creates data that other apps can see and interact with. If users don&rsquo;t expect their data to appear elsewhere, define your own.</p>
        </div>
      </details>
    </div>
  `;
}

// ── Create-new form ───────────────────────────────────────────────────

function renderCreateNewForm(rt: RecordType): string {
  const fs = formState!;
  const nsid = computeNsid(fs);

  return `
    <div id="dt-create-form">
      <div class="create-form-topbar">
        <a href="#" class="browse-link" id="dt-switch-to-browse">or use an existing definition &rarr;</a>
      </div>

      <h4 class="form-step-heading">Record name</h4>
      <div class="form-group">
        <input type="text" id="dt-record-name" value="${escapeAttr(fs.name)}"
               maxlength="63" autocomplete="off" />
        <div class="form-hint">A short identifier for this data type. Use lowerCamelCase (e.g., groceryItem, userProfile).</div>
        <div class="field-error" id="dt-name-error"></div>
      </div>

      <h4 class="form-step-heading">Description</h4>
      <div class="form-group">
        <textarea id="dt-description" rows="2" maxlength="500">${escapeHtml(fs.description)}</textarea>
        <div class="form-hint">Briefly describe what this data type stores. This helps other developers understand your data.</div>
      </div>

      <h4 class="form-step-heading">Where will this data type live?</h4>
      <div class="form-group">
        <div class="namespace-radio-group" id="dt-namespace-group">
          ${renderNamespaceOption(
            'thelexfiles-temp',
            'theLexFiles.com \u2014 experimental',
            "Published under your username at theLexFiles.com with a .temp. namespace, signaling that this definition is experimental and may change. Your lexicon will be published automatically when you generate your app.",
            fs.namespaceOption === 'thelexfiles' ? 'thelexfiles-temp' : fs.namespaceOption,
            true,
          )}
          ${renderNamespaceOption(
            'byo-domain',
            'My own domain',
            "Use a domain you control. You'll need to configure DNS records and handle publishing yourself.",
            fs.namespaceOption === 'thelexfiles' ? 'thelexfiles-temp' : fs.namespaceOption,
            false,
          )}
        </div>
        <div class="form-hint">Stable namespace publishing is not yet available.</div>
      </div>

      ${fs.namespaceOption === 'byo-domain' ? renderDomainWarning() : ''}

      ${fs.namespaceOption !== 'byo-domain' ? renderUsernameField(fs) : renderCustomDomainField(fs)}

      <div class="nsid-preview" id="dt-nsid-preview">
        <span class="nsid-preview-label">Your data type's unique identifier:</span>
        <code class="nsid-preview-value">${escapeHtml(nsid)}</code>
      </div>

      <details class="advanced-toggle">
        <summary>Advanced</summary>
        <div class="form-group" style="margin-top: 0.75rem;">
          <label for="dt-record-key-type">Record key type</label>
          <select id="dt-record-key-type">
            <option value="tid" ${fs.recordKeyType === 'tid' ? 'selected' : ''}>Auto-generated ID (tid) — recommended</option>
            <option value="any" ${fs.recordKeyType === 'any' ? 'selected' : ''}>Custom key (any)</option>
          </select>
          <div class="form-hint">${fs.recordKeyType === 'tid' ? 'Each record gets a unique timestamp-based ID. This is the standard for most record types.' : 'Record keys are user-defined strings. Use this when you need meaningful keys (e.g., a settings record keyed by setting name).'}</div>
        </div>
      </details>

      <div class="form-actions">
        <button class="save-btn" id="dt-save-btn" ${isFormValid(fs) ? '' : 'disabled'}>Save</button>
        <button class="cancel-btn" id="dt-cancel-btn">Cancel</button>
      </div>
    </div>
  `;
}

function renderNamespaceOption(
  value: NamespaceOption,
  label: string,
  description: string,
  currentValue: NamespaceOption,
  recommended: boolean,
): string {
  const checked = value === currentValue ? 'checked' : '';
  return `
    <label class="namespace-radio">
      <input type="radio" name="dt-namespace" value="${value}" ${checked} />
      <div class="namespace-radio-content">
        <span class="namespace-radio-label">${label}${recommended ? ' <span class="namespace-badge-rec">Recommended</span>' : ''}</span>
        <span class="namespace-radio-desc">${description}</span>
      </div>
    </label>
  `;
}

function renderUsernameField(fs: CreateNewFormState): string {
  return `
    <div class="form-group" id="dt-username-group">
      <label for="dt-username">Username</label>
      <input type="text" id="dt-username" value="${escapeAttr(fs.lexUsername)}"
             maxlength="63" autocomplete="off" />
      <div class="form-hint">This is your namespace on theLexFiles.com. All your lexicons will be published under this name.</div>
      <div class="field-error" id="dt-username-error"></div>
    </div>
  `;
}

function renderCustomDomainField(fs: CreateNewFormState): string {
  return `
    <div class="form-group" id="dt-domain-group">
      <label for="dt-custom-domain">Domain</label>
      <input type="text" id="dt-custom-domain" value="${escapeAttr(fs.customDomain)}"
             placeholder="example.com" autocomplete="off" />
      <div class="form-hint">Enter the domain you control. You'll need to create a _lexicon.[domain] DNS TXT record pointing to your DID before publishing.</div>
      <div class="field-error" id="dt-domain-error"></div>
    </div>
  `;
}

function renderDomainWarning(): string {
  return `
    <div class="byo-domain-warning">
      Only choose this if you're comfortable managing DNS TXT records and AT Protocol lexicon publishing.
      If you're not sure, use theLexFiles.com.
    </div>
  `;
}

// ── Browse / Adopt UI ─────────────────────────────────────────────────

function renderBrowseUI(): string {
  return `
    <div id="dt-browse-ui">
      <a href="#" class="data-detail-back" id="dt-back-to-create">&larr; Back</a>

      <div class="browse-tabs">
        <button id="dt-tab-search" class="browse-tab${browseTab === 'search' ? ' browse-tab--active' : ''}">Search</button>
        <button id="dt-tab-popular" class="browse-tab${browseTab === 'popular' ? ' browse-tab--active' : ''}">Browse popular</button>
      </div>

      ${browseTab === 'search' ? `
      <div class="form-group">
        <label for="dt-search-input">Search for a lexicon</label>
        <input type="text" id="dt-search-input"
               value="${escapeAttr(searchQuery)}"
               placeholder="Search by name or NSID (e.g., 'feed post' or 'app.bsky.feed')"
               autocomplete="off" />
      </div>` : ''}

      <div id="dt-browse-results">
        ${renderBrowseResults()}
      </div>
    </div>
  `;
}

function renderBrowseResults(): string {
  if (browseTab === 'popular') {
    return `
      ${renderPopularContent()}
      ${resolveError ? `<div class="search-error-msg">${escapeHtml(resolveError)}</div>` : ''}
      ${selectedSchema ? renderSchemaPreview() : ''}
    `;
  }

  return `
    ${searchError ? '<div class="search-error-msg">Search unavailable. You can enter an NSID directly below.</div>' : ''}

    ${searchResults.length > 0 ? renderSearchResults() : ''}

    <div class="form-group">
      <label for="dt-manual-nsid">Or enter an NSID directly</label>
      <div class="manual-nsid-row">
        <input type="text" id="dt-manual-nsid"
               placeholder="app.bsky.feed.post" autocomplete="off" />
        <button class="save-btn" id="dt-lookup-btn">Look up</button>
      </div>
    </div>

    ${resolveError ? `<div class="search-error-msg">${escapeHtml(resolveError)}</div>` : ''}
    ${selectedSchema ? renderSchemaPreview() : ''}
  `;
}

function renderPopularContent(): string {
  if (popularLoading) {
    return '<div class="search-loading-msg">Loading popular lexicons&hellip;</div>';
  }
  if (popularError) {
    return '<div class="search-error-msg">Could not load popular lexicons. Try searching instead.</div>';
  }
  if (popularLexicons.length === 0) {
    return '';
  }
  return `
    ${renderCategoryPills()}
    ${renderSortControls()}
    ${renderPopularList()}
  `;
}

function getFilteredSortedPopular(): LexiStatEntry[] {
  let list = popularLexicons;
  if (popularCategory) {
    list = list.filter((l) => l.category === popularCategory);
  }
  if (popularSort === 'users') {
    list = [...list].sort((a, b) => (b.unique_users_7d ?? 0) - (a.unique_users_7d ?? 0));
  } else if (popularSort === 'events') {
    list = [...list].sort((a, b) => (b.total_events ?? 0) - (a.total_events ?? 0));
  } else {
    list = [...list].sort((a, b) => a.nsid.localeCompare(b.nsid));
  }
  return list;
}

function renderCategoryPills(): string {
  const counts: Record<string, number> = {};
  for (const l of popularLexicons) {
    const cat = l.category ?? 'other';
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const pills = sorted
    .map(([cat, count]) => {
      const active = popularCategory === cat ? ' popular-pill--active' : '';
      return `<button class="popular-pill${active}" data-category="${escapeAttr(cat)}">${escapeHtml(cat)} <span class="popular-pill-count">${count}</span></button>`;
    })
    .join('');
  return `<div class="popular-pills" id="dt-category-pills">${pills}</div>`;
}

function renderSortControls(): string {
  return `
    <div class="popular-sort">
      <label for="dt-popular-sort">Sort by</label>
      <select id="dt-popular-sort">
        <option value="users"${popularSort === 'users' ? ' selected' : ''}>Most users (7d)</option>
        <option value="events"${popularSort === 'events' ? ' selected' : ''}>Most events</option>
        <option value="alpha"${popularSort === 'alpha' ? ' selected' : ''}>Alphabetical</option>
      </select>
    </div>
  `;
}

function renderPopularList(): string {
  const filtered = getFilteredSortedPopular();
  const visible = filtered.slice(0, popularShowCount);
  const items = visible
    .map((entry) => {
      const events = Number(entry.total_events) || 0;
      const users7d = entry.unique_users_7d != null ? Number(entry.unique_users_7d) : null;
      const categoryBadge = entry.category
        ? `<span class="search-result-source">${escapeHtml(entry.category)}</span>`
        : '';
      const desc = entry.description
        ? `<div class="popular-result-desc">${escapeHtml(entry.description)}</div>`
        : '';
      const usersPart = users7d != null ? `${users7d.toLocaleString()} users (7d) &middot; ` : '';
      const stats = `<div class="popular-result-stats">${usersPart}${events.toLocaleString()} events</div>`;
      const noSchema = entry.has_schema === false
        ? ' popular-result-no-schema'
        : '';
      const noSchemaBadge = entry.has_schema === false
        ? '<span class="no-schema-badge">no schema</span>'
        : '';

      return `
        <div class="search-result-item popular-result-item${noSchema}" data-nsid="${escapeAttr(entry.nsid)}">
          <div class="search-result-nsid">${escapeHtml(entry.nsid)} ${categoryBadge} ${noSchemaBadge}</div>
          ${desc}
          ${stats}
        </div>
      `;
    })
    .join('');
  const showMore = filtered.length > popularShowCount
    ? `<button class="popular-show-more" id="dt-show-more">Show more (${filtered.length - popularShowCount} remaining)</button>`
    : '';

  return `<div class="search-results" id="dt-popular-results">${items}</div>${showMore}`;
}

function renderSearchResultStats(nsid: string): string {
  const catalog = getCachedCatalog();
  if (!catalog) return '';
  const entry = findByNsid(catalog, nsid);
  if (!entry) return '';
  const users = entry.unique_users_7d != null ? Number(entry.unique_users_7d) : null;
  const events = Number(entry.total_events) || 0;
  const usersPart = users != null ? `${users.toLocaleString()} users &middot; ` : '';
  return `<span class="search-result-stats">${usersPart}${events.toLocaleString()} events</span>`;
}

function renderSearchResults(): string {
  // Lexicon Garden results
  const lgItems = searchResults
    .slice(0, 10)
    .map(
      (r) => `
      <div class="search-result-item" data-nsid="${escapeAttr(r.label)}">
        <span class="search-result-nsid">${escapeHtml(r.label)}</span>
        ${renderSearchResultStats(r.label)}
      </div>
    `,
    )
    .join('');

  // LexiStats-only results (not in Lexicon Garden)
  const lexiItems = searchLexiOnly
    .slice(0, 10)
    .map(
      (entry) => {
        const users = entry.unique_users_7d != null ? Number(entry.unique_users_7d) : null;
        const events = Number(entry.total_events) || 0;
        const usersPart = users != null ? `${users.toLocaleString()} users &middot; ` : '';
        return `
      <div class="search-result-item" data-nsid="${escapeAttr(entry.nsid)}">
        <span class="search-result-nsid">${escapeHtml(entry.nsid)}</span>
        <span class="search-result-stats">${usersPart}${events.toLocaleString()} events</span>
      </div>
    `;
      },
    )
    .join('');

  return `<div class="search-results" id="dt-search-results">${lgItems}${lexiItems}</div>`;
}

function renderSchemaPreview(): string {
  if (!selectedSchema) return '';

  const mainDef = selectedSchema.defs?.main;
  const defType = mainDef?.type ?? 'unknown';
  const isRecord = defType === 'record';
  const description = mainDef?.description ?? '';
  const keyType = mainDef?.key ?? 'tid';

  // Extract fields from record properties
  const fields =
    isRecord && mainDef?.record?.properties
      ? Object.entries(mainDef.record.properties)
          .map(([name, schema]) => {
            const s = schema as Record<string, unknown>;
            const required = mainDef.record?.required?.includes(name) ?? false;
            return `<li>${escapeHtml(name)}: ${escapeHtml(String(s.type ?? s.ref ?? 'unknown'))}${required ? ' (required)' : ''}</li>`;
          })
          .join('')
      : '';

  const nonRecordWarning = !isRecord
    ? `<div class="byo-domain-warning">This lexicon is a ${escapeHtml(defType)}, not a record type. Only record-type lexicons can be adopted as data types.</div>`
    : '';

  return `
    <div class="schema-preview" id="dt-schema-preview">
      <h4>Schema Preview</h4>
      <div class="schema-preview-field"><strong>NSID:</strong> ${escapeHtml(selectedSchema.id)}</div>
      ${description ? `<div class="schema-preview-field"><strong>Description:</strong> ${escapeHtml(description)}</div>` : ''}
      <div class="schema-preview-field"><strong>Type:</strong> ${escapeHtml(defType)}</div>
      ${isRecord ? `<div class="schema-preview-field"><strong>Record key type:</strong> ${escapeHtml(keyType)}</div>` : ''}
      ${fields ? `<div class="schema-preview-field"><strong>Fields:</strong><ul class="schema-fields-list">${fields}</ul></div>` : ''}

      ${nonRecordWarning}

      <details class="advanced-toggle">
        <summary>Raw JSON</summary>
        <pre class="schema-raw-json">${escapeHtml(JSON.stringify(selectedSchema, null, 2))}</pre>
      </details>

      <div class="form-actions" style="margin-top: 0.75rem;">
        <button class="save-btn" id="dt-adopt-btn" ${!isRecord ? 'disabled' : ''}>Adopt this lexicon</button>
      </div>
    </div>
  `;
}

// ── Adopted state display ─────────────────────────────────────────────

function renderAdoptedState(rt: RecordType): string {
  const description =
    rt.adoptedSchema?.defs?.main?.description ?? rt.description ?? '';
  return `
    <div class="adopted-state">
      <div class="adopted-nsid">
        <code>${escapeHtml(rt.adoptedNsid ?? '')}</code>
      </div>
      ${description ? `<p class="adopted-desc">${escapeHtml(description)}</p>` : ''}
      <a href="#" class="browse-link" id="dt-change-adopted">Change</a>
    </div>
  `;
}

// ── Event wiring ──────────────────────────────────────────────────────

function wireSourceChoice(): void {
  const createCard = document.getElementById('dt-choice-create');
  if (createCard) {
    createCard.addEventListener('click', () => {
      detailMode = 'create';
      rerenderSourceSection();
    });
  }

  const browseCard = document.getElementById('dt-choice-browse');
  if (browseCard) {
    browseCard.addEventListener('click', () => {
      detailMode = 'browse';
      rerenderSourceSection();
    });
  }
}

function wireDetailView(): void {
  // Back link
  const backLink = document.getElementById('dt-back-link');
  if (backLink) {
    backLink.addEventListener('click', (e) => {
      e.preventDefault();
      handleBackToGrid();
    });
  }

  // Delete button
  const deleteBtn = document.getElementById('dt-delete-record-btn');
  if (deleteBtn && activeDetailRecordId) {
    const recordId = activeDetailRecordId;
    deleteBtn.addEventListener('click', () => {
      deleteRecordType(recordId);
    });
  }

  const rt = getActiveRecordType();
  if (!rt) return;

  if (rt.source === 'adopted' && rt.adoptedNsid) {
    wireAdoptedState();
  } else if (detailMode === 'browse') {
    wireBrowseUI();
  } else if (detailMode === 'create') {
    wireCreateNewForm();
  } else {
    wireSourceChoice();
  }

  wireFieldsSection(rt);
}

function wireCreateNewForm(): void {
  // Record name input
  const nameInput = document.getElementById(
    'dt-record-name',
  ) as HTMLInputElement | null;
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      formState!.name = nameInput.value;
      validateRecordName(nameInput.value);
      updateNsidPreview();
      updateSaveButtonState();
    });
  }

  // Description textarea
  const descInput = document.getElementById(
    'dt-description',
  ) as HTMLTextAreaElement | null;
  if (descInput) {
    descInput.addEventListener('input', () => {
      formState!.description = descInput.value;
    });
  }

  // Namespace radio group
  const radios = document.querySelectorAll('input[name="dt-namespace"]');
  radios.forEach((radio) => {
    radio.addEventListener('change', () => {
      const value = (radio as HTMLInputElement).value as NamespaceOption;
      formState!.namespaceOption = value;
      rerenderSourceSection();
    });
  });

  // Username input
  const usernameInput = document.getElementById(
    'dt-username',
  ) as HTMLInputElement | null;
  if (usernameInput) {
    usernameInput.addEventListener('input', () => {
      formState!.lexUsername = usernameInput.value;
      validateUsername(usernameInput.value);
      updateNsidPreview();
      updateSaveButtonState();
    });
  }

  // Custom domain input
  const domainInput = document.getElementById(
    'dt-custom-domain',
  ) as HTMLInputElement | null;
  if (domainInput) {
    domainInput.addEventListener('input', () => {
      formState!.customDomain = domainInput.value;
      validateDomain(domainInput.value);
      updateNsidPreview();
      updateSaveButtonState();
    });
  }

  // Record key type select
  const keyTypeSelect = document.getElementById(
    'dt-record-key-type',
  ) as HTMLSelectElement | null;
  if (keyTypeSelect) {
    keyTypeSelect.addEventListener('change', () => {
      formState!.recordKeyType = keyTypeSelect.value as 'tid' | 'any';
    });
  }

  // Save button
  const saveBtn = document.getElementById('dt-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', handleSave);
  }

  // Cancel button
  const cancelBtn = document.getElementById('dt-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', handleCancel);
  }

  // Switch to browse link
  const switchToBrowse = document.getElementById('dt-switch-to-browse');
  if (switchToBrowse) {
    switchToBrowse.addEventListener('click', (e) => {
      e.preventDefault();
      detailMode = 'browse';
      rerenderSourceSection();
    });
  }
}

function wireBrowseUI(): void {
  // Back from browse
  const backToCreate = document.getElementById('dt-back-to-create');
  if (backToCreate) {
    backToCreate.addEventListener('click', (e) => {
      e.preventDefault();
      const rt = getActiveRecordType();
      const hasIdentity =
        rt && rt.name.length > 0 && (rt.namespaceOption || rt.adoptedNsid);
      detailMode = hasIdentity ? 'create' : 'choice';
      rerenderSourceSection();
    });
  }

  // Tab: Search
  const tabSearch = document.getElementById('dt-tab-search');
  if (tabSearch) {
    tabSearch.addEventListener('click', () => {
      if (browseTab === 'search') return;
      browseTab = 'search';
      selectedSchema = null;
      selectedNsid = null;
      rerenderSourceSection();
    });
  }

  // Tab: Popular
  const tabPopular = document.getElementById('dt-tab-popular');
  if (tabPopular) {
    tabPopular.addEventListener('click', () => {
      if (browseTab === 'popular') return;
      browseTab = 'popular';
      selectedSchema = null;
      selectedNsid = null;
      rerenderSourceSection();
      handleLoadPopular();
    });
  }

  // Search input (only present in search tab)
  const searchInput = document.getElementById(
    'dt-search-input',
  ) as HTMLInputElement | null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchQuery = searchInput.value;
      const query = searchInput.value.trim();
      if (!query) {
        searchResults = [];
        rerenderBrowseResults();
        return;
      }
      searchDebounceTimer = setTimeout(() => handleSearch(query), 300);
    });
  }

  // Wire events on the results container (search results, lookup, adopt)
  wireBrowseResultEvents();
}

function wireAdoptedState(): void {
  const changeLink = document.getElementById('dt-change-adopted');
  if (changeLink) {
    changeLink.addEventListener('click', (e) => {
      e.preventDefault();
      handleChangeAdopted();
    });
  }
}

function wireFieldsSection(rt: RecordType): void {
  // Guidance checklist toggle
  const guidanceLink = document.getElementById('dt-field-guidance-link');
  if (guidanceLink) {
    guidanceLink.addEventListener('click', (e) => {
      e.preventDefault();
      guidanceChecklistOpen = !guidanceChecklistOpen;
      rerenderPanel();
    });
  }

  // Add field button
  const addBtn = document.getElementById('dt-add-field-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => showFieldForm(rt));
  }

  // Edit/delete buttons via delegation
  document.querySelectorAll('.field-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.fieldId!;
      startFieldEdit(rt, id);
    });
  });
  document.querySelectorAll('.field-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.fieldId!;
      showDeleteConfirmation(id);
    });
  });

  // Delete confirmation buttons
  document.querySelectorAll('.field-confirm-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.fieldId!;
      confirmDeleteField(rt, id);
    });
  });
  document.querySelectorAll('.field-cancel-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      cancelDeleteField();
    });
  });
}

// ── Action handlers ───────────────────────────────────────────────────

async function handleBackToGrid(): Promise<void> {
  if (detailMode === 'create' && isFormDirty()) {
    const confirmed = await showConfirmDialog('You have unsaved changes. Discard?');
    if (!confirmed) return;
  }
  activeDetailRecordId = null;
  formState = null;
  savedFormSnapshot = null;
  detailMode = 'choice';
  rerenderPanel();
}

function handleSave(): void {
  const rt = getActiveRecordType();
  if (!rt || !formState) return;
  if (!isFormValid(formState)) return;

  const state = getWizardState();

  rt.name = formState.name;
  rt.description = formState.description;
  rt.namespaceOption = formState.namespaceOption;
  rt.lexUsername =
    formState.namespaceOption !== 'byo-domain'
      ? formState.lexUsername
      : undefined;
  rt.customDomain =
    formState.namespaceOption === 'byo-domain'
      ? formState.customDomain
      : undefined;
  rt.recordKeyType = formState.recordKeyType;
  rt.source = 'new';

  // Cache username and namespace option at app level
  if (formState.namespaceOption !== 'byo-domain' && formState.lexUsername) {
    state.appInfo.lexUsername = formState.lexUsername;
  }
  state.appInfo.lastNamespaceOption = formState.namespaceOption;

  saveWizardState(state);

  // Update snapshot so form is no longer dirty
  savedFormSnapshot = { ...formState };

  // Re-render to show updated badge
  rerenderPanel();
}

function handleCancel(): void {
  const rt = getActiveRecordType();
  if (!rt) return;
  // Reset form to last-saved state
  initFormState(rt);
  rerenderSourceSection();
}

async function handleLoadPopular(): Promise<void> {
  if (popularLexicons.length > 0) {
    rerenderBrowseResults();
    return;
  }
  popularLoading = true;
  popularError = false;
  rerenderBrowseResults();
  try {
    const catalog = await fetchLexiconCatalog();
    popularLexicons = filterRecords(catalog);
  } catch {
    popularError = true;
  }
  popularLoading = false;
  rerenderBrowseResults();
}

async function handleSearch(query: string): Promise<void> {
  selectedSchema = null;
  selectedNsid = null;
  resolveError = null;

  // Query Lexicon Garden
  let lgResults: AutocompleteResult[] = [];
  let lgFailed = false;
  try {
    lgResults = await searchLexicons(query);
  } catch {
    lgFailed = true;
  }

  // Query LexiStats (client-side filter of cached catalog)
  const catalog = getCachedCatalog();
  const lexiResults = catalog ? searchCatalog(catalog, query) : [];

  // Merge: LG first, then LexiStats-only matches, deduplicated
  const seen = new Set(lgResults.map((r) => r.label.toLowerCase()));
  const lexiOnly = lexiResults.filter((l) => !seen.has(l.nsid.toLowerCase()));

  searchResults = lgResults;
  searchLexiOnly = lexiOnly;
  searchError = lgFailed && lexiOnly.length === 0;

  rerenderBrowseResults();
}

async function handleSelectResult(nsid: string): Promise<void> {
  try {
    const result = await resolveLexicon(nsid);
    selectedSchema = result.schema;
    selectedNsid = nsid;
    resolveError = null;
    rerenderBrowseResults();
    // Scroll schema preview into view
    const preview = document.getElementById('dt-schema-preview');
    if (preview) {
      preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } catch {
    selectedSchema = null;
    selectedNsid = null;
    resolveError = browseTab === 'popular'
      ? `Schema not publicly available for ${nsid}. The author hasn't published it yet.`
      : `Failed to load schema for ${nsid}. Check the NSID and try again.`;
    rerenderBrowseResults();
  }
}

/**
 * Check whether another record type has already adopted the given NSID.
 * Returns the conflicting record, or undefined if no duplicate exists.
 */
export function findDuplicateNsidAdoption(
  nsid: string,
  currentRecordId: string,
  allRecords: ReadonlyArray<Pick<RecordType, 'id' | 'adoptedNsid' | 'displayName'>>,
): Pick<RecordType, 'id' | 'adoptedNsid' | 'displayName'> | undefined {
  return allRecords.find(
    r => r.id !== currentRecordId && r.adoptedNsid === nsid,
  );
}

/**
 * Pure computation: detect name collisions and compute disambiguated names.
 *
 * - If no collision, returns lastSegment unchanged with no renames.
 * - If collision with a custom record, only the adopted record is prefixed.
 * - If collision with another adopted record, both are prefixed using their
 *   respective second-to-last NSID segments.
 * - If auto-disambiguation still collides, sets needsPrompt = true.
 *
 * Does not mutate any records — returns renames to be applied by the caller.
 */
export function resolveNameCollision(
  lastSegment: string,
  newNsid: string,
  newRecordId: string,
  allRecords: ReadonlyArray<Pick<RecordType, 'id' | 'name' | 'source' | 'adoptedNsid'>>,
): {
  candidateName: string;
  needsPrompt: boolean;
  renames: Array<{ id: string; newName: string }>;
} {
  const others = allRecords.filter(r => r.id !== newRecordId);
  const collisions = others.filter(
    r => r.name.toLowerCase() === lastSegment.toLowerCase(),
  );

  if (collisions.length === 0) {
    return { candidateName: lastSegment, needsPrompt: false, renames: [] };
  }

  // Build a disambiguated name for the new record using second-to-last segment
  const nsidParts = newNsid.split('.');
  const prefix = nsidParts.length >= 2 ? nsidParts[nsidParts.length - 2] : '';
  const candidateName = prefix
    ? toCamelCase(prefix) + toPascalCase(lastSegment)
    : lastSegment;

  // Compute renames for colliding adopted records
  const renames: Array<{ id: string; newName: string }> = [];
  for (const collision of collisions) {
    if (collision.source === 'adopted' && collision.adoptedNsid) {
      const collParts = collision.adoptedNsid.split('.');
      const collPrefix = collParts.length >= 2 ? collParts[collParts.length - 2] : '';
      const collSegment = collParts[collParts.length - 1];
      if (collPrefix) {
        renames.push({
          id: collision.id,
          newName: toCamelCase(collPrefix) + toPascalCase(collSegment),
        });
      }
    }
    // Custom records (source='new') keep their name unchanged — no rename entry
  }

  // Check if our candidate name still collides after all proposed renames
  const renameMap = new Map(renames.map(r => [r.id, r.newName]));
  const allNamesAfterRename = others.map(r =>
    (renameMap.get(r.id) ?? r.name).toLowerCase(),
  );
  const needsPrompt = allNamesAfterRename.includes(candidateName.toLowerCase());

  return { candidateName, needsPrompt, renames };
}

/** Apply resolveNameCollision result, prompting the user if auto-disambiguation fails. */
async function disambiguateRecordName(
  lastSegment: string,
  newNsid: string,
  newRecordId: string,
  allRecords: RecordType[],
): Promise<string | null> {
  const result = resolveNameCollision(lastSegment, newNsid, newRecordId, allRecords);

  // Apply renames to existing records
  for (const rename of result.renames) {
    const record = allRecords.find(r => r.id === rename.id);
    if (record) record.name = rename.newName;
  }

  if (!result.needsPrompt) return result.candidateName;

  // Collect existing names for validation
  const takenNames = new Set(
    allRecords
      .filter(r => r.id !== newRecordId)
      .map(r => r.name.toLowerCase()),
  );

  // Fallback: prompt the user for a custom name with inline validation
  const customName = await showPromptDialog(
    `The auto-generated name "${result.candidateName}" is already in use. Please enter a unique name for this record type.`,
    result.candidateName,
    'e.g., myCustomPost',
    (value) => {
      const normalized = toCamelCase(value).toLowerCase();
      if (takenNames.has(normalized)) {
        return `"${toCamelCase(value)}" is already in use. Choose a different name.`;
      }
      return null;
    },
  );
  if (!customName) return null;
  return toCamelCase(customName);
}

async function handleAdopt(): Promise<void> {
  const rt = getActiveRecordType();
  if (!rt || !selectedSchema || !selectedNsid) return;

  const mainDef = selectedSchema.defs?.main;
  if (mainDef?.type !== 'record') return;

  // Block adopting an NSID that another record type already uses
  const state = getWizardState();
  const duplicate = findDuplicateNsidAdoption(selectedNsid, rt.id, state.recordTypes);
  if (duplicate) {
    await showConfirmDialog(
      `Another data type ("${duplicate.displayName}") already uses ${selectedNsid}. Each lexicon can only be adopted once.`,
    );
    return;
  }

  // Check if confirmation is needed
  const hasExistingData =
    rt.name.length > 0 || rt.fields.length > 0 || rt.namespaceOption;
  if (hasExistingData) {
    const confirmed = await showConfirmDialog(
      'Adopting this lexicon will replace your current name, namespace, and fields. Continue?',
    );
    if (!confirmed) return;
  }

  rt.source = 'adopted';
  rt.adoptedNsid = selectedNsid;
  rt.adoptedSchema = selectedSchema;

  // Extract name from NSID and disambiguate if needed
  const nsidParts = selectedNsid.split('.');
  const lastSegment = nsidParts[nsidParts.length - 1];

  const resolvedName = await disambiguateRecordName(
    lastSegment, selectedNsid, rt.id, state.recordTypes,
  );
  if (resolvedName === null) return; // User cancelled the prompt
  rt.name = resolvedName;

  rt.description = mainDef.description ?? '';
  rt.recordKeyType = (mainDef.key as 'tid' | 'any') ?? 'tid';

  // Import fields from schema
  if (mainDef.record?.properties) {
    const requiredFields = mainDef.record?.required ?? [];
    rt.fields = Object.entries(mainDef.record.properties).map(
      ([name, schema]) =>
        mapSchemaPropertyToField(
          name,
          schema as Record<string, unknown>,
          requiredFields,
        ),
    );
  }

  // Clear create-new fields
  rt.namespaceOption = undefined;
  rt.lexUsername = undefined;
  rt.customDomain = undefined;

  saveWizardState(state);
  formState = null;
  savedFormSnapshot = null;
  detailMode = 'choice';
  rerenderPanel();
}

async function handleChangeAdopted(): Promise<void> {
  const confirmed = await showConfirmDialog(
    'Stop using this lexicon? Your imported fields will be cleared.',
  );
  if (!confirmed) return;

  const rt = getActiveRecordType();
  if (!rt) return;

  const state = getWizardState();

  rt.source = 'new';
  rt.adoptedNsid = undefined;
  rt.adoptedSchema = undefined;
  rt.fields = [];

  saveWizardState(state);
  initFormState(rt);
  detailMode = 'choice';
  rerenderPanel();
}

// ── Field form lifecycle ──────────────────────────────────────────────

function showFieldForm(rt: RecordType, existing?: Field): void {
  editingFieldId = existing?.id ?? null;
  const area = document.getElementById('dt-field-form-area');
  if (!area) return;
  area.innerHTML = renderFieldForm(rt, existing);
  wireFieldForm(rt);

  const form = document.getElementById('dt-field-form');
  if (form?.scrollIntoView) {
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function startFieldEdit(rt: RecordType, fieldId: string): void {
  const field = rt.fields.find((f) => f.id === fieldId);
  if (!field) return;
  showFieldForm(rt, field);
}

function closeFieldForm(): void {
  editingFieldId = null;
  const area = document.getElementById('dt-field-form-area');
  if (area) area.innerHTML = '';
}

function renderFieldForm(rt: RecordType, existing?: Field): string {
  const saveLabel = existing ? 'Save' : 'Add Field';
  const typeValue = existing ? toTypeValue(existing) : '';
  const constraintsHtml = typeValue
    ? renderFieldConstraints(typeValue, rt, existing)
    : '';

  return `
    <div class="inline-form open" id="dt-field-form">
      <div class="form-row">
        <div class="form-group">
          <label for="dt-field-name">Field name</label>
          <input type="text" id="dt-field-name" value="${escapeAttr(existing?.name ?? '')}" maxlength="63" autocomplete="off" />
          <div class="form-hint">Use lowerCamelCase (e.g., firstName, itemCount). This becomes the property name in the schema.</div>
          <div class="field-error" id="dt-field-name-error"></div>
        </div>
        <div class="form-group">
          <label for="dt-field-type">Type</label>
          <select id="dt-field-type">
            <option value="">— Select type —</option>
            <optgroup label="Common">
              <option value="string"${typeValue === 'string' ? ' selected' : ''}>Text</option>
              <option value="integer"${typeValue === 'integer' ? ' selected' : ''}>Number</option>
              <option value="boolean"${typeValue === 'boolean' ? ' selected' : ''}>True/False</option>
            </optgroup>
            <optgroup label="Shortcuts">
              <option value="string:datetime"${typeValue === 'string:datetime' ? ' selected' : ''}>Date &amp; Time</option>
              <option value="string:uri"${typeValue === 'string:uri' ? ' selected' : ''}>Link (URI)</option>
              <option value="string:at-uri"${typeValue === 'string:at-uri' ? ' selected' : ''}>AT Protocol Link</option>
              <option value="string:handle"${typeValue === 'string:handle' ? ' selected' : ''}>Handle</option>
              <option value="string:did"${typeValue === 'string:did' ? ' selected' : ''}>DID</option>
              <option value="string:language"${typeValue === 'string:language' ? ' selected' : ''}>Language</option>
            </optgroup>
            <optgroup label="Advanced">
              <option value="blob"${typeValue === 'blob' ? ' selected' : ''}>File Upload</option>
              <option value="bytes"${typeValue === 'bytes' ? ' selected' : ''}>Raw Bytes</option>
              <option value="cid-link"${typeValue === 'cid-link' ? ' selected' : ''}>Content Hash</option>
              <option value="array-string"${typeValue === 'array-string' ? ' selected' : ''}>List of Text</option>
              <option value="array-integer"${typeValue === 'array-integer' ? ' selected' : ''}>List of Numbers</option>
              <option value="ref"${typeValue === 'ref' ? ' selected' : ''}>Reference</option>
            </optgroup>
          </select>
        </div>
      </div>
      <div id="dt-field-constraints">
        ${constraintsHtml}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="dt-field-required" ${existing?.required ? 'checked' : ''} />
            Required
          </label>
          <div class="form-hint">Required fields must be present in every record.</div>
        </div>
      </div>
      <div class="form-group">
        <label for="dt-field-description">Description</label>
        <textarea id="dt-field-description" rows="2">${escapeHtml(existing?.description ?? '')}</textarea>
        <div class="form-hint">Briefly describe what this field stores. This appears in the lexicon schema.</div>
      </div>
      <div class="form-actions">
        <button class="btn-primary field-save-btn" disabled>${saveLabel}</button>
        <button class="btn-ghost field-cancel-btn">Cancel</button>
      </div>
    </div>
  `;
}

function renderFieldConstraints(
  typeValue: string,
  rt: RecordType,
  existing?: Field,
): string {
  if (typeValue === 'string') {
    // Plain text — show format dropdown + length constraints
    const fmt = existing?.format ?? '';
    return `
      <div class="form-group">
        <label for="dt-field-format">Format</label>
        <select id="dt-field-format">
          <option value="">None (plain text)</option>
          <option value="datetime"${fmt === 'datetime' ? ' selected' : ''}>datetime — ISO 8601</option>
          <option value="uri"${fmt === 'uri' ? ' selected' : ''}>uri — URL or URI</option>
          <option value="at-uri"${fmt === 'at-uri' ? ' selected' : ''}>at-uri — AT Protocol URI</option>
          <option value="did"${fmt === 'did' ? ' selected' : ''}>did — Decentralized Identifier</option>
          <option value="handle"${fmt === 'handle' ? ' selected' : ''}>handle — AT Protocol handle</option>
          <option value="nsid"${fmt === 'nsid' ? ' selected' : ''}>nsid — Namespaced Identifier</option>
          <option value="tid"${fmt === 'tid' ? ' selected' : ''}>tid — Timestamp Identifier</option>
          <option value="record-key"${fmt === 'record-key' ? ' selected' : ''}>record-key — Valid record key</option>
          <option value="language"${fmt === 'language' ? ' selected' : ''}>language — BCP-47 tag</option>
          <option value="cid"${fmt === 'cid' ? ' selected' : ''}>cid — Content Identifier</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="dt-field-maxlength">Max length (bytes)</label>
          <input type="number" id="dt-field-maxlength" min="0" value="${existing?.maxLength ?? ''}" />
          <div class="form-hint">Maximum length in UTF-8 bytes</div>
        </div>
        <div class="form-group">
          <label for="dt-field-minlength">Min length (bytes)</label>
          <input type="number" id="dt-field-minlength" min="0" value="${existing?.minLength ?? ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="dt-field-maxgraphemes">Max graphemes</label>
          <input type="number" id="dt-field-maxgraphemes" min="0" value="${existing?.maxGraphemes ?? ''}" />
          <div class="form-hint">Maximum length in visible characters</div>
        </div>
        <div class="form-group">
          <label for="dt-field-mingraphemes">Min graphemes</label>
          <input type="number" id="dt-field-mingraphemes" min="0" value="${existing?.minGraphemes ?? ''}" />
        </div>
      </div>
    `;
  }

  if (typeValue === 'string:uri') {
    return `
      <div class="form-group">
        <label for="dt-field-maxlength">Max length</label>
        <input type="number" id="dt-field-maxlength" min="0" value="${existing?.maxLength ?? ''}" />
      </div>
    `;
  }

  if (typeValue === 'integer') {
    return `
      <div class="form-row">
        <div class="form-group">
          <label for="dt-field-minimum">Minimum value</label>
          <input type="number" id="dt-field-minimum" value="${existing?.minimum ?? ''}" />
        </div>
        <div class="form-group">
          <label for="dt-field-maximum">Maximum value</label>
          <input type="number" id="dt-field-maximum" value="${existing?.maximum ?? ''}" />
        </div>
      </div>
    `;
  }

  if (typeValue === 'blob') {
    const acceptStr = existing?.accept?.join(', ') ?? '';
    // Convert bytes to display value (KB or MB)
    let sizeValue = '';
    let sizeUnit = 'MB';
    if (existing?.maxSize != null) {
      if (existing.maxSize >= 1048576 && existing.maxSize % 1048576 === 0) {
        sizeValue = String(existing.maxSize / 1048576);
        sizeUnit = 'MB';
      } else if (existing.maxSize >= 1024) {
        sizeValue = String(existing.maxSize / 1024);
        sizeUnit = 'KB';
      } else {
        sizeValue = String(existing.maxSize / 1024);
        sizeUnit = 'KB';
      }
    }
    return `
      <div class="form-group">
        <label for="dt-field-accept">Accepted file types</label>
        <input type="text" id="dt-field-accept" placeholder="image/*, video/mp4" value="${escapeAttr(acceptStr)}" />
        <div class="form-hint">MIME type patterns, comma-separated. Use * for any type.</div>
      </div>
      <div class="form-group">
        <label for="dt-field-maxsize">Max file size</label>
        <div class="form-row" style="grid-template-columns: 1fr auto;">
          <input type="number" id="dt-field-maxsize" min="0" value="${escapeAttr(sizeValue)}" />
          <select id="dt-field-maxsize-unit">
            <option value="KB"${sizeUnit === 'KB' ? ' selected' : ''}>KB</option>
            <option value="MB"${sizeUnit === 'MB' ? ' selected' : ''}>MB</option>
          </select>
        </div>
      </div>
    `;
  }

  if (typeValue === 'bytes') {
    return `
      <div class="form-row">
        <div class="form-group">
          <label for="dt-field-minlength">Min length (bytes)</label>
          <input type="number" id="dt-field-minlength" min="0" value="${existing?.minLength ?? ''}" />
        </div>
        <div class="form-group">
          <label for="dt-field-maxlength">Max length (bytes)</label>
          <input type="number" id="dt-field-maxlength" min="0" value="${existing?.maxLength ?? ''}" />
        </div>
      </div>
    `;
  }

  if (typeValue === 'array-string' || typeValue === 'array-integer') {
    return `
      <div class="form-row">
        <div class="form-group">
          <label for="dt-field-minlength">Minimum items</label>
          <input type="number" id="dt-field-minlength" min="0" value="${existing?.minLength ?? ''}" />
        </div>
        <div class="form-group">
          <label for="dt-field-maxlength">Maximum items</label>
          <input type="number" id="dt-field-maxlength" min="0" value="${existing?.maxLength ?? ''}" />
        </div>
      </div>
    `;
  }

  if (typeValue === 'ref') {
    return renderRefTargetSelector(rt, existing);
  }

  // No constraints for boolean, cid-link, shortcut types with pre-set format
  return '';
}

function renderRefTargetSelector(rt: RecordType, existing?: Field): string {
  const { recordTypes } = getWizardState();
  const otherTypes = recordTypes.filter((r) => r.id !== rt.id);
  const isExternal =
    existing?.refTarget &&
    !recordTypes.some((r) => r.id === existing.refTarget);

  const options = otherTypes
    .map((r) => {
      const selected = existing?.refTarget === r.id ? ' selected' : '';
      return `<option value="${r.id}"${selected}>${escapeHtml(r.displayName)}</option>`;
    })
    .join('');

  return `
    <div class="form-group">
      <label for="dt-field-ref-target">Target type</label>
      <select id="dt-field-ref-target">
        <option value="">— Select target —</option>
        ${options}
        <option value="__external__"${isExternal ? ' selected' : ''}>Enter external NSID</option>
      </select>
    </div>
    <div class="form-group" id="dt-field-ref-external-group" style="display:${isExternal ? 'block' : 'none'}">
      <label for="dt-field-ref-external">External NSID</label>
      <input type="text" id="dt-field-ref-external" placeholder="app.bsky.feed.post" value="${escapeAttr(isExternal ? (existing?.refTarget ?? '') : '')}" autocomplete="off" />
    </div>
  `;
}

/** Convert a Field to its compound type value for the dropdown */
function toTypeValue(field: Field): string {
  if (field.type === 'string' && field.format) {
    // Only return compound for shortcut types
    const shortcuts = [
      'datetime',
      'uri',
      'at-uri',
      'handle',
      'did',
      'language',
    ];
    if (shortcuts.includes(field.format)) return `string:${field.format}`;
    // For other formats, user selected "Text" and picked format from format dropdown
    return 'string';
  }
  return field.type;
}

/** Parse a compound type value from the dropdown into type + format */
function parseTypeValue(value: string): { type: string; format?: string } {
  if (value.startsWith('string:')) {
    return { type: 'string', format: value.slice(7) };
  }
  return { type: value };
}

function wireFieldForm(rt: RecordType): void {
  // Type dropdown changes
  const typeSelect = document.getElementById(
    'dt-field-type',
  ) as HTMLSelectElement | null;
  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      const constraintsArea = document.getElementById('dt-field-constraints');
      if (constraintsArea) {
        constraintsArea.innerHTML = renderFieldConstraints(
          typeSelect.value,
          rt,
        );
        wireRefTargetEvents();
      }
      validateFieldForm(rt);
    });
  }

  // Name input validation
  const nameInput = document.getElementById(
    'dt-field-name',
  ) as HTMLInputElement | null;
  if (nameInput) {
    nameInput.addEventListener('input', () => validateFieldForm(rt));
  }

  // Ref target events
  wireRefTargetEvents();

  // Save/cancel
  const area = document.getElementById('dt-field-form-area');
  if (area) {
    area.querySelectorAll('.field-save-btn').forEach((btn) => {
      btn.addEventListener('click', () => saveField(rt));
    });
    area.querySelectorAll('.field-cancel-btn').forEach((btn) => {
      btn.addEventListener('click', () => closeFieldForm());
    });
  }

  // Initial validation for edit mode
  if (editingFieldId) {
    validateFieldForm(rt);
  }
}

function wireRefTargetEvents(): void {
  const refSelect = document.getElementById(
    'dt-field-ref-target',
  ) as HTMLSelectElement | null;
  if (refSelect) {
    refSelect.addEventListener('change', () => {
      const externalGroup = document.getElementById(
        'dt-field-ref-external-group',
      );
      if (externalGroup) {
        externalGroup.style.display =
          refSelect.value === '__external__' ? 'block' : 'none';
      }
    });
  }
}

function validateFieldForm(rt: RecordType): boolean {
  const nameInput = document.getElementById(
    'dt-field-name',
  ) as HTMLInputElement | null;
  const typeSelect = document.getElementById(
    'dt-field-type',
  ) as HTMLSelectElement | null;
  const saveBtn = document.querySelector(
    '.field-save-btn',
  ) as HTMLButtonElement | null;
  const errorEl = document.getElementById('dt-field-name-error');

  if (!nameInput || !typeSelect || !saveBtn) return false;

  const name = nameInput.value.trim();
  let valid = true;
  let errorMsg = '';

  if (!name) {
    valid = false;
  } else if (/^[^a-z]/.test(name)) {
    errorMsg =
      'Field name must start with a lowercase letter (lowerCamelCase).';
    valid = false;
  } else if (/[^a-zA-Z0-9]/.test(name)) {
    errorMsg = 'Only letters and digits are allowed.';
    valid = false;
  } else if (name.length > 63) {
    errorMsg = 'Maximum 63 characters.';
    valid = false;
  } else {
    // Check for duplicate names (excluding current field being edited)
    const duplicate = rt.fields.some(
      (f) => f.name === name && f.id !== editingFieldId,
    );
    if (duplicate) {
      errorMsg = 'A field with this name already exists.';
      valid = false;
    }
  }

  if (!typeSelect.value) {
    valid = false;
  }

  if (errorEl) errorEl.textContent = errorMsg;
  saveBtn.disabled = !valid;
  return valid;
}

function saveField(rt: RecordType): void {
  const nameInput = document.getElementById(
    'dt-field-name',
  ) as HTMLInputElement | null;
  const typeSelect = document.getElementById(
    'dt-field-type',
  ) as HTMLSelectElement | null;
  const requiredCheck = document.getElementById(
    'dt-field-required',
  ) as HTMLInputElement | null;
  const descInput = document.getElementById(
    'dt-field-description',
  ) as HTMLTextAreaElement | null;

  if (!nameInput || !typeSelect) return;

  const name = nameInput.value.trim();
  const typeValue = typeSelect.value;
  if (!name || !typeValue) return;

  const { type, format } = parseTypeValue(typeValue);

  const field: Field = {
    id: editingFieldId ?? generateId(),
    name,
    type,
    format,
    required: requiredCheck?.checked ?? false,
    description: descInput?.value.trim() || undefined,
  };

  // Read type-specific constraints
  if (type === 'string' && !format) {
    // Plain text type — read format from format dropdown
    const formatSelect = document.getElementById(
      'dt-field-format',
    ) as HTMLSelectElement | null;
    if (formatSelect?.value) field.format = formatSelect.value;
    field.maxLength = readNumberInput('dt-field-maxlength');
    field.minLength = readNumberInput('dt-field-minlength');
    field.maxGraphemes = readNumberInput('dt-field-maxgraphemes');
    field.minGraphemes = readNumberInput('dt-field-mingraphemes');
  } else if (typeValue === 'string:uri') {
    field.maxLength = readNumberInput('dt-field-maxlength');
  } else if (type === 'integer') {
    field.minimum = readNumberInput('dt-field-minimum');
    field.maximum = readNumberInput('dt-field-maximum');
  } else if (type === 'blob') {
    const acceptInput = document.getElementById(
      'dt-field-accept',
    ) as HTMLInputElement | null;
    if (acceptInput?.value.trim()) {
      field.accept = acceptInput.value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const sizeVal = readNumberInput('dt-field-maxsize');
    if (sizeVal != null) {
      const unitSelect = document.getElementById(
        'dt-field-maxsize-unit',
      ) as HTMLSelectElement | null;
      const unit = unitSelect?.value ?? 'MB';
      field.maxSize = unit === 'MB' ? sizeVal * 1048576 : sizeVal * 1024;
    }
  } else if (type === 'bytes') {
    field.minLength = readNumberInput('dt-field-minlength');
    field.maxLength = readNumberInput('dt-field-maxlength');
  } else if (type === 'array-string' || type === 'array-integer') {
    field.minLength = readNumberInput('dt-field-minlength');
    field.maxLength = readNumberInput('dt-field-maxlength');
  } else if (type === 'ref') {
    const refSelect = document.getElementById(
      'dt-field-ref-target',
    ) as HTMLSelectElement | null;
    if (refSelect?.value === '__external__') {
      const extInput = document.getElementById(
        'dt-field-ref-external',
      ) as HTMLInputElement | null;
      field.refTarget = extInput?.value.trim() || undefined;
    } else if (refSelect?.value) {
      field.refTarget = refSelect.value;
    }
  }

  const state = getWizardState();

  if (editingFieldId) {
    // Update existing
    const idx = rt.fields.findIndex((f) => f.id === editingFieldId);
    if (idx !== -1) rt.fields[idx] = field;
  } else {
    // Insert before system fields
    const systemIdx = rt.fields.findIndex((f) => f.isSystem);
    if (systemIdx !== -1) {
      rt.fields.splice(systemIdx, 0, field);
    } else {
      rt.fields.push(field);
    }
  }

  saveWizardState(state);
  closeFieldForm();
  rerenderFieldsSection(rt);
}

function readNumberInput(id: string): number | undefined {
  const input = document.getElementById(id) as HTMLInputElement | null;
  if (!input || input.value === '') return undefined;
  const num = Number(input.value);
  return isNaN(num) ? undefined : num;
}

// ── Delete confirmation ──────────────────────────────────────────────

function showDeleteConfirmation(fieldId: string): void {
  deletingFieldId = fieldId;
  const rt = getActiveRecordType();
  if (rt) rerenderFieldsSection(rt);
}

function confirmDeleteField(rt: RecordType, fieldId: string): void {
  rt.fields = rt.fields.filter((f) => f.id !== fieldId);
  deletingFieldId = null;
  saveWizardState(getWizardState());
  rerenderFieldsSection(rt);
}

function cancelDeleteField(): void {
  deletingFieldId = null;
  const rt = getActiveRecordType();
  if (rt) rerenderFieldsSection(rt);
}

function rerenderFieldsSection(rt: RecordType): void {
  const section = document.querySelector(
    '.data-detail .detail-section:last-child',
  );
  if (section) {
    section.innerHTML = renderFieldsSection(rt);
    wireFieldsSection(rt);
  }
}

// ── NSID computation ──────────────────────────────────────────────────

function computeNsid(fs: CreateNewFormState): string {
  const name = fs.name || '___';

  if (fs.namespaceOption === 'byo-domain') {
    const domain = fs.customDomain.trim();
    if (!domain) return `___.${name}`;
    const reversed = domain.split('.').reverse().join('.');
    return `${reversed}.${name}`;
  }

  const username = fs.lexUsername || '___';
  if (fs.namespaceOption === 'thelexfiles-temp') {
    return `com.thelexfiles.${username}.temp.${name}`;
  }
  return `com.thelexfiles.${username}.${name}`;
}

// ── Validation ────────────────────────────────────────────────────────

function validateRecordName(value: string): boolean {
  const errorEl = document.getElementById('dt-name-error');
  if (!errorEl) return false;

  if (!value) {
    errorEl.textContent = '';
    return false;
  }
  if (/^\d/.test(value)) {
    errorEl.textContent = 'Record name cannot start with a digit.';
    return false;
  }
  if (/[^a-zA-Z0-9]/.test(value)) {
    errorEl.textContent =
      'Only letters (a\u2013z, A\u2013Z) and digits (0\u20139) are allowed.';
    return false;
  }
  if (value.length > 63) {
    errorEl.textContent = 'Maximum 63 characters.';
    return false;
  }
  errorEl.textContent = '';
  return true;
}

function validateUsername(value: string): boolean {
  const errorEl = document.getElementById('dt-username-error');
  if (!errorEl) return false;

  if (!value) {
    errorEl.textContent = '';
    return false;
  }
  if (/[^a-z0-9-]/.test(value)) {
    errorEl.textContent = 'Lowercase letters, digits, and hyphens only.';
    return false;
  }
  if (value.startsWith('-') || value.endsWith('-')) {
    errorEl.textContent = 'Cannot start or end with a hyphen.';
    return false;
  }
  if (value.length > 63) {
    errorEl.textContent = 'Maximum 63 characters.';
    return false;
  }
  errorEl.textContent = '';
  return true;
}

function validateDomain(value: string): boolean {
  const errorEl = document.getElementById('dt-domain-error');
  if (!errorEl) return false;

  if (!value) {
    errorEl.textContent = '';
    return false;
  }
  if (!value.includes('.')) {
    errorEl.textContent = 'Must contain at least one dot (e.g., example.com).';
    return false;
  }
  if (/\s/.test(value)) {
    errorEl.textContent = 'Cannot contain spaces.';
    return false;
  }
  if (/^https?:\/\//i.test(value)) {
    errorEl.textContent =
      'Enter the domain without a protocol (no http:// or https://).';
    return false;
  }
  errorEl.textContent = '';
  return true;
}

function isFormValid(fs: CreateNewFormState): boolean {
  // Name is required and must be valid
  if (
    !fs.name ||
    /^\d/.test(fs.name) ||
    /[^a-zA-Z0-9]/.test(fs.name) ||
    fs.name.length > 63
  ) {
    return false;
  }

  if (fs.namespaceOption === 'byo-domain') {
    return (
      fs.customDomain.includes('.') &&
      !/\s/.test(fs.customDomain) &&
      !/^https?:\/\//i.test(fs.customDomain)
    );
  }

  // theLexFiles options need a valid username
  if (!fs.lexUsername) return false;
  if (/[^a-z0-9-]/.test(fs.lexUsername)) return false;
  if (fs.lexUsername.startsWith('-') || fs.lexUsername.endsWith('-'))
    return false;

  return true;
}

function isFormDirty(): boolean {
  if (!formState || !savedFormSnapshot) return false;
  return (
    formState.name !== savedFormSnapshot.name ||
    formState.description !== savedFormSnapshot.description ||
    formState.namespaceOption !== savedFormSnapshot.namespaceOption ||
    formState.lexUsername !== savedFormSnapshot.lexUsername ||
    formState.customDomain !== savedFormSnapshot.customDomain ||
    formState.recordKeyType !== savedFormSnapshot.recordKeyType
  );
}

// ── DOM update helpers ────────────────────────────────────────────────

function updateNsidPreview(): void {
  if (!formState) return;
  const preview = document.querySelector('.nsid-preview-value');
  if (preview) {
    preview.textContent = computeNsid(formState);
  }
}

function updateSaveButtonState(): void {
  if (!formState) return;
  const btn = document.getElementById(
    'dt-save-btn',
  ) as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = !isFormValid(formState);
  }
}

function rerenderPanel(): void {
  // Determine which container is currently visible
  const narrow =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 767px)').matches;

  if (narrow) {
    const accBody = document.querySelector(
      '.accordion-section[data-section="data"] .accordion-body',
    );
    if (accBody) {
      accBody.innerHTML = renderDataPanel();
      wireDataPanel();
    }
  } else {
    const bodyEl = document.getElementById('workspace-panel-body');
    if (bodyEl) {
      bodyEl.innerHTML = renderDataPanel();
      wireDataPanel();
    }
  }
}

function rerenderSourceSection(): void {
  const rt = getActiveRecordType();
  if (!rt) return;

  const container = document.getElementById('dt-source-section');
  if (!container) return;

  // Toggle "Back to Data Types" visibility
  const backLink = document.getElementById('dt-back-link');
  if (backLink) {
    backLink.style.display = detailMode === 'browse' ? 'none' : '';
  }

  if (rt.source === 'adopted' && rt.adoptedNsid) {
    container.innerHTML = renderAdoptedState(rt);
    wireAdoptedState();
  } else if (detailMode === 'browse') {
    container.innerHTML = renderBrowseUI();
    wireBrowseUI();
  } else if (detailMode === 'create') {
    container.innerHTML = renderCreateNewForm(rt);
    wireCreateNewForm();
  } else {
    container.innerHTML = renderSourceChoice();
    wireSourceChoice();
  }
}

function rerenderBrowseResults(): void {
  const container = document.getElementById('dt-browse-results');
  if (!container) return;
  container.innerHTML = renderBrowseResults();
  wireBrowseResultEvents();
}

function wireBrowseResultEvents(): void {
  // Search result clicks
  const resultsContainer = document.getElementById('dt-search-results');
  if (resultsContainer) {
    resultsContainer.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest(
        '.search-result-item',
      ) as HTMLElement | null;
      if (!item) return;
      const nsid = item.dataset.nsid;
      if (nsid) handleSelectResult(nsid);
    });
  }

  // Popular result clicks
  const popularContainer = document.getElementById('dt-popular-results');
  if (popularContainer) {
    popularContainer.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest(
        '.popular-result-item',
      ) as HTMLElement | null;
      if (!item) return;
      const nsid = item.dataset.nsid;
      if (nsid) handleSelectResult(nsid);
    });
  }

  // Category pill clicks
  const pillsContainer = document.getElementById('dt-category-pills');
  if (pillsContainer) {
    pillsContainer.addEventListener('click', (e) => {
      const pill = (e.target as HTMLElement).closest('.popular-pill') as HTMLElement | null;
      if (!pill) return;
      const cat = pill.dataset.category ?? null;
      popularCategory = popularCategory === cat ? null : cat;
      popularShowCount = 20;
      selectedSchema = null;
      selectedNsid = null;
      resolveError = null;
      rerenderBrowseResults();
    });
  }

  // Sort dropdown
  const sortSelect = document.getElementById('dt-popular-sort') as HTMLSelectElement | null;
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      popularSort = sortSelect.value as 'users' | 'events' | 'alpha';
      popularShowCount = 20;
      rerenderBrowseResults();
    });
  }

  // Show more button
  const showMoreBtn = document.getElementById('dt-show-more');
  if (showMoreBtn) {
    showMoreBtn.addEventListener('click', () => {
      popularShowCount += 20;
      rerenderBrowseResults();
    });
  }

  // Manual NSID lookup
  const lookupBtn = document.getElementById('dt-lookup-btn');
  if (lookupBtn) {
    lookupBtn.addEventListener('click', () => {
      const nsidInput = document.getElementById(
        'dt-manual-nsid',
      ) as HTMLInputElement | null;
      if (nsidInput?.value.trim()) {
        handleSelectResult(nsidInput.value.trim());
      }
    });
  }

  // Adopt button
  const adoptBtn = document.getElementById('dt-adopt-btn');
  if (adoptBtn) {
    adoptBtn.addEventListener('click', handleAdopt);
  }
}

function getActiveRecordType(): RecordType | undefined {
  if (!activeDetailRecordId) return undefined;
  return getWizardState().recordTypes.find(
    (r) => r.id === activeDetailRecordId,
  );
}

// ── Field mapping ─────────────────────────────────────────────────────

import type { Field } from '../../../types/wizard';
import { generateId, makeSystemCreatedAtField } from '../../../utils/id';

/** Map a lexicon schema property to our Field model */
function mapSchemaPropertyToField(
  name: string,
  s: Record<string, unknown>,
  requiredFields: string[],
): Field {
  const required = requiredFields.includes(name);
  const description = s.description ? String(s.description) : undefined;
  const base = { id: generateId(), name, required, description };

  const type = s.type as string | undefined;

  // Array type
  if (type === 'array') {
    const items = s.items as Record<string, unknown> | undefined;
    const itemType = items?.type as string | undefined;
    let fieldType = 'array-string';
    if (itemType === 'integer') fieldType = 'array-integer';
    else if (itemType !== 'string') fieldType = 'array-string'; // fallback
    return {
      ...base,
      type: fieldType,
      maxLength: s.maxLength != null ? Number(s.maxLength) : undefined,
      minLength: s.minLength != null ? Number(s.minLength) : undefined,
    };
  }

  // Ref type
  if (type === 'ref') {
    return {
      ...base,
      type: 'ref',
      refTarget: s.ref ? String(s.ref) : undefined,
    };
  }

  // Union type (unsupported — display only)
  if (type === 'union') {
    return { ...base, type: 'union' };
  }

  // Nested object (unsupported — display only)
  if (type === 'object') {
    return { ...base, type: 'object' };
  }

  // Unknown type
  if (type === 'unknown') {
    return { ...base, type: 'unknown' };
  }

  // Blob type
  if (type === 'blob') {
    const accept = Array.isArray(s.accept) ? (s.accept as string[]) : undefined;
    return {
      ...base,
      type: 'blob',
      accept,
      maxSize: s.maxSize != null ? Number(s.maxSize) : undefined,
    };
  }

  // Bytes type
  if (type === 'bytes') {
    return {
      ...base,
      type: 'bytes',
      minLength: s.minLength != null ? Number(s.minLength) : undefined,
      maxLength: s.maxLength != null ? Number(s.maxLength) : undefined,
    };
  }

  // CID-link type
  if (type === 'cid-link') {
    return { ...base, type: 'cid-link' };
  }

  // Integer type
  if (type === 'integer') {
    return {
      ...base,
      type: 'integer',
      minimum: s.minimum != null ? Number(s.minimum) : undefined,
      maximum: s.maximum != null ? Number(s.maximum) : undefined,
    };
  }

  // Boolean type
  if (type === 'boolean') {
    return { ...base, type: 'boolean' };
  }

  // String type (with optional format and constraints)
  if (type === 'string' || !type) {
    return {
      ...base,
      type: 'string',
      format: s.format ? String(s.format) : undefined,
      maxLength: s.maxLength != null ? Number(s.maxLength) : undefined,
      minLength: s.minLength != null ? Number(s.minLength) : undefined,
      maxGraphemes: s.maxGraphemes != null ? Number(s.maxGraphemes) : undefined,
      minGraphemes: s.minGraphemes != null ? Number(s.minGraphemes) : undefined,
    };
  }

  // Fallback
  return { ...base, type: type ?? 'unknown' };
}

/** Ensure source:'new' RecordTypes have the createdAt system field */
function ensureSystemFields(rt: RecordType): void {
  if (rt.source !== 'new') return;
  const hasCreatedAt = rt.fields.some(
    (f) => f.name === 'createdAt' && f.isSystem,
  );
  if (!hasCreatedAt) {
    rt.fields.push(makeSystemCreatedAtField());
    saveWizardState(getWizardState());
  }
}

// ── HTML helpers ──────────────────────────────────────────────────────

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
