/**
 * Compile-time Inlay renderer — serializes element trees to HTML strings.
 *
 * Used by the generator to produce final HTML output for text components.
 * No Inlay runtime ships in the generated app.
 */

import { NSID, type InlayElement } from '../../inlay/element';
import { nsidToTag } from '../../inlay/host-runtime';

/** ARIA role mappings — same as host-runtime.ts */
const ARIA_ROLES: Record<string, Record<string, string>> = {
  'org.atsui.Title': { role: 'heading', 'aria-level': '1' },
  'org.atsui.Heading': { role: 'heading', 'aria-level': '2' },
  'org.atsui.Text': { role: 'paragraph' },
  'org.atsui.Caption': { role: 'note' },
};

const ATTRIBUTE_PROPS = new Set(['gap', 'align', 'justify', 'inset', 'sticky', 'separator', 'variant']);

/** Known primitive NSIDs — must match host-runtime.ts. */
const KNOWN_PRIMITIVES = new Set<string>(Object.values(NSID));

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isAbsoluteUrl(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function compileUnknownPrimitive(nsid: string): string {
  return `<div class="inlay-unknown-primitive">Unknown Inlay primitive: ${escapeHtml(nsid)}</div>`;
}

/**
 * Compile an InlayElement tree to an HTML string.
 */
export function compileToHtml(element: InlayElement): string {
  if (!KNOWN_PRIMITIVES.has(element.type)) {
    return compileUnknownPrimitive(element.type);
  }

  if (element.type === NSID.Maybe) {
    return compileMaybe(element);
  }

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

  if (element.type === NSID.Avatar || element.type === NSID.Cover) {
    return `<${tag}${attrStr}>${compileImg(element)}</${tag}>`;
  }

  if (element.type === NSID.Link) {
    return `<${tag}${attrStr}>${compileLink(element)}</${tag}>`;
  }

  // Render children
  const childrenHtml = compileChildren(element.props.children);

  return `<${tag}${attrStr}>${childrenHtml}</${tag}>`;
}

function compileImg(element: InlayElement): string {
  const src = element.props.src;
  const alt = element.props.alt;
  const srcAttr = typeof src === 'string' ? ` src="${escapeHtml(src)}"` : '';
  const altAttr = ` alt="${escapeHtml(typeof alt === 'string' ? alt : '')}"`;
  return `<img${srcAttr}${altAttr}>`;
}

function compileLink(element: InlayElement): string {
  const href = element.props.href;
  const attrs: string[] = [];
  if (typeof href === 'string') {
    attrs.push(`href="${escapeHtml(href)}"`);
    if (isAbsoluteUrl(href)) {
      attrs.push('target="_blank"');
      attrs.push('rel="noopener noreferrer"');
    }
  }
  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
  const childrenHtml = compileChildren(element.props.children);
  return `<a${attrStr}>${childrenHtml}</a>`;
}

function compileMaybe(element: InlayElement): string {
  const tag = nsidToTag(NSID.Maybe);
  const branch = element.props.when ? element.props.then : element.props.else;
  let inner = '';
  if (typeof branch === 'string') {
    inner = escapeHtml(branch);
  } else if (isInlayElement(branch)) {
    inner = compileToHtml(branch);
  }
  return `<${tag}>${inner}</${tag}>`;
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
