/**
 * View page generator
 *
 * Generates one TypeScript file per wizard View. Each file exports a render
 * function that composes the view's assigned components in order. Menu
 * components call their NavMenu component; text components compile their
 * Inlay content tree at generation time; components with an attached
 * Inlay template (`inlayComponentRef`) emit the foundation-compiled HTML
 * plus a per-component `bindComponent<i>` function (inlined into the view
 * file) that hydrates record data at runtime; everything else falls back
 * to a placeholder.
 */

import type { View, Component, RecordType, WizardState } from '../../types/wizard';
import { escapeHtml } from '../../utils';
import { generatePlaceholderHtml } from '../components/Placeholder';
import {
  resolveChecklistConfig,
  describeChecklistFailure,
} from '../components/Checklist';
import { buildContentNodeTree } from '../../inlay/text-variants';
import { compileToHtml } from '../inlay/compile';
import { compileBindFunction } from '../inlay/data-binding';
import type { InlayResolutionMap } from '../inlay/resolution';
import { isResolveError } from '../../inlay/resolve';

interface ViewComponentInfo {
  component: Component;
  /** PascalCase component filename (without extension) for menu components */
  componentFile?: string;
  /** Function name to call for menu components */
  componentFunction?: string;
}

/**
 * Generate the view page file content for a single wizard View.
 */
export function generateViewPage(
  view: View,
  viewFunctionName: string,
  components: ViewComponentInfo[],
  wizardState: WizardState,
  inlayResolutions: InlayResolutionMap
): string {
  const { requirements, recordTypes, nonDataElements, views } = wizardState;

  // Collect menu + checklist component imports
  const menuImports = components
    .filter(c => c.component.componentType === 'menu' && c.componentFile && c.componentFunction)
    .map(c => `import { ${c.componentFunction} } from '../components/${c.componentFile}';`);
  const checklistImports = components
    .filter(c => c.component.componentType === 'checklist' && c.componentFile && c.componentFunction)
    .map(c => `import { ${c.componentFunction} } from '../components/${c.componentFile}';`);

  // Inlay-driven imports + module-scope bind function declarations are
  // assembled while we walk the components, then stitched in below.
  const apiGetters = new Set<string>();
  const bindFunctionDecls: string[] = [];
  let needsStore = false;
  let needsIdentity = false;

  // Build body — render each component as a section
  let body = '';

  if (components.length === 0) {
    body += `
  const empty = document.createElement('p');
  empty.className = 'view-empty';
  empty.textContent = 'No content defined for this view yet.';
  container.appendChild(empty);
`;
  } else {
    components.forEach((c, i) => {
      const varName = `component${i}`;
      const inlayResolution =
        c.component.inlayComponentRef && c.component.inlayComponentRef.length > 0
          ? inlayResolutions.get(c.component.id)
          : undefined;

      if (inlayResolution) {
        body += emitInlayBranch({
          info: c,
          index: i,
          varName,
          resolution: inlayResolution,
          wizardState,
          collectImport: (apiGetter) => {
            apiGetters.add(apiGetter);
            needsStore = true;
          },
          markNeedsIdentity: () => { needsIdentity = true; },
          pushBindFunction: (code) => bindFunctionDecls.push(code),
        });
      } else if (c.component.componentType === 'menu' && c.componentFunction) {
        // Real NavMenu component
        body += `
  // Component: ${c.component.name} (menu)
  const ${varName} = document.createElement('section');
  ${varName}.className = 'app-component';
  ${c.componentFunction}(${varName}, router);
  container.appendChild(${varName});
`;
      } else if (c.component.componentType === 'checklist' && c.componentFunction) {
        // Real Checklist component
        body += `
  // Component: ${c.component.name} (checklist)
  const ${varName} = document.createElement('section');
  ${varName}.className = 'app-component';
  ${c.componentFunction}(${varName});
  container.appendChild(${varName});
`;
      } else if (c.component.componentType === 'checklist') {
        // Checklist with unresolvable config — emit placeholder with the
        // most specific message we can derive.
        body += emitChecklistFailure(c.component, varName, wizardState);
      } else if (c.component.componentType === 'text') {
        // Inlay text component — compile-time rendering from contentNodes
        const tree = c.component.contentNodes?.length
          ? buildContentNodeTree(c.component.contentNodes)
          : null;
        if (tree) {
          const inlayHtml = compileToHtml(tree);
          const escapedHtml = inlayHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$');
          body += `
  // Component: ${c.component.name} (text — Inlay)
  const ${varName} = document.createElement('section');
  ${varName}.className = 'app-component inlay-root';
  ${varName}.innerHTML = \`${escapedHtml}\`;
  container.appendChild(${varName});
`;
        } else {
          // Text component with no know requirements — fallback to placeholder
          const placeholderHtml = generatePlaceholderHtml(
            c.component,
            requirements,
            recordTypes.map(r => ({ id: r.id, displayName: r.displayName })),
            nonDataElements,
            views
          );
          const escapedHtml = placeholderHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$');
          body += `
  // Component: ${c.component.name} (text) — placeholder fallback
  const ${varName} = document.createElement('section');
  ${varName}.className = 'app-component app-component-placeholder';
  ${varName}.innerHTML = \`${escapedHtml}\`;
  container.appendChild(${varName});
`;
        }
      } else {
        // Placeholder for non-text components
        const placeholderHtml = generatePlaceholderHtml(
          c.component,
          requirements,
          recordTypes.map(r => ({ id: r.id, displayName: r.displayName })),
          nonDataElements,
          views
        );
        // Escape backticks in the placeholder HTML for template literal
        const escapedHtml = placeholderHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$');
        body += `
  // Component: ${c.component.name}${c.component.componentType ? ` (${c.component.componentType})` : ''} — placeholder
  const ${varName} = document.createElement('section');
  ${varName}.className = 'app-component app-component-placeholder';
  ${varName}.innerHTML = \`${escapedHtml}\`;
  container.appendChild(${varName});
`;
      }
    });
  }

  // ── Stitch imports together ──────────────────────────────────────────

  let imports = `import type { Router } from '../router';\n`;
  if (menuImports.length > 0) {
    imports += menuImports.join('\n') + '\n';
  }
  if (checklistImports.length > 0) {
    imports += checklistImports.join('\n') + '\n';
  }
  if (needsStore) {
    imports += `import Store, { storeManager } from '../store';\n`;
  }
  if (apiGetters.size > 0) {
    const sorted = [...apiGetters].sort();
    imports += `import { ${sorted.join(', ')} } from '../atproto/api';\n`;
  }
  if (needsIdentity) {
    imports += `import { resolveDidToAvatar } from '../atproto/identity';\n`;
  }

  const moduleDecls = bindFunctionDecls.length > 0
    ? '\n' + bindFunctionDecls.join('\n\n') + '\n'
    : '';

  return `/**
 * ${view.name} — view page
 */

${imports}${moduleDecls}
export function ${viewFunctionName}(container: HTMLElement, router: Router): void {
  const heading = document.createElement('h2');
  heading.textContent = '${view.name.replace(/'/g, "\\'")}';
  container.appendChild(heading);
${body}}
`;
}

