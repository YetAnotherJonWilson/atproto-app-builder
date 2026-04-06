import { describe, it, expect } from 'vitest';
import { buildTextVariantTree, buildTextBlockTree } from '../../src/inlay/text-variants';
import { NSID } from '../../src/inlay/element';
import type { InlayElement } from '../../src/inlay/element';

describe('buildTextVariantTree()', () => {
  describe('paragraph', () => {
    it('renders text as a single Text element', () => {
      const tree = buildTextVariantTree('paragraph', 'Hello world');
      expect(tree.type).toBe(NSID.Text);
      expect(tree.props.children).toBe('Hello world');
    });

    it('wraps text + content in a Stack', () => {
      const tree = buildTextVariantTree('paragraph', 'Hello', 'Details here');
      expect(tree.type).toBe(NSID.Stack);
      const children = tree.props.children as InlayElement[];
      expect(children).toHaveLength(2);
      expect(children[0].type).toBe(NSID.Text);
      expect(children[0].props.children).toBe('Hello');
      expect(children[1].type).toBe(NSID.Text);
      expect(children[1].props.children).toBe('Details here');
    });
  });

  describe('heading', () => {
    it('renders text as a Title element', () => {
      const tree = buildTextVariantTree('heading', 'Welcome');
      expect(tree.type).toBe(NSID.Title);
      expect(tree.props.children).toBe('Welcome');
    });

    it('wraps title + content in a Stack', () => {
      const tree = buildTextVariantTree('heading', 'Welcome', 'To our app');
      expect(tree.type).toBe(NSID.Stack);
      const children = tree.props.children as InlayElement[];
      expect(children[0].type).toBe(NSID.Title);
      expect(children[1].type).toBe(NSID.Text);
    });
  });

  describe('section', () => {
    it('renders text as a Heading element', () => {
      const tree = buildTextVariantTree('section', 'About');
      expect(tree.type).toBe(NSID.Heading);
    });

    it('wraps heading + content in a Stack', () => {
      const tree = buildTextVariantTree('section', 'About', 'Learn more');
      expect(tree.type).toBe(NSID.Stack);
      const children = tree.props.children as InlayElement[];
      expect(children[0].type).toBe(NSID.Heading);
      expect(children[1].type).toBe(NSID.Text);
    });
  });

  describe('infoBox', () => {
    it('wraps in a Stack with variant="infoBox"', () => {
      const tree = buildTextVariantTree('infoBox', 'Note');
      expect(tree.type).toBe(NSID.Stack);
      expect(tree.props.variant).toBe('infoBox');
    });

    it('includes content as a second Text element', () => {
      const tree = buildTextVariantTree('infoBox', 'Note', 'Important details');
      const children = tree.props.children as InlayElement[];
      expect(children).toHaveLength(2);
      expect(children[0].props.children).toBe('Note');
      expect(children[1].props.children).toBe('Important details');
    });
  });

  describe('banner', () => {
    it('wraps in a Stack with variant="banner" and uses Title', () => {
      const tree = buildTextVariantTree('banner', 'Big announcement');
      expect(tree.type).toBe(NSID.Stack);
      expect(tree.props.variant).toBe('banner');
      const child = tree.props.children as InlayElement;
      expect(child.type).toBe(NSID.Title);
    });

    it('uses Caption for content', () => {
      const tree = buildTextVariantTree('banner', 'Announcement', 'Subtitle');
      const children = tree.props.children as InlayElement[];
      expect(children[0].type).toBe(NSID.Title);
      expect(children[1].type).toBe(NSID.Caption);
      expect(children[1].props.children).toBe('Subtitle');
    });
  });
});

describe('buildTextBlockTree()', () => {
  it('returns null for empty requirements', () => {
    expect(buildTextBlockTree([])).toBeNull();
  });

  it('returns the single requirement tree directly', () => {
    const tree = buildTextBlockTree([
      { text: 'Hello', textVariant: 'paragraph' },
    ]);
    expect(tree!.type).toBe(NSID.Text);
  });

  it('wraps multiple requirements in a Stack', () => {
    const tree = buildTextBlockTree([
      { text: 'Title', textVariant: 'heading' },
      { text: 'Body text', textVariant: 'paragraph' },
    ]);
    expect(tree!.type).toBe(NSID.Stack);
    const children = tree!.props.children as InlayElement[];
    expect(children).toHaveLength(2);
    expect(children[0].type).toBe(NSID.Title);
    expect(children[1].type).toBe(NSID.Text);
  });
});
