/**
 * Project picker dialog — list, load, delete, and create projects from PDS.
 *
 * Shown on login (if user has saved projects) or via the "My Projects" menu item.
 */

import { listProjects, loadProject, deleteProject, saveProject } from '../services/ProjectService';
import { promptForAppName } from '../dialogs/AppNameDialog';
import type { ProjectSummary } from '../services/ProjectService';
import {
  getWizardState,
  setWizardState,
  initializeWizardState,
  saveWizardState,
  hasMeaningfulState,
  hasUnsavedPdsChanges,
  getActiveProjectRkey,
  setActiveProjectRkey,
  setLastPdsSaveTimestamp,
  snapshotPdsContent,
  clearPdsContentSnapshot,
} from '../state/WizardState';
import { switchSection, updateAppNameInputs, transitionToWizard } from '../views/WorkspaceLayout';
import { renderCurrentStep } from '../views/StepRenderer';
import { replaceSectionInHistory } from '../navigation/HistoryManager';
import { updateSaveButtonVisibility } from '../services/PdsSaveController';

let dialogEl: HTMLDialogElement | null = null;

/**
 * Setup the custom event listener so "My Projects" menu item can open the picker.
 */
export function setupProjectPicker(): void {
  document.addEventListener('open-project-picker', () => openProjectPicker());
}

/**
 * Try to show the project picker after login. Skipped when:
 * - the user has no saved projects, or
 * - a project is already loaded (active rkey set) — in that case the user
 *   has already chosen what to work on and shouldn't be interrupted.
 *   This happens on session-restore page loads and deep-links into a
 *   specific wizard section.
 */
export async function showPostLoginPicker(): Promise<void> {
  if (getActiveProjectRkey()) return;
  try {
    const projects = await listProjects();
    if (projects.length > 0) {
      openProjectPicker(projects);
    }
  } catch {
    // PDS unreachable on login — skip picker silently
  }
}

async function openProjectPicker(prefetchedProjects?: ProjectSummary[]): Promise<void> {
  let projects: ProjectSummary[];
  try {
    projects = prefetchedProjects ?? await listProjects();
  } catch {
    showErrorDialog();
    return;
  }

  if (dialogEl) {
    dialogEl.close();
    dialogEl.remove();
  }

  dialogEl = document.createElement('dialog');
  dialogEl.className = 'wizard-dialog';

  const hasUnsaved = hasUnsavedPdsChanges();
  const activeRkey = getActiveProjectRkey();

  dialogEl.innerHTML = `<div class="dialog-content">
  <button type="button" class="dialog-close" id="picker-close">&times;</button>
  <h2>Your Projects</h2>
  ${hasUnsaved ? renderUnsavedWarning() : ''}
  ${projects.length > 0 ? renderProjectList(projects, activeRkey) : renderEmptyState()}
  <div class="dialog-buttons">
    ${projects.length > 0 ? '<button type="button" class="dialog-button" id="picker-load">Load Selected</button>' : ''}
    <button type="button" class="dialog-button dialog-button--secondary" id="picker-new">Start New Project</button>
  </div>
  <button type="button" class="dialog-cancel" id="picker-cancel">${projects.length > 0 ? 'Continue without loading' : 'Close'}</button>
</div>`;

  document.body.appendChild(dialogEl);
  wirePickerEvents(projects);
  dialogEl.showModal();
}

function renderUnsavedWarning(): string {
  return `<div class="dialog-warning">
  <strong>Unsaved changes.</strong> Your current project has changes that haven't been saved to your PDS.
  <div style="margin-top: 0.75rem;">
    <button type="button" class="dialog-button" id="picker-save-first" style="font-size: 0.95rem; padding: 0.6rem 1.25rem;">Save Current Project First</button>
  </div>
</div>`;
}

function renderProjectList(projects: ProjectSummary[], activeRkey: string | null): string {
  const items = projects.map((p) => {
    const isActive = p.rkey === activeRkey;
    const date = formatRelativeDate(p.updatedAt);
    return `<li class="project-item${isActive ? ' active' : ''}" data-rkey="${escapeAttr(p.rkey)}">
  <div class="project-item-info">
    <div class="project-item-name">
      ${escapeHtml(p.projectName)}${isActive ? ' <span class="project-item-active-badge">current</span>' : ''}
    </div>
    <div class="project-item-date">Last saved ${date}</div>
  </div>
  <button type="button" class="project-item-delete" title="Delete project" data-rkey="${escapeAttr(p.rkey)}" data-name="${escapeAttr(p.projectName)}">&times;</button>
</li>`;
  });

  return `<ul class="project-list">${items.join('')}</ul>`;
}

