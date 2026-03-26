/**
 * .env.example generator for generated apps.
 */

export function generateEnvExample(): string {
  return `# Production OAuth Configuration
# Copy this file to .env.production and fill in your values.
# These are only used when running \`npm run build\` (production mode).

# Required: The public URL where your app will be hosted
# Example: https://myapp.example.com
VITE_APP_URL=

# Optional: Override the OAuth client ID (defaults to \${VITE_APP_URL}/client-metadata.json)
# VITE_OAUTH_CLIENT_ID=

# Optional: Override the OAuth redirect URI (defaults to VITE_APP_URL)
# VITE_OAUTH_REDIRECT_URI=
`;
}