// ── Inlay branch ──────────────────────────────────────────────────────

interface InlayBranchArgs {
  info: ViewComponentInfo;
  index: number;
  varName: string;
  resolution: NonNullable<ReturnType<InlayResolutionMap['get']>>;
  wizardState: WizardState;
  collectImport: (apiGetter: string) => void;
  markNeedsIdentity: () => void;
  pushBindFunction: (code: string) => void;
}

function emitInlayBranch(args: InlayBranchArgs): string {
  const { info, index, varName, resolution, wizardState, collectImport, markNeedsIdentity, pushBindFunction } = args;
  const component = info.component;
  const ref = component.inlayComponentRef ?? '';

  // Resolution outright failed at fetch / validation time.
  if (isResolveError(resolution)) {
    return emitInlayFailure(varName, component.name, ref, `failed (${resolution.code})`);
  }

  // Successful fetch but the template references nested components we
  // can't render. Spec: treat as resolution failure.
  if (resolution.unresolvedComponents.length > 0) {
    const list = resolution.unresolvedComponents.join(', ');
    return emitInlayFailure(
      varName,
      component.name,
      ref,
      `has unresolved nested components: ${list}`
    );
  }

  // Find the bound RecordType. Without a do-requirement-with-data-type
  // there's nothing to fetch, so we surface that as a resolution-style
  // failure even though the picker UI normally prevents reaching here.
  const recordType = findBoundRecordType(component, wizardState);
  if (!recordType) {
    return emitInlayFailure(
      varName,
      component.name,
      ref,
      `requires a "do" requirement with a data type`
    );
  }

  const compiled = compileBindFunction(resolution, recordType, index);
  collectImport(compiled.apiGetterName);
  if (compiled.needsIdentityImport) markNeedsIdentity();
  pushBindFunction(compiled.code);

  const escapedHtml = compiled.html.replace(/`/g, '\\`').replace(/\$/g, '\\$');
  return `
  // Component: ${component.name} (inlay — ${ref})
  const ${varName} = document.createElement('section');
  ${varName}.className = 'app-component inlay-root';
  ${varName}.innerHTML = \`${escapedHtml}\`;
  container.appendChild(${varName});
  void ${compiled.bindFunctionName}(${varName});
`;
}

function emitInlayFailure(
  varName: string,
  componentName: string,
  ref: string,
  detail: string
): string {
  const message = `Inlay template ${escapeHtml(ref)} ${escapeHtml(detail)}`;
  return `
  // Component: ${componentName} (inlay) — ${detail}
  const ${varName} = document.createElement('section');
  ${varName}.className = 'app-component inlay-root';
  ${varName}.innerHTML = \`<div class="inlay-unresolved-component">${message}</div>\`;
  container.appendChild(${varName});
`;
}

function emitChecklistFailure(
  component: Component,
  varName: string,
  wizardState: WizardState,
): string {
  const recordType = findBoundRecordType(component, wizardState);
  let message: string;
  if (!recordType) {
    message = 'Checklist needs a do requirement bound to a data type.';
  } else {
    const resolution = resolveChecklistConfig(component, recordType);
    if (resolution.kind === 'ok') {
      // Should not normally happen — the index loop emitted a file. Fall
      // back to a generic message to keep the output non-fatal.
      message = `Checklist component generated without a callable function.`;
    } else {
      message = describeChecklistFailure(resolution);
    }
  }
  const safe = escapeHtml(message)
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');
  const safeName = escapeHtml(component.name)
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');
  return `
  // Component: ${component.name} (checklist) — unresolvable
  const ${varName} = document.createElement('section');
  ${varName}.className = 'app-component app-component-placeholder';
  ${varName}.innerHTML = \`
    <h3>${safeName}</h3>
    <div class="placeholder-type">Checklist</div>
    <p class="placeholder-message">${safe}</p>
  \`;
  container.appendChild(${varName});
`;
}

function findBoundRecordType(
  component: Component,
  wizardState: WizardState
): RecordType | null {
  for (const reqId of component.requirementIds) {
    const req = wizardState.requirements.find(r => r.id === reqId);
    if (req?.type !== 'do' || !req.dataTypeIds || req.dataTypeIds.length === 0) {
      continue;
    }
    const recordType = wizardState.recordTypes.find(rt => rt.id === req.dataTypeIds![0]);
    if (recordType) return recordType;
  }
  return null;
}
