/**
 * Utilities for Inlay binding paths — the ["record", "avatar"] arrays
 * that at.inlay.Binding elements carry in their props.path field.
 */

/** Special AT-URI segments that binding paths can reference. */
const SPECIAL_SEGMENTS = new Set(['$did', '$collection', '$rkey']);

export type BindingScope = 'record' | 'props';

export interface ParsedBindingPath {
  scope: BindingScope;
  segments: string[];
  special: string | null;
}

/** Serialize a path array to a dot-separated marker string. */
export function serializePath(path: readonly string[]): string {
  return path.join('.');
}

/** Parse a dot-separated marker string back to a path array. */
export function parsePath(marker: string): string[] {
  return marker.split('.');
}

/** Identify whether a path targets record data or caller props. */
export function pathScope(path: readonly string[]): BindingScope {
  if (path.length === 0) {
    throw new Error('Empty binding path');
  }
  const scope = path[0];
  if (scope === 'record' || scope === 'props') return scope;
  throw new Error(`Unknown binding scope: "${scope}" (expected "record" or "props")`);
}

/** Check whether a segment is a special AT-URI segment ($did, $collection, $rkey). */
export function isSpecialSegment(segment: string): boolean {
  return SPECIAL_SEGMENTS.has(segment);
}

/**
 * Parse a binding path into its scope, data segments, and optional
 * trailing special segment.
 *
 * Examples:
 *   ["record", "avatar"]              → { scope: "record", segments: ["avatar"], special: null }
 *   ["props", "uri", "$did"]          → { scope: "props", segments: ["uri"], special: "$did" }
 *   ["record", "item", "artists", "0", "artistName"]
 *     → { scope: "record", segments: ["item", "artists", "0", "artistName"], special: null }
 */
export function parseBindingPath(path: readonly string[]): ParsedBindingPath {
  if (path.length < 2) {
    throw new Error(`Binding path too short: [${path.map(s => `"${s}"`).join(', ')}]`);
  }

  const scope = pathScope(path);
  const rest = path.slice(1);
  const last = rest[rest.length - 1];

  if (isSpecialSegment(last)) {
    return {
      scope,
      segments: rest.slice(0, -1),
      special: last,
    };
  }

  return { scope, segments: rest, special: null };
}
