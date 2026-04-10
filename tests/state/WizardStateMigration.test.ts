// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';

import {
  setWizardState,
  getWizardState,
  initializeWizardState,
} from '../../src/app/state/WizardState';

describe('WizardState blocks → components migration', () => {
  beforeEach(() => {
    setWizardState(initializeWizardState());
    localStorage.clear();
  });

  it('renames top-level `blocks` field to `components` on load', () => {
    const legacyState = {
      ...initializeWizardState(),
    } as Record<string, unknown>;
    delete legacyState.components;
    legacyState.blocks = [
      { id: 'c1', name: 'About', requirementIds: ['r1'] },
      { id: 'c2', name: 'Feed', requirementIds: ['r2'] },
    ];

    setWizardState(legacyState as ReturnType<typeof initializeWizardState>);

    const loaded = getWizardState() as unknown as Record<string, unknown>;
    expect(Array.isArray(loaded.components)).toBe(true);
    expect((loaded.components as unknown[]).length).toBe(2);
    expect('blocks' in loaded).toBe(false);
    expect((loaded.components as { name: string }[])[0].name).toBe('About');
    expect((loaded.components as { name: string }[])[1].name).toBe('Feed');
  });

  it('renames `blockType` field on each component to `componentType`', () => {
    const legacyState = {
      ...initializeWizardState(),
    } as Record<string, unknown>;
    delete legacyState.components;
    legacyState.blocks = [
      { id: 'c1', name: 'Feed', requirementIds: [], blockType: 'list' },
      { id: 'c2', name: 'About', requirementIds: [], blockType: 'text' },
    ];

    setWizardState(legacyState as ReturnType<typeof initializeWizardState>);

    const loaded = getWizardState();
    expect(loaded.components[0].componentType).toBe('list');
    expect(loaded.components[1].componentType).toBe('text');
    // Legacy field removed
    expect((loaded.components[0] as unknown as Record<string, unknown>).blockType).toBeUndefined();
  });

  it('renames `blockIds` on each view to `componentIds`', () => {
    const legacyState = {
      ...initializeWizardState(),
    } as Record<string, unknown>;
    // Replace views with legacy shape
    legacyState.views = [
      { id: 'v1', name: 'Home', blockIds: ['c1', 'c2'] },
      { id: 'v2', name: 'Profile', blockIds: [] },
    ];

    setWizardState(legacyState as ReturnType<typeof initializeWizardState>);

    const loaded = getWizardState();
    expect(loaded.views[0].componentIds).toEqual(['c1', 'c2']);
    expect(loaded.views[1].componentIds).toEqual([]);
    // Legacy field removed
    expect((loaded.views[0] as unknown as Record<string, unknown>).blockIds).toBeUndefined();
  });

  it('keeps existing `components` field when both `blocks` and `components` are present', () => {
    const legacyState = {
      ...initializeWizardState(),
    } as Record<string, unknown>;
    legacyState.components = [
      { id: 'c1', name: 'Kept', requirementIds: [] },
    ];
    legacyState.blocks = [
      { id: 'c2', name: 'Dropped', requirementIds: [] },
    ];

    setWizardState(legacyState as ReturnType<typeof initializeWizardState>);

    const loaded = getWizardState();
    expect(loaded.components.length).toBe(1);
    expect(loaded.components[0].name).toBe('Kept');
    expect('blocks' in (loaded as unknown as Record<string, unknown>)).toBe(false);
  });
});
