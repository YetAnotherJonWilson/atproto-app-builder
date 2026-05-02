/**
 * Checklist component generator
 *
 * Emits a single self-contained TypeScript module per assigned checklist
 * component. The generated module exports a `render<Pascal>(container)`
 * function that owns the full lifecycle (fetch, render, add, toggle,
 * delete) for one record type, using the configured `labelField` and
 * `checkedField`.
 *
 * Also exports the default-pick convention helper used both at quick-create
 * time (in the components panel) and at generation time, plus a resolution
 * helper that classifies a (component, recordType) pair as either
 * generatable or fall-through-to-placeholder with a reason.
 */

import type { Component, ChecklistConfig, Field, RecordType } from '../../types/wizard';
import { toPascalCase, toCamelCase } from '../../utils';

// ── Default-pick convention ───────────────────────────────────────────

/**
 * Pick the default label field for a checklist bound to `recordType`.
 * Prefers the first non-system, required string field, then the first
 * non-system string field, then nothing.
 */
export function pickDefaultLabelField(recordType: RecordType): string | null {
  const stringFields = recordType.fields.filter(
    (f) => f.type === 'string' && !f.isSystem,
  );
  const requiredFirst = stringFields.find((f) => f.required);
  if (requiredFirst) return requiredFirst.name;
  if (stringFields.length > 0) return stringFields[0].name;
  return null;
}

/**
 * Pick the default checked field — first boolean field on the record type.
 */
export function pickDefaultCheckedField(recordType: RecordType): string | null {
  const boolField = recordType.fields.find((f) => f.type === 'boolean');
  return boolField ? boolField.name : null;
}

/**
 * Compute the convention-based default config for a record type. Returns
 * null when either field cannot be picked (the type is incompatible).
 */
export function pickDefaultChecklistConfig(
  recordType: RecordType,
): ChecklistConfig | null {
  const labelField = pickDefaultLabelField(recordType);
  const checkedField = pickDefaultCheckedField(recordType);
  if (!labelField || !checkedField) return null;
  return { labelField, checkedField };
}

// ── Resolution ────────────────────────────────────────────────────────

export type ChecklistResolution =
  | { kind: 'ok'; config: ChecklistConfig; recordType: RecordType }
  | { kind: 'missing-fields'; recordType: RecordType }
  | { kind: 'stale-label'; staleField: string; recordType: RecordType }
  | { kind: 'stale-checked'; staleField: string; recordType: RecordType };

/**
 * Classify whether a checklist component can be generated against the
 * given record type. Stale-config errors take precedence over
 * missing-fields when the config explicitly references a removed field.
 */
export function resolveChecklistConfig(
  component: Component,
  recordType: RecordType,
): ChecklistResolution {
  const stringFields = recordType.fields.filter(
    (f) => f.type === 'string' && !f.isSystem,
  );
  const boolFields = recordType.fields.filter((f) => f.type === 'boolean');

  // If the record type structurally lacks the field types required, we
  // can never resolve regardless of explicit config.
  if (stringFields.length === 0 || boolFields.length === 0) {
    return { kind: 'missing-fields', recordType };
  }

  const cfg = component.checklistConfig;

  if (cfg) {
    const labelExists = recordType.fields.some(
      (f) => f.name === cfg.labelField && f.type === 'string' && !f.isSystem,
    );
    if (!labelExists) {
      return { kind: 'stale-label', staleField: cfg.labelField, recordType };
    }
    const checkedExists = recordType.fields.some(
      (f) => f.name === cfg.checkedField && f.type === 'boolean',
    );
    if (!checkedExists) {
      return { kind: 'stale-checked', staleField: cfg.checkedField, recordType };
    }
    return { kind: 'ok', config: cfg, recordType };
  }

  // No explicit config — fall back to convention.
  const fallback = pickDefaultChecklistConfig(recordType);
  if (!fallback) {
    return { kind: 'missing-fields', recordType };
  }
  return { kind: 'ok', config: fallback, recordType };
}

/**
 * Build the human-readable placeholder message for an unresolvable
 * checklist component. Mirrors the strings the components panel shows
 * inline on the card.
 */
export function describeChecklistFailure(
  resolution: Exclude<ChecklistResolution, { kind: 'ok' }>,
): string {
  const rtLabel = resolution.recordType.displayName || resolution.recordType.name;
  switch (resolution.kind) {
    case 'missing-fields':
      return `Checklist needs a string field and a boolean field on \`${rtLabel}\`.`;
    case 'stale-label':
      return `Checklist label field \`${resolution.staleField}\` no longer exists on \`${rtLabel}\`.`;
    case 'stale-checked':
      return `Checklist checked field \`${resolution.staleField}\` no longer exists on \`${rtLabel}\`.`;
  }
}

// ── File generation ───────────────────────────────────────────────────

