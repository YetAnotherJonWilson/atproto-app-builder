/**
 * Workspace layout — sidebar + panel shell (Mockup 3b) and accordion (narrow viewports)
 *
 * Renders the sidebar + workspace HTML template (which also includes the accordion),
 * wires sidebar and accordion section switching, manages the progress track,
 * and provides transition animations for entering/exiting the wizard.
 *
 * Both layout shells exist in the DOM simultaneously. CSS media queries at 768px
 * control which one is visible. Panel content is rendered into only the visible
 * container to avoid duplicate element IDs. A matchMedia listener re-renders
 * when crossing the 768px breakpoint.
 */

import template from './workspace.html?raw';
import { getWizardState, saveWizardState } from '../state/WizardState';
import type { SectionName } from '../../types/wizard';
import {
  renderRequirementsPanel,
  wireRequirementsPanel,
  updateSidebar as updateRequirementsSidebar,
  updateDataSidebar,
} from './panels/RequirementsPanel';
import { renderDataPanel, wireDataPanel, resetDetailState } from './panels/DataPanel';
import { renderBlocksPanel, wireBlocksPanel, updateBlocksSidebar } from './panels/BlocksPanel';
import { renderViewsPanel, wireViewsPanel, updateViewsSidebar } from './panels/ViewsPanel';
import { renderGeneratePanel, wireGeneratePanel, updateGenerateSidebar } from './panels/GeneratePanel';

const SECTION_CONFIG: Record<
  SectionName,
  { title: string; render: () => string }
> = {
  requirements: {
    title: 'Define Requirements',
    render: renderRequirementsPanel,
  },
  data: { title: 'Define Data', render: renderDataPanel },
  components: { title: 'Blocks', render: renderBlocksPanel },
  views: { title: 'Define Views', render: renderViewsPanel },
  generate: { title: 'Generate', render: renderGeneratePanel },
};

const narrowQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 767px)')
    : null;

/** Whether the current viewport uses the accordion layout. */
export function isNarrowViewport(): boolean {
  return narrowQuery?.matches ?? false;
}

/**
 * Returns the workspace HTML template (sidebar + workspace + accordion shell).
 * Call wireWorkspaceLayout() after inserting into the DOM.
 */
export function renderWorkspaceLayout(): string {
  return template;
}

/**
 * Wire sidebar and accordion click handlers and render the active panel.
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

  // Wire accordion section click handlers
  document.querySelectorAll('.accordion-header').forEach((header) => {
    header.addEventListener('click', () => {
      const target = (header as HTMLElement).dataset.target as SectionName;
      if (target) switchSection(target);
    });
  });

  // Re-render into the correct container when crossing the 768px breakpoint
  if (narrowQuery) {
    narrowQuery.addEventListener('change', () => {
      const section = getWizardState().activeSection || 'requirements';
      switchSection(section);
    });
  }

  // Render the active panel
  switchSection(wizardState.activeSection || 'requirements');

  // Keep progress fill in sync on resize
  window.addEventListener('resize', updateProgressFill);

  // Show welcome dialog on first visit
  if (!wizardState.hasSeenWelcome) {
    showWelcomeDialog();
  }
}

function showWelcomeDialog(): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'wizard-dialog';
  dialog.innerHTML = `<div class="dialog-content">
  <h2>Welcome to the AT Protocol App Builder</h2>
  <p>A few things to know before you start:</p>
  <p>This tool is experimental. The apps it generates are scaffolded starting points, with placeholders for content that cannot yet be generated automatically.</p>
  <p>Your data schemas (lexicons) will be published under a <code>.temp</code> namespace, signaling that they are experimental and may change. This is the right choice while you\u2019re prototyping.</p>
  <p>Data stored in AT Protocol Personal Data Servers is not yet private. Don\u2019t use these apps to store anything sensitive \u2014 treat them as experiments.</p>
  <div class="dialog-buttons">
    <button type="button" class="dialog-button" id="welcome-dismiss">Got it, let\u2019s go</button>
  </div>
</div>`;

  document.body.appendChild(dialog);

  const dismissBtn = dialog.querySelector('#welcome-dismiss') as HTMLButtonElement;
  dismissBtn.addEventListener('click', () => {
    const state = getWizardState();
    state.hasSeenWelcome = true;
    saveWizardState(state);
    dialog.close();
    dialog.remove();
  });

  // No backdrop close, no X button — user must click the dismiss button
  dialog.addEventListener('cancel', (e) => e.preventDefault());

  dialog.showModal();
}

/**
 * Switch the active section in both sidebar and accordion, and render the panel
 * into the currently visible container only.
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
    `.sidebar-section[data-section="${section}"]`,
  );
  if (sidebarSection) sidebarSection.classList.add('active');

  // Update accordion active state
  document
    .querySelectorAll('.accordion-section')
    .forEach((s) => s.classList.remove('active'));
  const accordionSection = document.querySelector(
    `.accordion-section[data-section="${section}"]`,
  );
  if (accordionSection) accordionSection.classList.add('active');

  // Reset data detail state so navigating back to Data shows the card grid
  resetDetailState();

  // Render panel content into the visible container only (avoids duplicate IDs)
  const config = SECTION_CONFIG[section];
  const narrow = isNarrowViewport();

  if (narrow) {
    // Clear workspace body to avoid hidden duplicate IDs
    const bodyEl = document.getElementById('workspace-panel-body');
    if (bodyEl) bodyEl.innerHTML = '';

    // Render into accordion body
    const accBody = accordionSection?.querySelector('.accordion-body');
    if (accBody) accBody.innerHTML = config.render();
  } else {
    // Clear all accordion bodies to avoid hidden duplicate IDs
    document.querySelectorAll('.accordion-body').forEach((b) => {
      b.innerHTML = '';
    });

    // Render into workspace body
    const headerEl = document.getElementById('workspace-panel-header');
    const bodyEl = document.getElementById('workspace-panel-body');
    if (headerEl) headerEl.innerHTML = `<h2>${config.title}</h2>`;
    if (bodyEl) bodyEl.innerHTML = config.render();
  }

  // Wire panel-specific event handlers
  if (section === 'requirements') {
    wireRequirementsPanel();
    updateRequirementsSidebar();
  } else if (section === 'data') {
    wireDataPanel();
  } else if (section === 'components') {
    wireBlocksPanel();
    updateBlocksSidebar();
  } else if (section === 'views') {
    wireViewsPanel();
    updateViewsSidebar();
  } else if (section === 'generate') {
    wireGeneratePanel();
    updateGenerateSidebar();
  }

  // Always keep data sidebar in sync (RecordTypes may be seeded from requirements)
  updateDataSidebar();

  // Scroll accordion section into view on narrow viewports
  if (narrow && accordionSection?.scrollIntoView) {
    accordionSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  updateProgressFill();
  updateAccordionSummaries();
}

/**
 * Update accordion summary text, badges, and has-items state for all sections.
 */
