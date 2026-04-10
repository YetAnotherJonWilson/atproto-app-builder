/**
 * View page generator
 *
 * Generates one TypeScript file per wizard View. Each file exports a render
 * function that composes the view's assigned components in order. Menu
 * components call their NavMenu component; all other components render as
 * placeholders.
 */

import type { View, Component, WizardState } from '../../types/wizard';
import { toPascalCase, toCamelCase } from '../../utils';
import { generatePlaceholderHtml } from '../components/Placeholder';
import { buildContentNodeTree } from '../../inlay/text-variants';
import { compileToHtml } from '../inlay/compile';

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
  wizardState: WizardState
): string {
  const { requirements, recordTypes, nonDataElements, views } = wizardState;

  // Collect menu component imports
  const menuImports = components
    .filter(c => c.component.componentType === 'menu' && c.componentFile && c.componentFunction)
    .map(c => `import { ${c.componentFunction} } from '../components/${c.componentFile}';`);

  const hasMenuComponents = menuImports.length > 0;

  // Build import section
  let imports = `import type { Router } from '../router';\n`;
  if (menuImports.length > 0) {
    imports += menuImports.join('\n') + '\n';
  }

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

      if (c.component.componentType === 'menu' && c.componentFunction) {
        // Real NavMenu component
        body += `
  // Component: ${c.component.name} (menu)
  const ${varName} = document.createElement('section');
  ${varName}.className = 'app-component';
  ${c.componentFunction}(${varName}, router);
  container.appendChild(${varName});
`;
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

  return `/**
 * ${view.name} — view page
 */

${imports}
export function ${viewFunctionName}(container: HTMLElement, router: Router): void {
  const heading = document.createElement('h2');
  heading.textContent = '${view.name.replace(/'/g, "\\'")}';
  container.appendChild(heading);
${body}}
`;
}
