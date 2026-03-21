// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderDataPanel,
  wireDataPanel,
  getCompletionStatus,
  getStatusBadge,
  resetDetailState,
} from '../../src/app/views/panels/DataPanel';
import {
  getWizardState,
  setWizardState,
  initializeWizardState,
} from '../../src/app/state/WizardState';
import type { RecordType } from '../../src/types/wizard';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRecordType(overrides: Partial<RecordType> = {}): RecordType {
  return {
    id: `rt-${Date.now()}-${Math.random()}`,
    name: '',
    displayName: 'test type',
    description: '',
    fields: [],
    source: 'new',
    ...overrides,
  };
}

// ── Completion status ──────────────────────────────────────────────────

describe('getCompletionStatus', () => {
  it('returns "Name and fields needed" when both empty', () => {
    const rt = makeRecordType({ name: '', fields: [] });
    expect(getCompletionStatus(rt)).toBe('Name and fields needed');
  });

  it('returns "Lexicon name needed" when name empty but has fields', () => {
    const rt = makeRecordType({
      name: '',
      fields: [{ id: 'f1', name: 'title', type: 'string', required: true }],
    });
    expect(getCompletionStatus(rt)).toBe('Lexicon name needed');
  });

  it('returns "Fields needed" when name set but fields empty', () => {
    const rt = makeRecordType({ name: 'app.bsky.book', fields: [] });
    expect(getCompletionStatus(rt)).toBe('Fields needed');
  });

  it('returns "1 field" for singular', () => {
    const rt = makeRecordType({
      name: 'app.bsky.book',
      fields: [{ id: 'f1', name: 'title', type: 'string', required: true }],
    });
    expect(getCompletionStatus(rt)).toBe('1 field');
  });

  it('returns "3 fields" for plural', () => {
    const rt = makeRecordType({
      name: 'app.bsky.book',
      fields: [
        { id: 'f1', name: 'title', type: 'string', required: true },
        { id: 'f2', name: 'author', type: 'string', required: true },
        { id: 'f3', name: 'pages', type: 'string', required: false },
      ],
    });
    expect(getCompletionStatus(rt)).toBe('3 fields');
  });
});

// ── Status badge ──────────────────────────────────────────────────────

describe('getStatusBadge', () => {
  it('returns Draft for a new record with no name', () => {
    const rt = makeRecordType({ name: '', source: 'new' });
    expect(getStatusBadge(rt)).toEqual({ label: 'Draft', class: 'draft' });
  });

  it('returns Ready for a new record with name and namespace', () => {
    const rt = makeRecordType({
      name: 'groceryItem',
      source: 'new',
      namespaceOption: 'thelexfiles',
      lexUsername: 'alice',
    });
    expect(getStatusBadge(rt)).toEqual({ label: 'Ready', class: 'ready' });
  });

  it('returns Adopted for an adopted record', () => {
    const rt = makeRecordType({
      name: 'post',
      source: 'adopted',
      adoptedNsid: 'app.bsky.feed.post',
    });
    expect(getStatusBadge(rt)).toEqual({ label: 'Adopted', class: 'adopted' });
  });

  it('returns Draft when name set but no namespace option', () => {
    const rt = makeRecordType({ name: 'groceryItem', source: 'new' });
    expect(getStatusBadge(rt)).toEqual({ label: 'Draft', class: 'draft' });
  });
});

// ── Rendering ──────────────────────────────────────────────────────────