function renderEmptyState(): string {
  return `<p style="text-align: center; color: var(--text-muted); padding: 1.5rem 0;">No saved projects yet. Use the <strong style="color: var(--text-secondary);">Save to PDS</strong> button in the sidebar to save your current project.</p>`;
}

function wirePickerEvents(projects: ProjectSummary[]): void {
  if (!dialogEl) return;

  let selectedRkey = getActiveProjectRkey() || (projects.length > 0 ? projects[0].rkey : null);

  // Close button
  dialogEl.querySelector('#picker-close')?.addEventListener('click', closePicker);
  dialogEl.querySelector('#picker-cancel')?.addEventListener('click', closePicker);

  // Backdrop click to close
  dialogEl.addEventListener('click', (e) => {
    if (e.target === dialogEl) closePicker();
  });

  // Project row selection
  dialogEl.querySelectorAll('.project-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      // Don't select if clicking the delete button
      if ((e.target as HTMLElement).closest('.project-item-delete')) return;

      dialogEl!.querySelectorAll('.project-item').forEach((i) => {
        i.classList.remove('selected');
        i.classList.remove('active');
      });
      item.classList.add('selected');
      selectedRkey = (item as HTMLElement).dataset.rkey || null;
    });
  });

  // Load selected
  dialogEl.querySelector('#picker-load')?.addEventListener('click', async () => {
    if (!selectedRkey) return;
    try {
      const record = await loadProject(selectedRkey);
      // Ensure loaded project opens the wizard workspace
      if (record.wizardState.currentStep < 2) {
        record.wizardState.currentStep = 2;
      }
      setWizardState(record.wizardState);
      setActiveProjectRkey(record.rkey);
      saveWizardState(record.wizardState); // Update localStorage
      setLastPdsSaveTimestamp(record.wizardState.lastSaved);
      snapshotPdsContent(record.wizardState);
      closePicker();
      reloadUI();
    } catch (err: any) {
      alert('Failed to load project: ' + (err?.message || 'Unknown error'));
    }
  });

  // Start new project
  dialogEl.querySelector('#picker-new')?.addEventListener('click', async () => {
    closePicker();
    const name = await promptForAppName();
    if (!name) {
      // User cancelled — reopen the picker
      openProjectPicker();
      return;
    }
    const freshState = initializeWizardState();
    freshState.appInfo.appName = name;
    setWizardState(freshState);
    setActiveProjectRkey(null);
    setLastPdsSaveTimestamp(null);
    clearPdsContentSnapshot();
    saveWizardState(freshState);
    reloadUI();
  });

  // Save current project first
  dialogEl.querySelector('#picker-save-first')?.addEventListener('click', async () => {
    const btn = dialogEl!.querySelector('#picker-save-first') as HTMLButtonElement;
    btn.textContent = 'Saving\u2026';
    btn.disabled = true;
    try {
      const state = getWizardState();
      const rkey = await saveProject(state, getActiveProjectRkey());
      setActiveProjectRkey(rkey);
      const currentState = getWizardState();
      setLastPdsSaveTimestamp(currentState.lastSaved);
      snapshotPdsContent(currentState);
      // Refresh the dialog
      closePicker();
      openProjectPicker();
    } catch (err: any) {
      btn.textContent = 'Save failed';
      setTimeout(() => {
        btn.textContent = 'Save Current Project First';
        btn.disabled = false;
      }, 2000);
    }
  });

  // Delete buttons
  dialogEl.querySelectorAll('.project-item-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const el = btn as HTMLElement;
      const rkey = el.dataset.rkey!;
      const name = el.dataset.name!;
      showDeleteConfirmation(rkey, name);
    });
  });
}

