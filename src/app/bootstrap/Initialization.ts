/**
 * App initialization and bootstrap
 */

import {
  loadWizardState,
  setWizardState,
  initializeWizardState,
  getWizardState,
  hasMeaningfulState,
} from '../state/WizardState';
import { enterWizard, leaveWizard } from '../navigation/StepNavigation';
import { renderCurrentStep } from '../views/StepRenderer';
import { setupDialogHandlers } from '../dialogs/DialogHandlers';
import { setupWizardOps } from './WizardOps';
import { initializeHistoryManager } from '../navigation/HistoryManager';
import {
  initOAuthClient,
  isOAuthCallback,
  restoreSession,
} from '../auth/AuthService';
import {
  showSigningIn,
  showLoggedOut,
  showError,
  completeLogin,
  setOnLoggedOut,
  setOnLoggedIn,
} from '../auth/HeaderAuth';
import {
  renderLoginDialog,
  setupLoginDialog,
  setupLoginButton,
} from '../auth/LoginDialog';
import { setupProjectPicker, showPostLoginPicker } from '../auth/ProjectPickerDialog';
import { updateSaveButtonVisibility, wireSaveButtons, triggerAutoSave } from '../services/PdsSaveController';
import { setLoggedIn, setOnSaveCallback, setActiveProjectRkey, setLastPdsSaveTimestamp } from '../state/WizardState';

export let setupTooltips: any;

