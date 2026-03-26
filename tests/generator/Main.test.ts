import { describe, it, expect } from 'vitest';
import { generateMainTs } from '../../src/generator/app/Main';

describe('generateMainTs', () => {
  const result = generateMainTs('home');

  it('awaits initOAuthClient inside DOMContentLoaded', () => {
    expect(result).toContain('await initOAuthClient()');
  });

  it('does not call initOAuthClient at module top level', () => {
    // The bare "initOAuthClient();" call should NOT appear outside the event listener
    const lines = result.split('\n');
    const topLevelCalls = lines.filter(
      (line, i) =>
        line.trim() === 'initOAuthClient();' &&
        // Not inside an async function or event listener
        !lines.slice(Math.max(0, i - 5), i).some(l => l.includes('async') || l.includes('await'))
    );
    expect(topLevelCalls).toHaveLength(0);
  });

  it('navigates to the provided first view ID', () => {
    expect(result).toContain("router.navigate('home')");
  });

  it('handles OAuth callback detection', () => {
    expect(result).toContain('isOAuthCallback');
  });
});
