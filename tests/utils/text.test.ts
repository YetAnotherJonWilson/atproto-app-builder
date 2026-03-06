import { describe, it, expect } from 'vitest';
import { toPascalCase, toCamelCase } from '../../src/utils/text';

describe('toPascalCase', () => {
  it('converts space-separated words', () => {
    expect(toPascalCase('hello world')).toBe('HelloWorld');
  });

  it('converts hyphen-separated words', () => {
    expect(toPascalCase('my-app-name')).toBe('MyAppName');
  });

  it('handles single word', () => {
    expect(toPascalCase('hello')).toBe('Hello');
  });

  it('strips non-alphanumeric characters', () => {
    expect(toPascalCase('hello@world!')).toBe('HelloWorld');
  });

  it('handles empty string', () => {
    expect(toPascalCase('')).toBe('');
  });
});

describe('toCamelCase', () => {
  it('converts space-separated words', () => {
    expect(toCamelCase('hello world')).toBe('helloWorld');
  });

  it('lowercases first character', () => {
    expect(toCamelCase('MyApp')).toBe('myapp');
  });

  it('handles single word', () => {
    expect(toCamelCase('Hello')).toBe('hello');
  });
});
