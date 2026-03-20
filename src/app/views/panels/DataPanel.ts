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
import { toCamelCase } from '../../../utils/text';
import type { RecordType, NamespaceOption } from '../../../types/wizard';
import type { LexiconSchema } from '../../../types/generation';

// ── Module-level state ────────────────────────────────────────────────

let activeDetailRecordId: string | null = null;
let detailMode: 'choice' | 'create' | 'browse' = 'choice';

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
let searchError = false;
let selectedSchema: LexiconSchema | null = null;
let selectedNsid: string | null = null;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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
  formState = null;
  savedFormSnapshot = null;
  searchQuery = '';
  searchResults = [];
  searchError = false;
  selectedSchema = null;
  selectedNsid = null;
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
  const hasFields = rt.fields.length > 0;

  if (!hasName && !hasFields) return 'Name and fields needed';
  if (!hasName) return 'Lexicon name needed';
  if (!hasFields) return 'Fields needed';
  return `${rt.fields.length} field${rt.fields.length === 1 ? '' : 's'}`;
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
  searchQuery = '';
  searchResults = [];
  searchError = false;
  selectedSchema = null;
  selectedNsid = null;

  // Skip choice if identity already saved
  const hasIdentity = rt.name.length > 0 && (rt.namespaceOption || rt.adoptedNsid);
  detailMode = hasIdentity ? 'create' : 'choice';

  // Initialize form state from saved record
  initFormState(rt);

  rerenderPanel();
}

function initFormState(rt: RecordType): void {
  const state = getWizardState();
  const cachedUsername = state.appInfo.lexUsername ?? '';
  const cachedNamespace = state.appInfo.lastNamespaceOption ?? 'thelexfiles';

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
      ${detailMode !== 'browse' ? '<a href="#" class="data-detail-back" id="dt-back-link">&larr; Back to Data Types</a>' : ''}

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
        <div class="detail-section-heading">Fields</div>
        <p class="form-note">Field editing coming soon. ${rt.source === 'adopted' && rt.adoptedNsid ? 'Adopted lexicons have read-only fields.' : 'Add fields after configuring the definition above.'}</p>
      </div>
    </div>
  `;
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
            'thelexfiles',
            'theLexFiles.com',
            'Published under your username at theLexFiles.com. This is a stable definition \u2014 other apps can build against it.',
            fs.namespaceOption,
            true,
          )}
          ${renderNamespaceOption(
            'thelexfiles-temp',
            'theLexFiles.com \u2014 experimental',
            'Uses the .temp. namespace to signal that this definition is experimental and may change. Choose this if you\'re prototyping.',
            fs.namespaceOption,
            false,
          )}
          ${renderNamespaceOption(
            'byo-domain',
            'My own domain',
            'Use a domain you control. You\'ll need to configure DNS records and handle publishing yourself.',
            fs.namespaceOption,
            false,
          )}
        </div>
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

      <div class="form-group">
        <label for="dt-search-input">Search for a lexicon</label>
        <input type="text" id="dt-search-input"
               value="${escapeAttr(searchQuery)}"
               placeholder="Search by name or NSID (e.g., 'feed post' or 'app.bsky.feed')"
               autocomplete="off" />
      </div>

      <div id="dt-browse-results">
        ${renderBrowseResults()}
      </div>
    </div>
  `;
}