describe('renderDataPanel', () => {
  beforeEach(() => {
    setWizardState(initializeWizardState());
    resetDetailState();
  });

  it('renders empty state when no record types exist', () => {
    const html = renderDataPanel();
    expect(html).toContain('empty-workspace');
    expect(html).toContain('Define the data your app works with.');
    expect(html).toContain('Data Interaction');
    expect(html).toContain('data-go-to-req-btn');
    expect(html).toContain('Go to Requirements');
    expect(html).not.toContain('item-grid');
  });

  it('renders card grid when record types exist', () => {
    const state = getWizardState();
    state.recordTypes = [
      makeRecordType({ id: 'rt-1', displayName: 'book' }),
      makeRecordType({ id: 'rt-2', displayName: 'grocery item' }),
    ];
    const html = renderDataPanel();
    expect(html).not.toContain('empty-workspace');
    expect(html).toContain('item-grid');
    expect(html).toContain('data-list');
    expect(html).toContain('book');
    expect(html).toContain('grocery item');
  });

  it('renders cards with data-record-id attributes', () => {
    const state = getWizardState();
    state.recordTypes = [makeRecordType({ id: 'rt-abc' })];
    const html = renderDataPanel();
    expect(html).toContain('data-record-id="rt-abc"');
  });

  it('renders completion status on each card', () => {
    const state = getWizardState();
    state.recordTypes = [
      makeRecordType({ displayName: 'book', name: '', fields: [] }),
    ];
    const html = renderDataPanel();
    expect(html).toContain('Name and fields needed');
  });

  it('renders status badges on cards', () => {
    const state = getWizardState();
    state.recordTypes = [
      makeRecordType({ displayName: 'book', name: '', source: 'new' }),
    ];
    const html = renderDataPanel();
    expect(html).toContain('status-badge--draft');
    expect(html).toContain('Draft');
  });

  it('renders cards in creation order', () => {
    const state = getWizardState();
    state.recordTypes = [
      makeRecordType({ id: 'rt-1', displayName: 'alpha' }),
      makeRecordType({ id: 'rt-2', displayName: 'beta' }),
      makeRecordType({ id: 'rt-3', displayName: 'gamma' }),
    ];
    const html = renderDataPanel();
    const alphaIdx = html.indexOf('alpha');
    const betaIdx = html.indexOf('beta');
    const gammaIdx = html.indexOf('gamma');
    expect(alphaIdx).toBeLessThan(betaIdx);
    expect(betaIdx).toBeLessThan(gammaIdx);
  });

  it('escapes HTML in displayName', () => {
    const state = getWizardState();
    state.recordTypes = [
      makeRecordType({ displayName: '<script>alert("xss")</script>' }),
    ];
    const html = renderDataPanel();
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders clickable card class', () => {
    const state = getWizardState();
    state.recordTypes = [makeRecordType({ id: 'rt-1' })];
    const html = renderDataPanel();
    expect(html).toContain('item-card--clickable');
  });
});

// ── DOM interaction ────────────────────────────────────────────────────

