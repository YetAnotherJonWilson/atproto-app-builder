// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';

import {
  setLoggedIn,
  isLoggedIn,
  getActiveProjectRkey,
  setActiveProjectRkey,
  getLastPdsSaveTimestamp,
  setLastPdsSaveTimestamp,
  hasUnsavedPdsChanges,
  snapshotPdsContent,
  clearPdsContentSnapshot,
  setWizardState,
  initializeWizardState,
  getWizardState,
} from '../../src/app/state/WizardState';

describe('WizardState PDS tracking', () => {
  beforeEach(() => {
    setLoggedIn(false);
    setActiveProjectRkey(null);
    setLastPdsSaveTimestamp(null);
    clearPdsContentSnapshot();
    setWizardState(initializeWizardState());
    localStorage.clear();
  });

  describe('login state', () => {
    it('defaults to not logged in', () => {
      expect(isLoggedIn()).toBe(false);
    });

    it('can be set to logged in', () => {
      setLoggedIn(true);
      expect(isLoggedIn()).toBe(true);
    });
  });

  describe('activeProjectRkey', () => {
    it('defaults to null', () => {
      expect(getActiveProjectRkey()).toBeNull();
    });

    it('can be set and retrieved', () => {
      setActiveProjectRkey('abc123');
      expect(getActiveProjectRkey()).toBe('abc123');
    });

    it('can be cleared back to null', () => {
      setActiveProjectRkey('abc123');
      setActiveProjectRkey(null);
      expect(getActiveProjectRkey()).toBeNull();
    });
  });

  describe('lastPdsSaveTimestamp', () => {
    it('defaults to null', () => {
      expect(getLastPdsSaveTimestamp()).toBeNull();
    });

    it('can be set and retrieved', () => {
      setLastPdsSaveTimestamp('2026-03-25T12:00:00.000Z');
      expect(getLastPdsSaveTimestamp()).toBe('2026-03-25T12:00:00.000Z');
    });
  });

  describe('hasUnsavedPdsChanges', () => {
    it('returns false when not logged in', () => {
      setLoggedIn(false);
      const state = getWizardState();
      state.appInfo.appName = 'Something meaningful';
      expect(hasUnsavedPdsChanges()).toBe(false);
    });

    it('returns false when logged in but state is empty (no meaningful data)', () => {
      setLoggedIn(true);
      // Fresh state has no meaningful data
      expect(hasUnsavedPdsChanges()).toBe(false);
    });

    it('returns true when logged in with meaningful state and never saved to PDS', () => {
      setLoggedIn(true);
      const state = getWizardState();
      state.appInfo.appName = 'My App';
      expect(hasUnsavedPdsChanges()).toBe(true);
    });

    it('returns false when content matches PDS snapshot', () => {
      setLoggedIn(true);
      const state = getWizardState();
      state.appInfo.appName = 'My App';
      // Simulate a PDS save — snapshot current content
      snapshotPdsContent(state);
      expect(hasUnsavedPdsChanges()).toBe(false);
    });

    it('returns false after snapshot even if lastSaved timestamp changes', () => {
      setLoggedIn(true);
      const state = getWizardState();
      state.appInfo.appName = 'My App';
      snapshotPdsContent(state);
      // Simulate a localStorage re-save (bumps lastSaved but no content change)
      state.lastSaved = new Date().toISOString();
      expect(hasUnsavedPdsChanges()).toBe(false);
    });

    it('returns true when content differs from PDS snapshot', () => {
      setLoggedIn(true);
      const state = getWizardState();
      state.appInfo.appName = 'My App';
      snapshotPdsContent(state);
      // Now change actual content
      state.appInfo.appName = 'My App v2';
      expect(hasUnsavedPdsChanges()).toBe(true);
    });

    it('returns false after clearing snapshot with no meaningful state', () => {
      setLoggedIn(true);
      const state = getWizardState();
      state.appInfo.appName = 'My App';
      snapshotPdsContent(state);
      clearPdsContentSnapshot();
      // Reset to empty state — no meaningful data
      state.appInfo.appName = '';
      expect(hasUnsavedPdsChanges()).toBe(false);
    });
  });

});
