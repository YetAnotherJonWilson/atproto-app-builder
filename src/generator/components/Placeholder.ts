/**
 * Placeholder component generator
 *
 * Generates placeholder HTML for blocks that are not yet real components.
 * Typed placeholders (blocks with a blockType) show the type label.
 * Generic placeholders (no blockType) show just requirement summaries.
 */

import type { Block, BlockType, Requirement, View } from '../../types/wizard';

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  menu: 'Menu',
  list: 'List',
  detail: 'Detail View',
  form: 'Form',
  table: 'Table',
  card: 'Card',
  text: 'Text',
};

/**
 * Get a short summary string for a requirement, for display in placeholders.
 */
function getRequirementSummary(
  req: Requirement,
  recordTypes: { id: string; displayName: string }[],
  nonDataElements: { id: string; name: string }[],
  views: View[]
): string {
  switch (req.type) {
    case 'know':
      return req.text || 'Info section';
    case 'do':
      return req.description || 'interaction';
    case 'navigate': {
      if (req.navType === 'menu') return 'navigation menu';
      if (req.navType === 'direct') {
        const toView = req.toView
          ? views.find(v => v.id === req.toView)
          : undefined;
        return `link to ${toView?.name || 'view'}`;
      }
      if (req.navType === 'forward-back') return 'page navigation';
      return 'navigation';
    }
    default:
      return 'unknown';
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate inline placeholder HTML for a block section.
 * Returns the innerHTML string to set on the section element.
 */
export function generatePlaceholderHtml(
  block: Block,
  requirements: Requirement[],
  recordTypes: { id: string; displayName: string }[],
  nonDataElements: { id: string; name: string }[],
  views: View[]
): string {
  const blockReqs = block.requirementIds
    .map(id => requirements.find(r => r.id === id))
    .filter((r): r is Requirement => r != null);

  const reqSummaries = blockReqs
    .map(req => `      <li>${escapeHtml(getRequirementSummary(req, recordTypes, nonDataElements, views))}</li>`)
    .join('\n');

  const typeLabel = block.blockType ? BLOCK_TYPE_LABELS[block.blockType] : null;
  const typeLabelHtml = typeLabel
    ? `\n    <div class="placeholder-type">${escapeHtml(typeLabel)}</div>`
    : '';

  return `
    <h3>${escapeHtml(block.name)}</h3>${typeLabelHtml}
    <ul class="placeholder-requirements">
${reqSummaries}
    </ul>
  `;
}
