import { describe, it, expect } from 'vitest';
import { compileToHtml } from '../../src/generator/inlay/compile';
import { el, NSID } from '../../src/inlay/element';

describe('compileToHtml()', () => {
  it('compiles a Text element to custom element HTML', () => {
    const html = compileToHtml(el(NSID.Text, {}, 'Hello'));
    expect(html).toBe('<org-atsui-text role="paragraph">Hello</org-atsui-text>');
  });

  it('compiles a Title with ARIA heading role', () => {
    const html = compileToHtml(el(NSID.Title, {}, 'Welcome'));
    expect(html).toBe('<org-atsui-title role="heading" aria-level="1">Welcome</org-atsui-title>');
  });

  it('compiles a Heading with ARIA heading role level 2', () => {
    const html = compileToHtml(el(NSID.Heading, {}, 'Section'));
    expect(html).toBe('<org-atsui-heading role="heading" aria-level="2">Section</org-atsui-heading>');
  });

  it('compiles Stack with gap attribute', () => {
    const html = compileToHtml(el(NSID.Stack, { gap: 'small' }, el(NSID.Text, {}, 'Hi')));
    expect(html).toContain('<org-atsui-stack gap="small">');
    expect(html).toContain('<org-atsui-text');
    expect(html).toContain('</org-atsui-stack>');
  });

  it('compiles nested elements', () => {
    const tree = el(NSID.Stack, { gap: 'medium' },
      el(NSID.Title, {}, 'Title'),
      el(NSID.Text, {}, 'Body'),
    );
    const html = compileToHtml(tree);
    expect(html).toContain('gap="medium"');
    expect(html).toContain('<org-atsui-title');
    expect(html).toContain('Title');
    expect(html).toContain('<org-atsui-text');
    expect(html).toContain('Body');
  });

  it('compiles variant attribute for infoBox', () => {
    const tree = el(NSID.Stack, { variant: 'infoBox', gap: 'small' },
      el(NSID.Text, {}, 'Note'),
    );
    const html = compileToHtml(tree);
    expect(html).toContain('variant="infoBox"');
    expect(html).toContain('gap="small"');
  });

  it('compiles variant attribute for banner', () => {
    const tree = el(NSID.Stack, { variant: 'banner', gap: 'small' },
      el(NSID.Title, {}, 'Big'),
      el(NSID.Caption, {}, 'Sub'),
    );
    const html = compileToHtml(tree);
    expect(html).toContain('variant="banner"');
    expect(html).toContain('<org-atsui-caption role="note">Sub</org-atsui-caption>');
  });

  it('escapes HTML in text content', () => {
    const html = compileToHtml(el(NSID.Text, {}, '<script>alert("xss")</script>'));
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('compiles element with no children', () => {
    const html = compileToHtml(el(NSID.Fill, {}));
    expect(html).toBe('<org-atsui-fill></org-atsui-fill>');
  });
});
