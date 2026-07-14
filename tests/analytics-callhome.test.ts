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
  'endpoint',
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
    coreVersion: '0.2.1',
    otaVersion: '0.2.1',
    buildId: '0.2.1+20260714-184154.abc1234',
    arch: 'arm64',
    lang: 'de',
  };
}

type SendResult = Promise<{ ok: boolean; retry: boolean }>;

describe('CallHome', () => {
  it('does NOT send when disabled (opt-out)', async () => {
    let calls = 0;
    const ch = new CallHome({
      dataDir: dir,
      getConfig: () => ({ enabled: false, intervalHours: 24 }),
      buildInfo,
      fetchImpl: () => {
        calls += 1;
        return Promise.resolve({ ok: true, status: 204 });
      },
    });
    await (ch as unknown as { send: () => SendResult }).send();
    expect(calls).toBe(0);
  });

  it('sends a spec-shaped payload to the fixed endpoint and treats 204 as success', async () => {
    let seenUrl = '';
    let seen: Record<string, unknown> | null = null;
    let secret: string | undefined;
    const ch = new CallHome({
      dataDir: dir,
      getConfig: () => ({ enabled: true, intervalHours: 24, pingSecret: 's3cr3t' }),
      buildInfo,
      fetchImpl: (url, init) => {
        seenUrl = url;
        const i = init as { body: string; headers: Record<string, string> };
        seen = JSON.parse(i.body) as Record<string, unknown>;
        secret = i.headers['X-HPA-Ping-Secret'];
        return Promise.resolve({ ok: false, status: 204 });
      },
    });
    const res = await (ch as unknown as { send: (e: string) => SendResult }).send('start');
    expect(res.ok).toBe(true);
    expect(seenUrl).toBe('https://hcu.fabiorenner.de/ingest.php');
    expect(secret).toBe('s3cr3t');
    expect(seen).toMatchObject({ schema: 1, event: 'start', pluginId: 'de.fr.renner.plugin.calendar' });
  });

  it('retries on server errors (5xx) but not on invalid requests (4xx)', async () => {
    const mk = (status: number): CallHome =>
      new CallHome({
        dataDir: dir,
        getConfig: () => ({ enabled: true, intervalHours: 24 }),
        buildInfo,
        fetchImpl: () => Promise.resolve({ ok: false, status }),
      });
    const r400 = await (mk(400) as unknown as { send: (e: string) => SendResult }).send('start');
    const r500 = await (mk(500) as unknown as { send: (e: string) => SendResult }).send('start');
    expect(r400).toEqual({ ok: false, retry: false });
    expect(r500).toEqual({ ok: false, retry: true });
  });

  it('preview has no forbidden PII, a 64-hex installId and stays stable', async () => {
    const ch = new CallHome({
      dataDir: dir,
      getConfig: () => ({ enabled: true, intervalHours: 24 }),
      buildInfo,
    });
    const p1 = await ch.preview('start');
    const keys = Object.keys(p1).map((k) => k.toLowerCase());
    for (const bad of FORBIDDEN) expect(keys).not.toContain(bad);
    expect(p1.installId).toMatch(/^[0-9a-f]{64}$/);

    // A fresh instance over the same dataDir reuses the persisted installId.
    const ch2 = new CallHome({
      dataDir: dir,
      getConfig: () => ({ enabled: true, intervalHours: 24 }),
      buildInfo,
    });
    const p2 = await ch2.preview();
    expect(p2.installId).toBe(p1.installId);
  });
});
