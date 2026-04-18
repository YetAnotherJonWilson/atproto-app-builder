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

  it('renders data-inlay-did when did is a string and src is absent', () => {
    const dom = renderToDOM(el(NSID.Avatar, { did: 'did:plc:abc123' }));
    expect(dom.getAttribute('data-inlay-did')).toBe('did:plc:abc123');
    expect(dom.querySelector('img')!.hasAttribute('src')).toBe(false);
  });

  it('does not set data-inlay-did when src is present', () => {
    const dom = renderToDOM(el(NSID.Avatar, { did: 'did:plc:abc123', src: 'https://example.com/a.png' }));
    expect(dom.hasAttribute('data-inlay-did')).toBe(false);
    expect(dom.querySelector('img')!.getAttribute('src')).toBe('https://example.com/a.png');
  });

  it('renders size attribute', () => {
    const dom = renderToDOM(el(NSID.Avatar, { src: 'https://example.com/a.png', size: 'small' }));
    expect(dom.getAttribute('size')).toBe('small');
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

describe('renderToDOM() — Maybe (at.inlay.Maybe)', () => {
  it('renders the children branch when present', () => {
    const dom = renderToDOM({
      type: NSID.Maybe,
      props: {
        children: [el(NSID.Text, {}, 'shown')],
        fallback: el(NSID.Text, {}, 'hidden'),
      },
    });
    expect(dom.tagName.toLowerCase()).toBe('at-inlay-maybe');
    expect(dom.textContent).toBe('shown');
    expect(dom.children).toHaveLength(1);
    expect(dom.children[0].tagName.toLowerCase()).toBe('org-atsui-text');
  });

  it('renders fallback when children is absent', () => {
    const dom = renderToDOM({
      type: NSID.Maybe,
      props: {
        fallback: el(NSID.Text, {}, 'fallback'),
      },
    });
    expect(dom.textContent).toBe('fallback');
  });

  it('renders nothing when both children and fallback are absent', () => {
    const dom = renderToDOM({ type: NSID.Maybe, props: {} });
    expect(dom.tagName.toLowerCase()).toBe('at-inlay-maybe');
    expect(dom.children).toHaveLength(0);
    expect(dom.textContent).toBe('');
  });

  it('renders a single element child (not array)', () => {
    const dom = renderToDOM({
      type: NSID.Maybe,
      props: {
        children: el(NSID.Text, {}, 'single'),
      },
    });
    expect(dom.textContent).toBe('single');
  });

  it('takes no ARIA role', () => {
    const dom = renderToDOM({
      type: NSID.Maybe,
      props: { children: [el(NSID.Text, {}, 'x')] },
    });
    expect(dom.hasAttribute('role')).toBe(false);
  });
});

describe('renderToDOM() — Binding', () => {
  it('renders a span with data-inlay-bind attribute', () => {
    const dom = renderToDOM({
      type: NSID.Binding,
      props: { path: ['record', 'avatar'] },
    });
    expect(dom.tagName.toLowerCase()).toBe('span');
    expect(dom.getAttribute('data-inlay-bind')).toBe('record.avatar');
  });
});

describe('renderToDOM() — prop-value recursion', () => {
  it('Avatar with Binding src emits data-inlay-bind-src', () => {
    const dom = renderToDOM({
      type: NSID.Avatar,
      props: {
        src: { type: NSID.Binding, props: { path: ['record', 'avatar'] } },
        did: { type: NSID.Binding, props: { path: ['props', 'uri', '$did'] } },
        size: 'small',
      },
    });
    expect(dom.getAttribute('data-inlay-bind-src')).toBe('record.avatar');
    expect(dom.getAttribute('data-inlay-bind-did')).toBe('props.uri.$did');
    expect(dom.getAttribute('size')).toBe('small');
  });

  it('Link with Binding uri emits data-inlay-bind-href on anchor', () => {
    const dom = renderToDOM({
      type: NSID.Link,
      props: {
        uri: { type: NSID.Binding, props: { path: ['props', 'uri'] } },
        children: [el(NSID.Text, {}, 'click')],
      },
    });
    const a = dom.querySelector('a')!;
    expect(a.getAttribute('data-inlay-bind-href')).toBe('props.uri');
    expect(a.hasAttribute('href')).toBe(false);
    expect(a.textContent).toBe('click');
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

describe('runtime ↔ compile parity (non-Maybe, non-Binding primitives)', () => {
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

describe('runtime ↔ compile parity — Binding', () => {
  it('child binding produces same span markup', () => {
    const binding: InlayElement = { type: NSID.Binding, props: { path: ['record', 'name'] } };
    expect(domHtml(binding)).toBe(compileToHtml(binding));
  });

  it('attribute binding on Avatar produces same marker attrs', () => {
    const avatar: InlayElement = {
      type: NSID.Avatar,
      props: {
        src: { type: NSID.Binding, props: { path: ['record', 'avatar'] } },
        size: 'small',
      },
    };
    expect(domHtml(avatar)).toBe(compileToHtml(avatar));
  });

  it('attribute binding on Link produces same marker attrs', () => {
    const link: InlayElement = {
      type: NSID.Link,
      props: {
        uri: { type: NSID.Binding, props: { path: ['props', 'uri'] } },
        children: 'click',
      },
    };
    expect(domHtml(link)).toBe(compileToHtml(link));
  });
});
