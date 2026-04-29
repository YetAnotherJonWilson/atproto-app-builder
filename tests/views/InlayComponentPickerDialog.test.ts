// @vitest-environment jsdom
/**
 * Tests for the helper that derives a wizard component's published NSID
 * for compatibility filtering. The picker dialog itself runs in jsdom but
 * we test it by invoking the helper directly — DOM-level picker behavior
 * is exercised by ComponentsPanel.inlay.test.ts via the panel buttons.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getPublishedNsidForComponent } from '../../src/app/dialogs/InlayComponentPickerDialog';
import {
  setWizardState,
  initializeWizardState,
} from '../../src/app/state/WizardState';
import type { Component, RecordType, Requirement } from '../../src/types/wizard';

function setup(rt: RecordType, req: Requirement, comp: Component): void {
  const state = initializeWizardState();
  state.recordTypes = [rt];
  state.requirements = [req];
  state.components = [comp];
  setWizardState(state);
}

beforeEach(() => {
  setWizardState(initializeWizardState());
});

describe('getPublishedNsidForComponent', () => {
  const cmp: Component = {
    id: 'c1',
    name: 'Profile Card',
    requirementIds: ['r1'],
  };
  const req: Requirement = {
    id: 'r1',
    type: 'do',
    description: '',
    dataTypeIds: ['rt1'],
  };

  it('returns the adopted NSID directly', () => {
    setup(
      {
        id: 'rt1',
        name: 'profile',
        displayName: 'Profile',
        description: '',
        fields: [],
        source: 'adopted',
        adoptedNsid: 'app.bsky.actor.profile',
      },
      req,
      cmp,
    );
    expect(getPublishedNsidForComponent(cmp)).toBe('app.bsky.actor.profile');
  });

  it('computes the NSID for a thelexfiles namespace', () => {
    setup(
      {
        id: 'rt1',
        name: 'profile',
        displayName: 'Profile',
        description: '',
        fields: [],
        source: 'new',
        namespaceOption: 'thelexfiles',
        lexUsername: 'jon',
      },
      req,
      cmp,
    );
    expect(getPublishedNsidForComponent(cmp)).toBe('com.thelexfiles.jon.profile');
  });

  it('returns null when no namespaceOption is set', () => {
    setup(
      {
        id: 'rt1',
        name: 'profile',
        displayName: 'Profile',
        description: '',
        fields: [],
        source: 'new',
      },
      req,
      cmp,
    );
    expect(getPublishedNsidForComponent(cmp)).toBeNull();
  });

  it('returns null when component has no do requirement with dataTypeIds', () => {
    setup(
      {
        id: 'rt1',
        name: 'profile',
        displayName: 'Profile',
        description: '',
        fields: [],
        source: 'new',
        namespaceOption: 'thelexfiles',
        lexUsername: 'jon',
      },
      { id: 'r1', type: 'know', text: 'About' },
      cmp,
    );
    expect(getPublishedNsidForComponent(cmp)).toBeNull();
  });
});