/**
 * Generate the contents of `src/components/<PascalName>.ts` for one
 * checklist component. Caller is responsible for confirming that
 * `resolveChecklistConfig` returned `kind: 'ok'`.
 */
export function generateChecklistComponent(
  component: Component,
  recordType: RecordType,
  config: ChecklistConfig,
  functionName: string,
): string {
  const recordPascal = toPascalCase(recordType.name);
  const recordCamel = toCamelCase(recordType.name);
  const listKey = `${recordCamel}s`;
  const dataType = `${recordPascal}Data`;

  const hasCreatedAt = recordType.fields.some(
    (f) => f.name === 'createdAt',
  );

  // Build the create payload object literal. Only required fields and
  // our two managed fields go in; other optional fields are left undefined
  // (the runtime widget treats new items as label-only entries).
  const createPayloadFields: string[] = [
    `[LABEL_FIELD]: trimmed`,
    `[CHECKED_FIELD]: false`,
  ];
  if (hasCreatedAt) {
    createPayloadFields.push(`createdAt: new Date().toISOString()`);
  }
  // Required fields other than the label/checked/createdAt — fill with
  // a benign default so createRecord does not validation-fail. A first-
  // class story for "extra required fields on a checklist record type"
  // is out of scope; the spec assumes the record type was designed for
  // this widget.
  for (const f of recordType.fields) {
    if (f.isSystem) continue;
    if (f.name === config.labelField) continue;
    if (f.name === config.checkedField) continue;
    if (f.name === 'createdAt') continue;
    if (!f.required) continue;
    createPayloadFields.push(`${f.name}: ${defaultLiteralFor(f)}`);
  }

  const createPayloadLines = createPayloadFields
    .map((line) =>
      line
        .replace('[LABEL_FIELD]', config.labelField)
        .replace('[CHECKED_FIELD]', config.checkedField),
    )
    .map((line) => `      ${line},`)
    .join('\n');

  // Sort behavior in the renderer
  const sortBlock = hasCreatedAt
    ? `items = items.slice().sort((a, b) => {
      const at = (a as Record<string, unknown>).createdAt as string | undefined;
      const bt = (b as Record<string, unknown>).createdAt as string | undefined;
      if (!at && !bt) return 0;
      if (!at) return 1;
      if (!bt) return -1;
      return bt.localeCompare(at);
    });`
    : `// listRecords ordering preserved`;

  return `/**
 * Checklist component — ${component.name}
 *
 * Bound record type: ${recordType.name}
 * Label field:   ${config.labelField}
 * Checked field: ${config.checkedField}
 */

import { create${recordPascal}, update${recordPascal}, delete${recordPascal}, get${recordPascal}s } from '../atproto/api';
import type { ${dataType} } from '../atproto/types';

const LABEL_FIELD = '${config.labelField}' as const;
const CHECKED_FIELD = '${config.checkedField}' as const;

export function ${functionName}(container: HTMLElement): void {
  container.classList.add('checklist');

  const inputRow = document.createElement('div');
  inputRow.className = 'checklist-input-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Add an item…';
  input.className = 'checklist-input';
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'checklist-add-btn';
  addBtn.textContent = 'Add';
  inputRow.appendChild(input);
  inputRow.appendChild(addBtn);

  const addError = document.createElement('div');
  addError.className = 'checklist-error checklist-add-error';
  addError.style.display = 'none';

  const body = document.createElement('div');
  body.className = 'checklist-body';

  container.appendChild(inputRow);
  container.appendChild(addError);
  container.appendChild(body);

  let items: ${dataType}[] = [];
  // Per-item update generation counters keyed by uri.
  const updateGen = new Map<string, number>();

  function showAddError(message: string | null): void {
    if (!message) {
      addError.textContent = '';
      addError.style.display = 'none';
      return;
    }
    addError.textContent = 'Failed to add: ' + message;
    addError.style.display = '';
  }

  function renderEmpty(): void {
    body.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'checklist-empty';
    empty.textContent = 'No items yet. Add your first one above.';
    body.appendChild(empty);
  }

  function renderList(): void {
    body.innerHTML = '';
    if (items.length === 0) {
      renderEmpty();
      return;
    }
    const ul = document.createElement('ul');
    ul.className = 'checklist-list';
    for (const item of items) {
      ul.appendChild(renderItem(item));
    }
    body.appendChild(ul);
  }

  function renderItem(item: ${dataType}): HTMLElement {
    const li = document.createElement('li');
    li.className = 'checklist-item';
    li.dataset.uri = item.uri;
    const value = (item as unknown as Record<string, unknown>);
    const label = String(value[LABEL_FIELD] ?? '');
    const checked = Boolean(value[CHECKED_FIELD]);
    if (checked) li.classList.add('checklist-item-checked');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.addEventListener('change', () => onToggle(item, li, checkbox));

    const labelEl = document.createElement('span');
    labelEl.className = 'checklist-item-label';
    labelEl.textContent = label;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'checklist-delete-btn';
    delBtn.setAttribute('aria-label', 'Delete');
    delBtn.textContent = '\\u00d7';
    delBtn.addEventListener('click', () => onDelete(item, li));

    const errorEl = document.createElement('span');
    errorEl.className = 'checklist-error checklist-item-error';
    errorEl.style.display = 'none';

    li.appendChild(checkbox);
    li.appendChild(labelEl);
    li.appendChild(delBtn);
    li.appendChild(errorEl);
    return li;
  }

  function showItemError(li: HTMLElement, message: string): void {
    const errorEl = li.querySelector('.checklist-item-error') as HTMLElement | null;
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.style.display = '';
    setTimeout(() => {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }, 3000);
  }

  function renderLoading(): void {
    body.innerHTML = '';
    const p = document.createElement('div');
    p.className = 'checklist-loading';
    p.textContent = 'Loading\\u2026';
    body.appendChild(p);
  }

  function renderLoadFailure(message: string): void {
    body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'checklist-error checklist-load-error';
    wrap.textContent = 'Failed to load: ' + message + ' ';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'checklist-retry-btn';
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => { void load(); });
    wrap.appendChild(retry);
    body.appendChild(wrap);
  }

  async function load(): Promise<void> {
    renderLoading();
    try {
      const resp = await get${recordPascal}s({ limit: 100 });
      items = resp.${listKey} as ${dataType}[];
      ${sortBlock}
      renderList();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      renderLoadFailure(message);
    }
  }

  async function onAdd(): Promise<void> {
    const trimmed = input.value.trim();
    if (!trimmed) return;
    showAddError(null);
    try {
      const resp = await create${recordPascal}({
${createPayloadLines}
      } as Omit<${dataType}, 'uri' | 'cid'>);
      const newItem = {
        uri: resp.uri,
        cid: resp.cid,
        ${config.labelField}: trimmed,
        ${config.checkedField}: false,
        ${hasCreatedAt ? `createdAt: new Date().toISOString(),` : ''}
      } as unknown as ${dataType};
      items = [newItem, ...items];
      input.value = '';
      renderList();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showAddError(message);
    }
  }

  async function onToggle(
    item: ${dataType},
    li: HTMLElement,
    checkbox: HTMLInputElement,
  ): Promise<void> {
    const newValue = checkbox.checked;
    const previous = !newValue;
    li.classList.toggle('checklist-item-checked', newValue);
    (item as unknown as Record<string, unknown>)[CHECKED_FIELD] = newValue;

    const gen = (updateGen.get(item.uri) ?? 0) + 1;
    updateGen.set(item.uri, gen);

    try {
      const payload = { ...(item as unknown as Record<string, unknown>) };
      delete payload.uri;
      delete payload.cid;
      payload[CHECKED_FIELD] = newValue;
      await update${recordPascal}(item.uri, payload as Omit<${dataType}, 'uri' | 'cid'>);
      // If a newer toggle happened in flight, ignore this resolution.
      if (updateGen.get(item.uri) !== gen) return;
    } catch (err) {
      // Stale handler — bail without touching UI.
      if (updateGen.get(item.uri) !== gen) return;
      checkbox.checked = previous;
      li.classList.toggle('checklist-item-checked', previous);
      (item as unknown as Record<string, unknown>)[CHECKED_FIELD] = previous;
      const message = err instanceof Error ? err.message : String(err);
      showItemError(li, 'Failed to update: ' + message);
    }
  }

  async function onDelete(item: ${dataType}, li: HTMLElement): Promise<void> {
    const idx = items.indexOf(item);
    if (idx < 0) return;
    items = items.filter((x) => x !== item);
    li.remove();
    if (items.length === 0) renderEmpty();
    try {
      await delete${recordPascal}(item.uri);
    } catch (err) {
      items = [...items.slice(0, idx), item, ...items.slice(idx)];
      renderList();
      const restored = body.querySelector(\`[data-uri="\${item.uri}"]\`) as HTMLElement | null;
      const message = err instanceof Error ? err.message : String(err);
      if (restored) showItemError(restored, 'Failed to delete: ' + message);
    }
  }

  addBtn.addEventListener('click', () => { void onAdd(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void onAdd();
    } else {
      showAddError(null);
    }
  });

  void load();
}
`;
}

// ── Helpers ───────────────────────────────────────────────────────────

function defaultLiteralFor(field: Field): string {
  switch (field.type) {
    case 'string':
      return `''`;
    case 'integer':
      return `0`;
    case 'boolean':
      return `false`;
    case 'array-string':
    case 'array-number':
      return `[]`;
    default:
      return `null as unknown as never`;
  }
}
