/**
 * Workspace layout — sidebar + panel shell (Mockup 3b)
 *
 * Renders the sidebar + workspace HTML template, wires sidebar section
 * switching, manages the progress track, and provides transition animations
 * for entering/exiting the wizard.
 */

import template from './workspace.html?raw';
import { getWizardState, saveWizardState } from '../state/WizardState';
import type { SectionName } from '../../types/wizard';
import { renderRequirementsPanel } from './panels/RequirementsPanel';
import { renderDataPanel } from './panels/DataPanel';
import { renderComponentsPanel } from './panels/ComponentsPanel';
import { renderViewsPanel } from './panels/ViewsPanel';

const SECTION_CONFIG: Record<
  SectionName,
  { title: string; render: () => string }
> = {
  requirements: {
    title: 'Define Requirements',
    render: renderRequirementsPanel,
  },
  data: { title: 'Define Data', render: renderDataPanel },
  components: { title: 'Define Components', render: renderComponentsPanel },
  views: { title: 'Define Views', render: renderViewsPanel },
};

/**
 * Returns the workspace HTML template (sidebar + workspace shell).
 * Call wireWorkspaceLayout() after inserting into the DOM.
 */
export function renderWorkspaceLayout(): string {
  return template;
}

/**
 * Wire sidebar click handlers and render the active panel.
 * Must be called after renderWorkspaceLayout() HTML is in the DOM.
 */
export function wireWorkspaceLayout(): void {
  const wizardState = getWizardState();

  // Wire sidebar section click handlers
  document.querySelectorAll('.sidebar-header').forEach((header) => {
    header.addEventListener('click', () => {
      const target = (header as HTMLElement).dataset.target as SectionName;
      if (target) switchSection(target);
    });
  });

  // Render the active panel
  switchSection(wizardState.activeSection || 'requirements');

  // Keep progress fill in sync on resize
  window.addEventListener('resize', updateProgressFill);
}

/**
 * Switch the active sidebar section and render its panel.
 */
export function switchSection(section: SectionName): void {
  const wizardState = getWizardState();
  wizardState.activeSection = section;
  saveWizardState(wizardState);

  // Update sidebar active state
  document
    .querySelectorAll('.sidebar-section')
    .forEach((s) => s.classList.remove('active'));
  const sidebarSection = document.querySelector(
    `[data-section="${section}"]`,
  );
  if (sidebarSection) sidebarSection.classList.add('active');

  // Render the panel content
  const config = SECTION_CONFIG[section];
  const headerEl = document.getElementById('workspace-panel-header');
  const bodyEl = document.getElementById('workspace-panel-body');
  if (headerEl) headerEl.innerHTML = `<h2>${config.title}</h2>`;
  if (bodyEl) bodyEl.innerHTML = config.render();

  updateProgressFill();
}

/**
 * Calculate and set the progress fill line height based on the active section.
 */
export function updateProgressFill(): void {
  const nav = document.getElementById('sidebar-nav');
  const fill = document.getElementById('sidebar-progress-fill');
  const sections = document.querySelectorAll('.sidebar-section');
  const activeSection = document.querySelector('.sidebar-section.active');

  if (!nav || !fill || !activeSection || sections.length === 0) return;

  const firstDot = sections[0].querySelector('.sidebar-header');
  const activeDot = activeSection.querySelector('.sidebar-header');
  if (!firstDot || !activeDot) return;

  const navRect = nav.getBoundingClientRect();
  const firstRect = firstDot.getBoundingClientRect();
  const activeRect = activeDot.getBoundingClientRect();

  const startY = firstRect.top + firstRect.height / 2 - navRect.top;
  const endY = activeRect.top + activeRect.height / 2 - navRect.top;

  fill.style.top = startY + 'px';
  fill.style.height = Math.max(0, endY - startY) + 'px';
}

/**
 * Animated transition from landing page into the wizard.
 * Shows overlay flash, then calls onMidpoint (where the caller should
 * set the step, render content, etc.), then fades the overlay out.
 */
export function transitionToWizard(onMidpoint: () => void): void {
  const overlay = document.getElementById('transition-overlay');
  if (!overlay) {
    onMidpoint();
    return;
  }

  overlay.classList.add('active');

  setTimeout(() => {
    onMidpoint();
    window.scrollTo(0, 0);

    setTimeout(() => {
      overlay.classList.remove('active');
      // Re-calc progress fill now that sidebar transition is underway
      updateProgressFill();
    }, 100);
  }, 300);
}

/**
 * Animated transition from the wizard back to the landing page.
 */
export function transitionToLanding(onMidpoint: () => void): void {
  const overlay = document.getElementById('transition-overlay');
  if (!overlay) {
    onMidpoint();
    return;
  }

  overlay.classList.add('active');

  setTimeout(() => {
    onMidpoint();
    window.scrollTo(0, 0);

    setTimeout(() => {
      overlay.classList.remove('active');
    }, 100);
  }, 300);
}
