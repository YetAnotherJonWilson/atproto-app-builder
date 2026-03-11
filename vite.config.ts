import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  plugins: [wizardFallback()],
  server: {
    port: 8080,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  publicDir: 'public',
});
