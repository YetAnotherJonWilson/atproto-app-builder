import { describe, it, expect } from 'vitest';
import { generateViteConfig } from '../../src/generator/config/ViteConfig';

describe('generateViteConfig', () => {
  const result = generateViteConfig('My Test App', 'atproto repo:com.example.app.post');

  it('contains clientMetadataPlugin', () => {
    expect(result).toContain('clientMetadataPlugin');
  });

  it('imports loadEnv from vite', () => {
    expect(result).toContain("import { defineConfig, loadEnv } from 'vite'");
  });

  it('imports writeFileSync from node:fs', () => {
    expect(result).toContain("import { writeFileSync, mkdirSync } from 'node:fs'");
  });

  it('embeds the app name in client metadata', () => {
    expect(result).toContain("client_name: 'My Test App'");
  });

  it('reads VITE_APP_URL env var', () => {
    expect(result).toContain('env.VITE_APP_URL');
  });

  it('writes client-metadata.json to outDir', () => {
    expect(result).toContain("resolve(outDir, filename)");
    expect(result).toContain("writeMetadata('client-metadata.json'");
  });

  it('writes client-metadata-compat.json for fallback', () => {
    expect(result).toContain("writeMetadata('client-metadata-compat.json', 'atproto transition:generic')");
  });

  it('warns when VITE_APP_URL is not set', () => {
    expect(result).toContain('VITE_APP_URL not set');
  });

  it('includes dpop_bound_access_tokens in metadata', () => {
    expect(result).toContain('dpop_bound_access_tokens: true');
  });

  it('preserves standard vite config options', () => {
    expect(result).toContain('port: 8080');
    expect(result).toContain("outDir: 'dist'");
    expect(result).toContain("publicDir: 'public'");
  });

  it('escapes special characters in app name', () => {
    const withQuotes = generateViteConfig("App's Name", 'atproto');
    expect(withQuotes).toContain("client_name: 'App\\'s Name'");
  });
});
