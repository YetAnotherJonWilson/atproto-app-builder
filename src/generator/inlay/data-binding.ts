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
 *   - `data-inlay-bind-src` resolving to a blob ref (the AT Proto record
 *     shape `{ $type: 'blob', ref: { $link } }`) is converted to a
 *     Bluesky CDN URL using the bound record's DID. Avatar host →
 *     `/img/avatar/plain/<did>/<cid>@jpeg`; Cover host → `/img/banner/...`.
 *   - `data-inlay-bind-did` (and `data-inlay-did`) calls
 *     `resolveDidToAvatar` and writes the returned URL as the inner
 *     `<img>`'s `src`. If `bind-src` already produced a value, the DID
 *     resolver is skipped.
 *
 * Path aliasing:
 *   - `props.<view.prop>` is treated as `record.uri` (the bound record's
 *     AT-URI). E.g. for a template whose `view.prop = "uri"`,
 *     `props.uri.$did` resolves to the DID portion of the record's URI.
 *   - Any other `props.*` path resolves to missing (no component
 *     nesting in this spec).
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
  const viewProp = typeof resolved.view?.prop === 'string' ? (resolved.view.prop as string) : null;

  const code = renderBindFunction({
    bindFunctionName,
    apiGetterName,
    storeListKey,
    storeSetterName,
    needsIdentityImport,
    viewProp,
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
  /**
   * The template's entry-level view prop (e.g. "uri"). Paths starting
   * with `props.<viewProp>` are aliased to `record.uri`. `null` skips
   * the aliasing branch entirely.
   */
  viewProp: string | null;
}

function renderBindFunction(args: RenderArgs): string {
  const { bindFunctionName, apiGetterName, storeListKey, storeSetterName, needsIdentityImport, viewProp } = args;
  // JSON-encode for safe interpolation as a string literal in emitted code.
  const viewPropLiteral = viewProp == null ? 'null' : JSON.stringify(viewProp);

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
        const value: any = resolvePath(record, attr.value);
        if (value == null || value === '') {
          missing.add(el);
          return;
        }
        if (isImgHost && targetAttr === 'src') {
          const url = typeof value === 'string' ? value : tryBlobToCdnUrl(value, el, record);
          if (url == null) { missing.add(el); return; }
          const img = el.querySelector('img');
          if (img) img.setAttribute('src', url);
          srcSetOn.add(el);
          return;
        }
        el.setAttribute(targetAttr, String(value));
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
        const value: any = resolvePath(record, attr.value);
        if (value == null || value === '') {
          missing.add(el);
          return;
        }
        if (isImgHost && targetAttr === 'src') {
          const url = typeof value === 'string' ? value : tryBlobToCdnUrl(value, el, record);
          if (url == null) { missing.add(el); return; }
          const img = el.querySelector('img');
          if (img) img.setAttribute('src', url);
          return;
        }
        el.setAttribute(targetAttr, String(value));
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
  const viewProp: string | null = ${viewPropLiteral};

  function resolvePath(record: any, marker: string): any {
    const parts = marker.split('.');
    if (parts.length < 2 || record == null) return undefined;
    let head = parts[0];
    let rest = parts.slice(1);
    // Alias the entry-level view prop to the bound record's URI.
    // E.g. for view.prop = "uri", \`props.uri.$did\` ≡ \`record.uri.$did\`.
    if (head === 'props' && viewProp != null && rest[0] === viewProp) {
      head = 'record';
      rest = ['uri', ...rest.slice(1)];
    }
    if (head !== 'record') return undefined;
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

  // Extract a CID string from any of the blob shapes the AT Proto stack
  // returns: plain typed JSON (\`{ \$type: 'blob', ref: { \$link } }\`),
  // \`@atproto/lexicon\` BlobRef class instances (with a CID-instance ref),
  // and the legacy untyped \`{ cid: '...' }\` form.
  function extractBlobCid(v: any): string | null {
    if (v == null || typeof v !== 'object') return null;
    if (v.ref != null && typeof v.ref.$link === 'string') return v.ref.$link;
    if (typeof v.toJSON === 'function') {
      try {
        const j: any = v.toJSON();
        if (j && j.ref && typeof j.ref.$link === 'string') return j.ref.$link;
        if (j && typeof j.cid === 'string') return j.cid;
      } catch {}
    }
    if (v.ref != null && typeof v.ref.toString === 'function') {
      try {
        const s = v.ref.toString();
        if (typeof s === 'string' && s.length > 0 && s !== '[object Object]') return s;
      } catch {}
    }
    if (typeof v.cid === 'string') return v.cid;
    return null;
  }

  function tryBlobToCdnUrl(v: any, host: Element, rec: any): string | null {
    const cid = extractBlobCid(v);
    if (cid == null) return null;
    const did = resolvePath(rec, 'record.uri.$did');
    if (typeof did !== 'string') return null;
    // Avatar host (org-atsui-avatar) → /img/avatar/...; Cover host → /img/banner/...
    const variant = host.tagName === 'ORG-ATSUI-COVER' ? 'banner' : 'avatar';
    return 'https://cdn.bsky.app/img/' + variant + '/plain/' + did + '/' + cid + '@jpeg';
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
