import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, watch } from 'fs';

import { cloudflare } from "@cloudflare/vite-plugin";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Always read ?raw HTML imports from disk and reload on change */
function rawHtmlReload(): Plugin {
  return {
    name: 'raw-html-reload',
    enforce: 'pre',
    load(id) {
      if (id.endsWith('.html?raw')) {
        const filePath = id.replace('?raw', '');
        return `export default ${JSON.stringify(readFileSync(filePath, 'utf-8'))}`;
      }
    },
    configureServer(server) {
      if (process.env.VITEST) return;
      // Watch template directory for HTML changes
      const viewsDir = resolve(__dirname, 'src/app/views');
      watch(viewsDir, { recursive: true }, (_event, filename) => {
        if (filename && filename.endsWith('.html')) {
          // Invalidate all ?raw HTML modules
          for (const mod of server.moduleGraph.idToModuleMap.values()) {
            if (mod.id?.endsWith('.html?raw')) {
              server.moduleGraph.invalidateModule(mod);
            }
          }
          // Send reload WITHOUT a path so the browser always reloads
          server.ws.send({ type: 'full-reload' });
        }
      });
    },
  };
}

/** Rewrite /wizard* requests to index.html so client-side routing works in dev */
function wizardFallback(): Plugin {
  return {
    name: 'wizard-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && req.url.startsWith('/wizard')) {
          req.url = '/index.html';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    rawHtmlReload(),
    wizardFallback(),
    ...(!process.env.VITEST ? [cloudflare()] : []),
  ],
  server: {
    port: 8080,
    host: '0.0.0.0',
    proxy: {
      '/lexicon-garden': {
        target: 'https://lexicon.garden',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lexicon-garden/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
  },
  publicDir: 'public',
});