// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderGeneratePanel,
  wireGeneratePanel,
  updateGenerateSidebar,
  isDomainNeeded,
} from '../../src/app/views/panels/GeneratePanel';
import {
  getWizardState,
  setWizardState,
  initializeWizardState,
} from '../../src/app/state/WizardState';
import type { RecordType } from '../../src/types/wizard';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRecordType(
  overrides: Partial<RecordType> & { name: string },
): RecordType {
  return {
    id: `rt-${Date.now()}-${Math.random()}`,
    displayName: overrides.name,
    description: '',
    fields: [],
    source: 'new',
    ...overrides,
  };
}

function setupState(opts: {
  appName?: string;
  domain?: string;
  description?: string;
  authorName?: string;
  recordTypes?: RecordType[];
  hasGenerated?: boolean;
}): void {
  const state = initializeWizardState();
  state.appInfo.appName = opts.appName ?? '';
  state.appInfo.domain = opts.domain ?? '';
  state.appInfo.description = opts.description ?? '';
  state.appInfo.authorName = opts.authorName ?? '';
  if (opts.recordTypes) state.recordTypes = opts.recordTypes;
  if (opts.hasGenerated !== undefined) state.hasGenerated = opts.hasGenerated;
  setWizardState(state);
}

function renderAndWire(): void {
  document.body.innerHTML = `
    <div class="sidebar-section" data-section="generate">
      <div class="sidebar-items"></div>
    </div>
    <div id="workspace-panel-body">${renderGeneratePanel()}</div>
  `;
  wireGeneratePanel();
}

// ── Initial render ───────────────────────────────────────────────────

