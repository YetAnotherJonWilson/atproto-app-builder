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

  describe('Avatar', () => {
    it('compiles with <img> child carrying src + alt', () => {
      const html = compileToHtml(el(NSID.Avatar, { src: 'https://example.com/a.png', alt: 'Alice' }));
      expect(html).toBe('<org-atsui-avatar><img src="https://example.com/a.png" alt="Alice"></org-atsui-avatar>');
    });

    it('defaults alt to empty string when omitted', () => {
      const html = compileToHtml(el(NSID.Avatar, { src: 'https://example.com/a.png' }));
      expect(html).toBe('<org-atsui-avatar><img src="https://example.com/a.png" alt=""></org-atsui-avatar>');
    });

    it('escapes src and alt to prevent attribute injection', () => {
      const html = compileToHtml(
        el(NSID.Avatar, { src: 'https://x.com/"><script>', alt: '"<>&' }),
      );
      expect(html).not.toContain('<script>');
      expect(html).toContain('&quot;');
      expect(html).toContain('&amp;');
    });
  });

  describe('Cover', () => {
    it('compiles with <img> child', () => {
      const html = compileToHtml(el(NSID.Cover, { src: 'https://example.com/b.jpg', alt: 'banner' }));
      expect(html).toBe('<org-atsui-cover><img src="https://example.com/b.jpg" alt="banner"></org-atsui-cover>');
    });
  });

  describe('Link', () => {
    it('absolute URLs get target="_blank" rel="noopener noreferrer"', () => {
      const html = compileToHtml(
        el(NSID.Link, { href: 'https://example.com' }, el(NSID.Text, {}, 'Open')),
      );
      expect(html).toBe(
        '<org-atsui-link><a href="https://example.com" target="_blank" rel="noopener noreferrer"><org-atsui-text role="paragraph">Open</org-atsui-text></a></org-atsui-link>',
      );
    });

    it('non-absolute hrefs are passed through without target/rel', () => {
      const html = compileToHtml(el(NSID.Link, { href: '/profile/alice' }, 'Profile'));
      expect(html).toBe('<org-atsui-link><a href="/profile/alice">Profile</a></org-atsui-link>');
    });

    it('escapes href to prevent attribute injection', () => {
      const html = compileToHtml(el(NSID.Link, { href: '"><script>alert(1)</script>' }, 'x'));
      expect(html).not.toContain('<script>');
      expect(html).toContain('&quot;');
    });
  });

  describe('Maybe', () => {
    it('renders the then branch when when is truthy', () => {
      const html = compileToHtml(
        el(NSID.Maybe, {
          when: true,
          then: el(NSID.Text, {}, 'shown'),
          else: el(NSID.Text, {}, 'hidden'),
        }),
      );
      expect(html).toBe('<org-atsui-maybe><org-atsui-text role="paragraph">shown</org-atsui-text></org-atsui-maybe>');
    });

    it('renders the else branch when when is falsy', () => {
      const html = compileToHtml(
        el(NSID.Maybe, {
          when: false,
          then: el(NSID.Text, {}, 'shown'),
          else: el(NSID.Text, {}, 'fallback'),
        }),
      );
      expect(html).toBe('<org-atsui-maybe><org-atsui-text role="paragraph">fallback</org-atsui-text></org-atsui-maybe>');
    });

    it('renders empty when when is falsy and else is missing', () => {
      const html = compileToHtml(
        el(NSID.Maybe, { when: false, then: el(NSID.Text, {}, 'shown') }),
      );
      expect(html).toBe('<org-atsui-maybe></org-atsui-maybe>');
    });
  });

  describe('unknown primitive fallback', () => {
    it('emits a visible warning element with the NSID', () => {
      const html = compileToHtml({ type: 'org.atsui.NotReal', props: {} });
      expect(html).toBe('<div class="inlay-unknown-primitive">Unknown Inlay primitive: org.atsui.NotReal</div>');
    });

    it('escapes the NSID in the fallback warning', () => {
      const html = compileToHtml({ type: '<script>', props: {} });
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });
});
