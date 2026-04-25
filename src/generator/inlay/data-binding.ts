/**
 * Runtime data-binding codegen for attached Inlay templates.
 *
 * Emits a per-component `bindComponent<i>` function that the generated
 * view file calls after constructing the DOM. The function:
 *   1. Hydrates the bound record list from the existing generated
 *      `Api`/`Store` layer.
 *   2. Walks `[data-inlay-bind]` and `[data-inlay-bind-<attr>]` markers
 *      (and the literal `data-inlay-did` attribute the compile path
 *      emits for Avatar/Cover with a string `did` prop) and substitutes
 *      values from the first record.
 *   3. Toggles `<at-inlay-maybe>` branches to "fallback" when any
 *      binding inside the children branch resolves to missing.
 *
 * Special-cases `<img>`-host elements (org-atsui-avatar, org-atsui-cover):
 *   - `data-inlay-bind-src` writes to the inner `<img>` element, not
 *     the host.
 *   - `data-inlay-bind-did` (and `data-inlay-did`) calls
 *     `resolveDidToAvatar` and writes the returned URL as the inner
 *     `<img>`'s `src`. If `bind-src` already produced a value, the DID
 *     resolver is skipped.
 *
 * `props.*` paths are unsupported in this pass and resolve to missing —
 * see the spec ambiguity resolution.
 */

import type { RecordType } from '../../types/wizard';
import { toPascalCase, toCamelCase } from '../../utils';
import { compileToHtml } from './compile';
import type { ResolvedTemplate } from '../../inlay/resolve';
import type { InlayElement } from '../../inlay/element';

export interface CompiledBindFunction {
  /** TypeScript source defining the `bindComponent<i>` function. */
  code: string;
  /** Function identifier the view file calls (e.g. `bindComponent0`). */
  bindFunctionName: string;
  /** True when the emitted code calls `resolveDidToAvatar`. */
  needsIdentityImport: boolean;
  /** Generated Api function the bind function calls (e.g. `getProfiles`). */
  apiGetterName: string;
  /** Store list field for the bound record type (e.g. `profiles`). */
  storeListKey: string;
  /** Store setter for the bound record type (e.g. `setProfiles`). */
  storeSetterName: string;
  /** Compiled HTML produced for the resolved template. */
  html: string;
}

export function compileBindFunction(
  resolved: ResolvedTemplate,
  recordType: RecordType,
  componentIndex: number
): CompiledBindFunction {
  const html = compileToHtml(resolved.templateTree as InlayElement);
  const needsIdentityImport =
    /\bdata-inlay-bind-did\b/.test(html) || /\bdata-inlay-did=/.test(html);

  const pascal = toPascalCase(recordType.name);
  const camel = toCamelCase(recordType.name);
  const apiGetterName = `get${pascal}s`;
  const storeListKey = `${camel}s`;
  const storeSetterName = `set${pascal}s`;
  const bindFunctionName = `bindComponent${componentIndex}`;

  const code = renderBindFunction({
    bindFunctionName,
    apiGetterName,
    storeListKey,
    storeSetterName,
    needsIdentityImport,
  });

  return {
    code,
    bindFunctionName,
    needsIdentityImport,
    apiGetterName,
    storeListKey,
    storeSetterName,
    html,
  };
}

interface RenderArgs {
  bindFunctionName: string;
  apiGetterName: string;
  storeListKey: string;
  storeSetterName: string;
  needsIdentityImport: boolean;
}

