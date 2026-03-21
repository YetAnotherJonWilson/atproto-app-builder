/**
 * ID generation utilities
 */

import type { Field } from '../types/wizard';

export function generateId(): string {
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

/** Create the standard createdAt system field for new lexicons */
export function makeSystemCreatedAtField(): Field {
  return {
    id: generateId(),
    name: 'createdAt',
    type: 'string',
    format: 'datetime',
    required: true,
    isSystem: true,
  };
}
