/**
 * Minimal Inlay template resolution.
 *
 * Takes a component AT-URI, fetches the record from the author's PDS,
 * validates it as a bodyTemplate, and deserializes the element tree via
 * @inlay/core's `deserializeTree`.  Bindings are preserved (no
 * `resolveBindings` call) — the compile path reads them as markers.
 *
 * Does NOT resolve nested component references or call `@inlay/render`.
 */

import { deserializeTree } from '@inlay/core';
import { resolveDidToPds } from './discovery';

// ── Result types ──────────────────────────────────────────────────────

export interface ResolvedTemplate {
  templateTree: unknown;
  view: Record<string, unknown> | undefined;
  imports: string[];
  uri: string;
  unresolvedComponents: string[];
}

export interface ResolveError {
  error: string;
  code: 'network' | 'not-template' | 'external-body';
}

export type ResolveResult = ResolvedTemplate | ResolveError;

export function isResolveError(result: ResolveResult): result is ResolveError {
  return 'error' in result;
}

// ── Constants ─────────────────────────────────────────────────────────

const INLAY_COMPONENT_COLLECTION = 'at.inlay.component';
const BODY_TEMPLATE_TYPE = 'at.inlay.component#bodyTemplate';
const BODY_EXTERNAL_TYPE = 'at.inlay.component#bodyExternal';

/** Primitive NSIDs we know how to render — anything else is "unresolved". */
const KNOWN_NSIDS = new Set([
  'org.atsui.Stack',
  'org.atsui.Row',
  'org.atsui.Title',
  'org.atsui.Heading',
  'org.atsui.Text',
  'org.atsui.Caption',
  'org.atsui.Fill',
  'org.atsui.Avatar',
  'org.atsui.Cover',
  'org.atsui.Link',
  'at.inlay.Maybe',
  'at.inlay.Binding',
]);

// ── AT-URI parsing ────────────────────────────────────────────────────

function parseAtUri(uri: string): { did: string; collection: string; rkey: string } | null {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { did: match[1], collection: match[2], rkey: match[3] };
}

// ── Tree scanning ─────────────────────────────────────────────────────

/** Walk a deserialized tree and collect NSIDs that are not known primitives. */
function collectUnresolvedComponents(tree: unknown): string[] {
  const found = new Set<string>();
  walkForUnresolved(tree, found);
  return [...found];
}

function walkForUnresolved(node: unknown, found: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      walkForUnresolved(item, found);
    }
    return;
  }
  if (!isPlainObject(node)) return;
  if (typeof node.type === 'string' && 'props' in node) {
    // It's an element
    if (!KNOWN_NSIDS.has(node.type)) {
      found.add(node.type);
    }
    // Recurse into props
    if (isPlainObject(node.props)) {
      for (const value of Object.values(node.props)) {
        walkForUnresolved(value, found);
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ── Main entry point ──────────────────────────────────────────────────

/**
 * Resolve an Inlay component AT-URI to a deserialized template tree.
 *
 * Fetches the record from the author's PDS, validates that it is a
 * bodyTemplate, deserializes the node tree (replacing serialization
 * markers with BRAND symbols), and scans for unresolved nested
 * component references.
 */
export async function resolveInlayTemplate(uri: string): Promise<ResolveResult> {
  const parsed = parseAtUri(uri);
  if (!parsed) {
    return { error: `Invalid AT-URI: ${uri}`, code: 'network' };
  }
  if (parsed.collection !== INLAY_COMPONENT_COLLECTION) {
    return { error: `Not an inlay component URI: ${uri}`, code: 'not-template' };
  }

  // Fetch the record from the author's PDS
  let record: Record<string, unknown>;
  try {
    const pds = await resolveDidToPds(parsed.did);
    const url = `${pds}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(parsed.did)}&collection=${encodeURIComponent(parsed.collection)}&rkey=${encodeURIComponent(parsed.rkey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { error: `PDS returned ${res.status} for ${uri}`, code: 'network' };
    }
    const data = await res.json() as { value?: unknown };
    if (!isPlainObject(data.value)) {
      return { error: `Record value missing for ${uri}`, code: 'network' };
    }
    record = data.value;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message, code: 'network' };
  }

  // Validate body type
  const body = record.body;
  if (!isPlainObject(body)) {
    return { error: `Record has no body: ${uri}`, code: 'not-template' };
  }

  if (body.$type === BODY_EXTERNAL_TYPE) {
    return { error: `External-body component: ${uri}`, code: 'external-body' };
  }

  if (body.$type !== BODY_TEMPLATE_TYPE) {
    return { error: `Body type is ${String(body.$type)}, expected ${BODY_TEMPLATE_TYPE}`, code: 'not-template' };
  }

  // Deserialize the element tree (replaces "$" markers with BRAND symbol)
  const node = body.node;
  if (node == null) {
    return { error: `Template body has no node: ${uri}`, code: 'not-template' };
  }

  const templateTree = deserializeTree(node);

  // Extract view and imports
  const view = isPlainObject(record.view) ? record.view : undefined;
  const imports = Array.isArray(record.imports) ? (record.imports as string[]) : [];

  // Scan for unresolved nested component references
  const unresolvedComponents = collectUnresolvedComponents(templateTree);

  return { templateTree, view, imports, uri, unresolvedComponents };
}
