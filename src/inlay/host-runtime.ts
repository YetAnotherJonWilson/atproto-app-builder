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

/** Known primitive NSIDs — anything outside this set is an error. */
const KNOWN_PRIMITIVES = new Set<string>(Object.values(NSID));

/**
 * Render an InlayElement tree to a DOM element.
 * Returns a fully constructed DOM tree ready for insertion.
 */
export function renderToDOM(element: InlayElement): HTMLElement {
  if (!KNOWN_PRIMITIVES.has(element.type)) {
    const errEl = document.createElement('div');
    errEl.className = 'inlay-error';
    errEl.textContent = `Unknown Inlay primitive: ${element.type}`;
    return errEl;
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

  // Render children
  const children = element.props.children;
  if (children != null) {
    renderChildren(el, children);
  }

  return el;
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
