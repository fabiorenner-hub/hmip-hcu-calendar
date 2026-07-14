import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { installBundle, isSafeBundlePath, parseBundleFile } from '../src/plugin/ota/installer.js';
import type { FetchLike } from '../src/plugin/ota/github.js';
import type { OtaManifest } from '../src/plugin/ota/manifest.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ota-inst-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function bundleBytes(version = '0.1.4'): Uint8Array {
  const obj = {
    format: 'calendar-ota-1',
    version,
    files: { 'main.js': Buffer.from('export const main=async()=>{};').toString('base64') },
  };
  return new Uint8Array(Buffer.from(JSON.stringify(obj), 'utf8'));
}

function fetchReturning(bytes: Uint8Array): FetchLike {
  return (() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(null),
      text: () => Promise.resolve(''),
      arrayBuffer: () => Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
    })) as FetchLike;
}

describe('installer path guard', () => {
  it('rejects traversal / absolute / backslash paths', () => {
    expect(isSafeBundlePath('main.js')).toBe(true);
    expect(isSafeBundlePath('public/app.js')).toBe(true);
    expect(isSafeBundlePath('../etc/passwd')).toBe(false);
    expect(isSafeBundlePath('/abs')).toBe(false);
    expect(isSafeBundlePath('public\\x')).toBe(false);
    expect(isSafeBundlePath('secret.txt')).toBe(false);
  });

  it('parseBundleFile requires main.js and correct format', () => {
    expect(parseBundleFile(bundleBytes())).not.toBeNull();
    const noMain = new Uint8Array(
      Buffer.from(JSON.stringify({ format: 'calendar-ota-1', version: '1.0.0', files: {} })),
    );
    expect(parseBundleFile(noMain)).toBeNull();
  });
});

describe('installBundle', () => {
  const manifest = (bytes: Uint8Array, version = '0.1.4'): OtaManifest => ({
    version,
    minCoreVersion: '0.1.0',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    assetUrl: 'https://example.com/b',
    bundleName: 'calendar-ota.json',
  });

  it('fails with verify-failed on sha mismatch', async () => {
    const bytes = bundleBytes();
    const res = await installBundle(
      { dataDir: dir, fetchImpl: fetchReturning(bytes) },
      { manifest: { ...manifest(bytes), sha256: 'f'.repeat(64) }, bundle: { name: 'b', url: 'https://x/b' } },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('verify-failed');
  });

  it('happy path stages, activates and writes mainSha256', async () => {
    const bytes = bundleBytes();
    const res = await installBundle(
      { dataDir: dir, fetchImpl: fetchReturning(bytes) },
      { manifest: manifest(bytes), bundle: { name: 'b', url: 'https://x/b' } },
    );
    expect(res.ok).toBe(true);
    expect(existsSync(join(dir, 'ota', 'active', 'main.js'))).toBe(true);
    const m = JSON.parse(readFileSync(join(dir, 'ota', 'active', 'manifest.json'), 'utf8')) as {
      mainSha256?: string;
    };
    expect(m.mainSha256).toMatch(/^[0-9a-f]{64}$/u);
  });
});
