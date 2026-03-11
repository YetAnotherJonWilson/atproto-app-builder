import { describe, it, expect } from 'vitest';
import { generatePackageJson } from '../../src/generator/config/PackageJson';
import type { AppInfo } from '../../src/types/wizard';

describe('generatePackageJson', () => {
  const baseAppInfo: AppInfo = {
    appName: 'My Cool App',
    domain: 'example.com',
    description: 'A test app',
    authorName: 'Test Author',
  };

  it('produces valid JSON', () => {
    const result = generatePackageJson(baseAppInfo);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('slugifies the app name', () => {
    const parsed = JSON.parse(generatePackageJson(baseAppInfo));
    expect(parsed.name).toBe('my-cool-app');
  });

  it('uses description from appInfo', () => {
    const parsed = JSON.parse(generatePackageJson(baseAppInfo));
    expect(parsed.description).toBe('A test app');
  });

  it('falls back to generated description when empty', () => {
    const info = { ...baseAppInfo, description: '' };
    const parsed = JSON.parse(generatePackageJson(info));
    expect(parsed.description).toContain('My Cool App');
  });

  it('includes atproto dependencies', () => {
    const parsed = JSON.parse(generatePackageJson(baseAppInfo));
    expect(parsed.dependencies).toHaveProperty('@atproto/api');
    expect(parsed.dependencies).toHaveProperty('@atproto/oauth-client-browser');
  });

  it('sets author from appInfo', () => {
    const parsed = JSON.parse(generatePackageJson(baseAppInfo));
    expect(parsed.author).toBe('Test Author');
  });
});
