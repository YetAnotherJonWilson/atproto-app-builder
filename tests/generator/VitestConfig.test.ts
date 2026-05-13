import { describe, it, expect } from 'vitest';
import { generateVitestConfig } from '../../src/generator/config/VitestConfig';

describe('generateVitestConfig', () => {
  const output = generateVitestConfig();

  it('configures the jsdom environment', () => {
    expect(output).toContain("environment: 'jsdom'");
  });

  it('includes tests under tests/', () => {
    expect(output).toContain("include: ['tests/**/*.{test,spec}.ts']");
  });

  it('imports defineConfig from vitest/config', () => {
    expect(output).toContain("import { defineConfig } from 'vitest/config'");
  });
});
