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
