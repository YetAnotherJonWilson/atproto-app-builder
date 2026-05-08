import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../src/utils/html';

describe('escapeHtml', () => {
  it('escapes ampersands first so other entities are not double-encoded', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double and single quotes', () => {
    expect(escapeHtml(`"hello"`)).toBe('&quot;hello&quot;');
    expect(escapeHtml(`it's`)).toBe('it&#39;s');
  });

  it('escapes a mixed string in a single pass', () => {
    expect(escapeHtml(`<a href="x">it's & ok</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;it&#39;s &amp; ok&lt;/a&gt;'
    );
  });

  it('returns plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});
