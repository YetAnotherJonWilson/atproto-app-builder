/**
 * CSS styles generator
 */

import inlayPrimitivesCss from '../../../styles/inlay-primitives.css?raw';

export function generateStyles(): string {
  return `:root {
  --color-bg: #f5f5f5;
  --color-surface: white;
  --color-surface-muted: #f9f9f9;
  --color-surface-subtle: #fafafa;
  --color-text: #333;
  --color-text-muted: #999;
  --color-accent: #0085ff;
  --color-accent-hover: #0066cc;
  --color-on-accent: white;
  --color-secondary: #666;
  --color-secondary-hover: #555;
  --color-danger: #dc3545;
  --color-danger-hover: #c82333;
  --color-info-bg: #e3f2fd;
  --color-info-text: #1976d2;
  --color-error-bg: #ffebee;
  --color-error-text: #c62828;
  --color-border: #ddd;
  --color-border-subtle: #e0e0e0;
  --color-border-strong: #ccc;
  --color-spinner-track: #f3f3f3;
  --color-shadow: rgba(0, 0, 0, 0.1);
  --radius-sm: 3px;
  --radius-md: 5px;
  --radius-lg: 8px;
  --radius-xl: 10px;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 600px;
  margin: 50px auto;
  padding: 20px;
  background: var(--color-bg);
}

.container {
  background: var(--color-surface);
  padding: 30px;
  border-radius: var(--radius-xl);
  box-shadow: 0 2px 10px var(--color-shadow);
}

h1 {
  color: var(--color-text);
  margin-bottom: 20px;
}

h2 {
  color: var(--color-text);
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
  border: 4px solid var(--color-spinner-track);
  border-top: 4px solid var(--color-accent);
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
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-sizing: border-box;
  font-family: inherit;
}

textarea {
  resize: vertical;
  min-height: 80px;
}

button {
  background: var(--color-accent);
  color: var(--color-on-accent);
  border: none;
  padding: 12px 24px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 16px;
  width: 100%;
  margin-top: 10px;
}

button:hover {
  background: var(--color-accent-hover);
}

button.secondary {
  background: var(--color-secondary);
}

button.secondary:hover {
  background: var(--color-secondary-hover);
}

button.danger {
  background: var(--color-danger);
}

button.danger:hover {
  background: var(--color-danger-hover);
}

.status {
  padding: 10px;
  margin: 10px 0;
  border-radius: var(--radius-md);
  background: var(--color-info-bg);
  color: var(--color-info-text);
}

.status.error {
  background: var(--color-error-bg);
  color: var(--color-error-text);
}

.user-info {
  padding: 15px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  margin: 15px 0;
}

/* App content area */
#appContent {
  margin: 20px 0;
}

/* Nav menu */
.nav-menu {
  display: flex;
  gap: 4px;
  padding: 8px;
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  margin-bottom: 20px;
}

.nav-menu-item {
  padding: 8px 16px;
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--color-text);
  font-weight: 500;
  transition: background 0.2s;
}

.nav-menu-item:hover {
  background: var(--color-border-subtle);
}

/* Component sections */
.app-component {
  margin-bottom: 16px;
}

/* Placeholder components */
.app-component-placeholder {
  border: 2px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
  padding: 20px;
  background: var(--color-surface-subtle);
}

.app-component-placeholder h3 {
  margin: 0 0 8px 0;
  color: var(--color-secondary);
  font-size: 16px;
}

.placeholder-type {
  display: inline-block;
  padding: 2px 8px;
  background: var(--color-info-bg);
  color: var(--color-info-text);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 8px;
}

.placeholder-requirements {
  margin: 0;
  padding-left: 20px;
  color: var(--color-text-muted);
  font-size: 14px;
}

.placeholder-requirements li {
  margin-bottom: 4px;
}

/* Empty view state */
.view-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-text-muted);
  font-style: italic;
}

/* Media previews */
.media-preview {
  max-width: 100%;
  margin: 10px 0;
  border-radius: var(--radius-md);
}

.media-preview img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md);
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
  background: var(--color-info-bg);
  color: var(--color-info-text);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

/* Checklist component */
.checklist-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.checklist-input-row input {
  flex: 1;
  margin: 0;
}

.checklist-add-btn {
  width: auto;
  margin: 0;
  padding: 10px 18px;
  flex-shrink: 0;
}

.checklist-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  margin-bottom: 6px;
}

.checklist-item input[type="checkbox"] {
  width: auto;
  margin: 0;
  flex-shrink: 0;
}

.checklist-item .checklist-item-label {
  flex: 1;
  color: var(--color-text);
}

.checklist-item-checked .checklist-item-label {
  text-decoration: line-through;
  opacity: 0.6;
}

.checklist-delete-btn {
  background: transparent;
  color: var(--color-text-muted);
  width: auto;
  margin: 0;
  padding: 4px 10px;
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
}

.checklist-delete-btn:hover {
  background: var(--color-error-bg);
  color: var(--color-error-text);
}

.checklist-empty {
  padding: 24px 12px;
  color: var(--color-text-muted);
  font-style: italic;
  text-align: center;
}

.checklist-error {
  color: var(--color-error-text);
  font-size: 13px;
  padding: 6px 0;
}

.checklist-item-error {
  margin-left: 8px;
  font-size: 12px;
}

.checklist-loading {
  color: var(--color-text-muted);
  padding: 12px;
  text-align: center;
}

.checklist-retry-btn {
  width: auto;
  margin: 0 0 0 8px;
  padding: 4px 12px;
  font-size: 13px;
}

${inlayPrimitivesCss}
`;
}
