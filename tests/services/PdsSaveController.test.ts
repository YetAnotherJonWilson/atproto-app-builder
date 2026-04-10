// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock ProjectService
const mockSaveProject = vi.fn();
vi.mock('../../src/app/services/ProjectService', () => ({
  saveProject: (...args: any[]) => mockSaveProject(...args),
}));

// Mock WizardState
const mockState = {
  _loggedIn: false,
  _rkey: null as string | null,
  _lastTs: null as string | null,
  _meaningful: true,
};

vi.mock('../../src/app/state/WizardState', () => ({
  isLoggedIn: () => mockState._loggedIn,
  getWizardState: () => ({
    appInfo: { appName: 'Test', domain: '', description: '', authorName: '' },
    requirements: [{ id: '1', type: 'know', text: 'something' }],
    recordTypes: [],
    queryMethods: [],
    procedureMethods: [],
    components: [],
    views: [],
    currentStep: 2,
    hasGenerated: false,
    hasSeenWelcome: true,
  }),
  hasMeaningfulState: () => mockState._meaningful,
  getActiveProjectRkey: () => mockState._rkey,
  setActiveProjectRkey: (v: string | null) => { mockState._rkey = v; },
  setLastPdsSaveTimestamp: (v: string | null) => { mockState._lastTs = v; },
  snapshotPdsContent: () => {},
}));

import {
  updateSaveButtonVisibility,
  wireSaveButtons,
  triggerAutoSave,
} from '../../src/app/services/PdsSaveController';

describe('PdsSaveController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockState._loggedIn = false;
    mockState._rkey = null;
    mockState._lastTs = null;
    mockState._meaningful = true;

    document.body.innerHTML = `
      <div id="sidebar-save" hidden>
        <button id="sidebar-save-btn"><span class="save-icon">&#9729;</span> Save to PDS</button>
        <div id="sidebar-save-status"></div>
      </div>
      <div id="accordion-save" hidden>
        <button id="accordion-save-btn"><span class="save-icon">&#9729;</span> Save to PDS</button>
        <div id="accordion-save-status"></div>
      </div>
    `;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('updateSaveButtonVisibility', () => {
    it('hides save buttons when logged out', () => {
      mockState._loggedIn = false;
      updateSaveButtonVisibility();
      expect(document.getElementById('sidebar-save')!.hidden).toBe(true);
      expect(document.getElementById('accordion-save')!.hidden).toBe(true);
    });

    it('shows save buttons when logged in', () => {
      mockState._loggedIn = true;
      updateSaveButtonVisibility();
      expect(document.getElementById('sidebar-save')!.hidden).toBe(false);
      expect(document.getElementById('accordion-save')!.hidden).toBe(false);
    });
  });

  describe('wireSaveButtons + manual save', () => {
    it('calls saveProject on click', async () => {
      mockState._loggedIn = true;
      mockSaveProject.mockResolvedValue('new-rkey');

      wireSaveButtons();
      document.getElementById('sidebar-save-btn')!.click();

      // Let the async handler resolve
      await vi.runAllTimersAsync();

      expect(mockSaveProject).toHaveBeenCalledOnce();
      expect(mockState._rkey).toBe('new-rkey');
    });

    it('does not save when state is not meaningful', async () => {
      mockState._loggedIn = true;
      mockState._meaningful = false;

      wireSaveButtons();
      document.getElementById('sidebar-save-btn')!.click();

      await vi.runAllTimersAsync();

      expect(mockSaveProject).not.toHaveBeenCalled();
    });
  });

  describe('triggerAutoSave', () => {
    it('does not save when logged out', async () => {
      mockState._loggedIn = false;
      triggerAutoSave();

      await vi.advanceTimersByTimeAsync(2000);
      expect(mockSaveProject).not.toHaveBeenCalled();
    });

    it('debounces multiple rapid calls into one save', async () => {
      mockState._loggedIn = true;
      mockSaveProject.mockResolvedValue('rkey1');

      triggerAutoSave();
      triggerAutoSave();
      triggerAutoSave();

      await vi.advanceTimersByTimeAsync(2000);

      expect(mockSaveProject).toHaveBeenCalledOnce();
    });

    it('saves after debounce delay', async () => {
      mockState._loggedIn = true;
      mockSaveProject.mockResolvedValue('rkey1');

      triggerAutoSave();

      // Not yet
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockSaveProject).not.toHaveBeenCalled();

      // After debounce
      await vi.advanceTimersByTimeAsync(600);
      expect(mockSaveProject).toHaveBeenCalledOnce();
    });

    it('updates button to success state after save', async () => {
      mockState._loggedIn = true;
      mockSaveProject.mockResolvedValue('rkey1');

      triggerAutoSave();
      await vi.advanceTimersByTimeAsync(2000);

      const btn = document.getElementById('sidebar-save-btn')!;
      expect(btn.textContent).toContain('Saved!');
      expect(btn.classList.contains('sidebar-save-btn--success')).toBe(true);

      // Reverts after 2 seconds
      await vi.advanceTimersByTimeAsync(2000);
      expect(btn.textContent).toContain('Save to PDS');
      expect(btn.classList.contains('sidebar-save-btn--success')).toBe(false);
    });

    it('shows error state on save failure', async () => {
      mockState._loggedIn = true;
      mockSaveProject.mockRejectedValue(new Error('Network down'));

      triggerAutoSave();
      await vi.advanceTimersByTimeAsync(2000);

      const btn = document.getElementById('sidebar-save-btn')!;
      expect(btn.textContent).toContain('Save failed');
      expect(btn.classList.contains('sidebar-save-btn--error')).toBe(true);

      const status = document.getElementById('sidebar-save-status')!;
      expect(status.textContent).toBe('Network down');
    });
  });
});
