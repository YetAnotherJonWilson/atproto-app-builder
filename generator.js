// ===== AT Protocol App Generator =====
// Generates complete TypeScript + Vite applications based on wizard configuration

// ===== HELPER FUNCTIONS =====

function toPascalCase(str) {
  return str
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function generateNSID(domain, name) {
  const parts = domain.split('.').reverse();
  const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [...parts, safeName].join('.');
}

// ===== PACKAGE.JSON GENERATOR =====

function generatePackageJson(appInfo) {
  const safeName = appInfo.appName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  return JSON.stringify({
    "name": safeName,
    "version": "1.0.0",
    "description": appInfo.description || `${appInfo.appName} - An AT Protocol application`,
    "main": "index.js",
    "scripts": {
      "dev": "vite",
      "build": "vite build",
      "preview": "vite preview"
    },
    "author": appInfo.authorName || "",
    "license": "MIT",
    "type": "module",
    "dependencies": {
      "@atproto/api": "^0.18.8",
      "@atproto/lexicon": "^0.5.1",
      "@atproto/oauth-client-browser": "^0.3.35"
    },
    "devDependencies": {
      "@types/node": "^25.0.3",
      "typescript": "^5.9.3",
      "vite": "^7.2.4"
    }
  }, null, 2);
}

// ===== VITE CONFIG GENERATOR =====

function generateViteConfig() {
  return `import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8080,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
  },
  publicDir: 'public',
});
`;
}

// ===== TSCONFIG GENERATOR =====

function generateTsConfig() {
  return JSON.stringify({
    "compilerOptions": {
      "target": "ES2020",
      "useDefineForClassFields": true,
      "module": "ESNext",
      "lib": ["ES2020", "DOM", "DOM.Iterable"],
      "skipLibCheck": true,
      "moduleResolution": "bundler",
      "allowImportingTsExtensions": true,
      "resolveJsonModule": true,
      "isolatedModules": true,
      "noEmit": true,
      "strict": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "noFallthroughCasesInSwitch": true
    },
    "include": ["**/*.ts"]
  }, null, 2);
}

// ===== INDEX.HTML GENERATOR =====

function generateIndexHtml(appInfo, recordTypes, appConfig) {
  const primaryRecord = recordTypes.find(r => r.name === appConfig.primaryRecordType) || recordTypes[0];
  const appTitle = appInfo.appName;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appTitle}</title>
    <script type="module" src="./app.ts" defer></script>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <div class="container">
      <h1>${appTitle}</h1>

      <!-- Loading Section (shown during OAuth callback) -->
      <div id="loadingSection" class="loading-section">
        <div class="spinner"></div>
        <p>Completing sign in...</p>
      </div>

      <!-- Login Section -->
      <div id="loginSection" class="login-section active">
        <p>Sign in with your AT Protocol account (Bluesky, etc.)</p>
        <form id="loginForm">
          <input
            type="text"
            id="handleInput"
            placeholder="your-handle.bsky.social"
            autocomplete="username"
            required
          />
          <button type="submit">Sign In</button>
        </form>
        <div id="loginStatus" class="status" style="display: none"></div>
      </div>

      <!-- App Section (shown after login) -->
      <div id="appSection" class="app-section">
        <div class="user-info">
          <strong>Logged in as:</strong>
          <div id="userDisplayName"></div>
          <div id="userHandle"></div>
          <div id="userDid" style="font-size: 12px; color: #666; margin-top: 5px"></div>
        </div>

        <div id="appStatus" class="status">Ready!</div>

        <!-- Main Menu View -->
        <div id="mainMenuView" class="view-section active">
          <div id="menuContainer"></div>
        </div>

        <!-- List View -->
        <div id="listView" class="view-section"></div>

        <!-- Detail View -->
        <div id="detailView" class="view-section"></div>

        <!-- Create/Edit Form View -->
        <div id="formView" class="view-section"></div>

        <button id="logoutButton" class="secondary">Sign Out</button>
      </div>
    </div>
  </body>
</html>
`;
}

// ===== STYLES.CSS GENERATOR =====

function generateStyles() {
  return `body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 600px;
  margin: 50px auto;
  padding: 20px;
  background: #f5f5f5;
}

.container {
  background: white;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

h1 {
  color: #333;
  margin-bottom: 20px;
}

h2 {
  color: #333;
  margin-bottom: 15px;
  font-size: 24px;
}

.loading-section {
  display: none;
  text-align: center;
  padding: 40px 0;
}

.loading-section.active {
  display: block;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #0085ff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.login-section {
  display: none;
}

.login-section.active {
  display: block;
}

.app-section {
  display: none;
}

.app-section.active {
  display: block;
}

input, textarea, select {
  width: 100%;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 5px;
  box-sizing: border-box;
  font-family: inherit;
}

textarea {
  resize: vertical;
  min-height: 80px;
}

button {
  background: #0085ff;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  width: 100%;
  margin-top: 10px;
}

button:hover {
  background: #0066cc;
}

button.secondary {
  background: #666;
}

button.secondary:hover {
  background: #555;
}

button.danger {
  background: #dc3545;
}

button.danger:hover {
  background: #c82333;
}

.status {
  padding: 10px;
  margin: 10px 0;
  border-radius: 5px;
  background: #e3f2fd;
  color: #1976d2;
}

.status.error {
  background: #ffebee;
  color: #c62828;
}

.user-info {
  padding: 15px;
  background: #f5f5f5;
  border-radius: 5px;
  margin: 15px 0;
}

/* View sections */
.view-section {
  display: none;
}

.view-section.active {
  display: block;
  margin: 20px 0;
}

/* Menu container */
#menuContainer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 20px 0;
}

