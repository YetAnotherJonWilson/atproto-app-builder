import { describe, it, expect } from 'vitest';
import { generateStoreTest } from '../../src/generator/tests/StoreTest';

describe('generateStoreTest', () => {
  const output = generateStoreTest();

  it('imports Store and storeManager from the generated store module', () => {
    expect(output).toContain("import Store, { storeManager } from '../src/store'");
  });

  it('asserts subscribe returns an unsubscribe function', () => {
    expect(output).toContain('storeManager.subscribe');
    expect(output).toContain("expect(typeof unsubscribe).toBe('function')");
  });

  it('asserts the default Store export is an object', () => {
    expect(output).toContain("expect(typeof Store).toBe('object')");
  });
});