function renderBrowseResults(): string {
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

    ${selectedSchema ? renderSchemaPreview() : ''}
  `;
}

function renderSearchResults(): string {
  const items = searchResults
    .slice(0, 10)
    .map(
      (r) => `
      <div class="search-result-item" data-nsid="${escapeAttr(r.label)}">
        <span class="search-result-nsid">${escapeHtml(r.label)}</span>
        <span class="search-result-source">via Lexicon Garden</span>
      </div>
    `,
    )
    .join('');

  return `<div class="search-results" id="dt-search-results">${items}</div>`;
}

function renderSchemaPreview(): string {
  if (!selectedSchema) return '';

  const mainDef = selectedSchema.defs?.main;
  const defType = mainDef?.type ?? 'unknown';
  const isRecord = defType === 'record';
  const description = mainDef?.description ?? '';
  const keyType = mainDef?.key ?? 'tid';

  // Extract fields from record properties
  const fields = isRecord && mainDef?.record?.properties
    ? Object.entries(mainDef.record.properties).map(([name, schema]) => {
        const s = schema as Record<string, unknown>;
        const required = mainDef.record?.required?.includes(name) ?? false;
        return `<li>${escapeHtml(name)}: ${escapeHtml(String(s.type ?? s.ref ?? 'unknown'))}${required ? ' (required)' : ''}</li>`;
      }).join('')
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
}

function wireCreateNewForm(): void {
  // Record name input
  const nameInput = document.getElementById('dt-record-name') as HTMLInputElement | null;
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      formState!.name = nameInput.value;
      validateRecordName(nameInput.value);
      updateNsidPreview();
      updateSaveButtonState();
    });
  }

  // Description textarea
  const descInput = document.getElementById('dt-description') as HTMLTextAreaElement | null;
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
  const usernameInput = document.getElementById('dt-username') as HTMLInputElement | null;
  if (usernameInput) {
    usernameInput.addEventListener('input', () => {
      formState!.lexUsername = usernameInput.value;
      validateUsername(usernameInput.value);
      updateNsidPreview();
      updateSaveButtonState();
    });
  }

  // Custom domain input
  const domainInput = document.getElementById('dt-custom-domain') as HTMLInputElement | null;
  if (domainInput) {
    domainInput.addEventListener('input', () => {
      formState!.customDomain = domainInput.value;
      validateDomain(domainInput.value);
      updateNsidPreview();
      updateSaveButtonState();
    });
  }

  // Record key type select
  const keyTypeSelect = document.getElementById('dt-record-key-type') as HTMLSelectElement | null;
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
      const hasIdentity = rt && rt.name.length > 0 && (rt.namespaceOption || rt.adoptedNsid);
      detailMode = hasIdentity ? 'create' : 'choice';
      rerenderSourceSection();
    });
  }

  // Search input
  const searchInput = document.getElementById('dt-search-input') as HTMLInputElement | null;
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

// ── Action handlers ───────────────────────────────────────────────────

function handleBackToGrid(): void {
  if (detailMode === 'create' && isFormDirty()) {
    if (!confirm('You have unsaved changes. Discard?')) return;
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
  rt.lexUsername = formState.namespaceOption !== 'byo-domain' ? formState.lexUsername : undefined;
  rt.customDomain = formState.namespaceOption === 'byo-domain' ? formState.customDomain : undefined;
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

async function handleSearch(query: string): Promise<void> {
  try {
    searchError = false;
    searchResults = await searchLexicons(query);
    selectedSchema = null;
    selectedNsid = null;
  } catch {
    searchError = true;
    searchResults = [];
  }
  rerenderBrowseResults();
}

async function handleSelectResult(nsid: string): Promise<void> {
  try {
    const result = await resolveLexicon(nsid);
    selectedSchema = result.schema;
    selectedNsid = nsid;
    rerenderBrowseResults();
    // Scroll schema preview into view
    const preview = document.getElementById('dt-schema-preview');
    if (preview) {
      preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } catch {
    selectedSchema = null;
    selectedNsid = null;
    // Show error inline
    const preview = document.getElementById('dt-schema-preview');
    if (preview) {
      preview.innerHTML = '<div class="search-error-msg">Failed to load schema. Check the NSID and try again.</div>';
    }
  }
}

function handleAdopt(): void {
  const rt = getActiveRecordType();
  if (!rt || !selectedSchema || !selectedNsid) return;

  const mainDef = selectedSchema.defs?.main;
  if (mainDef?.type !== 'record') return;

  // Check if confirmation is needed
  const hasExistingData = rt.name.length > 0 || rt.fields.length > 0 || rt.namespaceOption;
  if (hasExistingData) {
    if (
      !confirm(
        'Adopting this lexicon will replace your current name, namespace, and fields. Continue?',
      )
    )
      return;
  }

  const state = getWizardState();

  rt.source = 'adopted';
  rt.adoptedNsid = selectedNsid;
  rt.adoptedSchema = selectedSchema;

  // Extract name from NSID (last segment)
  const nsidParts = selectedNsid.split('.');
  rt.name = nsidParts[nsidParts.length - 1];

  rt.description = mainDef.description ?? '';
  rt.recordKeyType = (mainDef.key as 'tid' | 'any') ?? 'tid';

  // Import fields from schema
  if (mainDef.record?.properties) {
    rt.fields = Object.entries(mainDef.record.properties).map(
      ([name, schema]) => {
        const s = schema as Record<string, unknown>;
        const required = mainDef.record?.required?.includes(name) ?? false;
        return {
          id: `field-${name}-${Date.now()}`,
          name,
          type: String(s.type ?? s.ref ?? 'unknown'),
          required,
          description: String(s.description ?? ''),
        };
      },
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

function handleChangeAdopted(): void {
  if (!confirm('Stop using this lexicon? Your imported fields will be cleared.')) return;

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
    errorEl.textContent = 'Only letters (a\u2013z, A\u2013Z) and digits (0\u20139) are allowed.';
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
    errorEl.textContent = 'Enter the domain without a protocol (no http:// or https://).';
    return false;
  }
  errorEl.textContent = '';
  return true;
}

function isFormValid(fs: CreateNewFormState): boolean {
  // Name is required and must be valid
  if (!fs.name || /^\d/.test(fs.name) || /[^a-zA-Z0-9]/.test(fs.name) || fs.name.length > 63) {
    return false;
  }

  if (fs.namespaceOption === 'byo-domain') {
    return fs.customDomain.includes('.') && !/\s/.test(fs.customDomain) && !/^https?:\/\//i.test(fs.customDomain);
  }

  // theLexFiles options need a valid username
  if (!fs.lexUsername) return false;
  if (/[^a-z0-9-]/.test(fs.lexUsername)) return false;
  if (fs.lexUsername.startsWith('-') || fs.lexUsername.endsWith('-')) return false;

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
  const btn = document.getElementById('dt-save-btn') as HTMLButtonElement | null;
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
      const item = (e.target as HTMLElement).closest('.search-result-item') as HTMLElement | null;
      if (!item) return;
      const nsid = item.dataset.nsid;
      if (nsid) handleSelectResult(nsid);
    });
  }

  // Manual NSID lookup
  const lookupBtn = document.getElementById('dt-lookup-btn');
  if (lookupBtn) {
    lookupBtn.addEventListener('click', () => {
      const nsidInput = document.getElementById('dt-manual-nsid') as HTMLInputElement | null;
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

// ── HTML helpers ──────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
