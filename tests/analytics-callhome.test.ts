import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CallHome, type CallHomeBuildInfo } from '../src/plugin/analytics/callHome.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'callhome-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const FORBIDDEN = [
  'token',
  'authtoken',
  'sgtin',
  'serial',
  'ip',
  'lat',
  'lon',
  'latitude',
  'longitude',
  'address',
  'name',
  'room',
];

function buildInfo(): CallHomeBuildInfo {
  return {
    coreVersion: '0.2.0',
    otaVersion: '0.2.0',
    buildId: '0.2.0+20260713-184154.abc1234',
    arch: 'arm64',
    lang: 'de',
  };
}

describe('CallHome', () => {
  it('does NOT send when disabled', async () => {
    let calls = 0;
    const ch = new CallHome({
      dataDir: dir,
      getConfig: () => ({ enabled: false, endpoint: 'https://example.com/ingest.php', intervalHours: 24 }),
      buildInfo,
      fetchImpl: () => {
        calls += 1;
        return Promise.resolve({ ok: true, status: 204 });
      },
    });
    await (ch as unknown as { send: () => Promise<boolean> }).send();
    expect(calls).toBe(0);
  });

  it('does NOT send to a non-https endpoint', async () => {
    let calls = 0;
    const ch = new CallHome({
      dataDir: dir,
      getConfig: () => ({ enabled: true, endpoint: 'http://insecure/ingest.php', intervalHours: 24 }),
      buildInfo,
      fetchImpl: () => {
        calls += 1;
        return Promise.resolve({ ok: true, status: 204 });
      },
    });
    await (ch as unknown as { send: () => Promise<boolean> }).send();
    expect(calls).toBe(0);
  });

  it('sends a spec-shaped payload and treats HTTP 204 as success', async () => {
    let seen: Record<string, unknown> | null = null;
    let secret: string | undefined;
    const ch = new CallHome({
      dataDir: dir,
      getConfig: () => ({
        enabled: true,
        endpoint: 'https://example.com/ingest.php',
        intervalHours: 24,
        pingSecret: 's3cr3t',
      }),
      buildInfo,
      fetchImpl: (_url, init) => {
        const i = init as { body: string; headers: Record<string, string> };
        seen = JSON.parse(i.body) as Record<string, unknown>;
        secret = i.headers['X-HPA-Ping-Secret'];
        return Promise.resolve({ ok: false, status: 204 });
      },
    });
    const ok = await (ch as unknown as { send: (e: string) => Promise<boolean> }).send('start');
    expect(ok).toBe(true);
    expect(secret).toBe('s3cr3t');
    expect(seen).toMatchObject({ schema: 1, event: 'start', pluginId: 'de.fr.renner.plugin.calendar' });
  });

  it('preview has no forbidden PII, a 64-hex installId and stays stable', async () => {
    const ch = new CallHome({
      dataDir: dir,
      getConfig: () => ({ enabled: true, endpoint: 'https://example.com/ingest.php', intervalHours: 24 }),
      buildInfo,
    });
    const p1 = await ch.preview('start');
    const keys = Object.keys(p1).map((k) => k.toLowerCase());
    for (const bad of FORBIDDEN) expect(keys).not.toContain(bad);
    expect(p1.installId).toMatch(/^[0-9a-f]{64}$/);

    // A fresh instance over the same dataDir reuses the persisted installId.
    const ch2 = new CallHome({
      dataDir: dir,
      getConfig: () => ({ enabled: true, endpoint: 'https://example.com/ingest.php', intervalHours: 24 }),
      buildInfo,
    });
    const p2 = await ch2.preview();
    expect(p2.installId).toBe(p1.installId);
  });
});