export function updateAccordionSummaries(): void {
  const wizardState = getWizardState();

  // Requirements
  const reqSection = document.querySelector(
    '.accordion-section[data-section="requirements"]',
  );
  if (reqSection) {
    const count = wizardState.requirements.length;
    const badge = reqSection.querySelector('.accordion-badge');
    if (badge) badge.textContent = String(count);

    const summary = reqSection.querySelector('.accordion-summary');
    if (summary) {
      if (count === 0) {
        summary.textContent = 'None yet';
      } else {
        const texts = wizardState.requirements.map((r) => {
          if (r.type === 'know') return r.text ?? '';
          if (r.type === 'do') return `${r.verb ?? ''} ${r.data ?? ''}`.trim();
          if (r.navType === 'menu') {
            const label = r.menuLabel || 'menu';
            return r.menuIncludeAllViews !== false
              ? `${label}: all views`
              : label;
          }
          if (r.navType === 'forward-back') return 'fwd/back';
          const fromName = r.fromView
            ? wizardState.views.find((v) => v.id === r.fromView)?.name ?? '?'
            : '?';
          const toName = r.toView
            ? wizardState.views.find((v) => v.id === r.toView)?.name ?? '?'
            : '?';
          return `${fromName} → ${toName}`;
        });
        summary.textContent = texts.join(' · ');
      }
    }

    if (count > 0) {
      reqSection.classList.add('has-items');
    } else {
      reqSection.classList.remove('has-items');
    }
  }

  // Data
  const dataSection = document.querySelector(
    '.accordion-section[data-section="data"]',
  );
  if (dataSection) {
    const count = wizardState.recordTypes.length;
    const badge = dataSection.querySelector('.accordion-badge');
    if (badge) badge.textContent = String(count);

    const summary = dataSection.querySelector('.accordion-summary');
    if (summary) {
      summary.textContent =
        count === 0
          ? 'None yet'
          : wizardState.recordTypes
              .map((r) => r.displayName || r.name)
              .join(' · ');
    }

    if (count > 0) {
      dataSection.classList.add('has-items');
    } else {
      dataSection.classList.remove('has-items');
    }
  }

  // Blocks (components section)
  const compSection = document.querySelector(
    '.accordion-section[data-section="components"]',
  );
  if (compSection) {
    const blockCount = wizardState.blocks.length;
    const badge = compSection.querySelector('.accordion-badge');
    if (badge) badge.textContent = String(blockCount);

    const summary = compSection.querySelector('.accordion-summary');
    if (summary) {
      summary.textContent =
        blockCount === 0
          ? 'None yet'
          : wizardState.blocks.map((b) => b.name).join(' · ');
    }

    if (blockCount > 0) {
      compSection.classList.add('has-items');
    } else {
      compSection.classList.remove('has-items');
    }
  }

  // Views
  const viewsSection = document.querySelector(
    '.accordion-section[data-section="views"]',
  );
  if (viewsSection) {
    const viewCount = wizardState.views.length;
    const badge = viewsSection.querySelector('.accordion-badge');
    if (badge) badge.textContent = String(viewCount);

    const summary = viewsSection.querySelector('.accordion-summary');
    if (summary) {
      summary.textContent =
        viewCount === 0
          ? 'None yet'
          : wizardState.views.map((v) => v.name).join(' · ');
    }

    // has-items: user has meaningfully engaged (more than 1 view OR any view has blocks)
    const hasEngaged =
      viewCount > 1 ||
      wizardState.views.some((v) => v.blockIds.length > 0);
    if (hasEngaged) {
      viewsSection.classList.add('has-items');
    } else {
      viewsSection.classList.remove('has-items');
    }
  }

  // Generate
  const genSection = document.querySelector(
    '.accordion-section[data-section="generate"]',
  );
  if (genSection) {
    const summary = genSection.querySelector('.accordion-summary');
    if (summary) {
      const appName = wizardState.appInfo.appName.trim();
      summary.textContent = appName || 'Configure & generate';
    }

    if (wizardState.hasGenerated) {
      genSection.classList.add('has-items');
    } else {
      genSection.classList.remove('has-items');
    }
  }
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
