/**
 * NavMenu component generator
 *
 * Generates a navigation menu component for components with componentType: 'menu'.
 * Menu items are derived from the component's navigate requirement or fall back
 * to all views.
 */

import type { Component, Requirement, View } from '../../types/wizard';
import { toPascalCase, toCamelCase } from '../../utils';

interface NavMenuItem {
  label: string;
  viewId: string;
}

/**
 * Derive the menu items for a nav menu component.
 * Looks for a navigate requirement with navType: 'menu' inside the component.
 * Falls back to all views if none found.
 */
function getMenuItems(
  component: Component,
  requirements: Requirement[],
  views: View[],
  viewSlugMap: Map<string, string>
): NavMenuItem[] {
  // Find the navigate-menu requirement in this component
  const navReq = component.requirementIds
    .map(id => requirements.find(r => r.id === id))
    .find(r => r?.type === 'navigate' && r.navType === 'menu');

  let targetViews: View[];

  if (navReq?.menuIncludeAllViews) {
    targetViews = views;
  } else if (navReq?.menuItems && navReq.menuItems.length > 0) {
    // menuItems contains view IDs
    targetViews = navReq.menuItems
      .map(viewId => views.find(v => v.id === viewId))
      .filter((v): v is View => v != null);
  } else {
    // Fallback: include all views
    targetViews = views;
  }

  return targetViews.map(v => ({
    label: v.name,
    viewId: viewSlugMap.get(v.id) ?? toCamelCase(v.name),
  }));
}

/**
 * Generate a NavMenu component file for a menu-type component.
 * The function name is unique per component (e.g., renderMainMenu).
 */
export function generateNavMenuComponent(
  component: Component,
  requirements: Requirement[],
  views: View[],
  viewSlugMap: Map<string, string>,
  functionName: string
): string {
  const items = getMenuItems(component, requirements, views, viewSlugMap);

  const itemsLiteral = items
    .map(item => `    { label: '${item.label.replace(/'/g, "\\'")}', viewId: '${item.viewId}' }`)
    .join(',\n');

  return `/**
 * Navigation menu component — ${component.name}
 */

import type { Router } from '../router';

export function ${functionName}(container: HTMLElement, router: Router): void {
  const nav = document.createElement('nav');
  nav.className = 'nav-menu';

  const items = [
${itemsLiteral}
  ];

  items.forEach(item => {
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'nav-menu-item';
    link.textContent = item.label;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate(item.viewId);
    });
    nav.appendChild(link);
  });

  container.appendChild(nav);
}
`;
}
