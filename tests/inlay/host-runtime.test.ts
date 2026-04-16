// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderToDOM } from '../../src/inlay/host-runtime';
import { compileToHtml } from '../../src/generator/inlay/compile';
import { el, NSID, type InlayElement } from '../../src/inlay/element';

/** Normalize DOM → HTML so we can compare with compile output. */
function domHtml(element: InlayElement): string {
  return renderToDOM(element).outerHTML;
}

describe('renderToDOM() — Avatar', () => {
  it('renders an <img> with src and alt inside the custom element', () => {
    const dom = renderToDOM(el(NSID.Avatar, { src: 'https://example.com/a.png', alt: 'Alice' }));
    expect(dom.tagName.toLowerCase()).toBe('org-atsui-avatar');
    const img = dom.querySelector('img')!;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.com/a.png');
    expect(img.getAttribute('alt')).toBe('Alice');
  });

  it('defaults alt to empty string when omitted', () => {
    const dom = renderToDOM(el(NSID.Avatar, { src: 'https://example.com/a.png' }));
    expect(dom.querySelector('img')!.getAttribute('alt')).toBe('');
  });
});

describe('renderToDOM() — Cover', () => {
  it('renders an <img> inside the custom element', () => {
    const dom = renderToDOM(el(NSID.Cover, { src: 'https://example.com/banner.jpg', alt: 'banner' }));
    expect(dom.tagName.toLowerCase()).toBe('org-atsui-cover');
    const img = dom.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://example.com/banner.jpg');
    expect(img.getAttribute('alt')).toBe('banner');
  });
});

describe('renderToDOM() — Link', () => {
  it('wraps children in an <a> with absolute URL → external link attrs', () => {
    const dom = renderToDOM(
      el(NSID.Link, { uri: 'https://example.com' }, el(NSID.Text, {}, 'Open')),
    );
    expect(dom.tagName.toLowerCase()).toBe('org-atsui-link');
    const a = dom.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://example.com');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.querySelector('org-atsui-text')!.textContent).toBe('Open');
  });

  it('passes non-absolute uri through without target/rel', () => {
    const dom = renderToDOM(el(NSID.Link, { uri: '/profile/alice' }, 'Profile'));
    const a = dom.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('/profile/alice');
    expect(a.hasAttribute('target')).toBe(false);
    expect(a.hasAttribute('rel')).toBe(false);
    expect(a.textContent).toBe('Profile');
  });
});

describe('renderToDOM() — Maybe', () => {
  it('renders the then branch when when is truthy', () => {
    const dom = renderToDOM(
      el(NSID.Maybe, {
        when: true,
        then: el(NSID.Text, {}, 'shown'),
        else: el(NSID.Text, {}, 'hidden'),
      }),
    );
    expect(dom.tagName.toLowerCase()).toBe('org-atsui-maybe');
    expect(dom.textContent).toBe('shown');
    expect(dom.children).toHaveLength(1);
    expect(dom.children[0].tagName.toLowerCase()).toBe('org-atsui-text');
  });

  it('renders the else branch when when is falsy', () => {
    const dom = renderToDOM(
      el(NSID.Maybe, {
        when: false,
        then: el(NSID.Text, {}, 'shown'),
        else: el(NSID.Text, {}, 'fallback'),
      }),
    );
    expect(dom.textContent).toBe('fallback');
  });

  it('renders nothing when when is falsy and else is missing', () => {
    const dom = renderToDOM(
      el(NSID.Maybe, { when: false, then: el(NSID.Text, {}, 'shown') }),
    );
    expect(dom.tagName.toLowerCase()).toBe('org-atsui-maybe');
    expect(dom.children).toHaveLength(0);
    expect(dom.textContent).toBe('');
  });

  it('takes no ARIA role', () => {
    const dom = renderToDOM(
      el(NSID.Maybe, { when: true, then: el(NSID.Text, {}, 'x') }),
    );
    expect(dom.hasAttribute('role')).toBe(false);
  });
});

describe('renderToDOM() — unknown primitive fallback', () => {
  it('renders a visible warning element with the NSID', () => {
    const dom = renderToDOM({ type: 'org.atsui.NotReal', props: {} });
    expect(dom.tagName.toLowerCase()).toBe('div');
    expect(dom.className).toBe('inlay-unknown-primitive');
    expect(dom.textContent).toContain('org.atsui.NotReal');
  });
});

describe('renderToDOM() — known primitives still work', () => {
  it('renders Title with role=heading aria-level=1', () => {
    const dom = renderToDOM(el(NSID.Title, {}, 'Welcome'));
    expect(dom.tagName.toLowerCase()).toBe('org-atsui-title');
    expect(dom.getAttribute('role')).toBe('heading');
    expect(dom.getAttribute('aria-level')).toBe('1');
    expect(dom.textContent).toBe('Welcome');
  });
});

describe('runtime ↔ compile parity', () => {
  const cases: { name: string; input: InlayElement }[] = [
    {
      name: 'Avatar with src + alt',
      input: el(NSID.Avatar, { src: 'https://example.com/a.png', alt: 'Alice' }),
    },
    {
      name: 'Cover with src + alt',
      input: el(NSID.Cover, { src: 'https://example.com/b.jpg', alt: 'banner' }),
    },
    {
      name: 'Link external',
      input: el(NSID.Link, { uri: 'https://example.com' }, el(NSID.Text, {}, 'Open')),
    },
    {
      name: 'Link internal',
      input: el(NSID.Link, { uri: '/profile/alice' }, 'Profile'),
    },
    {
      name: 'Maybe truthy then',
      input: el(NSID.Maybe, {
        when: true,
        then: el(NSID.Text, {}, 'shown'),
        else: el(NSID.Text, {}, 'hidden'),
      }),
    },
    {
      name: 'Maybe falsy else',
      input: el(NSID.Maybe, {
        when: false,
        then: el(NSID.Text, {}, 'shown'),
        else: el(NSID.Text, {}, 'fallback'),
      }),
    },
    {
      name: 'Maybe falsy with no else',
      input: el(NSID.Maybe, { when: false, then: el(NSID.Text, {}, 'shown') }),
    },
    {
      name: 'unknown primitive fallback',
      input: { type: 'org.atsui.NotReal', props: {} } as InlayElement,
    },
    {
      name: 'composed: Row > Avatar + Stack > Title + Caption',
      input: el(
        NSID.Row,
        { gap: 'medium' },
        el(NSID.Avatar, { src: 'https://example.com/a.png', alt: 'Alice' }),
        el(
          NSID.Stack,
          { gap: 'small' },
          el(NSID.Title, {}, 'Alice'),
          el(NSID.Caption, {}, '@alice'),
        ),
      ),
    },
  ];

  for (const { name, input } of cases) {
    it(name, () => {
      expect(domHtml(input)).toBe(compileToHtml(input));
    });
  }
});
