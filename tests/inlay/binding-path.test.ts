import { describe, it, expect } from 'vitest';
import {
  serializePath,
  parsePath,
  pathScope,
  isSpecialSegment,
  parseBindingPath,
} from '../../src/inlay/binding-path';

describe('serializePath', () => {
  it('joins segments with dots', () => {
    expect(serializePath(['record', 'avatar'])).toBe('record.avatar');
  });

  it('handles deep paths', () => {
    expect(serializePath(['record', 'item', 'artists', '0', 'artistName']))
      .toBe('record.item.artists.0.artistName');
  });

  it('handles paths with special segments', () => {
    expect(serializePath(['props', 'uri', '$did'])).toBe('props.uri.$did');
  });
});

describe('parsePath', () => {
  it('splits on dots', () => {
    expect(parsePath('record.avatar')).toEqual(['record', 'avatar']);
  });

  it('round-trips with serializePath', () => {
    const paths = [
      ['record', 'avatar'],
      ['props', 'uri', '$did'],
      ['record', 'item', 'artists', '0', 'artistName'],
      ['record', 'displayName'],
      ['props', 'uri'],
    ];
    for (const path of paths) {
      expect(parsePath(serializePath(path))).toEqual(path);
    }
  });
});

describe('pathScope', () => {
  it('returns "record" for record paths', () => {
    expect(pathScope(['record', 'avatar'])).toBe('record');
  });

  it('returns "props" for props paths', () => {
    expect(pathScope(['props', 'uri'])).toBe('props');
  });

  it('throws on empty path', () => {
    expect(() => pathScope([])).toThrow('Empty binding path');
  });

  it('throws on unknown scope', () => {
    expect(() => pathScope(['state', 'count'])).toThrow('Unknown binding scope: "state"');
  });
});

describe('isSpecialSegment', () => {
  it('recognizes $did', () => {
    expect(isSpecialSegment('$did')).toBe(true);
  });

  it('recognizes $collection', () => {
    expect(isSpecialSegment('$collection')).toBe(true);
  });

  it('recognizes $rkey', () => {
    expect(isSpecialSegment('$rkey')).toBe(true);
  });

  it('rejects normal segments', () => {
    expect(isSpecialSegment('avatar')).toBe(false);
    expect(isSpecialSegment('did')).toBe(false);
    expect(isSpecialSegment('$other')).toBe(false);
  });
});

describe('parseBindingPath', () => {
  it('parses a simple record path', () => {
    expect(parseBindingPath(['record', 'avatar'])).toEqual({
      scope: 'record',
      segments: ['avatar'],
      special: null,
    });
  });

  it('parses a deep record path (NowPlaying artistName)', () => {
    expect(parseBindingPath(['record', 'item', 'artists', '0', 'artistName'])).toEqual({
      scope: 'record',
      segments: ['item', 'artists', '0', 'artistName'],
      special: null,
    });
  });

  it('parses a props path with no special segment', () => {
    expect(parseBindingPath(['props', 'uri'])).toEqual({
      scope: 'props',
      segments: ['uri'],
      special: null,
    });
  });

  it('extracts trailing $did special segment', () => {
    expect(parseBindingPath(['props', 'uri', '$did'])).toEqual({
      scope: 'props',
      segments: ['uri'],
      special: '$did',
    });
  });

  it('extracts trailing $collection special segment', () => {
    expect(parseBindingPath(['props', 'uri', '$collection'])).toEqual({
      scope: 'props',
      segments: ['uri'],
      special: '$collection',
    });
  });

  it('extracts trailing $rkey special segment', () => {
    expect(parseBindingPath(['props', 'uri', '$rkey'])).toEqual({
      scope: 'props',
      segments: ['uri'],
      special: '$rkey',
    });
  });

  it('throws on a path with only a scope', () => {
    expect(() => parseBindingPath(['record'])).toThrow('Binding path too short');
  });

  it('throws on an empty path', () => {
    expect(() => parseBindingPath([])).toThrow('Binding path too short');
  });

  it('throws on an unknown scope', () => {
    expect(() => parseBindingPath(['state', 'x'])).toThrow('Unknown binding scope');
  });
});