/* List items */
.list-container {
  margin: 20px 0;
}

.list-item {
  padding: 15px;
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 5px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.list-item:hover {
  background: #f0f0f0;
}

.list-item h3 {
  margin: 0 0 8px 0;
  color: #333;
}

.list-item p {
  margin: 4px 0;
  color: #666;
  font-size: 14px;
}

.list-item .meta {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}

/* Empty state */
.no-data {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-style: italic;
}

/* Form styling */
.form-container {
  margin: 20px 0;
}

.form-container label {
  display: block;
  margin: 15px 0 5px;
  font-weight: 500;
  color: #333;
}

.form-container .field-help {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

/* Button group */
.button-group {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.button-group button {
  flex: 1;
}

/* Detail view */
.detail-container {
  margin: 20px 0;
}

.detail-container .field-group {
  margin-bottom: 15px;
}

.detail-container .field-label {
  font-weight: 500;
  color: #666;
  font-size: 12px;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.detail-container .field-value {
  color: #333;
}

/* Media previews */
.media-preview {
  max-width: 100%;
  margin: 10px 0;
  border-radius: 5px;
}

.media-preview img {
  max-width: 100%;
  height: auto;
  border-radius: 5px;
}

.media-preview audio,
.media-preview video {
  width: 100%;
}

/* Tags/Arrays */
.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
}

.tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 12px;
}

/* Checkbox styling */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin: 0;
}
`;
}

// ===== AUTH.TS GENERATOR =====

function generateAuthTs() {
  return `import {
  BrowserOAuthClient,
  OAuthSession,
} from '@atproto/oauth-client-browser';
import { Agent } from '@atproto/api';
import { atprotoLoopbackClientMetadata } from '@atproto/oauth-types';

// OAuth client and session state
let oauthClient: BrowserOAuthClient;
export let session: OAuthSession | null = null;

// User profile data interface
export interface UserProfile {
  displayName: string;
  handle: string;
  did: string;
}

// Session restoration result
export interface SessionRestoreResult {
  session: OAuthSession;
  state?: string;
}

/**
 * Initialize the OAuth client
 */
export async function initOAuthClient(): Promise<void> {
  oauthClient = new BrowserOAuthClient({
    handleResolver: 'https://bsky.social',
    clientMetadata: atprotoLoopbackClientMetadata(
      \`http://localhost?\${new URLSearchParams([
        ['redirect_uri', \`http://127.0.0.1:8080\`],
        ['scope', \`atproto transition:generic\`],
      ])}\`
    ),
  });
}

/**
 * Sign in with AT Protocol handle
 */
export async function signIn(handle: string): Promise<void> {
  if (!handle) {
    throw new Error('Handle is required');
  }

  await oauthClient.signIn(handle, {
    state: JSON.stringify({ returnTo: window.location.href }),
    signal: new AbortController().signal,
  });
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  if (session) {
    await oauthClient.revoke(session.sub);
  }
  session = null;
}

/**
 * Restore session from browser storage
 */
export async function restoreSession(): Promise<SessionRestoreResult | null> {
  const result = await oauthClient.init();

  if (result) {
    session = result.session;
    return {
      session: result.session,
      state: result.state ?? undefined,
    };
  }

  return null;
}

/**
 * Get the current user's profile information
 */
export async function getUserProfile(): Promise<UserProfile> {
  if (!session) {
    throw new Error('No active session');
  }

  const agent = new Agent(session);

  try {
    const profile = await agent.app.bsky.actor.getProfile({
      actor: session.sub,
    });

    return {
      displayName: profile.data.displayName ?? '',
      handle: profile.data.handle,
      did: session.sub,
    };
  } catch (error) {
    // Fallback for loopback mode
    return {
      displayName: '',
      handle: session.sub,
      did: session.sub,
    };
  }
}

/**
 * Get the current session
 */
export function getSession(): OAuthSession | null {
  return session;
}
`;
}

// ===== TYPES.TS GENERATOR =====

function generateTypesTs(recordTypes, domain) {
  let output = `/**
 * Shared type definitions for the app
 */

`;

  // Generate interface for each record type
  recordTypes.forEach(record => {
    const interfaceName = toPascalCase(record.name) + 'Data';

    output += `export interface ${interfaceName} {\n`;
    output += `  uri: string;\n`;
    output += `  cid: string;\n`;

    record.fields.forEach(field => {
      const tsType = getTypeScriptType(field);
      const optional = field.required ? '' : '?';
      output += `  ${field.name}${optional}: ${tsType};\n`;
    });

    output += `}\n\n`;
  });

  // Generate pagination and response types
  output += `export interface PaginationOptions {
  limit?: number;
  cursor?: string | null;
  reverse?: boolean;
}

export interface CreateRecordResponse {
  uri: string;
  cid: string;
  validationStatus?: string;
}

`;

  // Generate response types for each record
  recordTypes.forEach(record => {
    const pascalName = toPascalCase(record.name);
    output += `export interface ${pascalName}Response {
  ${toCamelCase(record.name)}s: ${pascalName}Data[];
  cursor: string | null;
  total: number;
}

`;
  });

  // Generate store type
  output += `export interface StoreType {\n`;
  recordTypes.forEach(record => {
    const pascalName = toPascalCase(record.name);
    output += `  ${toCamelCase(record.name)}s: ${pascalName}Data[];\n`;
  });
  output += `}\n`;

  return output;
}

function getTypeScriptType(field) {
  switch (field.type) {
    case 'string':
      return 'string';
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array-string':
      return 'string[]';
    case 'array-number':
      return 'number[]';
    case 'media-url':
      return 'string';
    case 'bytes':
      return 'Uint8Array';
    case 'cid-link':
      return 'string';
    case 'blob':
      return 'Blob';
    default:
      return 'unknown';
  }
}

// ===== STORE.TS GENERATOR =====

function generateStoreTs(recordTypes) {
  const imports = recordTypes.map(r => `${toPascalCase(r.name)}Data`).join(',\n  ');

  let output = `/**
 * Global store for app state
 */

import {
  StoreType,
  ${imports},
} from './types';

type StoreListener = (store: StoreType) => void;

class StoreManager {
  private store: StoreType;
  private listeners: Set<StoreListener> = new Set();

  constructor(store: StoreType) {
    this.store = store;
  }

`;

  // Generate setter for each record type
  recordTypes.forEach(record => {
    const pascalName = toPascalCase(record.name);
    const camelName = toCamelCase(record.name);
    output += `  set${pascalName}s(items: ${pascalName}Data[]): void {
    this.store.${camelName}s = items;
    this.notify();
  }

`;
  });

  output += `  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.store));
  }
}

// The raw store object
const Store: StoreType = {
`;

  recordTypes.forEach(record => {
    output += `  ${toCamelCase(record.name)}s: [],\n`;
  });

  output += `};

export const storeManager = new StoreManager(Store);
export default Store;
`;

  return output;
}

// ===== API.TS GENERATOR =====

function generateApiTs(recordTypes, domain) {
  let output = `import { OAuthSession } from '@atproto/oauth-client-browser';
import { Agent } from '@atproto/api';
import { session } from './Auth';
import {
  PaginationOptions,
  CreateRecordResponse,
`;

  recordTypes.forEach(record => {
    const pascalName = toPascalCase(record.name);
    output += `  ${pascalName}Data,\n`;
    output += `  ${pascalName}Response,\n`;
  });

  output += `} from './types';

// Helper: Validate session exists
function ensureSession(): OAuthSession {
  if (!session) {
    throw new Error('User not logged in. Please sign in first.');
  }
  return session;
}

// Helper: Create agent instance
function createAgent(): Agent {
  return new Agent(ensureSession());
}

`;

  // Generate CRUD functions for each record type
  recordTypes.forEach(record => {
    const pascalName = toPascalCase(record.name);
    const camelName = toCamelCase(record.name);
    const nsid = generateNSID(domain, record.name);

    // CREATE function
    output += `/**
 * Create a new ${record.name} record
 */
export async function create${pascalName}(data: Omit<${pascalName}Data, 'uri' | 'cid'>): Promise<CreateRecordResponse> {
  const record: Record<string, unknown> = {
    $type: '${nsid}',
    ...data,
  };

  const agent = createAgent();
  const response = await agent.com.atproto.repo.createRecord({
    repo: session!.sub,
    collection: '${nsid}',
    record: record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
    validationStatus: response.data.validationStatus,
  };
}

`;

    // UPDATE function
    output += `/**
 * Update an existing ${record.name} record
 */
export async function update${pascalName}(uri: string, data: Omit<${pascalName}Data, 'uri' | 'cid'>): Promise<CreateRecordResponse> {
  const uriParts = uri.split('/');
  const rkey = uriParts[uriParts.length - 1];

  const record: Record<string, unknown> = {
    $type: '${nsid}',
    ...data,
  };

  const agent = createAgent();
  const response = await agent.com.atproto.repo.putRecord({
    repo: session!.sub,
    collection: '${nsid}',
    rkey: rkey,
    record: record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
    validationStatus: response.data.validationStatus,
  };
}

`;

    // DELETE function
    output += `/**
 * Delete a ${record.name} record
 */
export async function delete${pascalName}(uri: string): Promise<void> {
  const uriParts = uri.split('/');
  const rkey = uriParts[uriParts.length - 1];

  const agent = createAgent();
  await agent.com.atproto.repo.deleteRecord({
    repo: session!.sub,
    collection: '${nsid}',
    rkey: rkey,
  });
}

`;

    // GET ALL function
    output += `/**
 * Retrieve all ${record.name} records
 */
export async function get${pascalName}s(options: PaginationOptions = {}): Promise<${pascalName}Response> {
  const { limit = 50, cursor = null, reverse = false } = options;

  if (limit < 1 || limit > 100) {
    throw new Error('limit must be between 1 and 100');
  }

  ensureSession();
  const agent = createAgent();

  const queryParams = {
    repo: session!.sub,
    collection: '${nsid}',
    limit: limit,
    reverse: reverse,
    ...(cursor && { cursor }),
  };

  const response = await agent.com.atproto.repo.listRecords(queryParams);

  return {
    ${camelName}s: response.data.records.map((record) => ({
      uri: record.uri,
      cid: record.cid,
`;

    record.fields.forEach(field => {
      const defaultValue = field.type.startsWith('array') ? '[]' : 'null';
      if (field.required) {
        output += `      ${field.name}: (record.value as Record<string, unknown>).${field.name} as ${getTypeScriptType(field)},\n`;
      } else {
        output += `      ${field.name}: ((record.value as Record<string, unknown>).${field.name} as ${getTypeScriptType(field)}) || ${defaultValue},\n`;
      }
    });

    output += `    })),
    cursor: response.data.cursor || null,
    total: response.data.records.length,
  };
}

`;
  });

  return output;
}

// ===== UI STATE.TS GENERATOR =====

function generateUIStateTs() {
  return `/**
 * UI State helpers for managing screen visibility
 */

export function showLoadingScreen(): void {
  document.getElementById('loadingSection')!.classList.add('active');
  document.getElementById('loginSection')!.classList.remove('active');
  document.getElementById('appSection')!.classList.remove('active');
}

export function showLoginScreen(): void {
  document.getElementById('loadingSection')!.classList.remove('active');
  document.getElementById('loginSection')!.classList.add('active');
  document.getElementById('appSection')!.classList.remove('active');
}

export function showAppScreen(): void {
  document.getElementById('loadingSection')!.classList.remove('active');
  document.getElementById('loginSection')!.classList.remove('active');
  document.getElementById('appSection')!.classList.add('active');
}

export function showStatus(elementId: string, message: string, isError: boolean = false): void {
  const statusEl = document.getElementById(elementId) as HTMLElement;
  statusEl.textContent = message;
  statusEl.style.display = 'block';

  if (isError) {
    statusEl.classList.add('error');
  } else {
    statusEl.classList.remove('error');
  }
}
`;
}

// ===== UI COMPONENTS.TS GENERATOR =====

function generateUIComponentsTs() {
  return `/**
 * UI Component helpers
 */

export function createButton(
  label: string,
  variant: 'primary' | 'secondary' | 'danger',
  onClick: () => void
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (variant !== 'primary') {
    button.className = variant;
  }
  button.addEventListener('click', onClick);
  return button;
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return date.toLocaleDateString('en-US', options);
}

export function clearContainer(container: HTMLElement): void {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

export function createMediaPreview(url: string, mediaType: string): HTMLElement {
  const container = document.createElement('div');
  container.className = 'media-preview';

  if (mediaType === 'image') {
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Image preview';
    img.onerror = () => {
      container.innerHTML = '<p style="color: #999;">Unable to load image</p>';
    };
    container.appendChild(img);
  } else if (mediaType === 'audio') {
    const audio = document.createElement('audio');
    audio.src = url;
    audio.controls = true;
    container.appendChild(audio);
  } else if (mediaType === 'video') {
    const video = document.createElement('video');
    video.src = url;
    video.controls = true;
    container.appendChild(video);
  } else {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.textContent = url;
    container.appendChild(link);
  }

  return container;
}

export function createTagsDisplay(tags: string[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'tags-container';

  tags.forEach(tag => {
    const tagEl = document.createElement('span');
    tagEl.className = 'tag';
    tagEl.textContent = tag;
    container.appendChild(tagEl);
  });

  return container;
}
`;
}

// ===== NAVIGATION.TS GENERATOR =====

function generateNavigationTs(recordTypes, appConfig) {
  const primaryRecord = recordTypes.find(r => r.name === appConfig.primaryRecordType) || recordTypes[0];
  const pascalName = toPascalCase(primaryRecord.name);
  const camelName = toCamelCase(primaryRecord.name);

  return `/**
 * Navigation manager for handling view transitions
 */

import Store from './Store';
import { renderListView } from './views/ListView';
import { renderDetailView } from './views/DetailView';
import { renderFormView } from './views/FormView';

export class NavigationManager {
  constructor() {}

  private activateView(viewId: string): void {
    const views = ['mainMenuView', 'listView', 'detailView', 'formView'];
    views.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });

    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add('active');
  }

  showMainMenu(): void {
    this.activateView('mainMenuView');
  }

  showList(): void {
    this.activateView('listView');

    const container = document.getElementById('listView');
    if (!container) return;

    renderListView(container, Store.${camelName}s, {
      onItemClick: (uri) => {
        const item = Store.${camelName}s.find(i => i.uri === uri);
        if (item) this.showDetail(item);
      },
      onBack: () => this.showMainMenu(),
      onCreate: () => this.showForm(null),
    });
  }

  showDetail(item: any): void {
    this.activateView('detailView');

    const container = document.getElementById('detailView');
    if (!container) return;

    renderDetailView(container, item, {
      onBack: () => this.showList(),
      onEdit: () => this.showForm(item),
      onDelete: () => this.showList(),
    });
  }

  showForm(item: any | null): void {
    this.activateView('formView');

    const container = document.getElementById('formView');
    if (!container) return;

    renderFormView(container, item, {
      onSave: () => this.showList(),
      onCancel: () => item ? this.showDetail(item) : this.showList(),
    });
  }
}
`;
}

// ===== SESSION MANAGER.TS GENERATOR =====

function generateSessionManagerTs(recordTypes) {
  let imports = recordTypes.map(r => `get${toPascalCase(r.name)}s`).join(', ');
  let setters = '';

  recordTypes.forEach(record => {
    const pascalName = toPascalCase(record.name);
    const camelName = toCamelCase(record.name);
    setters += `
    const ${camelName}sResponse = await get${pascalName}s();
    storeManager.set${pascalName}s(${camelName}sResponse.${camelName}s);
    console.log(\`Loaded \${${camelName}sResponse.${camelName}s.length} ${record.name}s\`);
`;
  });

  return `/**
 * Session management for user authentication and data loading
 */

import { ${imports} } from './API';
import { storeManager } from './Store';
import {
  restoreSession as restoreAuthSession,
  getUserProfile,
  getSession,
} from './Auth';

export async function updateUserInfo(): Promise<void> {
  try {
    const profile = await getUserProfile();

    const userDisplayNameEl = document.getElementById('userDisplayName') as HTMLElement;
    const userHandleEl = document.getElementById('userHandle') as HTMLElement;
    const userDidEl = document.getElementById('userDid') as HTMLElement;

    userDisplayNameEl.textContent = profile.displayName;
    userHandleEl.textContent = profile.handle;
    userDidEl.textContent = profile.did;
  } catch (error) {
    console.error('Failed to update user info:', error);
  }
}

export async function loadUserData(): Promise<void> {
  if (!getSession()) return;

  try {${setters}
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to load user data:', errorMsg);
  }
}

export async function restoreSession(): Promise<{
  session: { sub: string };
  state?: string;
} | null> {
  try {
    return await restoreAuthSession();
  } catch (error) {
    console.error('Session restoration error:', error);
    return null;
  }
}
`;
}

// ===== APP.TS GENERATOR =====

function generateAppTs(recordTypes, appConfig) {
  const primaryRecord = recordTypes.find(r => r.name === appConfig.primaryRecordType) || recordTypes[0];
  const pascalName = toPascalCase(primaryRecord.name);

  return `import Store from './services/Store';
import { NavigationManager } from './services/Navigation';
import { createButton } from './services/UIComponents';
import {
  showLoadingScreen,
  showLoginScreen,
  showAppScreen,
  showStatus,
} from './services/UIState';
import {
  restoreSession,
  updateUserInfo,
  loadUserData,
} from './services/SessionManager';
import {
  initOAuthClient,
  signIn,
  signOut,
} from './services/Auth';

declare global {
  interface Window {
    app: any;
  }
  var app: any;
}

window.app = {};
app.store = Store;

let navigationManager: NavigationManager;

initOAuthClient();

window.addEventListener('DOMContentLoaded', async () => {
  const queryParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.slice(1));

  const isOAuthCallback =
    queryParams.has('code') ||
    queryParams.has('error') ||
    hashParams.has('code') ||
    hashParams.has('error');

  if (isOAuthCallback) {
    showLoadingScreen();
  }

  await initializeApp();

  document.getElementById('loginForm')!.addEventListener('submit', async (e: Event) => {
    e.preventDefault();

    const handleInput = document.getElementById('handleInput') as HTMLInputElement;
    const handle = handleInput.value.trim();

    if (!handle) {
      showStatus('loginStatus', 'Please enter your handle', true);
      return;
    }

    try {
      showStatus('loginStatus', 'Redirecting to sign in...');
      await signIn(handle);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showStatus('loginStatus', \`Login failed: \${errorMsg}\`, true);
    }
  });

  document.getElementById('logoutButton')!.addEventListener('click', async () => {
    try {
      await signOut();
      showLoginScreen();
      showStatus('loginStatus', 'Signed out successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showStatus('appStatus', \`Logout failed: \${errorMsg}\`, true);
    }
  });
});

async function initializeApp(): Promise<void> {
  const result = await restoreSession();

  if (result) {
    showAppScreen();
    updateUserInfo();
    await loadUserData();
    initializeMainMenu();

    if (result.state) {
      console.log(\`\${result.session.sub} was successfully authenticated\`);
    } else {
      console.log(\`\${result.session.sub} was restored\`);
    }
  } else {
    showLoginScreen();
  }
}

function initializeMainMenu(): void {
  navigationManager = new NavigationManager();

  const menuContainer = document.getElementById('menuContainer');
  if (!menuContainer) return;

  menuContainer.innerHTML = '';

  const viewAllBtn = createButton('View All ${pascalName}s', 'primary', () => {
    navigationManager.showList();
  });

  const createNewBtn = createButton('Create New ${pascalName}', 'primary', () => {
    navigationManager.showForm(null);
  });

  menuContainer.appendChild(viewAllBtn);
  menuContainer.appendChild(createNewBtn);
}
`;
}

// ===== LIST VIEW GENERATOR =====

function generateListViewTs(recordTypes, appConfig) {
  const primaryRecord = recordTypes.find(r => r.name === appConfig.primaryRecordType) || recordTypes[0];
  const pascalName = toPascalCase(primaryRecord.name);
  const displayFields = appConfig.listDisplayFields || primaryRecord.fields.slice(0, 3).map(f => f.name);

  let fieldDisplay = '';
  displayFields.forEach(fieldName => {
    const field = primaryRecord.fields.find(f => f.name === fieldName);
    if (field) {
      if (field.type === 'array-string' || field.type === 'array-number') {
        fieldDisplay += `
      if (item.${fieldName} && item.${fieldName}.length > 0) {
        const tagContainer = document.createElement('div');
        tagContainer.className = 'tags-container';
        item.${fieldName}.slice(0, 3).forEach((val: any) => {
          const tag = document.createElement('span');
          tag.className = 'tag';
          tag.textContent = String(val);
          tagContainer.appendChild(tag);
        });
        if (item.${fieldName}.length > 3) {
          const more = document.createElement('span');
          more.className = 'tag';
          more.textContent = \`+\${item.${fieldName}.length - 3} more\`;
          tagContainer.appendChild(more);
        }
        listItem.appendChild(tagContainer);
      }
`;
      } else if (field.type === 'boolean') {
        fieldDisplay += `
      const ${fieldName}P = document.createElement('p');
      ${fieldName}P.textContent = item.${fieldName} ? '${fieldName}: Yes' : '${fieldName}: No';
      listItem.appendChild(${fieldName}P);
`;
      } else {
        fieldDisplay += `
      if (item.${fieldName}) {
        const ${fieldName}P = document.createElement('p');
        ${fieldName}P.textContent = String(item.${fieldName});
        listItem.appendChild(${fieldName}P);
      }
`;
      }
    }
  });

  return `/**
 * List View - displays all ${primaryRecord.name} records
 */

import { ${pascalName}Data } from './types';
import { createButton, clearContainer, formatDate } from './UIComponents';

interface ListViewCallbacks {
  onItemClick: (uri: string) => void;
  onBack: () => void;
  onCreate: () => void;
}

export function renderListView(
  container: HTMLElement,
  items: ${pascalName}Data[],
  callbacks: ListViewCallbacks
): void {
  clearContainer(container);

  const header = document.createElement('h2');
  header.textContent = 'All ${pascalName}s';
  container.appendChild(header);

  if (items.length === 0) {
    const noData = document.createElement('p');
    noData.className = 'no-data';
    noData.textContent = 'No ${primaryRecord.name}s yet. Create your first one!';
    container.appendChild(noData);
  } else {
    const listContainer = document.createElement('div');
    listContainer.className = 'list-container';

    items.forEach((item) => {
      const listItem = document.createElement('div');
      listItem.className = 'list-item';
      listItem.addEventListener('click', () => callbacks.onItemClick(item.uri));

${fieldDisplay}

      listContainer.appendChild(listItem);
    });

    container.appendChild(listContainer);
  }

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';
  buttonGroup.appendChild(createButton('Create New', 'primary', callbacks.onCreate));
  buttonGroup.appendChild(createButton('Back', 'secondary', callbacks.onBack));
  container.appendChild(buttonGroup);
}
`;
}

// ===== DETAIL VIEW GENERATOR =====

function generateDetailViewTs(recordTypes, appConfig) {
  const primaryRecord = recordTypes.find(r => r.name === appConfig.primaryRecordType) || recordTypes[0];
  const pascalName = toPascalCase(primaryRecord.name);
  const camelName = toCamelCase(primaryRecord.name);
  const nsid = appConfig.domain ? generateNSID(appConfig.domain, primaryRecord.name) : '';

  let fieldDisplay = '';
  primaryRecord.fields.forEach(field => {
    if (field.type === 'media-url') {
      fieldDisplay += `
  if (item.${field.name}) {
    const ${field.name}Group = document.createElement('div');
    ${field.name}Group.className = 'field-group';
    const ${field.name}Label = document.createElement('div');
    ${field.name}Label.className = 'field-label';
    ${field.name}Label.textContent = '${field.name}';
    ${field.name}Group.appendChild(${field.name}Label);
    ${field.name}Group.appendChild(createMediaPreview(item.${field.name}, '${field.mediaType || 'image'}'));
    detailContainer.appendChild(${field.name}Group);
  }
`;
    } else if (field.type === 'array-string' || field.type === 'array-number') {
      fieldDisplay += `
  if (item.${field.name} && item.${field.name}.length > 0) {
    const ${field.name}Group = document.createElement('div');
    ${field.name}Group.className = 'field-group';
    const ${field.name}Label = document.createElement('div');
    ${field.name}Label.className = 'field-label';
    ${field.name}Label.textContent = '${field.name}';
    ${field.name}Group.appendChild(${field.name}Label);
    ${field.name}Group.appendChild(createTagsDisplay(item.${field.name}.map(String)));
    detailContainer.appendChild(${field.name}Group);
  }
`;
    } else if (field.type === 'boolean') {
      fieldDisplay += `
  {
    const ${field.name}Group = document.createElement('div');
    ${field.name}Group.className = 'field-group';
    const ${field.name}Label = document.createElement('div');
    ${field.name}Label.className = 'field-label';
    ${field.name}Label.textContent = '${field.name}';
    ${field.name}Group.appendChild(${field.name}Label);
    const ${field.name}Value = document.createElement('div');
    ${field.name}Value.className = 'field-value';
    ${field.name}Value.textContent = item.${field.name} ? 'Yes' : 'No';
    ${field.name}Group.appendChild(${field.name}Value);
    detailContainer.appendChild(${field.name}Group);
  }
`;
    } else {
      fieldDisplay += `
  if (item.${field.name}) {
    const ${field.name}Group = document.createElement('div');
    ${field.name}Group.className = 'field-group';
    const ${field.name}Label = document.createElement('div');
    ${field.name}Label.className = 'field-label';
    ${field.name}Label.textContent = '${field.name}';
    ${field.name}Group.appendChild(${field.name}Label);
    const ${field.name}Value = document.createElement('div');
    ${field.name}Value.className = 'field-value';
    ${field.name}Value.textContent = String(item.${field.name});
    ${field.name}Group.appendChild(${field.name}Value);
    detailContainer.appendChild(${field.name}Group);
  }
`;
    }
  });

  return `/**
 * Detail View - displays a single ${primaryRecord.name} record
 */

import { ${pascalName}Data } from './types';
import { delete${pascalName} } from './API';
import { storeManager } from './Store';
import { createButton, clearContainer, formatDate, createMediaPreview, createTagsDisplay } from './UIComponents';

interface DetailViewCallbacks {
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function renderDetailView(
  container: HTMLElement,
  item: ${pascalName}Data,
  callbacks: DetailViewCallbacks
): void {
  clearContainer(container);

  const header = document.createElement('h2');
  header.textContent = '${pascalName} Details';
  container.appendChild(header);

  const detailContainer = document.createElement('div');
  detailContainer.className = 'detail-container';

${fieldDisplay}

  container.appendChild(detailContainer);

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';
  buttonGroup.appendChild(createButton('Edit', 'primary', callbacks.onEdit));
  buttonGroup.appendChild(createButton('Delete', 'danger', async () => {
    if (confirm('Are you sure you want to delete this ${primaryRecord.name}?')) {
      try {
        await delete${pascalName}(item.uri);
        // Refresh the store
        const { get${pascalName}s } = await import('./API');
        const response = await get${pascalName}s();
        storeManager.set${pascalName}s(response.${camelName}s);
        callbacks.onDelete();
      } catch (error) {
        alert('Failed to delete: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  }));
  buttonGroup.appendChild(createButton('Back', 'secondary', callbacks.onBack));
  container.appendChild(buttonGroup);
}
`;
}

// ===== FORM VIEW GENERATOR =====

function generateFormViewTs(recordTypes, appConfig) {
  const primaryRecord = recordTypes.find(r => r.name === appConfig.primaryRecordType) || recordTypes[0];
  const pascalName = toPascalCase(primaryRecord.name);
  const camelName = toCamelCase(primaryRecord.name);

  let formFields = '';
  let collectData = '';

  primaryRecord.fields.forEach(field => {
    const required = field.required ? 'required' : '';
    const requiredLabel = field.required ? ' *' : '';

    if (field.type === 'boolean') {
      formFields += `
  const ${field.name}Label = document.createElement('label');
  ${field.name}Label.className = 'checkbox-label';
  const ${field.name}Input = document.createElement('input');
  ${field.name}Input.type = 'checkbox';
  ${field.name}Input.id = '${field.name}';
  ${field.name}Input.checked = item?.${field.name} || false;
  ${field.name}Label.appendChild(${field.name}Input);
  ${field.name}Label.appendChild(document.createTextNode(' ${field.name}'));
  form.appendChild(${field.name}Label);
`;
      collectData += `    ${field.name}: (document.getElementById('${field.name}') as HTMLInputElement).checked,\n`;
    } else if (field.type === 'integer') {
      formFields += `
  const ${field.name}Label = document.createElement('label');
  ${field.name}Label.textContent = '${field.name}${requiredLabel}';
  form.appendChild(${field.name}Label);
  const ${field.name}Input = document.createElement('input');
  ${field.name}Input.type = 'number';
  ${field.name}Input.id = '${field.name}';
  ${field.name}Input.value = item?.${field.name}?.toString() || '';
  ${field.name}Input.${required ? 'required = true' : ''};
  form.appendChild(${field.name}Input);
`;
      collectData += `    ${field.name}: parseInt((document.getElementById('${field.name}') as HTMLInputElement).value) || 0,\n`;
    } else if (field.type === 'array-string') {
      formFields += `
  const ${field.name}Label = document.createElement('label');
  ${field.name}Label.textContent = '${field.name}${requiredLabel} (comma-separated)';
  form.appendChild(${field.name}Label);
  const ${field.name}Input = document.createElement('input');
  ${field.name}Input.type = 'text';
  ${field.name}Input.id = '${field.name}';
  ${field.name}Input.value = item?.${field.name}?.join(', ') || '';
  ${field.name}Input.placeholder = 'item1, item2, item3';
  form.appendChild(${field.name}Input);
`;
      collectData += `    ${field.name}: (document.getElementById('${field.name}') as HTMLInputElement).value.split(',').map(s => s.trim()).filter(s => s),\n`;
    } else if (field.type === 'array-number') {
      formFields += `
  const ${field.name}Label = document.createElement('label');
  ${field.name}Label.textContent = '${field.name}${requiredLabel} (comma-separated numbers)';
  form.appendChild(${field.name}Label);
  const ${field.name}Input = document.createElement('input');
  ${field.name}Input.type = 'text';
  ${field.name}Input.id = '${field.name}';
  ${field.name}Input.value = item?.${field.name}?.join(', ') || '';
  ${field.name}Input.placeholder = '1, 2, 3';
  form.appendChild(${field.name}Input);
`;
      collectData += `    ${field.name}: (document.getElementById('${field.name}') as HTMLInputElement).value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),\n`;
    } else {
      // String, media-url, etc.
      const inputType = field.format === 'datetime' ? 'datetime-local' : 'text';
      const placeholder = field.type === 'media-url' ? `https://example.com/${field.mediaType || 'file'}` : '';

      formFields += `
  const ${field.name}Label = document.createElement('label');
  ${field.name}Label.textContent = '${field.name}${requiredLabel}';
  form.appendChild(${field.name}Label);
  const ${field.name}Input = document.createElement('input');
  ${field.name}Input.type = '${inputType}';
  ${field.name}Input.id = '${field.name}';
  ${field.name}Input.value = item?.${field.name} || '';
  ${placeholder ? `${field.name}Input.placeholder = '${placeholder}';` : ''}
  ${field.required ? `${field.name}Input.required = true;` : ''}
  form.appendChild(${field.name}Input);
`;
      collectData += `    ${field.name}: (document.getElementById('${field.name}') as HTMLInputElement).value,\n`;
    }
  });

  return `/**
 * Form View - create/edit ${primaryRecord.name} records
 */

import { ${pascalName}Data } from './types';
import { create${pascalName}, update${pascalName}, get${pascalName}s } from './API';
import { storeManager } from './Store';
import { createButton, clearContainer } from './UIComponents';

interface FormViewCallbacks {
  onSave: () => void;
  onCancel: () => void;
}

export function renderFormView(
  container: HTMLElement,
  item: ${pascalName}Data | null,
  callbacks: FormViewCallbacks
): void {
  clearContainer(container);

  const isEdit = item !== null;

  const header = document.createElement('h2');
  header.textContent = isEdit ? 'Edit ${pascalName}' : 'Create ${pascalName}';
  container.appendChild(header);

  const form = document.createElement('div');
  form.className = 'form-container';

${formFields}

  container.appendChild(form);

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';

  buttonGroup.appendChild(createButton('Save', 'primary', async () => {
    try {
      const data = {
${collectData}      };

      if (isEdit) {
        await update${pascalName}(item.uri, data as any);
      } else {
        await create${pascalName}(data as any);
      }

      // Refresh the store
      const response = await get${pascalName}s();
      storeManager.set${pascalName}s(response.${camelName}s);

      callbacks.onSave();
    } catch (error) {
      alert('Failed to save: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }));

  buttonGroup.appendChild(createButton('Cancel', 'secondary', callbacks.onCancel));
  container.appendChild(buttonGroup);
}
`;
}

// ===== MAIN GENERATOR FUNCTION =====

function generateAllFiles(wizardState, appConfig) {
  const files = {};
  const { appInfo, recordTypes } = wizardState;
  const domain = appInfo.domain;

  // Root files
  files['package.json'] = generatePackageJson(appInfo);
  files['vite.config.ts'] = generateViteConfig();
  files['tsconfig.json'] = generateTsConfig();
  files['index.html'] = generateIndexHtml(appInfo, recordTypes, appConfig);
  files['styles.css'] = generateStyles();
  files['app.ts'] = generateAppTs(recordTypes, appConfig);

  // Services
  files['services/Auth.ts'] = generateAuthTs();
  files['services/types.ts'] = generateTypesTs(recordTypes, domain);
  files['services/Store.ts'] = generateStoreTs(recordTypes);
  files['services/API.ts'] = generateApiTs(recordTypes, domain);
  files['services/UIState.ts'] = generateUIStateTs();
  files['services/UIComponents.ts'] = generateUIComponentsTs();
  files['services/Navigation.ts'] = generateNavigationTs(recordTypes, appConfig);
  files['services/SessionManager.ts'] = generateSessionManagerTs(recordTypes);

  // Views
  files['services/views/ListView.ts'] = generateListViewTs(recordTypes, appConfig);
  files['services/views/DetailView.ts'] = generateDetailViewTs(recordTypes, appConfig);
  files['services/views/FormView.ts'] = generateFormViewTs(recordTypes, appConfig);

  // Lexicons
  recordTypes.forEach(record => {
    const nsid = generateNSID(domain, record.name);
    const lexicon = generateRecordLexicon(record, domain);
    files[`lexicons/${nsid.replace(/\./g, '/')}.json`] = JSON.stringify(lexicon, null, 2);
  });

  // README
  files['README.md'] = generateReadme(appInfo, recordTypes, domain);

  return files;
}

function generateRecordLexicon(recordType, domain) {
  const nsid = generateNSID(domain, recordType.name);

  const properties = {};
  const required = [];

  recordType.fields.forEach(field => {
    let fieldSchema;

    if (field.type === 'array-string') {
      fieldSchema = {
        type: 'array',
        items: { type: 'string' },
        ...(field.description && { description: field.description })
      };
    } else if (field.type === 'array-number') {
      fieldSchema = {
        type: 'array',
        items: { type: 'integer' },
        ...(field.description && { description: field.description })
      };
    } else if (field.type === 'media-url') {
      fieldSchema = {
        type: 'string',
        format: 'uri',
        ...(field.description && { description: field.description + ` (${field.mediaType || 'media'} URL)` })
      };
    } else {
      fieldSchema = {
        type: field.type,
        ...(field.format && { format: field.format }),
        ...(field.maxLength && { maxLength: field.maxLength }),
        ...(field.description && { description: field.description })
      };
    }

    properties[field.name] = fieldSchema;

    if (field.required) {
      required.push(field.name);
    }
  });

  return {
    lexicon: 1,
    id: nsid,
    defs: {
      main: {
        type: "record",
        description: recordType.description || `${recordType.name} record`,
        key: "tid",
        record: {
          type: "object",
          required: required,
          properties: properties
        }
      }
    }
  };
}

function generateReadme(appInfo, recordTypes, domain) {
  return `# ${appInfo.appName}

${appInfo.description || 'An AT Protocol application'}

## Author
${appInfo.authorName || 'Unknown'}

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

3. Open http://localhost:8080 in your browser

4. Sign in with your AT Protocol handle (e.g., yourname.bsky.social)

## Record Types

${recordTypes.map(r => `### ${r.name}
${r.description || 'No description'}

**Fields:**
${r.fields.map(f => `- \`${f.name}\` (${f.type})${f.required ? ' - Required' : ''}`).join('\n')}
`).join('\n')}

## Building for Production

\`\`\`bash
npm run build
\`\`\`

The built files will be in the \`dist/\` directory.

---

Generated with the AT Protocol App Builder
`;
}

// Export for use in app.js
window.AppGenerator = {
  generateAllFiles,
  toPascalCase,
  toCamelCase,
  generateNSID
};
