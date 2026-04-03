/**
 * Vite config generator
 */

export function generateViteConfig(appName: string, scope: string): string {
  // Escape any backticks or backslashes in the app name for safe embedding
  const safeAppName = appName.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/'/g, "\\'");
  const safeScope = scope.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  return `import { defineConfig, loadEnv } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function clientMetadataPlugin() {
  let outDir: string;

  return {
    name: 'generate-client-metadata',
    configResolved(config: any) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const env = loadEnv('production', process.cwd(), 'VITE_');
      const appUrl = env.VITE_APP_URL || '';

      if (!appUrl) {
        console.warn(
          '\\n\\u26a0 VITE_APP_URL not set — skipping client-metadata.json generation.' +
          '\\n  Set VITE_APP_URL in .env.production for OAuth to work in production.\\n'
        );
        return;
      }

      const origin = appUrl.replace(/\\/+$/, '');
      const redirectUri = env.VITE_OAUTH_REDIRECT_URI || origin;

      function writeMetadata(filename: string, scope: string) {
        const clientId = filename === 'client-metadata.json'
          ? (env.VITE_OAUTH_CLIENT_ID || \`\${origin}/\${filename}\`)
          : \`\${origin}/\${filename}\`;

        const metadata = {
          client_id: clientId,
          client_name: '${safeAppName}',
          client_uri: origin,
          redirect_uris: [redirectUri],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          scope,
          token_endpoint_auth_method: 'none',
          application_type: 'web',
          dpop_bound_access_tokens: true,
        };

        mkdirSync(outDir, { recursive: true });
        writeFileSync(
          resolve(outDir, filename),
          JSON.stringify(metadata, null, 2)
        );
        console.log(\`\\u2713 Generated \${filename} for \${origin}\`);
      }

      writeMetadata('client-metadata.json', '${safeScope}');
      writeMetadata('client-metadata-compat.json', 'atproto transition:generic');
    },
  };
}

export default defineConfig({
  plugins: [clientMetadataPlugin()],
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
