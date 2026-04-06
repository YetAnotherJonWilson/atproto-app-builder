/**
 * Text variant → Inlay element tree mapping.
 *
 * Maps each TextVariant to a composition of Inlay primitives using a
 * requirement's text and content fields.
 */

import type { TextVariant, ContentNode } from '../types/wizard';
import type { InlayElement } from './element';
import { el, NSID } from './element';

/**
 * Build an Inlay element tree for a single "know" requirement based on its
 * textVariant. Returns the element tree ready for the host runtime.
 */
export function buildTextVariantTree(
  variant: TextVariant,
  text: string,
  content?: string,
): InlayElement {
  switch (variant) {
    case 'paragraph':
      return buildParagraph(text, content);
    case 'heading':
      return buildHeading(text, content);
    case 'section':
      return buildSection(text, content);
    case 'infoBox':
      return buildInfoBox(text, content);
    case 'banner':
      return buildBanner(text, content);
    default:
      return buildParagraph(text, content);
  }
}

function buildParagraph(text: string, content?: string): InlayElement {
  if (content) {
    return el(NSID.Stack, { gap: 'small' },
      el(NSID.Text, {}, text),
      el(NSID.Text, {}, content),
    );
  }
  return el(NSID.Text, {}, text);
}

function buildHeading(text: string, content?: string): InlayElement {
  if (content) {
    return el(NSID.Stack, { gap: 'small' },
      el(NSID.Title, {}, text),
      el(NSID.Text, {}, content),
    );
  }
  return el(NSID.Title, {}, text);
}

function buildSection(text: string, content?: string): InlayElement {
  if (content) {
    return el(NSID.Stack, { gap: 'small' },
      el(NSID.Heading, {}, text),
      el(NSID.Text, {}, content),
    );
  }
  return el(NSID.Heading, {}, text);
}

function buildInfoBox(text: string, content?: string): InlayElement {
  const children: (InlayElement | string)[] = [el(NSID.Text, {}, text)];
  if (content) {
    children.push(el(NSID.Text, {}, content));
  }
  return el(NSID.Stack, { gap: 'small', variant: 'infoBox' }, ...children);
}

function buildBanner(text: string, content?: string): InlayElement {
  const children: (InlayElement | string)[] = [el(NSID.Title, {}, text)];
  if (content) {
    children.push(el(NSID.Caption, {}, content));
  }
  return el(NSID.Stack, { gap: 'small', variant: 'banner' }, ...children);
}

/**
 * Build a block-level element tree from multiple requirements.
 * Wraps multiple requirements in a Stack; single requirements render directly.
 * @deprecated Use buildContentNodeTree instead — this reads legacy requirement fields.
 */
export function buildTextBlockTree(
  requirements: { text: string; content?: string; textVariant: TextVariant }[],
): InlayElement | null {
  if (requirements.length === 0) return null;

  const trees = requirements.map(r => buildTextVariantTree(r.textVariant, r.text, r.content));
  if (trees.length === 1) return trees[0];

  return el(NSID.Stack, { gap: 'medium' }, ...trees);
}

// ── Content node rendering ──────────────────────────────────────────

/** Map a single ContentNode to an InlayElement. */
function contentNodeToElement(node: ContentNode): InlayElement {
  switch (node.type) {
    case 'heading':
      return el(NSID.Title, {}, node.text);
    case 'paragraph':
      return el(NSID.Text, {}, node.text);
    case 'caption':
      return el(NSID.Caption, {}, node.text);
    case 'infoBox':
      return el(NSID.Stack, { gap: 'small', variant: 'infoBox' }, el(NSID.Text, {}, node.text));
    case 'banner':
      return el(NSID.Stack, { gap: 'small', variant: 'banner' }, el(NSID.Title, {}, node.text));
    case 'image':
      // Stub — render placeholder text until image UI is built
      return el(NSID.Text, {}, `[Image: ${node.alt ?? node.src}]`);
  }
}

/**
 * Build a block-level element tree from an array of ContentNodes.
 * Single node renders directly; multiple nodes are wrapped in a Stack.
 */
export function buildContentNodeTree(nodes: ContentNode[]): InlayElement | null {
  if (nodes.length === 0) return null;

  const trees = nodes.map(contentNodeToElement);
  if (trees.length === 1) return trees[0];

  return el(NSID.Stack, { gap: 'medium' }, ...trees);
}
