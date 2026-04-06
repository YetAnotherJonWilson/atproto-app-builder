/**
 * Compile-time Inlay renderer — serializes element trees to HTML strings.
 *
 * Used by the generator to produce final HTML output for text blocks.
 * No Inlay runtime ships in the generated app.
 */

import type { InlayElement } from '../../inlay/element';
import { nsidToTag } from '../../inlay/host-runtime';

/** ARIA role mappings — same as host-runtime.ts */
const ARIA_ROLES: Record<string, Record<string, string>> = {
  'org.atsui.Title': { role: 'heading', 'aria-level': '1' },
  'org.atsui.Heading': { role: 'heading', 'aria-level': '2' },
  'org.atsui.Text': { role: 'paragraph' },
  'org.atsui.Caption': { role: 'note' },
};

const ATTRIBUTE_PROPS = new Set(['gap', 'align', 'justify', 'inset', 'sticky', 'separator', 'variant']);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Compile an InlayElement tree to an HTML string.
 */
export function compileToHtml(element: InlayElement): string {
  const tag = nsidToTag(element.type);

  // Build attributes
  const attrs: string[] = [];

  // ARIA roles
  const aria = ARIA_ROLES[element.type];
  if (aria) {
    for (const [attr, value] of Object.entries(aria)) {
      attrs.push(`${attr}="${escapeHtml(value)}"`);
    }
  }

  // Props as attributes
  for (const [key, value] of Object.entries(element.props)) {
    if (key === 'children') continue;
    if (ATTRIBUTE_PROPS.has(key) && value != null) {
      attrs.push(`${key}="${escapeHtml(String(value))}"`);
    }
  }

  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  // Render children
  const childrenHtml = compileChildren(element.props.children);

  return `<${tag}${attrStr}>${childrenHtml}</${tag}>`;
}

function compileChildren(children: unknown): string {
  if (children == null) return '';

  if (typeof children === 'string') {
    return escapeHtml(children);
  }

  if (Array.isArray(children)) {
    return children
      .map(child => {
        if (typeof child === 'string') return escapeHtml(child);
        if (isInlayElement(child)) return compileToHtml(child);
        return '';
      })
      .join('');
  }

  if (isInlayElement(children)) {
    return compileToHtml(children as InlayElement);
  }

  return '';
}

function isInlayElement(value: unknown): value is InlayElement {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'props' in value &&
    typeof (value as InlayElement).type === 'string'
  );
}
