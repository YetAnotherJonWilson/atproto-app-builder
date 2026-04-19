// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';

import {
  initializeWizardState,
  saveWizardState,
  loadWizardState,
} from '../../src/app/state/WizardState';

describe('WizardState persistence — Component.inlayComponentRef', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips through save/load on a component', () => {
    const state = initializeWizardState();
    state.components = [
      {
        id: 'c1',
        name: 'Now Playing',
        requirementIds: [],
        componentType: 'text',
        inlayComponentRef:
          'at://did:plc:fpruhuo22xkm5o7ttr2ktxdo/at.inlay.component/mov.danabra.NowPlaying',
      },
    ];

    saveWizardState(state);
    const loaded = loadWizardState();

    expect(loaded).not.toBeNull();
    expect(loaded!.state.components).toHaveLength(1);
    expect(loaded!.state.components[0].inlayComponentRef).toBe(
      'at://did:plc:fpruhuo22xkm5o7ttr2ktxdo/at.inlay.component/mov.danabra.NowPlaying',
    );
  });

  it('leaves inlayComponentRef undefined when absent', () => {
    const state = initializeWizardState();
    state.components = [
      { id: 'c1', name: 'About', requirementIds: [], componentType: 'text' },
    ];

    saveWizardState(state);
    const loaded = loadWizardState();

    expect(loaded!.state.components[0].inlayComponentRef).toBeUndefined();
  });
});
