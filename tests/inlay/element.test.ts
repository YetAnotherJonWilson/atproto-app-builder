import { describe, it, expect } from 'vitest';
import { el, NSID } from '../../src/inlay/element';
import type { InlayElement } from '../../src/inlay/element';

describe('el()', () => {
  it('creates an element with type and empty props', () => {
    const result = el(NSID.Text, {});
    expect(result.type).toBe('org.atsui.Text');
    expect(result.props).toEqual({});
  });

  it('creates an element with props', () => {
    const result = el(NSID.Stack, { gap: 'small' });
    expect(result.props.gap).toBe('small');
  });

  it('adds a single string child to props.children', () => {
    const result = el(NSID.Text, {}, 'Hello');
    expect(result.props.children).toBe('Hello');
  });

  it('adds a single element child directly (not wrapped in array)', () => {
    const child = el(NSID.Text, {}, 'Hi');
    const result = el(NSID.Stack, {}, child);
    expect(result.props.children).toBe(child);
  });

  it('adds multiple children as an array', () => {
    const child1 = el(NSID.Title, {}, 'Title');
    const child2 = el(NSID.Text, {}, 'Body');
    const result = el(NSID.Stack, {}, child1, child2);
    expect(Array.isArray(result.props.children)).toBe(true);
    expect((result.props.children as InlayElement[]).length).toBe(2);
  });

  it('omits children from props when none provided', () => {
    const result = el(NSID.Fill, {});
    expect(result.props).not.toHaveProperty('children');
  });

  it('merges explicit props with children', () => {
    const result = el(NSID.Stack, { gap: 'large' }, el(NSID.Text, {}, 'Hi'));
    expect(result.props.gap).toBe('large');
    expect(result.props.children).toBeDefined();
  });
});

describe('NSID constants', () => {
  it('has correct NSID format', () => {
    expect(NSID.Stack).toBe('org.atsui.Stack');
    expect(NSID.Row).toBe('org.atsui.Row');
    expect(NSID.Title).toBe('org.atsui.Title');
    expect(NSID.Heading).toBe('org.atsui.Heading');
    expect(NSID.Text).toBe('org.atsui.Text');
    expect(NSID.Caption).toBe('org.atsui.Caption');
    expect(NSID.Fill).toBe('org.atsui.Fill');
  });
});
