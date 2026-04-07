// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { resolveNameCollision, findDuplicateNsidAdoption } from '../../src/app/views/panels/DataPanel';

type MinimalRecord = {
  id: string;
  name: string;
  displayName: string;
  source: 'new' | 'adopted';
  adoptedNsid?: string;
};

function rec(overrides: Partial<MinimalRecord> & { id: string }): MinimalRecord {
  return { name: '', displayName: 'test', source: 'new', ...overrides };
}

describe('resolveNameCollision', () => {
  it('returns lastSegment unchanged when no collision exists', () => {
    const records = [
      rec({ id: 'new', name: '' }),
      rec({ id: 'existing', name: 'recipe' }),
    ];

    const result = resolveNameCollision('post', 'app.bsky.feed.post', 'new', records);

    expect(result.candidateName).toBe('post');
    expect(result.needsPrompt).toBe(false);
    expect(result.renames).toEqual([]);
  });

  it('prefixes adopted record when it collides with a custom record', () => {
    const records = [
      rec({ id: 'new', name: '' }),
      rec({ id: 'custom', name: 'post', source: 'new' }),
    ];

    const result = resolveNameCollision('post', 'app.bsky.feed.post', 'new', records);

    expect(result.candidateName).toBe('feedPost');
    expect(result.needsPrompt).toBe(false);
    // Custom record is NOT renamed
    expect(result.renames).toEqual([]);
  });

  it('renames both adopted records when they collide with each other', () => {
    const records = [
      rec({ id: 'new', name: '' }),
      rec({
        id: 'existing',
        name: 'post',
        source: 'adopted',
        adoptedNsid: 'com.example.post',
      }),
    ];

    const result = resolveNameCollision('post', 'app.bsky.feed.post', 'new', records);

    expect(result.candidateName).toBe('feedPost');
    expect(result.needsPrompt).toBe(false);
    expect(result.renames).toEqual([
      { id: 'existing', newName: 'examplePost' },
    ]);
  });

  it('handles three-way collision: custom + adopted + new adopted', () => {
    const records = [
      rec({ id: 'new', name: '' }),
      rec({ id: 'custom', name: 'post', source: 'new' }),
      rec({
        id: 'adopted1',
        name: 'post',
        source: 'adopted',
        adoptedNsid: 'com.example.post',
      }),
    ];

    const result = resolveNameCollision('post', 'app.bsky.feed.post', 'new', records);

    expect(result.candidateName).toBe('feedPost');
    expect(result.needsPrompt).toBe(false);
    // Only the adopted record is renamed, not the custom one
    expect(result.renames).toEqual([
      { id: 'adopted1', newName: 'examplePost' },
    ]);
  });

  it('sets needsPrompt when auto-disambiguation still collides', () => {
    const records = [
      rec({ id: 'new', name: '' }),
      rec({ id: 'blocker', name: 'feedPost', source: 'new' }),
      rec({ id: 'custom', name: 'post', source: 'new' }),
    ];

    const result = resolveNameCollision('post', 'app.bsky.feed.post', 'new', records);

    // "feedPost" collides with the existing record named "feedPost"
    expect(result.candidateName).toBe('feedPost');
    expect(result.needsPrompt).toBe(true);
  });

  it('uses second-to-last NSID segment for different namespace depths', () => {
    const records = [
      rec({ id: 'new', name: '' }),
      rec({
        id: 'existing',
        name: 'post',
        source: 'adopted',
        adoptedNsid: 'xyz.social.post',
      }),
    ];

    const result = resolveNameCollision('post', 'com.example.post', 'new', records);

    expect(result.candidateName).toBe('examplePost');
    expect(result.renames).toEqual([
      { id: 'existing', newName: 'socialPost' },
    ]);
  });

  it('is case-insensitive when detecting collisions', () => {
    const records = [
      rec({ id: 'new', name: '' }),
      rec({ id: 'existing', name: 'Post', source: 'new' }),
    ];

    const result = resolveNameCollision('post', 'app.bsky.feed.post', 'new', records);

    expect(result.candidateName).toBe('feedPost');
    expect(result.needsPrompt).toBe(false);
  });

  it('does not rename the record being adopted (only others)', () => {
    const records = [
      rec({ id: 'new', name: 'post' }),
      rec({ id: 'other', name: 'recipe' }),
    ];

    // No collision with 'other', and 'new' is excluded from collision check
    const result = resolveNameCollision('post', 'app.bsky.feed.post', 'new', records);

    expect(result.candidateName).toBe('post');
    expect(result.renames).toEqual([]);
  });

  it('sets needsPrompt when same NSID is adopted twice', () => {
    const records = [
      rec({ id: 'new', name: '' }),
      rec({
        id: 'existing',
        name: 'listitem',
        source: 'adopted',
        adoptedNsid: 'app.bsky.graph.listitem',
      }),
    ];

    const result = resolveNameCollision(
      'listitem', 'app.bsky.graph.listitem', 'new', records,
    );

    // Both would disambiguate to "graphListitem" — collision is unavoidable
    expect(result.candidateName).toBe('graphListitem');
    expect(result.needsPrompt).toBe(true);
    expect(result.renames).toEqual([
      { id: 'existing', newName: 'graphListitem' },
    ]);
  });

  it('handles NSID with only two segments', () => {
    const records = [
      rec({ id: 'new', name: '' }),
      rec({ id: 'existing', name: 'post', source: 'new' }),
    ];

    const result = resolveNameCollision('post', 'example.post', 'new', records);

    expect(result.candidateName).toBe('examplePost');
    expect(result.needsPrompt).toBe(false);
  });
});

describe('findDuplicateNsidAdoption', () => {
  it('returns undefined when no other record uses the NSID', () => {
    const records = [
      rec({ id: 'current', adoptedNsid: undefined }),
      rec({ id: 'other', adoptedNsid: 'com.example.recipe' }),
    ];

    expect(findDuplicateNsidAdoption('app.bsky.graph.listitem', 'current', records))
      .toBeUndefined();
  });

  it('returns the conflicting record when another record uses the same NSID', () => {
    const records = [
      rec({ id: 'current', adoptedNsid: undefined }),
      rec({ id: 'other', adoptedNsid: 'app.bsky.graph.listitem' }),
    ];

    const result = findDuplicateNsidAdoption('app.bsky.graph.listitem', 'current', records);
    expect(result).toBeDefined();
    expect(result!.id).toBe('other');
  });

  it('ignores the current record when it already has the same NSID (re-adopt)', () => {
    const records = [
      rec({ id: 'current', adoptedNsid: 'app.bsky.graph.listitem' }),
      rec({ id: 'other', adoptedNsid: 'com.example.post' }),
    ];

    expect(findDuplicateNsidAdoption('app.bsky.graph.listitem', 'current', records))
      .toBeUndefined();
  });
});
