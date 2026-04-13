/**
 * Minimal Inlay host runtime — renders primitive element trees to DOM.
 *
 * Maps org.atsui.* NSIDs to custom HTML elements matching inlay.at's
 * convention, with ARIA roles for accessibility. This module is used both
 * in the app builder (live preview) and by the generator (compile-time).
 */

import { NSID, type InlayElement } from './element';

/** Convert NSID to custom element tag name: "org.atsui.Stack" → "org-atsui-stack" */
export function nsidToTag(nsid: string): string {
  return nsid.replace(/\./g, '-').toLowerCase();
}

/** ARIA role mappings for accessibility on custom elements. */
const ARIA_ROLES: Record<string, Record<string, string>> = {
  'org.atsui.Title': { role: 'heading', 'aria-level': '1' },
  'org.atsui.Heading': { role: 'heading', 'aria-level': '2' },
  'org.atsui.Text': { role: 'paragraph' },
  'org.atsui.Caption': { role: 'note' },
};

/** Props that map to HTML attributes on the custom element. */
const ATTRIBUTE_PROPS = new Set([
  'gap',
  'align',
  'justify',
  'inset',
  'sticky',
  'separator',
  'variant',
]);

/** Known primitive NSIDs — anything outside this set falls back to an unknown-primitive warning. */
const KNOWN_PRIMITIVES = new Set<string>(Object.values(NSID));

/** Absolute URL = treated as external (gets target=_blank). */
function isAbsoluteUrl(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** Standardized warning element for primitives outside KNOWN_PRIMITIVES. */
function renderUnknownPrimitive(nsid: string): HTMLElement {
  const errEl = document.createElement('div');
  errEl.className = 'inlay-unknown-primitive';
  errEl.textContent = `Unknown Inlay primitive: ${nsid}`;
  return errEl;
}

/**
 * Render an InlayElement tree to a DOM element.
 * Returns a fully constructed DOM tree ready for insertion.
 */
export function renderToDOM(element: InlayElement): HTMLElement {
  if (!KNOWN_PRIMITIVES.has(element.type)) {
    return renderUnknownPrimitive(element.type);
  }

  if (element.type === NSID.Maybe) {
    return renderMaybe(element);
  }

  const tag = nsidToTag(element.type);
  const el = document.createElement(tag);

  // Set ARIA roles
  const aria = ARIA_ROLES[element.type];
  if (aria) {
    for (const [attr, value] of Object.entries(aria)) {
      el.setAttribute(attr, value);
    }
  }

  // Set props as attributes
  for (const [key, value] of Object.entries(element.props)) {
    if (key === 'children') continue;
    if (ATTRIBUTE_PROPS.has(key) && value != null) {
      el.setAttribute(key, String(value));
    }
  }

  if (element.type === NSID.Avatar || element.type === NSID.Cover) {
    renderImageInto(el, element);
    return el;
  }

  if (element.type === NSID.Link) {
    renderLinkInto(el, element);
    return el;
  }

  // Render children
  const children = element.props.children;
  if (children != null) {
    renderChildren(el, children);
  }

  return el;
}

function renderImageInto(parent: HTMLElement, element: InlayElement): void {
  const src = element.props.src;
  const alt = element.props.alt;
  const img = document.createElement('img');
  if (typeof src === 'string') img.setAttribute('src', src);
  img.setAttribute('alt', typeof alt === 'string' ? alt : '');
  parent.appendChild(img);
}

function renderLinkInto(parent: HTMLElement, element: InlayElement): void {
  const href = element.props.href;
  const a = document.createElement('a');
  if (typeof href === 'string') {
    a.setAttribute('href', href);
    if (isAbsoluteUrl(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  }
  const children = element.props.children;
  if (children != null) {
    renderChildren(a, children);
  }
  parent.appendChild(a);
}

function renderMaybe(element: InlayElement): HTMLElement {
  const wrapper = document.createElement(nsidToTag(NSID.Maybe));
  const branch = element.props.when ? element.props.then : element.props.else;
  if (isInlayElement(branch)) {
    wrapper.appendChild(renderToDOM(branch));
  } else if (typeof branch === 'string') {
    wrapper.appendChild(document.createTextNode(branch));
  }
  return wrapper;
}

function renderChildren(parent: HTMLElement, children: unknown): void {
  if (typeof children === 'string') {
    parent.textContent = children;
  } else if (Array.isArray(children)) {
    for (const child of children) {
      if (typeof child === 'string') {
        parent.appendChild(document.createTextNode(child));
      } else if (isInlayElement(child)) {
        parent.appendChild(renderToDOM(child));
      }
    }
  } else if (isInlayElement(children)) {
    parent.appendChild(renderToDOM(children as InlayElement));
  }
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