export function initializeApp(): void {
  // Setup window.wizardOps for onclick handlers
  setupWizardOps();

  // Check for saved state
  const saved = loadWizardState();

  if (saved && !saved.isStale && hasMeaningfulState(saved.state)) {
    // Only show resume dialog if there's actual wizard data to resume
    // Step 0 is the landing page with no user data worth resuming
    setWizardState(saved.state);
    // TODO: uncomment below before deploying (maybe use an env var to turn this off in the future)
    // Resume dialog disabled during development
    // const savedDate = new Date(saved.state.lastSaved);
    // const resumeDate = document.getElementById('resume-date');
    // if (resumeDate) {
    //   resumeDate.textContent = savedDate.toLocaleString();
    // }
    // const dialog = document.getElementById(
    //   'resume-dialog'
    // ) as HTMLDialogElement;
    // if (dialog) dialog.showModal();
  } else {
    setWizardState(initializeWizardState());
  }

  // Setup dialog handlers
  setupDialogHandlers();

  // Initialize browser history management for step navigation
  initializeHistoryManager();

  // Wire up the landing-page "Start Building" button. The back button
  // (#wizard-back) is hidden in HTML and unused in the sidebar layout;
  // it will be removed in Phase 8.
  const nextBtn = document.getElementById('wizard-next');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      void enterWizard();
    });
  }

  // Wire up logo/title click to navigate back to landing page from wizard
  const headerTitle = document.querySelector('.header-title');
  if (headerTitle) {
    headerTitle.addEventListener('click', () => {
      if (getWizardState().currentStep >= 2) {
        leaveWizard();
      }
    });
  }

  const tooltip = document.getElementById('tooltip');
  let activeTooltip: Element | null = null;

  const termDefinitions: Record<string, string> = {
    ATProtocol:
      'The AT Protocol enables creating decentralized web applications, where users can see and control all of their data, and move freely between applications.',
    what: 'Decentralized apps allow users to log in with their own decentralized ID, and use data from storage that is owned and controlled by that user.',
    why: 'Learn the benefits of users owning their data. For example, gaining freedom from platform lock-in.',
    how: 'Discover the technical foundations and tools needed to build on the AT Protocol.',
    'Decentralized ID':
      'Your unique identifier that works across all AT Protocol applications.',
    'Personal Data Storage': 'Data storage that belongs to you.',
  };

  function showTooltip(element: Element, content: string): void {
    if (!tooltip) return;

    // Get all client rects - there will be multiple if the term wraps to multiple lines
    const rects = Array.from(element.getClientRects());
    // Sort by top position and use the topmost line for positioning
    rects.sort((a: DOMRect, b: DOMRect) => a.top - b.top);
    const rect = rects[0] || element.getBoundingClientRect();

    // Check if tooltip is inside the dialog (which is in the top layer)
    const isInDialog = tooltip.closest('dialog');

    // Get dialog offset if inside dialog
    let dialogOffsetLeft = 0;
    let dialogOffsetTop = 0;
    if (isInDialog) {
      const dialogRect = isInDialog.getBoundingClientRect();
      dialogOffsetLeft = dialogRect.left;
      dialogOffsetTop = dialogRect.top;
    }

    // Only use scroll offsets if NOT in a dialog
    const scrollTop = isInDialog
      ? 0
      : window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = isInDialog
      ? 0
      : window.pageXOffset || document.documentElement.scrollLeft;

    tooltip.innerHTML = content;
    tooltip.classList.add('show');

    // Note: the tooltip starts out at the bottom left of the screen
    // we're only getting its rect object for its width and height
    const tooltipRect = tooltip.getBoundingClientRect();

    // Position tooltip above the element
    let left =
      rect.left +
      scrollLeft +
      rect.width / 2 -
      tooltipRect.width / 2 -
      dialogOffsetLeft;
    let top = rect.top + scrollTop - tooltipRect.height - 12 - dialogOffsetTop;

    // Calculate the intended center of the element (for arrow positioning)
    const elementCenter =
      rect.left + scrollLeft + rect.width / 2 - dialogOffsetLeft;

    // Adjust if tooltip would go off screen
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }

    // Calculate arrow position relative to the tooltip
    const arrowLeft = elementCenter - left;
    const arrowLeftPercent = (arrowLeft / tooltipRect.width) * 100;

    // Clamp arrow position to stay within tooltip bounds (with some padding)
    const clampedArrowPercent = Math.max(10, Math.min(90, arrowLeftPercent));

    // Set the arrow position using CSS custom property
    tooltip.style.setProperty('--arrow-left', clampedArrowPercent + '%');

    if (rect.top < tooltipRect.height + 22) {
      top = rect.bottom + scrollTop + 12 - dialogOffsetTop;
      // Flip arrow to point up when tooltip is below
      tooltip.classList.add('tooltip-below');
    } else {
      tooltip.classList.remove('tooltip-below');
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';

    activeTooltip = element;
  }

  function hideTooltip(): void {
    if (!tooltip) return;
    tooltip.classList.remove('show');
    activeTooltip = null;
  }

  // Export setupTooltips for use after step renders
  setupTooltips = function () {
    document.querySelectorAll('.term').forEach((term) => {
      // Skip if already set up
      if ((term as any)._tooltipSetup) return;
      (term as any)._tooltipSetup = true;

      const text = term.textContent;
      if (!text) return;
      const content = termDefinitions[text];

      if (content) {
        term.addEventListener('mouseenter', () => {
          showTooltip(term, content);
        });

        term.addEventListener('mouseleave', () => {
          hideTooltip();
        });

        // For mobile/touch devices
        term.addEventListener('click', (e) => {
          e.preventDefault();
          if (activeTooltip === term) {
            hideTooltip();
          } else {
            showTooltip(term, content);
          }
        });
      }
    });
  };

  // Hide tooltip when clicking elsewhere
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      !target.classList.contains('term') &&
      tooltip &&
      !tooltip.contains(target)
    ) {
      hideTooltip();
    }
  });

  // Register PDS auto-save callback (debounced, fires on every saveWizardState)
  setOnSaveCallback(triggerAutoSave);

  // Auth initialization
  document.body.insertAdjacentHTML('beforeend', renderLoginDialog());
  setupLoginDialog();
  setupLoginButton();
  setupProjectPicker();
  setOnLoggedOut(() => {
    setLoggedIn(false);
    setActiveProjectRkey(null);
    setLastPdsSaveTimestamp(null);
    // Don't clear PDS content snapshot — it tracks whether local state
    // has changed since the last PDS save, regardless of login state.
    setupLoginButton();
    updateSaveButtonVisibility();
  });
  setOnLoggedIn(() => {
    updateSaveButtonVisibility();
    wireSaveButtons();
    showPostLoginPicker();
  });
  initAuth();

  // Render the initial step
  renderCurrentStep();
}

async function initAuth(): Promise<void> {
  const isCallback = isOAuthCallback();

  try {
    // Show signing-in state in header if returning from OAuth
    if (isCallback) {
      showSigningIn();
    }

    await initOAuthClient();
    const restored = await restoreSession();

    if (restored) {
      await completeLogin();
    } else if (isCallback) {
      // Callback detected but session restore failed
      showError('Login was cancelled or denied');
      setupLoginButton();
    }
    // else: no session, no callback — stay in logged-out state (default)
  } catch (err: any) {
    showLoggedOut();
    setupLoginButton();
    if (isCallback) {
      showError('Login failed. Please try again.');
    }
  }
}
