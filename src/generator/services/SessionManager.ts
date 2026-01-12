/**
 * Session Manager service generator
 */

import type { RecordType } from '../../types/wizard';
import { toPascalCase, toCamelCase } from '../../utils';

export function generateSessionManagerTs(recordTypes: RecordType[]): string {
  const imports = recordTypes.map(r => `get${toPascalCase(r.name)}s`).join(', ');
  let setters = '';

  recordTypes.forEach(record => {
    const pascalName = toPascalCase(record.name);
    const camelName = toCamelCase(record.name);
    setters += `
    const ${camelName}sResponse = await get${pascalName}s();
    storeManager.set${pascalName}s(${camelName}sResponse.${camelName}s);
    console.log(\`Loaded \${${camelName}sResponse.${camelName}s.length} ${record.name}s\`);
`;
  });

  return `/**
 * Session management for user authentication and data loading
 */

import { ${imports} } from './API';
import { storeManager } from './Store';
import {
  restoreSession as restoreAuthSession,
  getUserProfile,
  getSession,
} from './Auth';

export async function updateUserInfo(): Promise<void> {
  try {
    const profile = await getUserProfile();

    const userDisplayNameEl = document.getElementById('userDisplayName') as HTMLElement;
    const userHandleEl = document.getElementById('userHandle') as HTMLElement;
    const userDidEl = document.getElementById('userDid') as HTMLElement;

    userDisplayNameEl.textContent = profile.displayName;
    userHandleEl.textContent = profile.handle;
    userDidEl.textContent = profile.did;
  } catch (error) {
    console.error('Failed to update user info:', error);
  }
}

export async function loadUserData(): Promise<void> {
  if (!getSession()) return;

  try {${setters}
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to load user data:', errorMsg);
  }
}

export async function restoreSession(): Promise<{
  session: { sub: string };
  state?: string;
} | null> {
  try {
    return await restoreAuthSession();
  } catch (error) {
    console.error('Session restoration error:', error);
    return null;
  }
}
`;
}