function showDeleteConfirmation(rkey: string, name: string): void {
  if (!dialogEl) return;

  const overlay = document.createElement('div');
  overlay.className = 'dialog-content';
  overlay.id = 'delete-confirm-overlay';
  overlay.innerHTML = `
  <h2>Delete Project</h2>
  <p>This will permanently delete <strong style="color: var(--text-primary);">"${escapeHtml(name)}"</strong> from your PDS. This cannot be undone.</p>
  <p style="font-size: 0.95rem;">Type <strong style="color: var(--text-primary);">${escapeHtml(name)}</strong> to confirm:</p>
  <input type="text" class="delete-confirm-input" id="delete-confirm-input" placeholder="Type project name...">
  <div class="dialog-buttons" style="margin-top: 0.5rem;">
    <button type="button" class="dialog-button dialog-button--danger" id="delete-confirm-btn" disabled>Delete Project</button>
  </div>
  <button type="button" class="dialog-cancel" id="delete-confirm-cancel">Cancel</button>`;

  // Replace dialog content with delete confirmation
  const originalContent = dialogEl.innerHTML;
  dialogEl.innerHTML = '';
  dialogEl.appendChild(overlay);

  const input = dialogEl.querySelector('#delete-confirm-input') as HTMLInputElement;
  const confirmBtn = dialogEl.querySelector('#delete-confirm-btn') as HTMLButtonElement;
  const cancelBtn = dialogEl.querySelector('#delete-confirm-cancel') as HTMLButtonElement;

  input.addEventListener('input', () => {
    confirmBtn.disabled = input.value !== name;
  });

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.textContent = 'Deleting\u2026';
    confirmBtn.disabled = true;
    try {
      await deleteProject(rkey);
      // If deleted project was active, clear tracking and reset state
      if (getActiveProjectRkey() === rkey) {
        setActiveProjectRkey(null);
        setLastPdsSaveTimestamp(null);
        clearPdsContentSnapshot();
        const freshState = initializeWizardState();
        setWizardState(freshState);
        saveWizardState(freshState);
      }
      // Refresh the picker
      closePicker();
      openProjectPicker();
    } catch (err: any) {
      confirmBtn.textContent = 'Delete failed';
      setTimeout(() => {
        confirmBtn.textContent = 'Delete Project';
        confirmBtn.disabled = input.value !== name;
      }, 2000);
    }
  });

  cancelBtn.addEventListener('click', () => {
    // Restore original dialog content
    dialogEl!.innerHTML = originalContent;
    // Re-wire (need to fetch projects again)
    listProjects().then((projects) => wirePickerEvents(projects)).catch(() => {});
  });

  input.focus();
}

function closePicker(): void {
  if (dialogEl) {
    dialogEl.close();
    dialogEl.remove();
    dialogEl = null;
  }
}

function reloadUI(): void {
  const state = getWizardState();
  if (state.currentStep >= 2) {
    const section = state.activeSection || 'requirements';
    // Check if workspace layout is already rendered (i.e. we're already in the wizard)
    const workspaceExists = document.getElementById('workspace-panel-body');
    if (workspaceExists) {
      // Already in wizard — re-render the active section. switchSection
      // won't push history because state.activeSection was just overwritten
      // to the loaded value, so we sync the URL explicitly.
      switchSection(section, { skipHistory: true });
      replaceSectionInHistory(section);
    } else {
      // Still on landing page — transition to wizard and render workspace
      transitionToWizard(() => {
        renderCurrentStep();
        replaceSectionInHistory(section);
      });
    }
  } else {
    // On landing/early steps
    renderCurrentStep();
  }
  updateAppNameInputs();
  updateSaveButtonVisibility();
}

function showErrorDialog(): void {
  if (dialogEl) {
    dialogEl.close();
    dialogEl.remove();
  }

  dialogEl = document.createElement('dialog');
  dialogEl.className = 'wizard-dialog';
  dialogEl.style.maxWidth = '450px';
  dialogEl.innerHTML = `<div class="dialog-content">
  <button type="button" class="dialog-close" id="picker-close">&times;</button>
  <h2>Your Projects</h2>
  <div class="dialog-error">Unable to load projects. Check your connection and try again.</div>
  <div class="dialog-buttons">
    <button type="button" class="dialog-button" id="picker-retry">Retry</button>
  </div>
  <button type="button" class="dialog-cancel" id="picker-cancel">Close</button>
</div>`;

  document.body.appendChild(dialogEl);

  dialogEl.querySelector('#picker-close')?.addEventListener('click', closePicker);
  dialogEl.querySelector('#picker-cancel')?.addEventListener('click', closePicker);
  dialogEl.querySelector('#picker-retry')?.addEventListener('click', () => {
    closePicker();
    openProjectPicker();
  });
  dialogEl.addEventListener('click', (e) => {
    if (e.target === dialogEl) closePicker();
  });

  dialogEl.showModal();
}

function formatRelativeDate(iso: string): string {
  if (!iso) return 'unknown';
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
