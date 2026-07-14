import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OtaManager, type UpdateChannel } from '../src/plugin/ota/manager.js';
import type { FetchLike } from '../src/plugin/ota/github.js';
import {
  LATEST_RELEASE_API,
  RELEASES_API,
} from '../src/plugin/ota/github.js';

const MANIFEST_URL = 'https://example.com/ota-manifest.json';

function manifestJson(version: string, minCore = '0.1.0'): string {
  return JSON.stringify({
    version,
    minCoreVersion: minCore,
    sha256: 'a'.repeat(64),
    assetUrl: 'https://example.com/calendar-ota.json',
    bundleName: 'calendar-ota.json',
  });
}

function releaseObj(tag: string, prerelease: boolean, manifestVersion: string): unknown {
  return {
    tag_name: tag,
    html_url: 'https://x',
    prerelease,
    assets: [
      { name: 'ota-manifest.json', browser_download_url: MANIFEST_URL },
      { name: `calendar-ota-${manifestVersion}.json`, browser_download_url: 'https://example.com/calendar-ota.json' },
    ],
  };
}

function mkFetch(routes: Record<string, unknown>, texts: Record<string, string> = {}): FetchLike {
  return ((url: string) => {
    const has = url in routes || url in texts;
    return Promise.resolve({
      ok: has,
      status: has ? 200 : 404,
      json: () => Promise.resolve(routes[url]),
      text: () => Promise.resolve(texts[url] ?? ''),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });
  }) as FetchLike;
}

function makeManager(channel: UpdateChannel, fetchImpl: FetchLike): OtaManager {
  return new OtaManager({
    dataDir: mkdtempSync(join(tmpdir(), 'ota-mgr-')),
    coreVersion: '0.1.3',
    getMode: () => 'manual',
    getChannel: () => channel,
    getIntervalHours: () => 6,
    requestRestart: () => undefined,
    fetchImpl,
  });
}

describe('OtaManager channels', () => {
  it('stable: newer full release → update available', async () => {
    const f = mkFetch(
      { [LATEST_RELEASE_API]: releaseObj('v0.1.4', false, '0.1.4') },
      { [MANIFEST_URL]: manifestJson('0.1.4') },
    );
    const out = await makeManager('stable', f).check();
    expect(out.updateAvailable).toBe(true);
    expect(out.latest).toBe('0.1.4');
  });

  it('experimental: newer prerelease build stamp → update available', async () => {
    const f = mkFetch(
      { [RELEASES_API]: [releaseObj('experimental', true, '0.1.3+exp.20260702-1200')] },
      { [MANIFEST_URL]: manifestJson('0.1.3+exp.20260702-1200') },
    );
    const out = await makeManager('experimental', f).check();
    expect(out.updateAvailable).toBe(true);
  });

  it('requiresCore when minCoreVersion exceeds core', async () => {
    const f = mkFetch(
      { [LATEST_RELEASE_API]: releaseObj('v0.2.0', false, '0.2.0') },
      { [MANIFEST_URL]: manifestJson('0.2.0', '0.2.0') },
    );
    const out = await makeManager('stable', f).check();
    expect(out.updateAvailable).toBe(false);
    expect(out.requiresCore).toBe(true);
    expect(out.result).toBe('refused-core');
  });

  it('already-current when release equals core', async () => {
    const f = mkFetch(
      { [LATEST_RELEASE_API]: releaseObj('v0.1.3', false, '0.1.3') },
      { [MANIFEST_URL]: manifestJson('0.1.3') },
    );
    const out = await makeManager('stable', f).check();
    expect(out.updateAvailable).toBe(false);
    expect(out.result).toBe('already-current');
  });
});