function renderBindFunction(args: RenderArgs): string {
  const { bindFunctionName, apiGetterName, storeListKey, storeSetterName, needsIdentityImport } = args;

  const didBlock = needsIdentityImport
    ? `
    const didHosts: { host: Element; did: string }[] = [];
    const srcSetOn = new Set<Element>();`
    : '';

  const didMainPass = needsIdentityImport
    ? `
      // Pass 1: bind-src and other non-did attribute markers
      Array.from(el.attributes).forEach((attr) => {
        if (!attr.name.startsWith('data-inlay-bind-')) return;
        const targetAttr = attr.name.substring('data-inlay-bind-'.length);
        if (targetAttr === 'did') return;
        const value = resolvePath(record, attr.value);
        if (value == null || value === '') {
          missing.add(el);
          return;
        }
        const valueStr = String(value);
        if (isImgHost && targetAttr === 'src') {
          const img = el.querySelector('img');
          if (img) img.setAttribute('src', valueStr);
          srcSetOn.add(el);
        } else {
          el.setAttribute(targetAttr, valueStr);
        }
      });
      // Pass 2: bind-did
      const didMarker = el.getAttribute('data-inlay-bind-did');
      if (didMarker) {
        const value = resolvePath(record, didMarker);
        if (value == null || value === '') {
          if (!isImgHost || !srcSetOn.has(el)) missing.add(el);
        } else if (isImgHost) {
          if (!srcSetOn.has(el)) didHosts.push({ host: el, did: String(value) });
        } else {
          el.setAttribute('did', String(value));
        }
      }
      // Literal compile-time DID on Avatar/Cover host
      const literalDid = el.getAttribute('data-inlay-did');
      if (literalDid && isImgHost && !srcSetOn.has(el)) {
        didHosts.push({ host: el, did: literalDid });
      }`
    : `
      Array.from(el.attributes).forEach((attr) => {
        if (!attr.name.startsWith('data-inlay-bind-')) return;
        const targetAttr = attr.name.substring('data-inlay-bind-'.length);
        const value = resolvePath(record, attr.value);
        if (value == null || value === '') {
          missing.add(el);
          return;
        }
        const valueStr = String(value);
        if (isImgHost && targetAttr === 'src') {
          const img = el.querySelector('img');
          if (img) img.setAttribute('src', valueStr);
        } else {
          el.setAttribute(targetAttr, valueStr);
        }
      });`;

  const didResolver = needsIdentityImport
    ? `
    await Promise.all(didHosts.map(async ({ host, did }) => {
      const url = await resolveDidToAvatar(did);
      if (url) {
        const img = host.querySelector('img');
        if (img) img.setAttribute('src', url);
      } else {
        missing.add(host);
      }
    }));`
    : '';

  return `async function ${bindFunctionName}(container: HTMLElement): Promise<void> {
  function resolvePath(record: any, marker: string): any {
    const parts = marker.split('.');
    if (parts.length < 2) return undefined;
    if (parts[0] !== 'record' || record == null) return undefined;
    let rest = parts.slice(1);
    const last = rest[rest.length - 1];
    const isSpecial = last === '$did' || last === '$collection' || last === '$rkey';
    if (isSpecial) rest = rest.slice(0, -1);
    let current: any = record;
    for (const seg of rest) {
      if (current == null) return undefined;
      current = current[seg];
    }
    if (isSpecial) {
      if (typeof current !== 'string') return undefined;
      const m = current.match(/^at:\\/\\/([^/]+)\\/([^/]+)\\/(.+)$/);
      if (!m) return undefined;
      if (last === '$did') return m[1];
      if (last === '$collection') return m[2];
      return m[3];
    }
    return current;
  }

  // Hydrate record list from the store (or fetch via the generated Api).
  let records = Store.${storeListKey};
  if (!records || records.length === 0) {
    try {
      const resp = await ${apiGetterName}();
      storeManager.${storeSetterName}(resp.${storeListKey});
      records = resp.${storeListKey};
    } catch (err) {
      console.warn('${bindFunctionName}: failed to load records', err);
      records = [];
    }
  }
  const record: any = records[0];
  const missing = new Set<Element>();${didBlock}

  // Child bindings: <span data-inlay-bind="...">value</span>
  container.querySelectorAll<HTMLElement>('[data-inlay-bind]').forEach((el) => {
    const value = resolvePath(record, el.getAttribute('data-inlay-bind') as string);
    if (value == null || value === '') {
      el.textContent = '';
      missing.add(el);
    } else {
      el.textContent = String(value);
    }
  });

  // Attribute bindings: data-inlay-bind-<attr> on host elements.
  container.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const isImgHost = el.tagName === 'ORG-ATSUI-AVATAR' || el.tagName === 'ORG-ATSUI-COVER';${didMainPass}
  });${didResolver}

  // Maybe branch toggle: hide children / show fallback when any binding
  // inside the children branch resolved to missing.
  container.querySelectorAll<HTMLElement>('at-inlay-maybe').forEach((maybe) => {
    const childrenBranch = maybe.querySelector<HTMLElement>('[data-inlay-branch="children"]');
    const fallbackBranch = maybe.querySelector<HTMLElement>('[data-inlay-branch="fallback"]');
    if (!childrenBranch || !fallbackBranch) return;
    let hasMissing = false;
    missing.forEach((m) => { if (childrenBranch.contains(m)) hasMissing = true; });
    if (hasMissing) {
      childrenBranch.style.display = 'none';
      fallbackBranch.style.removeProperty('display');
    }
  });
}`;
}
