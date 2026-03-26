import { describe, it, expect } from 'vitest';
import { generateAuthTs } from '../../src/generator/atproto/Auth';

describe('generateAuthTs', () => {
  const result = generateAuthTs();

  it('imports getOAuthConfig from environment config', () => {
    expect(result).toContain("from '../config/environment'");
    expect(result).toContain('getOAuthConfig');
  });

  it('contains dev path using loopback client metadata', () => {
    expect(result).toContain('atprotoLoopbackClientMetadata');
    expect(result).toContain('new BrowserOAuthClient({');
  });

  it('contains prod path using BrowserOAuthClient.load', () => {
    expect(result).toContain('BrowserOAuthClient.load({');
  });

  it('branches on config.isDev', () => {
    expect(result).toContain('config.isDev');
  });

  it('uses config for handleResolver', () => {
    expect(result).toContain('config.handleResolver');
  });

  it('uses config for clientId', () => {
    expect(result).toContain('config.clientId');
  });

  it('exports initOAuthClient as async', () => {
    expect(result).toContain('export async function initOAuthClient()');
  });
});
