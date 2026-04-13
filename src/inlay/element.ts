/**
 * Inlay element tree data structure.
 *
 * An InlayElement is the inert data representation of a component — the same
 * shape Inlay uses internally ({ type: NSID, props }). These trees are pure
 * data with no behavior; a host runtime turns them into visible UI.
 */

export interface InlayElement {
  type: string; // full NSID, e.g. "org.atsui.Stack"
  props: Record<string, unknown>;
}

/** Shorthand for creating an element node. */
export function el(
  type: string,
  props?: Record<string, unknown>,
  ...children: (InlayElement | string)[]
): InlayElement {
  const resolvedChildren =
    children.length === 1
      ? children[0]
      : children.length > 0
        ? children
        : undefined;
  return {
    type,
    props: {
      ...props,
      ...(resolvedChildren !== undefined ? { children: resolvedChildren } : {}),
    },
  };
}

// ── NSID constants ───────────────────────────────────────────────────

export const NSID = {
  Stack: 'org.atsui.Stack',
  Row: 'org.atsui.Row',
  Title: 'org.atsui.Title',
  Heading: 'org.atsui.Heading',
  Text: 'org.atsui.Text',
  Caption: 'org.atsui.Caption',
  Fill: 'org.atsui.Fill',
} as const;
