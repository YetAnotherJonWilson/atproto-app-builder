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
      "preview": "vite preview"
    },
    "author": appInfo.authorName || "",
    "license": "MIT",
    "type": "module",
    "dependencies": {
      "@atproto/api": "^0.18.8",
      "@atproto/lexicon": "^0.5.1",
      "@atproto/oauth-client-browser": "^0.3.35"
    },
    "devDependencies": {
      "@types/node": "^25.0.3",
      "typescript": "^5.9.3",
      "vite": "^7.2.4"
    }
  }, null, 2);
}
