/**
 * Vite config generator
 */

export function generateViteConfig(): string {
  return `import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8080,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
  },
  publicDir: 'public',
});
`;
}
