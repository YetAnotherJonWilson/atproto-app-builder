/**
 * Store service generator
 */

import type { RecordType } from '../../types/wizard';
import { toPascalCase, toCamelCase } from '../../utils';

export function generateStoreTs(recordTypes: RecordType[]): string {
  const imports = recordTypes.map(r => `${toPascalCase(r.name)}Data`).join(',\n  ');

  let output = `/**
 * Global store for app state
 */

import {
  StoreType,
  ${imports},
} from './types';

type StoreListener = (store: StoreType) => void;

class StoreManager {
  private store: StoreType;
  private listeners: Set<StoreListener> = new Set();

  constructor(store: StoreType) {
    this.store = store;
  }

`;

  // Generate setter for each record type
  recordTypes.forEach(record => {
    const pascalName = toPascalCase(record.name);
    const camelName = toCamelCase(record.name);
    output += `  set${pascalName}s(items: ${pascalName}Data[]): void {
    this.store.${camelName}s = items;
    this.notify();
  }

`;
  });

  output += `  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.store));
  }
}

// The raw store object
const Store: StoreType = {
`;

  recordTypes.forEach(record => {
    output += `  ${toCamelCase(record.name)}s: [],\n`;
  });

  output += `};

export const storeManager = new StoreManager(Store);
export default Store;
`;

  return output;
}
