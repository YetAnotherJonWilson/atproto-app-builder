/**
 * Main generator module - orchestrates all file generation
 */

import type { WizardState, AppConfig, View, Component } from '../types/wizard';
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
import { generateIdentityTs } from './atproto/Identity';

// App generators
import { generateMainTs } from './app/Main';
import { generateStoreTs } from './app/Store';
import { generateUITs } from './app/UI';
import { generateRouterTs } from './app/Router';

// View and component generators
import { generateViewPage } from './views/ViewPage';
import { generateNavMenuComponent } from './components/NavMenu';
import {
  generateChecklistComponent,
  resolveChecklistConfig,
} from './components/Checklist';

// Other generators
import { generateRecordLexicon, computeRecordTypeNsid } from './Lexicon';
import { generateReadme } from './Readme';

// Inlay template integration
import { resolveAttachedTemplates } from './inlay/resolution';
import { isResolveError } from '../inlay/resolve';

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

// ── Identify components that are actually assigned to views ──────────

function getAssignedComponents(views: View[], allComponents: Component[]): Component[] {
  const assignedIds = new Set<string>();
  for (const view of views) {
    for (const componentId of view.componentIds) {
      assignedIds.add(componentId);
    }
  }
  return allComponents.filter(c => assignedIds.has(c.id));
}

// ── Main generation entry point ──────────────────────────────────────

export async function generateAllFiles(
  wizardState: WizardState,
  appConfig: AppConfig
): Promise<FileOutput> {
  const files: FileOutput = {};
  const { appInfo, recordTypes, views, components } = wizardState;

  // Resolve any attached Inlay template components up front so view
  // generation has resolution outcomes on hand and the session cache is
  // warm for the panel's broken-template badge.
  const inlayResolutions = await resolveAttachedTemplates(components);
  const hasInlaySuccess = [...inlayResolutions.values()].some(
    r => !isResolveError(r) && r.unresolvedComponents.length === 0
  );

  // Build unique PascalCase filenames and camelCase slugs for views
  const viewFileNames = buildUniqueNames(views, toPascalCase);   // id → PascalCase
  const viewSlugs = buildUniqueNames(views, toCamelCase);        // id → camelCase

  // Build unique PascalCase filenames for assigned components
  const assignedComponents = getAssignedComponents(views, components);
  const componentFileNames = buildUniqueNames(assignedComponents, toPascalCase);

  // Build view entries for the Router
  const viewEntries = views.map(v => ({
    viewId: viewSlugs.get(v.id)!,
    fileName: viewFileNames.get(v.id)!,
    functionName: `render${viewFileNames.get(v.id)}View`,
  }));

  const firstViewId = viewEntries.length > 0 ? viewEntries[0].viewId : 'home';

  // ── Compute OAuth scope from record types ─────────────────────────

  const nsids = recordTypes.map(rt => computeRecordTypeNsid(rt));
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
  files['src/atproto/types.ts'] = generateTypesTs(recordTypes);
  files['src/atproto/api.ts'] = generateApiTs(recordTypes);
  files['src/atproto/session.ts'] = generateSessionManagerTs(recordTypes);

  // identity.ts is only needed by inlay templates that bind a DID to an
  // <img>. Emitting it whenever any inlay template resolved successfully
  // keeps the rule simple — at worst an unused 1KB file lands in projects
  // whose templates don't bind a DID.
  if (hasInlaySuccess) {
    files['src/atproto/identity.ts'] = generateIdentityTs();
  }

  // ── NavMenu components (for menu-type components) ─────────────────

  const menuComponents = assignedComponents.filter(c => c.componentType === 'menu');
  for (const component of menuComponents) {
    const fileName = componentFileNames.get(component.id)!;
    const functionName = `render${fileName}`;
    files[`src/components/${fileName}.ts`] = generateNavMenuComponent(
      component,
      wizardState.requirements,
      views,
      viewSlugs,
      functionName
    );
  }

  // ── Checklist components ──────────────────────────────────────────

  const checklistComponents = assignedComponents.filter(
    c => c.componentType === 'checklist',
  );
  for (const component of checklistComponents) {
    const recordType = findBoundRecordTypeFor(component, wizardState);
    if (!recordType) continue;
    const resolution = resolveChecklistConfig(component, recordType);
    if (resolution.kind !== 'ok') continue;
    const fileName = componentFileNames.get(component.id)!;
    const functionName = `render${fileName}`;
    files[`src/components/${fileName}.ts`] = generateChecklistComponent(
      component,
      resolution.recordType,
      resolution.config,
      functionName,
    );
  }

  // ── View pages ─────────────────────────────────────────────────────

  for (const view of views) {
    const fileName = viewFileNames.get(view.id)!;
    const functionName = `render${fileName}View`;

    // Resolve components assigned to this view
    const viewComponents = view.componentIds
      .map(id => components.find(c => c.id === id))
      .filter((c): c is Component => c != null)
      .map(component => {
        if (component.componentType === 'menu') {
          const compFileName = componentFileNames.get(component.id)!;
          return {
            component,
            componentFile: compFileName,
            componentFunction: `render${compFileName}`,
          };
        }
        if (component.componentType === 'checklist') {
          // Only emit a real-component reference if the file was actually
          // generated; otherwise ViewPage falls through to placeholder.
          const compFileName = componentFileNames.get(component.id)!;
          const functionName = `render${compFileName}`;
          const wasEmitted =
            !!files[`src/components/${compFileName}.ts`];
          if (wasEmitted) {
            return {
              component,
              componentFile: compFileName,
              componentFunction: functionName,
            };
          }
        }
        return { component };
      });

    files[`src/views/${fileName}.ts`] = generateViewPage(
      view,
      functionName,
      viewComponents,
      wizardState,
      inlayResolutions
    );
  }

  // ── Lexicons ───────────────────────────────────────────────────────

  recordTypes.forEach(record => {
    const nsid = computeRecordTypeNsid(record);
    const lexicon = generateRecordLexicon(record, recordTypes);
    files[`lexicons/${nsid.replace(/\./g, '/')}.json`] = JSON.stringify(lexicon, null, 2);
  });

  // ── README ─────────────────────────────────────────────────────────

  files['README.md'] = generateReadme(appInfo, recordTypes);

  return files;
}

// Re-export for use in views
export { generateRecordLexicon, computeRecordTypeNsid } from './Lexicon';

function findBoundRecordTypeFor(
  component: Component,
  wizardState: WizardState,
) {
  for (const reqId of component.requirementIds) {
    const req = wizardState.requirements.find(r => r.id === reqId);
    if (req?.type !== 'do' || !req.dataTypeIds || req.dataTypeIds.length === 0) {
      continue;
    }
    const rt = wizardState.recordTypes.find(r => r.id === req.dataTypeIds![0]);
    if (rt) return rt;
  }
  return null;
}
