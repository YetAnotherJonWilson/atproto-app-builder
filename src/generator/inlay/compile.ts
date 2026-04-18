/**
 * Compile-time Inlay renderer — serializes element trees to HTML strings.
 *
 * Used by the generator to produce final HTML output for text components.
 * No Inlay runtime ships in the generated app.
 *
 * Binding markers emitted by compileToHtml():
 *   - Child binding:    <span data-inlay-bind="<serialized path>"></span>
 *   - Attribute binding: data-inlay-bind-<attr>="<serialized path>" on host element
 */

import { NSID, type InlayElement } from '../../inlay/element';
import { nsidToTag } from '../../inlay/host-runtime';
import { serializePath } from '../../inlay/binding-path';

/** ARIA role mappings — same as host-runtime.ts */
const ARIA_ROLES: Record<string, Record<string, string>> = {
  'org.atsui.Title': { role: 'heading', 'aria-level': '1' },
  'org.atsui.Heading': { role: 'heading', 'aria-level': '2' },
  'org.atsui.Text': { role: 'paragraph' },
  'org.atsui.Caption': { role: 'note' },
};

const ATTRIBUTE_PROPS = new Set(['gap', 'align', 'justify', 'inset', 'sticky', 'separator', 'variant', 'size']);

/** Known primitive NSIDs — must match host-runtime.ts. */
const KNOWN_PRIMITIVES = new Set<string>(Object.values(NSID));

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isAbsoluteUrl(uri: string): boolean {
  return /^https?:\/\//i.test(uri);
}

/**
 * Compile an InlayElement tree to an HTML string.
 */
export function compileToHtml(element: InlayElement): string {
  if (!KNOWN_PRIMITIVES.has(element.type)) {
    return compileUnresolvedComponent(element.type);
  }

  // Binding: emit a marker span
  if (element.type === NSID.Binding) {
    return compileBinding(element);
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

  // Props as attributes (skip children, skip element-valued props)
  for (const [key, value] of Object.entries(element.props)) {
    if (key === 'children') continue;
    if (isInlayElement(value)) continue; // handled by prop-value recursion in specific renderers
    if (ATTRIBUTE_PROPS.has(key) && value != null) {
      attrs.push(`${key}="${escapeHtml(String(value))}"`);
    }
  }

  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  if (element.type === NSID.Avatar || element.type === NSID.Cover) {
    return compileImgElement(element, tag, attrs);
  }

  if (element.type === NSID.Link) {
    return compileLinkElement(element, tag, attrs);
  }

  // Render children
  const childrenHtml = compileChildren(element.props.children);

  return `<${tag}${attrStr}>${childrenHtml}</${tag}>`;
}

function compileBinding(element: InlayElement): string {
  const path = element.props.path;
  if (Array.isArray(path)) {
    return `<span data-inlay-bind="${escapeHtml(serializePath(path as string[]))}"></span>`;
  }
  return '<span></span>';
}

function compileUnresolvedComponent(nsid: string): string {
  return `<div class="inlay-unresolved-component">Unsupported component: ${escapeHtml(nsid)}</div>`;
}

function compileImgElement(element: InlayElement, tag: string, baseAttrs: string[]): string {
  const src = element.props.src;
  const alt = element.props.alt;
  const did = element.props.did;
  const attrs = [...baseAttrs];

  // Prop-value recursion: binding on src/did → marker attrs on host
  if (isInlayElement(src) && src.type === NSID.Binding) {
    attrs.push(`data-inlay-bind-src="${escapeHtml(serializePath(src.props.path as string[]))}"`);
  }
  if (isInlayElement(did) && did.type === NSID.Binding) {
    attrs.push(`data-inlay-bind-did="${escapeHtml(serializePath(did.props.path as string[]))}"`);
  } else if (typeof did === 'string' && typeof src !== 'string') {
    attrs.push(`data-inlay-did="${escapeHtml(did)}"`);
  }

  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
  const srcAttr = typeof src === 'string' ? ` src="${escapeHtml(src)}"` : '';
  const altAttr = ` alt="${escapeHtml(typeof alt === 'string' ? alt : '')}"`;
  return `<${tag}${attrStr}><img${srcAttr}${altAttr}></${tag}>`;
}

function compileLinkElement(element: InlayElement, tag: string, baseAttrs: string[]): string {
  const uri = element.props.uri;
  const outerAttrStr = baseAttrs.length > 0 ? ' ' + baseAttrs.join(' ') : '';
  const linkAttrs: string[] = [];
  if (isInlayElement(uri) && uri.type === NSID.Binding) {
    linkAttrs.push(`data-inlay-bind-href="${escapeHtml(serializePath(uri.props.path as string[]))}"`);
  } else if (typeof uri === 'string') {
    linkAttrs.push(`href="${escapeHtml(uri)}"`);
    if (isAbsoluteUrl(uri)) {
      linkAttrs.push('target="_blank"');
      linkAttrs.push('rel="noopener noreferrer"');
    }
  }
  const linkAttrStr = linkAttrs.length > 0 ? ' ' + linkAttrs.join(' ') : '';
  const childrenHtml = compileChildren(element.props.children);
  return `<${tag}${outerAttrStr}><a${linkAttrStr}>${childrenHtml}</a></${tag}>`;
}

function compileMaybe(element: InlayElement): string {
  const tag = nsidToTag(NSID.Maybe);
  const children = element.props.children;
  const fallback = element.props.fallback;
  const childrenHtml = compileBranch(children);
  const fallbackHtml = compileBranch(fallback);
  return `<${tag}><div data-inlay-branch="children">${childrenHtml}</div><div data-inlay-branch="fallback" style="display:none">${fallbackHtml}</div></${tag}>`;
}

function compileBranch(branch: unknown): string {
  if (branch == null) return '';
  if (typeof branch === 'string') return escapeHtml(branch);
  if (Array.isArray(branch)) {
    return branch
      .map(child => {
        if (typeof child === 'string') return escapeHtml(child);
        if (isInlayElement(child)) return compileToHtml(child);
        return '';
      })
      .join('');
  }
  if (isInlayElement(branch)) return compileToHtml(branch);
  return '';
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