describe('wireDataPanel (DOM)', () => {
  beforeEach(() => {
    setWizardState(initializeWizardState());
    resetDetailState();
  });

  function mountEmptyPanel(): void {
    document.body.innerHTML = `
      <div id="workspace-panel-body">${renderDataPanel()}</div>
      <div class="sidebar-header" data-target="requirements"></div>
    `;
    wireDataPanel();
  }

  function mountPanelWithCards(): void {
    const state = getWizardState();
    state.recordTypes = [
      makeRecordType({ id: 'rt-1', displayName: 'book' }),
      makeRecordType({ id: 'rt-2', displayName: 'grocery item' }),
    ];
    document.body.innerHTML = `
      <div id="workspace-panel-body">${renderDataPanel()}</div>
      <div class="sidebar-header" data-target="requirements"></div>
    `;
    wireDataPanel();
  }

  it('"Go to Requirements" button clicks the requirements sidebar header', () => {
    mountEmptyPanel();
    let clicked = false;
    const reqHeader = document.querySelector(
      '.sidebar-header[data-target="requirements"]',
    ) as HTMLElement;
    reqHeader.addEventListener('click', () => { clicked = true; });

    document.getElementById('data-go-to-req-btn')!.click();
    expect(clicked).toBe(true);
  });

  it('card grid renders two cards when two record types exist', () => {
    mountPanelWithCards();
    const cards = document.querySelectorAll('.item-card');
    expect(cards).toHaveLength(2);
  });

  it('cards display correct displayName and status', () => {
    mountPanelWithCards();
    const cards = document.querySelectorAll('.item-card');
    expect(cards[0].querySelector('.item-name')!.textContent).toBe('book');
    expect(cards[0].querySelector('.item-meta')!.textContent).toBe('Name and fields needed');
    expect(cards[1].querySelector('.item-name')!.textContent).toBe('grocery item');
  });

  it('re-rendering picks up fresh state', () => {
    mountEmptyPanel();
    expect(document.querySelector('.empty-workspace')).not.toBeNull();

    // Add a record type and re-render
    const state = getWizardState();
    state.recordTypes = [makeRecordType({ displayName: 'book' })];
    const body = document.getElementById('workspace-panel-body')!;
    body.innerHTML = renderDataPanel();
    wireDataPanel();

    expect(document.querySelector('.empty-workspace')).toBeNull();
    expect(document.querySelectorAll('.item-card')).toHaveLength(1);
  });

  it('clicking a card opens the detail view', () => {
    mountPanelWithCards();
    const card = document.querySelector('.item-card[data-record-id="rt-1"]') as HTMLElement;
    card.click();

    // After click, the panel should re-render with detail view
    expect(document.querySelector('.data-detail')).not.toBeNull();
    expect(document.querySelector('.data-detail-title')!.textContent).toBe('book');
    expect(document.getElementById('dt-back-link')).not.toBeNull();
  });

  it('detail view shows status badge', () => {
    mountPanelWithCards();
    const card = document.querySelector('.item-card[data-record-id="rt-1"]') as HTMLElement;
    card.click();

    expect(document.querySelector('.status-badge--draft')).not.toBeNull();
  });

  it('detail view auto-suggests record name from displayName', () => {
    const state = getWizardState();
    state.recordTypes = [
      makeRecordType({ id: 'rt-1', displayName: 'grocery item' }),
    ];
    document.body.innerHTML = `
      <div id="workspace-panel-body">${renderDataPanel()}</div>
    `;
    wireDataPanel();

    const card = document.querySelector('.item-card[data-record-id="rt-1"]') as HTMLElement;
    card.click();

    // Navigate through choice to create form
    document.getElementById('dt-choice-create')!.click();

    const nameInput = document.getElementById('dt-record-name') as HTMLInputElement;
    expect(nameInput.value).toBe('groceryItem');
  });

  it('detail view shows NSID preview', () => {
    const state = getWizardState();
    state.recordTypes = [
      makeRecordType({ id: 'rt-1', displayName: 'grocery item' }),
    ];
    document.body.innerHTML = `
      <div id="workspace-panel-body">${renderDataPanel()}</div>
    `;
    wireDataPanel();

    const card = document.querySelector('.item-card[data-record-id="rt-1"]') as HTMLElement;
    card.click();

    // Navigate through choice to create form
    document.getElementById('dt-choice-create')!.click();

    const nsid = document.querySelector('.nsid-preview-value');
    expect(nsid).not.toBeNull();
    // Should contain groceryItem in the NSID
    expect(nsid!.textContent).toContain('groceryItem');
  });

  it('detail view shows source choice for fresh drafts', () => {
    mountPanelWithCards();
    const card = document.querySelector('.item-card[data-record-id="rt-1"]') as HTMLElement;
    card.click();

    expect(document.querySelector('.source-choice')).not.toBeNull();
    expect(document.getElementById('dt-choice-create')).not.toBeNull();
    expect(document.getElementById('dt-choice-browse')).not.toBeNull();
    expect(document.getElementById('dt-create-form')).toBeNull();
  });

  it('clicking "Define new" shows create form', () => {
    mountPanelWithCards();
    const card = document.querySelector('.item-card[data-record-id="rt-1"]') as HTMLElement;
    card.click();

    document.getElementById('dt-choice-create')!.click();

    expect(document.getElementById('dt-create-form')).not.toBeNull();
    expect(document.querySelector('.source-choice')).toBeNull();
    expect(document.getElementById('dt-switch-to-browse')).not.toBeNull();
  });

  it('clicking "Use existing" shows browse UI', () => {
    mountPanelWithCards();
    const card = document.querySelector('.item-card[data-record-id="rt-1"]') as HTMLElement;
    card.click();

    document.getElementById('dt-choice-browse')!.click();

    expect(document.getElementById('dt-browse-ui')).not.toBeNull();
    expect(document.querySelector('.source-choice')).toBeNull();
    expect(document.getElementById('dt-back-to-create')).not.toBeNull();
  });

  it('clicking back from browse returns to source choice for fresh drafts', () => {
    mountPanelWithCards();
    const card = document.querySelector('.item-card[data-record-id="rt-1"]') as HTMLElement;
    card.click();

    // Go to browse via choice
    document.getElementById('dt-choice-browse')!.click();
    expect(document.getElementById('dt-browse-ui')).not.toBeNull();

    // Back should return to choice (not create)
    document.getElementById('dt-back-to-create')!.click();
    expect(document.querySelector('.source-choice')).not.toBeNull();
    expect(document.getElementById('dt-browse-ui')).toBeNull();
  });

  it('skips source choice for records with saved identity', () => {
    const state = getWizardState();
    state.recordTypes = [
      makeRecordType({
        id: 'rt-saved',
        displayName: 'book',
        name: 'book',
        namespaceOption: 'thelexfiles',
        lexUsername: 'alice',
      }),
    ];
    document.body.innerHTML = `
      <div id="workspace-panel-body">${renderDataPanel()}</div>
    `;
    wireDataPanel();

    const card = document.querySelector('.item-card[data-record-id="rt-saved"]') as HTMLElement;
    card.click();

    // Should go straight to create form, not choice
    expect(document.getElementById('dt-create-form')).not.toBeNull();
    expect(document.querySelector('.source-choice')).toBeNull();
  });

  it('detail view shows three namespace radio options', () => {
    mountPanelWithCards();
    const card = document.querySelector('.item-card[data-record-id="rt-1"]') as HTMLElement;
    card.click();

    // Navigate through choice to create form
    document.getElementById('dt-choice-create')!.click();

    const radios = document.querySelectorAll('input[name="dt-namespace"]');
    expect(radios).toHaveLength(3);
  });

  it('back link returns to card grid', () => {
    mountPanelWithCards();
    const card = document.querySelector('.item-card[data-record-id="rt-1"]') as HTMLElement;
    card.click();
    expect(document.querySelector('.data-detail')).not.toBeNull();

    const backLink = document.getElementById('dt-back-link') as HTMLElement;
    backLink.click();
    expect(document.querySelector('.data-detail')).toBeNull();
    expect(document.querySelector('.item-grid')).not.toBeNull();
  });

  it('namespace defaults to theLexFiles.com (recommended)', () => {
    mountPanelWithCards();
    const card = document.querySelector('.item-card[data-record-id="rt-1"]') as HTMLElement;
    card.click();

    // Navigate through choice to create form
    document.getElementById('dt-choice-create')!.click();

    const checked = document.querySelector(
      'input[name="dt-namespace"]:checked',
    ) as HTMLInputElement;
    expect(checked.value).toBe('thelexfiles');
  });

  it('detail view shows intro text in source choice', () => {
    mountPanelWithCards();
    const card = document.querySelector('.item-card[data-record-id="rt-1"]') as HTMLElement;
    card.click();

    const intro = document.querySelector('.source-intro');
    expect(intro).not.toBeNull();
    expect(intro!.textContent).toContain('Each data type needs a definition');
  });

  it('detail view has Fields section heading', () => {
    mountPanelWithCards();
    const card = document.querySelector('.item-card[data-record-id="rt-1"]') as HTMLElement;
    card.click();

    const heading = document.querySelector('.detail-section-heading');
    expect(heading).not.toBeNull();
    expect(heading!.textContent).toBe('Fields');
  });
});

