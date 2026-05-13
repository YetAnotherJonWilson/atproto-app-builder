/**
 * Generator for the generated app's tests/store.test.ts.
 *
 * v1: a minimal, data-model-agnostic test that exercises the
 * subscribe/unsubscribe contract. Per-record-type setter tests
 * are deferred to a future iteration.
 */

export function generateStoreTest(): string {
  return `import { describe, it, expect } from 'vitest';
import Store, { storeManager } from '../src/store';

describe('store', () => {
  it('default export is an object', () => {
    expect(typeof Store).toBe('object');
    expect(Store).not.toBeNull();
  });

  it('subscribe returns an unsubscribe function', () => {
    const unsubscribe = storeManager.subscribe(() => {});
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('calling unsubscribe twice does not throw', () => {
    const unsubscribe = storeManager.subscribe(() => {});
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
  });
});
`;
}
