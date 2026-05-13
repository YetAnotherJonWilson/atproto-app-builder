/**
 * Package.json generator
 */

import type { AppInfo } from '../../types/wizard';

export function generatePackageJson(appInfo: AppInfo): string {
  const safeName = appInfo.appName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  return JSON.stringify({
    "name": safeName,
    "version": "1.0.0",
    "description": appInfo.description || `${appInfo.appName} - An AT Protocol application`,
    "main": "index.js",
    "scripts": {
      "dev": "vite",
      "build": "vite build",
      "preview": "vite preview",
      "test": "vitest run"
    },
    "author": appInfo.authorName || "",
    "license": "MIT",
    "type": "module",
    "dependencies": {
      "@atproto/api": "^0.18.8",
      "@atproto/lexicon": "^0.5.1",
      "@atproto/oauth-client-browser": "^0.3.35",
      "@atproto/oauth-types": "^0.6.3"
    },
    "devDependencies": {
      "@types/node": "^25.0.3",
      "jsdom": "^29.0.0",
      "typescript": "^5.9.3",
      "vite": "^7.2.4",
      "vitest": "^4.0.18"
    }
  }, null, 2);
}
