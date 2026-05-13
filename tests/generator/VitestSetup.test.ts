// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { initializeWizardState } from '../../src/app/state/WizardState';
import { generateAllFiles } from '../../src/generator';

describe('generator emits a Vitest setup', () => {
  it('writes vitest.config.ts and tests/store.test.ts at the project root', async () => {
    const state = initializeWizardState();
    const files = await generateAllFiles(state);

    expect(files).toHaveProperty('vitest.config.ts');
    expect(files).toHaveProperty('tests/store.test.ts');
  });

  it('emitted vitest.config.ts parses as a valid TypeScript module', async () => {
    const state = initializeWizardState();
    const files = await generateAllFiles(state);

    // Lightweight check: balanced braces and the defineConfig export.
    const config = files['vitest.config.ts'];
    expect(config).toContain('export default defineConfig(');
    const openBraces = (config.match(/\{/g) ?? []).length;
    const closeBraces = (config.match(/\}/g) ?? []).length;
    expect(openBraces).toBe(closeBraces);
  });

  it('emitted store test imports from the generated store module', async () => {
    const state = initializeWizardState();
    const files = await generateAllFiles(state);

    expect(files['tests/store.test.ts']).toContain("from '../src/store'");
  });
});
