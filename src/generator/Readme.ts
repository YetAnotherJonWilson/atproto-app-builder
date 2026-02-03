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
`;
}
