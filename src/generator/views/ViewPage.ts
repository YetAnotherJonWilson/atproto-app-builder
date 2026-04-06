/**
 * View page generator
 *
 * Generates one TypeScript file per wizard View. Each file exports a render
 * function that composes the view's assigned blocks in order. Menu blocks
 * call their NavMenu component; all other blocks render as placeholders.
 */

import type { View, Block, WizardState } from '../../types/wizard';
import { toPascalCase, toCamelCase } from '../../utils';
import { generatePlaceholderHtml } from '../components/Placeholder';
import { buildContentNodeTree } from '../../inlay/text-variants';
import { compileToHtml } from '../inlay/compile';

interface ViewBlockInfo {
  block: Block;
  /** PascalCase component filename (without extension) for menu blocks */
  componentFile?: string;
  /** Function name to call for menu blocks */
  componentFunction?: string;
}

/**
 * Generate the view page file content for a single wizard View.
 */
export function generateViewPage(
  view: View,
  viewFunctionName: string,
  blocks: ViewBlockInfo[],
  wizardState: WizardState
): string {
  const { requirements, recordTypes, nonDataElements, views } = wizardState;

  // Collect menu block imports
  const menuImports = blocks
    .filter(b => b.block.blockType === 'menu' && b.componentFile && b.componentFunction)
    .map(b => `import { ${b.componentFunction} } from '../components/${b.componentFile}';`);

  const hasMenuBlocks = menuImports.length > 0;

  // Build import section
  let imports = `import type { Router } from '../router';\n`;
  if (menuImports.length > 0) {
    imports += menuImports.join('\n') + '\n';
  }

  // Build body — render each block as a section
  let body = '';

  if (blocks.length === 0) {
    body += `
  const empty = document.createElement('p');
  empty.className = 'view-empty';
  empty.textContent = 'No content defined for this view yet.';
  container.appendChild(empty);
`;
  } else {
    blocks.forEach((b, i) => {
      const varName = `block${i}`;

      if (b.block.blockType === 'menu' && b.componentFunction) {
        // Real NavMenu component
        body += `
  // Block: ${b.block.name} (menu)
  const ${varName} = document.createElement('section');
  ${varName}.className = 'block';
  ${b.componentFunction}(${varName}, router);
  container.appendChild(${varName});
`;
      } else if (b.block.blockType === 'text') {
        // Inlay text block — compile-time rendering from contentNodes
        const tree = b.block.contentNodes?.length
          ? buildContentNodeTree(b.block.contentNodes)
          : null;
        if (tree) {
          const inlayHtml = compileToHtml(tree);
          const escapedHtml = inlayHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$');
          body += `
  // Block: ${b.block.name} (text — Inlay)
  const ${varName} = document.createElement('section');
  ${varName}.className = 'block inlay-root';
  ${varName}.innerHTML = \`${escapedHtml}\`;
  container.appendChild(${varName});
`;
        } else {
          // Text block with no know requirements — fallback to placeholder
          const placeholderHtml = generatePlaceholderHtml(
            b.block,
            requirements,
            recordTypes.map(r => ({ id: r.id, displayName: r.displayName })),
            nonDataElements,
            views
          );
          const escapedHtml = placeholderHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$');
          body += `
  // Block: ${b.block.name} (text) — placeholder fallback
  const ${varName} = document.createElement('section');
  ${varName}.className = 'block block-placeholder';
  ${varName}.innerHTML = \`${escapedHtml}\`;
  container.appendChild(${varName});
`;
        }
      } else {
        // Placeholder for non-text blocks
        const placeholderHtml = generatePlaceholderHtml(
          b.block,
          requirements,
          recordTypes.map(r => ({ id: r.id, displayName: r.displayName })),
          nonDataElements,
          views
        );
        // Escape backticks in the placeholder HTML for template literal
        const escapedHtml = placeholderHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$');
        body += `
  // Block: ${b.block.name}${b.block.blockType ? ` (${b.block.blockType})` : ''} — placeholder
  const ${varName} = document.createElement('section');
  ${varName}.className = 'block block-placeholder';
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