// ── Field list rendering ────────────────────────────────────────────────

describe('field list rendering', () => {
  beforeEach(() => {
    setWizardState(initializeWizardState());
    resetDetailState();
  });

  function openDetailForRecord(rt: Partial<RecordType>): void {
    const state = getWizardState();
    state.recordTypes = [makeRecordType({ id: 'rt-test', ...rt })];
    document.body.innerHTML = `<div id="workspace-panel-body">${renderDataPanel()}</div>`;
    wireDataPanel();
    const card = document.querySelector('.item-card[data-record-id="rt-test"]') as HTMLElement;
    card.click();
  }

  it('shows empty state with system field for new lexicons', () => {
    openDetailForRecord({
      displayName: 'book',
      name: 'book',
      namespaceOption: 'thelexfiles',
      lexUsername: 'alice',
    });

    expect(document.querySelector('.field-empty-state')).not.toBeNull();
    expect(document.querySelector('.field-empty-state')!.textContent).toContain('No fields defined yet');
    // System field should be rendered
    const systemBadge = document.querySelector('.system-badge');
    expect(systemBadge).not.toBeNull();
    expect(systemBadge!.textContent).toBe('System');
  });

  it('shows "+ Add Field" button when identity is configured', () => {
    openDetailForRecord({
      displayName: 'book',
      name: 'book',
      namespaceOption: 'thelexfiles',
      lexUsername: 'alice',
    });

    expect(document.getElementById('dt-add-field-btn')).not.toBeNull();
  });

  it('hides "+ Add Field" button when identity is not configured', () => {
    openDetailForRecord({
      displayName: 'book',
      name: '',
    });

    // Navigate to source choice first, then check
    expect(document.getElementById('dt-add-field-btn')).toBeNull();
  });

  it('shows read-only note for adopted lexicons', () => {
    openDetailForRecord({
      displayName: 'post',
      name: 'post',
      source: 'adopted',
      adoptedNsid: 'app.bsky.feed.post',
      adoptedSchema: {
        lexicon: 1,
        id: 'app.bsky.feed.post',
        defs: {
          main: {
            type: 'record',
            description: 'A post',
            key: 'tid',
            record: {
              type: 'object',
              required: ['text', 'createdAt'],
              properties: {
                text: { type: 'string', maxLength: 300 },
                createdAt: { type: 'string', format: 'datetime' },
              },
            },
          },
        },
      },
      fields: [
        { id: 'f1', name: 'text', type: 'string', maxLength: 300, required: true },
        { id: 'f2', name: 'createdAt', type: 'string', format: 'datetime', required: true },
      ],
    });

    const note = document.querySelector('.form-note');
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain('These fields are defined by the adopted lexicon');
    expect(note!.textContent).toContain('app.bsky.feed.post');

    // No add button for adopted
    expect(document.getElementById('dt-add-field-btn')).toBeNull();

    // No edit/delete buttons
    expect(document.querySelector('.field-edit-btn')).toBeNull();
    expect(document.querySelector('.field-delete-btn')).toBeNull();
  });

  it('renders field rows with type badges', () => {
    openDetailForRecord({
      displayName: 'book',
      name: 'book',
      namespaceOption: 'thelexfiles',
      lexUsername: 'alice',
      fields: [
        { id: 'f1', name: 'title', type: 'string', required: true },
        { id: 'f2', name: 'pages', type: 'integer', required: false },
        { id: 'f3', name: 'createdAt', type: 'string', format: 'datetime', required: true, isSystem: true },
      ],
    });

    const rows = document.querySelectorAll('.field-row');
    expect(rows).toHaveLength(3);

    // First row: title (Text, Required)
    const firstRow = rows[0];
    expect(firstRow.querySelector('.field-row-name')!.textContent).toBe('title');
    expect(firstRow.querySelector('.type-badge')!.textContent).toBe('Text');
    expect(firstRow.querySelector('.required-badge')).not.toBeNull();

    // Last row: createdAt (Date & Time, System)
    const lastRow = rows[2];
    expect(lastRow.querySelector('.field-row-name')!.textContent).toBe('createdAt');
    expect(lastRow.querySelector('.type-badge')!.textContent).toBe('Date & Time');
    expect(lastRow.querySelector('.system-badge')).not.toBeNull();
    // System fields have no edit/delete
    expect(lastRow.querySelector('.field-edit-btn')).toBeNull();
    expect(lastRow.querySelector('.field-delete-btn')).toBeNull();
  });

  it('shows edit and delete buttons for user fields', () => {
    openDetailForRecord({
      displayName: 'book',
      name: 'book',
      namespaceOption: 'thelexfiles',
      lexUsername: 'alice',
      fields: [
        { id: 'f1', name: 'title', type: 'string', required: true },
        { id: 'f-sys', name: 'createdAt', type: 'string', format: 'datetime', required: true, isSystem: true },
      ],
    });

    const userRow = document.querySelector('.field-row[data-field-id="f1"]');
    expect(userRow!.querySelector('.field-edit-btn')).not.toBeNull();
    expect(userRow!.querySelector('.field-delete-btn')).not.toBeNull();
  });

  it('backfills createdAt system field for new records missing it', () => {
    openDetailForRecord({
      displayName: 'book',
      name: 'book',
      namespaceOption: 'thelexfiles',
      lexUsername: 'alice',
      fields: [
        { id: 'f1', name: 'title', type: 'string', required: true },
      ],
    });

    // Should have backfilled createdAt
    const state = getWizardState();
    const rt = state.recordTypes.find(r => r.id === 'rt-test')!;
    const sysField = rt.fields.find(f => f.name === 'createdAt' && f.isSystem);
    expect(sysField).toBeDefined();
  });
});

