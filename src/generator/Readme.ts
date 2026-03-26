/**
 * README generator
 */

import type { AppInfo, RecordType } from '../types/wizard';

export function generateReadme(
  appInfo: AppInfo,
  recordTypes: RecordType[],
  domain: string
): string {
  return `# ${appInfo.appName}

${appInfo.description || 'An AT Protocol application'}

## Author
${appInfo.authorName || 'Unknown'}

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

3. Open http://localhost:8080 in your browser

4. Sign in with your AT Protocol handle (e.g., yourname.bsky.social)

## Record Types

${recordTypes
  .map(
    (r) => `### ${r.name}
${r.description || 'No description'}

**Fields:**
${r.fields
  .map((f) => `- \`${f.name}\` (${f.type})${f.required ? ' - Required' : ''}`)
  .join('\n')}
`
  )
  .join('\n')}

## Building for Production

\`\`\`bash
npm run build
\`\`\`

The built files will be in the \`dist/\` directory.

## Deploying to Production

This app uses AT Protocol OAuth for authentication. In development mode
(\`npm run dev\`), it uses loopback authentication that requires no setup.
For production deployment, you need to configure OAuth:

### 1. Set up environment variables

Copy the example env file and set your production URL:

\`\`\`bash
cp .env.example .env.production
\`\`\`

Edit \`.env.production\`:

\`\`\`bash
VITE_APP_URL=https://your-app-domain.com
\`\`\`

### 2. Build the app

\`\`\`bash
npm run build
\`\`\`

This automatically generates \`client-metadata.json\` in the \`dist/\` directory
with your OAuth configuration.

### 3. Deploy

Upload the \`dist/\` directory to any static hosting provider (Netlify, Vercel,
Cloudflare Pages, GitHub Pages, etc).

**Important:** The \`client-metadata.json\` file must be accessible at
\`https://your-domain.com/client-metadata.json\`. Most static hosts serve
files from the root directory automatically.

### How AT Protocol OAuth works

- Your app's \`client-metadata.json\` tells AT Protocol authorization servers
  where to redirect users after login
- The \`client_id\` in the metadata must exactly match the URL where the file
  is served
- No server-side code or API keys are needed — AT Protocol OAuth uses
  public clients with DPoP-bound tokens
`;
}