describe('GeneratePanel — initial render', () => {
  beforeEach(() => {
    setupState({});
  });

  it('shows description text', () => {
    const html = renderGeneratePanel();
    expect(html).toContain('Configure your app');
    expect(html).toContain('AT Protocol application');
  });

  it('shows App Identity section with core form fields', () => {
    const html = renderGeneratePanel();
    expect(html).toContain('App Identity');
    expect(html).toContain('gen-app-name');
    expect(html).toContain('gen-description');
    expect(html).toContain('gen-author');
  });

  it('shows Review section', () => {
    const html = renderGeneratePanel();
    expect(html).toContain('Review');
    expect(html).toContain('Record Types');
    expect(html).toContain('Views');
    expect(html).toContain('Blocks');
    expect(html).toContain('Requirements');
  });

  it('shows Export section with download button', () => {
    const html = renderGeneratePanel();
    expect(html).toContain('Export');
    expect(html).toContain('gen-download-btn');
    expect(html).toContain('Download ZIP');
  });

  it('disables download button when app name is empty', () => {
    renderAndWire();
    const btn = document.getElementById('gen-download-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

// ── Domain field visibility ──────────────────────────────────────────

describe('GeneratePanel — domain field visibility', () => {
  it('hides domain field when no record types exist', () => {
    setupState({});
    const html = renderGeneratePanel();
    expect(html).not.toContain('gen-domain');
  });

  it('shows domain field when a record type needs fallback domain', () => {
    const rt = makeRecordType({ name: 'post' }); // no namespace option → needs domain
    setupState({ recordTypes: [rt] });
    const html = renderGeneratePanel();
    expect(html).toContain('gen-domain');
  });

  it('hides domain field when all record types use thelexfiles', () => {
    const rt = makeRecordType({
      name: 'post',
      namespaceOption: 'thelexfiles',
      lexUsername: 'alice',
    });
    setupState({ recordTypes: [rt] });
    const html = renderGeneratePanel();
    expect(html).not.toContain('gen-domain');
  });

  it('hides domain field when all record types use thelexfiles-temp', () => {
    const rt = makeRecordType({
      name: 'post',
      namespaceOption: 'thelexfiles-temp',
      lexUsername: 'alice',
    });
    setupState({ recordTypes: [rt] });
    const html = renderGeneratePanel();
    expect(html).not.toContain('gen-domain');
  });

  it('hides domain field when all record types are adopted', () => {
    const rt = makeRecordType({
      name: 'post',
      source: 'adopted',
      adoptedNsid: 'com.example.post',
    });
    setupState({ recordTypes: [rt] });
    const html = renderGeneratePanel();
    expect(html).not.toContain('gen-domain');
  });

  it('hides domain field when all record types use byo-domain', () => {
    const rt = makeRecordType({
      name: 'post',
      namespaceOption: 'byo-domain',
      customDomain: 'mysite.com',
    });
    setupState({ recordTypes: [rt] });
    const html = renderGeneratePanel();
    expect(html).not.toContain('gen-domain');
  });

  it('shows domain field when mix of thelexfiles and fallback records', () => {
    const rts = [
      makeRecordType({ name: 'post', namespaceOption: 'thelexfiles', lexUsername: 'alice' }),
      makeRecordType({ name: 'profile' }), // needs fallback domain
    ];
    setupState({ recordTypes: rts });
    const html = renderGeneratePanel();
    expect(html).toContain('gen-domain');
  });
});

// ── isDomainNeeded ───────────────────────────────────────────────────

describe('isDomainNeeded', () => {
  it('returns false with no record types', () => {
    setupState({});
    expect(isDomainNeeded()).toBe(false);
  });

  it('returns true when a record type has no namespace option', () => {
    setupState({ recordTypes: [makeRecordType({ name: 'post' })] });
    expect(isDomainNeeded()).toBe(true);
  });

  it('returns false when all use thelexfiles', () => {
    setupState({
      recordTypes: [
        makeRecordType({ name: 'post', namespaceOption: 'thelexfiles', lexUsername: 'alice' }),
      ],
    });
    expect(isDomainNeeded()).toBe(false);
  });

  it('returns true when thelexfiles record lacks lexUsername', () => {
    setupState({
      recordTypes: [
        makeRecordType({ name: 'post', namespaceOption: 'thelexfiles' }),
      ],
    });
    expect(isDomainNeeded()).toBe(true);
  });
});

// ── Form pre-population ──────────────────────────────────────────────

describe('GeneratePanel — form pre-population', () => {
  it('pre-populates fields from wizard state', () => {
    // Include a record type needing domain so domain field renders
    const rt = makeRecordType({ name: 'post' });
    setupState({
      appName: 'My App',
      domain: 'example.com',
      description: 'A test app',
      authorName: 'Jon',
      recordTypes: [rt],
    });
    renderAndWire();

    const appName = document.getElementById('gen-app-name') as HTMLInputElement;
    const domain = document.getElementById('gen-domain') as HTMLInputElement;
    const desc = document.getElementById('gen-description') as HTMLTextAreaElement;
    const author = document.getElementById('gen-author') as HTMLInputElement;

    expect(appName.value).toBe('My App');
    expect(domain.value).toBe('example.com');
    expect(desc.value).toBe('A test app');
    expect(author.value).toBe('Jon');
  });
});

// ── Form persistence ─────────────────────────────────────────────────

describe('GeneratePanel — form persistence', () => {
  beforeEach(() => {
    // Include a record type so domain field renders
    const rt = makeRecordType({ name: 'post' });
    setupState({ recordTypes: [rt] });
    renderAndWire();
  });

  it('persists app name on input', () => {
    const input = document.getElementById('gen-app-name') as HTMLInputElement;
    input.value = 'New App';
    input.dispatchEvent(new Event('input'));

    const state = getWizardState();
    expect(state.appInfo.appName).toBe('New App');
  });

  it('persists domain on input', () => {
    const input = document.getElementById('gen-domain') as HTMLInputElement;
    input.value = 'test.com';
    input.dispatchEvent(new Event('input'));

    const state = getWizardState();
    expect(state.appInfo.domain).toBe('test.com');
  });

  it('persists description on input', () => {
    const input = document.getElementById('gen-description') as HTMLTextAreaElement;
    input.value = 'My desc';
    input.dispatchEvent(new Event('input'));

    const state = getWizardState();
    expect(state.appInfo.description).toBe('My desc');
  });

  it('persists author on input', () => {
    const input = document.getElementById('gen-author') as HTMLInputElement;
    input.value = 'Author';
    input.dispatchEvent(new Event('input'));

    const state = getWizardState();
    expect(state.appInfo.authorName).toBe('Author');
  });
});

// ── Download button state ────────────────────────────────────────────

describe('GeneratePanel — download button state', () => {
  it('enables when app name and domain are filled (domain needed)', () => {
    const rt = makeRecordType({ name: 'post' });
    setupState({ appName: 'My App', domain: 'example.com', recordTypes: [rt] });
    renderAndWire();

    const btn = document.getElementById('gen-download-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('disabled when only app name is filled but domain is needed', () => {
    const rt = makeRecordType({ name: 'post' });
    setupState({ appName: 'My App', recordTypes: [rt] });
    renderAndWire();

    const btn = document.getElementById('gen-download-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('disabled when only domain is filled', () => {
    const rt = makeRecordType({ name: 'post' });
    setupState({ domain: 'example.com', recordTypes: [rt] });
    renderAndWire();

    const btn = document.getElementById('gen-download-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('enables with just app name when domain is not needed', () => {
    const rt = makeRecordType({
      name: 'post',
      namespaceOption: 'thelexfiles',
      lexUsername: 'alice',
    });
    setupState({ appName: 'My App', recordTypes: [rt] });
    renderAndWire();

    const btn = document.getElementById('gen-download-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('enables with just app name when no record types exist', () => {
    setupState({ appName: 'My App' });
    renderAndWire();

    const btn = document.getElementById('gen-download-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });
});

// ── Review section ───────────────────────────────────────────────────

describe('GeneratePanel — review section', () => {
  it('shows record type count and names with NSIDs', () => {
    const rt = makeRecordType({ name: 'post', displayName: 'Post' });
    setupState({ domain: 'example.com', recordTypes: [rt] });

    const html = renderGeneratePanel();
    expect(html).toContain('1');
    expect(html).toContain('Post');
    expect(html).toContain('com.example.post');
  });

  it('shows multiple record types', () => {
    const rts = [
      makeRecordType({ name: 'post', displayName: 'Post' }),
      makeRecordType({ name: 'profile', displayName: 'Profile' }),
    ];
    setupState({ domain: 'example.com', recordTypes: rts });

    const html = renderGeneratePanel();
    expect(html).toContain('2');
    expect(html).toContain('Post');
    expect(html).toContain('Profile');
    expect(html).toContain('com.example.post');
    expect(html).toContain('com.example.profile');
  });

  it('shows placeholder NSID when domain is empty', () => {
    const rt = makeRecordType({ name: 'post', displayName: 'Post' });
    setupState({ recordTypes: [rt] });

    const html = renderGeneratePanel();
    expect(html).toContain('[domain].post');
  });

  it('shows thelexfiles NSID without domain', () => {
    const rt = makeRecordType({
      name: 'post',
      displayName: 'Post',
      namespaceOption: 'thelexfiles',
      lexUsername: 'alice',
    });
    setupState({ recordTypes: [rt] });

    const html = renderGeneratePanel();
    expect(html).toContain('com.thelexfiles.alice.post');
  });

  it('shows adopted NSID without requiring domain', () => {
    const rt = makeRecordType({
      name: 'post',
      displayName: 'Post',
      source: 'adopted',
      adoptedNsid: 'app.bsky.feed.post',
    });
    setupState({ recordTypes: [rt] });

    const html = renderGeneratePanel();
    expect(html).toContain('app.bsky.feed.post');
    expect(html).not.toContain('[domain].post');
  });

  it('shows lexicon preview in details element', () => {
    const rt = makeRecordType({ name: 'post', displayName: 'Post' });
    setupState({ domain: 'example.com', recordTypes: [rt] });

    const html = renderGeneratePanel();
    expect(html).toContain('<details>');
    expect(html).toContain('<summary>');
    expect(html).toContain('wizard-code');
    expect(html).toContain('&quot;lexicon&quot;');
  });

  it('shows warning when no record types exist', () => {
    setupState({});

    const html = renderGeneratePanel();
    expect(html).toContain('No data types defined');
    expect(html).toContain('generate-warning');
  });

  it('does not show warning when record types exist', () => {
    const rt = makeRecordType({ name: 'post' });
    setupState({ domain: 'example.com', recordTypes: [rt] });

    const html = renderGeneratePanel();
    expect(html).not.toContain('generate-warning');
  });

  it('shows views count and names', () => {
    setupState({}); // initializeWizardState seeds a Home view

    const html = renderGeneratePanel();
    expect(html).toContain('Home');
  });

  it('shows blocks count', () => {
    const state = initializeWizardState();
    state.blocks = [
      { id: 'b1', name: 'Nav', requirementIds: [] },
      { id: 'b2', name: 'Feed', requirementIds: [] },
    ];
    setWizardState(state);

    const html = renderGeneratePanel();
    expect(html).toContain('>2<');
  });

  it('shows requirements count', () => {
    const state = initializeWizardState();
    state.requirements = [
      { id: 'r1', type: 'know', text: 'About page' },
      { id: 'r2', type: 'do', verb: 'create', data: 'post' },
      { id: 'r3', type: 'know', text: 'FAQ' },
    ];
    setWizardState(state);

    const html = renderGeneratePanel();
    expect(html).toContain('>3<');
  });
});

// ── Sidebar ──────────────────────────────────────────────────────────

describe('GeneratePanel — sidebar', () => {
  it('shows "Configure & generate" when app name is empty', () => {
    setupState({});

    document.body.innerHTML = `
      <div class="sidebar-section" data-section="generate">
        <div class="sidebar-items"></div>
      </div>
    `;

    updateGenerateSidebar();

    const items = document.querySelector('.sidebar-items');
    expect(items?.textContent).toContain('Configure');
    expect(items?.textContent).toContain('generate');
  });

  it('shows app name when filled', () => {
    setupState({ appName: 'Cool App' });

    document.body.innerHTML = `
      <div class="sidebar-section" data-section="generate">
        <div class="sidebar-items"></div>
      </div>
    `;

    updateGenerateSidebar();

    const item = document.querySelector('.sidebar-item');
    expect(item?.textContent).toContain('Cool App');
  });

  it('does not have has-items when not generated', () => {
    setupState({ appName: 'Cool App' });

    document.body.innerHTML = `
      <div class="sidebar-section" data-section="generate">
        <div class="sidebar-items"></div>
      </div>
    `;

    updateGenerateSidebar();

    const section = document.querySelector('.sidebar-section');
    expect(section?.classList.contains('has-items')).toBe(false);
  });

  it('has has-items when hasGenerated is true', () => {
    setupState({ appName: 'Cool App', hasGenerated: true });

    document.body.innerHTML = `
      <div class="sidebar-section" data-section="generate">
        <div class="sidebar-items"></div>
      </div>
    `;

    updateGenerateSidebar();

    const section = document.querySelector('.sidebar-section');
    expect(section?.classList.contains('has-items')).toBe(true);
  });
});

// ── Next-step card in ViewsPanel ─────────────────────────────────────

describe('ViewsPanel — next-step card', () => {
  it('renders next-step card pointing to Generate', async () => {
    const { renderViewsPanel } = await import('../../src/app/views/panels/ViewsPanel');

    setupState({});
    const html = renderViewsPanel();
    expect(html).toContain('views-next-step');
    expect(html).toContain('Final step');
    expect(html).toContain('Generate your app');
    expect(html).toContain('data-section="generate"');
  });
});