// ── Field form interaction ────────────────────────────────────────────

describe('field form interaction', () => {
  beforeEach(() => {
    setWizardState(initializeWizardState());
    resetDetailState();
  });

  function openDetailWithIdentity(): void {
    const state = getWizardState();
    state.recordTypes = [makeRecordType({
      id: 'rt-test',
      displayName: 'book',
      name: 'book',
      namespaceOption: 'thelexfiles',
      lexUsername: 'alice',
      fields: [
        { id: 'f-sys', name: 'createdAt', type: 'string', format: 'datetime', required: true, isSystem: true },
      ],
    })];
    document.body.innerHTML = `<div id="workspace-panel-body">${renderDataPanel()}</div>`;
    wireDataPanel();
    const card = document.querySelector('.item-card[data-record-id="rt-test"]') as HTMLElement;
    card.click();
  }

  it('clicking "+ Add Field" shows inline form', () => {
    openDetailWithIdentity();
    document.getElementById('dt-add-field-btn')!.click();

    expect(document.getElementById('dt-field-form')).not.toBeNull();
    expect(document.getElementById('dt-field-name')).not.toBeNull();
    expect(document.getElementById('dt-field-type')).not.toBeNull();
  });

  it('save button is initially disabled', () => {
    openDetailWithIdentity();
    document.getElementById('dt-add-field-btn')!.click();

    const saveBtn = document.querySelector('.field-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('cancel closes the form', () => {
    openDetailWithIdentity();
    document.getElementById('dt-add-field-btn')!.click();
    expect(document.getElementById('dt-field-form')).not.toBeNull();

    const cancelBtn = document.querySelector('.field-cancel-btn') as HTMLElement;
    cancelBtn.click();
    expect(document.getElementById('dt-field-form')).toBeNull();
  });

  it('adding a valid field saves to state and re-renders', () => {
    openDetailWithIdentity();
    document.getElementById('dt-add-field-btn')!.click();

    const nameInput = document.getElementById('dt-field-name') as HTMLInputElement;
    const typeSelect = document.getElementById('dt-field-type') as HTMLSelectElement;
    nameInput.value = 'title';
    nameInput.dispatchEvent(new Event('input'));
    typeSelect.value = 'string';
    typeSelect.dispatchEvent(new Event('change'));

    const saveBtn = document.querySelector('.field-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
    saveBtn.click();

    // Field should appear in the list
    const state = getWizardState();
    const rt = state.recordTypes.find(r => r.id === 'rt-test')!;
    const userFields = rt.fields.filter(f => !f.isSystem);
    expect(userFields).toHaveLength(1);
    expect(userFields[0].name).toBe('title');
    expect(userFields[0].type).toBe('string');

    // Field row should be rendered
    expect(document.querySelector('.field-row-name')).not.toBeNull();
  });

  it('validates field name: must start with lowercase letter', () => {
    openDetailWithIdentity();
    document.getElementById('dt-add-field-btn')!.click();

    const nameInput = document.getElementById('dt-field-name') as HTMLInputElement;
    const typeSelect = document.getElementById('dt-field-type') as HTMLSelectElement;
    typeSelect.value = 'string';
    typeSelect.dispatchEvent(new Event('change'));

    // Leading digit
    nameInput.value = '1badname';
    nameInput.dispatchEvent(new Event('input'));
    expect(document.getElementById('dt-field-name-error')!.textContent).toContain('lowercase letter');
    expect((document.querySelector('.field-save-btn') as HTMLButtonElement).disabled).toBe(true);

    // Leading uppercase
    nameInput.value = 'BadName';
    nameInput.dispatchEvent(new Event('input'));
    expect(document.getElementById('dt-field-name-error')!.textContent).toContain('lowercase letter');
    expect((document.querySelector('.field-save-btn') as HTMLButtonElement).disabled).toBe(true);

    // Valid lowerCamelCase
    nameInput.value = 'goodName';
    nameInput.dispatchEvent(new Event('input'));
    expect(document.getElementById('dt-field-name-error')!.textContent).toBe('');
    expect((document.querySelector('.field-save-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('validates field name: no special characters', () => {
    openDetailWithIdentity();
    document.getElementById('dt-add-field-btn')!.click();

    const nameInput = document.getElementById('dt-field-name') as HTMLInputElement;
    const typeSelect = document.getElementById('dt-field-type') as HTMLSelectElement;
    nameInput.value = 'bad-name';
    nameInput.dispatchEvent(new Event('input'));
    typeSelect.value = 'string';
    typeSelect.dispatchEvent(new Event('change'));

    const error = document.getElementById('dt-field-name-error')!;
    expect(error.textContent).toContain('Only letters and digits');
    expect((document.querySelector('.field-save-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('validates field name: no duplicates', () => {
    // First add a field
    openDetailWithIdentity();
    document.getElementById('dt-add-field-btn')!.click();
    const nameInput = document.getElementById('dt-field-name') as HTMLInputElement;
    const typeSelect = document.getElementById('dt-field-type') as HTMLSelectElement;
    nameInput.value = 'title';
    nameInput.dispatchEvent(new Event('input'));
    typeSelect.value = 'string';
    typeSelect.dispatchEvent(new Event('change'));
    (document.querySelector('.field-save-btn') as HTMLButtonElement).click();

    // Try to add another with the same name
    document.getElementById('dt-add-field-btn')!.click();
    const nameInput2 = document.getElementById('dt-field-name') as HTMLInputElement;
    const typeSelect2 = document.getElementById('dt-field-type') as HTMLSelectElement;
    nameInput2.value = 'title';
    nameInput2.dispatchEvent(new Event('input'));
    typeSelect2.value = 'string';
    typeSelect2.dispatchEvent(new Event('change'));

    const error = document.getElementById('dt-field-name-error')!;
    expect(error.textContent).toContain('A field with this name already exists');
    expect((document.querySelector('.field-save-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('type change updates constraints area', () => {
    openDetailWithIdentity();
    document.getElementById('dt-add-field-btn')!.click();

    const typeSelect = document.getElementById('dt-field-type') as HTMLSelectElement;

    // Select string type
    typeSelect.value = 'string';
    typeSelect.dispatchEvent(new Event('change'));
    expect(document.getElementById('dt-field-maxlength')).not.toBeNull();
    expect(document.getElementById('dt-field-format')).not.toBeNull();

    // Switch to integer
    typeSelect.value = 'integer';
    typeSelect.dispatchEvent(new Event('change'));
    expect(document.getElementById('dt-field-minimum')).not.toBeNull();
    expect(document.getElementById('dt-field-maximum')).not.toBeNull();
    expect(document.getElementById('dt-field-maxlength')).toBeNull();

    // Switch to boolean — no constraints
    typeSelect.value = 'boolean';
    typeSelect.dispatchEvent(new Event('change'));
    expect(document.getElementById('dt-field-constraints')!.innerHTML).toBe('');
  });

  it('shortcut types set format automatically', () => {
    openDetailWithIdentity();
    document.getElementById('dt-add-field-btn')!.click();

    const nameInput = document.getElementById('dt-field-name') as HTMLInputElement;
    const typeSelect = document.getElementById('dt-field-type') as HTMLSelectElement;

    nameInput.value = 'eventDate';
    nameInput.dispatchEvent(new Event('input'));
    typeSelect.value = 'string:datetime';
    typeSelect.dispatchEvent(new Event('change'));

    (document.querySelector('.field-save-btn') as HTMLButtonElement).click();

    const state = getWizardState();
    const rt = state.recordTypes.find(r => r.id === 'rt-test')!;
    const field = rt.fields.find(f => f.name === 'eventDate')!;
    expect(field.type).toBe('string');
    expect(field.format).toBe('datetime');
  });
});

// ── Field deletion ──────────────────────────────────────────────────

describe('field deletion', () => {
  beforeEach(() => {
    setWizardState(initializeWizardState());
    resetDetailState();
  });

  it('shows inline delete confirmation', () => {
    const state = getWizardState();
    state.recordTypes = [makeRecordType({
      id: 'rt-test',
      displayName: 'book',
      name: 'book',
      namespaceOption: 'thelexfiles',
      lexUsername: 'alice',
      fields: [
        { id: 'f1', name: 'title', type: 'string', required: true },
        { id: 'f-sys', name: 'createdAt', type: 'string', format: 'datetime', required: true, isSystem: true },
      ],
    })];
    document.body.innerHTML = `<div id="workspace-panel-body">${renderDataPanel()}</div>`;
    wireDataPanel();
    const card = document.querySelector('.item-card[data-record-id="rt-test"]') as HTMLElement;
    card.click();

    // Click delete on the user field
    const deleteBtn = document.querySelector('.field-delete-btn[data-field-id="f1"]') as HTMLElement;
    deleteBtn.click();

    // Should show confirmation
    expect(document.querySelector('.field-delete-confirm')).not.toBeNull();
    expect(document.querySelector('.field-confirm-delete-btn')).not.toBeNull();
    expect(document.querySelector('.field-cancel-delete-btn')).not.toBeNull();
  });

  it('confirming delete removes the field', () => {
    const state = getWizardState();
    state.recordTypes = [makeRecordType({
      id: 'rt-test',
      displayName: 'book',
      name: 'book',
      namespaceOption: 'thelexfiles',
      lexUsername: 'alice',
      fields: [
        { id: 'f1', name: 'title', type: 'string', required: true },
        { id: 'f-sys', name: 'createdAt', type: 'string', format: 'datetime', required: true, isSystem: true },
      ],
    })];
    document.body.innerHTML = `<div id="workspace-panel-body">${renderDataPanel()}</div>`;
    wireDataPanel();
    const card = document.querySelector('.item-card[data-record-id="rt-test"]') as HTMLElement;
    card.click();

    const deleteBtn = document.querySelector('.field-delete-btn[data-field-id="f1"]') as HTMLElement;
    deleteBtn.click();

    const confirmBtn = document.querySelector('.field-confirm-delete-btn') as HTMLElement;
    confirmBtn.click();

    const updatedState = getWizardState();
    const rt = updatedState.recordTypes.find(r => r.id === 'rt-test')!;
    expect(rt.fields.filter(f => !f.isSystem)).toHaveLength(0);
  });

  it('cancelling delete restores the row', () => {
    const state = getWizardState();
    state.recordTypes = [makeRecordType({
      id: 'rt-test',
      displayName: 'book',
      name: 'book',
      namespaceOption: 'thelexfiles',
      lexUsername: 'alice',
      fields: [
        { id: 'f1', name: 'title', type: 'string', required: true },
        { id: 'f-sys', name: 'createdAt', type: 'string', format: 'datetime', required: true, isSystem: true },
      ],
    })];
    document.body.innerHTML = `<div id="workspace-panel-body">${renderDataPanel()}</div>`;
    wireDataPanel();
    const card = document.querySelector('.item-card[data-record-id="rt-test"]') as HTMLElement;
    card.click();

    const deleteBtn = document.querySelector('.field-delete-btn[data-field-id="f1"]') as HTMLElement;
    deleteBtn.click();

    const cancelBtn = document.querySelector('.field-cancel-delete-btn') as HTMLElement;
    cancelBtn.click();

    // Confirmation gone, field still present
    expect(document.querySelector('.field-delete-confirm')).toBeNull();
    const updatedState = getWizardState();
    const rt = updatedState.recordTypes.find(r => r.id === 'rt-test')!;
    expect(rt.fields.filter(f => !f.isSystem)).toHaveLength(1);
  });
});

// ── Completion status with system fields ──────────────────────────────

describe('completion status with system fields', () => {
  it('system-only fields count as "Fields needed"', () => {
    const rt = makeRecordType({
      name: 'book',
      fields: [
        { id: 'f-sys', name: 'createdAt', type: 'string', format: 'datetime', required: true, isSystem: true },
      ],
    });
    expect(getCompletionStatus(rt)).toBe('Fields needed');
  });

  it('user fields plus system fields shows total count', () => {
    const rt = makeRecordType({
      name: 'book',
      fields: [
        { id: 'f1', name: 'title', type: 'string', required: true },
        { id: 'f-sys', name: 'createdAt', type: 'string', format: 'datetime', required: true, isSystem: true },
      ],
    });
    expect(getCompletionStatus(rt)).toBe('2 fields');
  });
});

// ── State migration ───────────────────────────────────────────────────

describe('state migration', () => {
  it('adds source and recordKeyType to old RecordTypes', () => {
    const state = initializeWizardState();
    state.recordTypes = [
      { id: 'rt-1', name: '', displayName: 'book', description: '', fields: [] } as any,
    ];
    setWizardState(state);
    const migrated = getWizardState();
    expect(migrated.recordTypes[0].source).toBe('new');
    expect(migrated.recordTypes[0].recordKeyType).toBe('tid');
  });
});
