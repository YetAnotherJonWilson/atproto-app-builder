/**
 * Main generator module - orchestrates all file generation
 */

import type { WizardState, AppConfig, View, Block } from '../types/wizard';
import type { FileOutput } from '../types/generation';
import { toPascalCase, toCamelCase } from '../utils';
import { buildScopeFromNsids } from '../shared/scopes';

// Config generators
import { generatePackageJson } from './config/PackageJson';
import { generateViteConfig } from './config/ViteConfig';
import { generateTsConfig } from './config/TsConfig';
import { generateEnvironmentTs } from './config/Environment';
import { generateEnvExample } from './config/EnvExample';

// Template generators
import { generateIndexHtml } from './templates/IndexHtml';
import { generateStyles } from './templates/Styles';

// AT Protocol generators
import { generateAuthTs } from './atproto/Auth';
import { generateTypesTs } from './atproto/Types';
import { generateApiTs } from './atproto/Api';
import { generateSessionManagerTs } from './atproto/Session';

// App generators
import { generateMainTs } from './app/Main';
import { generateStoreTs } from './app/Store';
import { generateUITs } from './app/UI';
import { generateRouterTs } from './app/Router';

// View and component generators
import { generateViewPage } from './views/ViewPage';
import { generateNavMenuComponent } from './components/NavMenu';

// Other generators
import { generateRecordLexicon, computeRecordTypeNsid } from './Lexicon';
import { generateReadme } from './Readme';

// ── Name/slug helpers with collision handling ─────────────────────────

function buildUniqueNames(
  items: { id: string; name: string }[],
  toCase: (name: string) => string
): Map<string, string> {
  const result = new Map<string, string>();
  const usedNames = new Map<string, number>();

  for (const item of items) {
    let baseName = toCase(item.name);
    if (!baseName) baseName = toCase('unnamed');

    const count = usedNames.get(baseName) ?? 0;
    const finalName = count === 0 ? baseName : `${baseName}${count + 1}`;
    usedNames.set(baseName, count + 1);
    result.set(item.id, finalName);
  }

  return result;
}

// ── Identify blocks that are actually assigned to views ───────────────

function getAssignedBlocks(views: View[], allBlocks: Block[]): Block[] {
  const assignedIds = new Set<string>();
  for (const view of views) {
    for (const blockId of view.blockIds) {
      assignedIds.add(blockId);
    }
  }
  return allBlocks.filter(b => assignedIds.has(b.id));
}

// ── Main generation entry point ──────────────────────────────────────

export function generateAllFiles(wizardState: WizardState, appConfig: AppConfig): FileOutput {
  const files: FileOutput = {};
  const { appInfo, recordTypes, views, blocks } = wizardState;
  const domain = appInfo.domain;

  // Build unique PascalCase filenames and camelCase slugs for views
  const viewFileNames = buildUniqueNames(views, toPascalCase);   // id → PascalCase
  const viewSlugs = buildUniqueNames(views, toCamelCase);        // id → camelCase

  // Build unique PascalCase filenames for assigned blocks
  const assignedBlocks = getAssignedBlocks(views, blocks);
  const blockFileNames = buildUniqueNames(assignedBlocks, toPascalCase);

  // Build view entries for the Router
  const viewEntries = views.map(v => ({
    viewId: viewSlugs.get(v.id)!,
    fileName: viewFileNames.get(v.id)!,
    functionName: `render${viewFileNames.get(v.id)}View`,
  }));

  const firstViewId = viewEntries.length > 0 ? viewEntries[0].viewId : 'home';

  // ── Compute OAuth scope from record types ─────────────────────────

  const nsids = recordTypes.map(rt => computeRecordTypeNsid(rt, domain));
  const scope = buildScopeFromNsids(nsids);

  // ── Root files ─────────────────────────────────────────────────────

  files['package.json'] = generatePackageJson(appInfo);
  files['vite.config.ts'] = generateViteConfig(appInfo.appName, scope);
  files['tsconfig.json'] = generateTsConfig();
  files['.env.example'] = generateEnvExample();
  files['index.html'] = generateIndexHtml(appInfo);
  files['styles.css'] = generateStyles();

  // ── App entry and core ─────────────────────────────────────────────

  files['src/main.ts'] = generateMainTs(firstViewId);
  files['src/router.ts'] = generateRouterTs(viewEntries);
  files['src/store.ts'] = generateStoreTs(recordTypes);
  files['src/ui.ts'] = generateUITs();

  // ── AT Protocol layer ──────────────────────────────────────────────

  files['src/config/environment.ts'] = generateEnvironmentTs(scope);
  files['src/atproto/auth.ts'] = generateAuthTs();
  files['src/atproto/types.ts'] = generateTypesTs(recordTypes, domain);
  files['src/atproto/api.ts'] = generateApiTs(recordTypes, domain);
  files['src/atproto/session.ts'] = generateSessionManagerTs(recordTypes);

  // ── NavMenu components (for menu-type blocks) ──────────────────────

  const menuBlocks = assignedBlocks.filter(b => b.blockType === 'menu');
  for (const block of menuBlocks) {
    const fileName = blockFileNames.get(block.id)!;
    const functionName = `render${fileName}`;
    files[`src/components/${fileName}.ts`] = generateNavMenuComponent(
      block,
      wizardState.requirements,
      views,
      viewSlugs,
      functionName
    );
  }

  // ── View pages ─────────────────────────────────────────────────────

  for (const view of views) {
    const fileName = viewFileNames.get(view.id)!;
    const functionName = `render${fileName}View`;

    // Resolve blocks assigned to this view
    const viewBlocks = view.blockIds
      .map(id => blocks.find(b => b.id === id))
      .filter((b): b is Block => b != null)
      .map(block => {
        if (block.blockType === 'menu') {
          const compFileName = blockFileNames.get(block.id)!;
          return {
            block,
            componentFile: compFileName,
            componentFunction: `render${compFileName}`,
          };
        }
        return { block };
      });

    files[`src/views/${fileName}.ts`] = generateViewPage(
      view,
      functionName,
      viewBlocks,
      wizardState
    );
  }

  // ── Lexicons ───────────────────────────────────────────────────────

  recordTypes.forEach(record => {
    const nsid = computeRecordTypeNsid(record, domain);
    const lexicon = generateRecordLexicon(record, domain, recordTypes);
    files[`lexicons/${nsid.replace(/\./g, '/')}.json`] = JSON.stringify(lexicon, null, 2);
  });

  // ── README ─────────────────────────────────────────────────────────

  files['README.md'] = generateReadme(appInfo, recordTypes, domain);

  return files;
}

// Re-export for use in views
export { generateRecordLexicon, computeRecordTypeNsid } from './Lexicon';
