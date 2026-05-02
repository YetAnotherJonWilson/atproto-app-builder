/**
 * Placeholder component generator
 *
 * Generates placeholder HTML for components that are not yet real rendered
 * components. Typed placeholders (components with a componentType) show the
 * type label. Generic placeholders (no componentType) show just requirement
 * summaries.
 */

import type { Component, ComponentType, Requirement, View } from '../../types/wizard';

const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  menu: 'Menu',
  list: 'List',
  detail: 'Detail View',
  form: 'Form',
  table: 'Table',
  card: 'Card',
  text: 'Text',
  checklist: 'Checklist',
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
 * Generate inline placeholder HTML for a component section.
 * Returns the innerHTML string to set on the section element.
 */
export function generatePlaceholderHtml(
  component: Component,
  requirements: Requirement[],
  recordTypes: { id: string; displayName: string }[],
  nonDataElements: { id: string; name: string }[],
  views: View[]
): string {
  const componentReqs = component.requirementIds
    .map(id => requirements.find(r => r.id === id))
    .filter((r): r is Requirement => r != null);

  const reqSummaries = componentReqs
    .map(req => `      <li>${escapeHtml(getRequirementSummary(req, recordTypes, nonDataElements, views))}</li>`)
    .join('\n');

  const typeLabel = component.componentType ? COMPONENT_TYPE_LABELS[component.componentType] : null;
  const typeLabelHtml = typeLabel
    ? `\n    <div class="placeholder-type">${escapeHtml(typeLabel)}</div>`
    : '';

  return `
    <h3>${escapeHtml(component.name)}</h3>${typeLabelHtml}
    <ul class="placeholder-requirements">
${reqSummaries}
    </ul>
  `;
}
