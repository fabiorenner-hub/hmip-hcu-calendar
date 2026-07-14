/**
 * Bootstrap loader (IMAGE-ONLY, never OTA-updatable).
 *
 * Docker CMD entry (`node dist/bootstrap/loader.js`). Decides at start whether
 * to run a verified OTA payload from `/data/ota/active` or the image-baked
 * bundle (`dist/plugin/index.js`), and protects against crash-loops with
 * automatic rollback (quarantine) to the image bundle.
 *
 * HARD RULE: only node built-ins here. No imports from app code or node_modules,
 * so the loader can never depend on — nor be replaced by — an OTA payload.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_BOOT_ATTEMPTS = 3;

interface OtaStateShape {
  activeVersion: string | null;
  bootAttempts: number;
  lastGoodAt: string | null;
  quarantined: string[];
}

interface MinimalManifest {
  version: string;
  minCoreVersion: string;
  sha256: string;
  mainSha256?: string;
}

export type BundleChoice =
  | { kind: 'ota'; version: string }
  | { kind: 'image'; quarantineDir: boolean; reason: string };

export interface DecideInput {
  readonly coreVersion: string;
  readonly hasActiveBundle: boolean;
  readonly manifest: MinimalManifest | null;
  readonly sha256Match: boolean;
  readonly bootAttempts: number;
  readonly maxBootAttempts: number;
}

function parseSemver(v: string): [number, number, number] {
  const core = v.trim().replace(/^v/iu, '').split(/[-+]/u)[0] ?? '';
  const p = core.split('.');
  const n = (s: string | undefined): number => {
    const x = Number.parseInt(s ?? '0', 10);
    return Number.isFinite(x) && x >= 0 ? x : 0;
  };
  return [n(p[0]), n(p[1]), n(p[2])];
}

function isAtLeast(a: string, b: string): boolean {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i]! > pb[i]!) return true;
    if (pa[i]! < pb[i]!) return false;
  }
  return true;
}

/**
 * PURE decision: OTA vs image, and whether the active dir must be quarantined.
 * An incompatible-but-valid bundle (`requires-core`) is NOT quarantined; a
 * broken/crash-looping bundle IS.
 */
export function decideBundle(input: DecideInput): BundleChoice {
  if (!input.hasActiveBundle) {
    return { kind: 'image', quarantineDir: false, reason: 'no-ota' };
  }
  if (input.manifest === null) {
    return { kind: 'image', quarantineDir: true, reason: 'manifest-invalid' };
  }
  if (!input.sha256Match) {
    return { kind: 'image', quarantineDir: true, reason: 'sha256-mismatch' };
  }
  if (!isAtLeast(input.coreVersion, input.manifest.minCoreVersion)) {
    return { kind: 'image', quarantineDir: false, reason: 'requires-core' };
  }
  if (input.bootAttempts >= input.maxBootAttempts) {
    return { kind: 'image', quarantineDir: true, reason: 'crash-loop' };
  }
  return { kind: 'ota', version: input.manifest.version };
}

function dataDir(): string {
  return process.env['CALENDAR_DATA_DIR'] ?? '/data';
}
function otaDir(): string {
  return path.join(dataDir(), 'ota');
}
function activeDir(): string {
  return path.join(otaDir(), 'active');
}
function statePath(): string {
  return path.join(otaDir(), 'state.json');
}

async function readState(): Promise<OtaStateShape> {
  const fallback: OtaStateShape = {
    activeVersion: null,
    bootAttempts: 0,
    lastGoodAt: null,
    quarantined: [],
  };
  try {
    const raw = await fs.readFile(statePath(), 'utf8');
    const obj = JSON.parse(raw) as Partial<OtaStateShape>;
    return {
      activeVersion: typeof obj.activeVersion === 'string' ? obj.activeVersion : null,
      bootAttempts: typeof obj.bootAttempts === 'number' && obj.bootAttempts >= 0 ? obj.bootAttempts : 0,
      lastGoodAt: typeof obj.lastGoodAt === 'string' ? obj.lastGoodAt : null,
      quarantined: Array.isArray(obj.quarantined)
        ? obj.quarantined.filter((v): v is string => typeof v === 'string')
        : [],
    };
  } catch {
    return fallback;
  }
}

async function writeState(state: OtaStateShape): Promise<void> {
  await fs.mkdir(otaDir(), { recursive: true });
  const tmp = path.join(otaDir(), `state.json.${process.pid}.tmp`);
  await fs.writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, statePath());
}

async function readActiveManifest(): Promise<MinimalManifest | null> {
  try {
    const raw = await fs.readFile(path.join(activeDir(), 'manifest.json'), 'utf8');
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const { version, minCoreVersion, sha256, mainSha256 } = obj;
    if (
      typeof version === 'string' &&
      typeof minCoreVersion === 'string' &&
      typeof sha256 === 'string' &&
      /^[0-9a-f]{64}$/iu.test(sha256)
    ) {
      return {
        version,
        minCoreVersion,
        sha256,
        ...(typeof mainSha256 === 'string' && /^[0-9a-f]{64}$/iu.test(mainSha256) ? { mainSha256 } : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function sha256OfFile(p: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(p);
    return createHash('sha256').update(buf).digest('hex');
  } catch {
    return null;
  }
}

async function quarantineActive(label: string): Promise<void> {
  try {
    const dest = path.join(otaDir(), 'failed', `${label}-${Date.now()}`);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.rename(activeDir(), dest);
  } catch {
    try {
      await fs.rm(activeDir(), { recursive: true, force: true });
    } catch {
      /* give up — image fallback still runs */
    }
  }
}

function log(msg: string): void {
  console.log(`[ota-loader] ${msg}`);
}

async function runImageBundle(): Promise<void> {
  const url = new URL('../plugin/index.js', import.meta.url).href;
  const mod = (await import(url)) as { main?: () => Promise<unknown> };
  if (typeof mod.main === 'function') {
    await mod.main();
  }
}

async function runOtaBundle(): Promise<void> {
  const url = pathToFileURL(path.join(activeDir(), 'main.js')).href;
  const mod = (await import(url)) as { main?: () => Promise<unknown> };
  if (typeof mod.main !== 'function') {
    throw new Error('ota bundle has no main() export');
  }
  await mod.main();
}

export async function runLoader(): Promise<void> {
  const coreVersion = process.env['CALENDAR_VERSION'] ?? '0.0.0';
  const state = await readState();

  const hasActiveBundle =
    (await fileExists(path.join(activeDir(), 'main.js'))) &&
    (await fileExists(path.join(activeDir(), 'manifest.json')));
  const manifest = hasActiveBundle ? await readActiveManifest() : null;
  const sha = manifest !== null ? await sha256OfFile(path.join(activeDir(), 'main.js')) : null;
  const sha256Match =
    manifest !== null &&
    (manifest.mainSha256 === undefined
      ? true
      : sha !== null && sha.toLowerCase() === manifest.mainSha256.toLowerCase());

  const choice = decideBundle({
    coreVersion,
    hasActiveBundle,
    manifest,
    sha256Match,
    bootAttempts: state.bootAttempts,
    maxBootAttempts: MAX_BOOT_ATTEMPTS,
  });

  if (choice.kind === 'image') {
    if (choice.quarantineDir) {
      const label = manifest?.version ?? 'unknown';
      log(`quarantining OTA bundle (${label}): ${choice.reason}`);
      await quarantineActive(label);
      const q = new Set(state.quarantined);
      if (manifest?.version !== undefined) q.add(manifest.version);
      await writeState({ ...state, bootAttempts: 0, quarantined: [...q] });
    } else {
      log(`running image bundle (core ${coreVersion}): ${choice.reason}`);
    }
    await runImageBundle();
    return;
  }

  const nextAttempts = state.bootAttempts + 1;
  await writeState({ ...state, bootAttempts: nextAttempts });
  log(`running OTA bundle ${choice.version} (core ${coreVersion}, attempt ${nextAttempts})`);

  (globalThis as { __otaMarkHealthy?: () => void }).__otaMarkHealthy = (): void => {
    void writeState({
      activeVersion: choice.version,
      bootAttempts: 0,
      lastGoodAt: new Date().toISOString(),
      quarantined: state.quarantined,
    }).catch(() => undefined);
  };
  process.env['CALENDAR_OTA_ACTIVE'] = '1';
  process.env['CALENDAR_OTA_VERSION'] = choice.version;
  process.env['CALENDAR_PUBLIC_DIR'] = path.join(activeDir(), 'public');

  try {
    await runOtaBundle();
  } catch (err) {
    log(
      `OTA bundle failed to start; quarantining + image fallback: ${err instanceof Error ? err.message : String(err)}`,
    );
    await quarantineActive(choice.version);
    const q = new Set(state.quarantined);
    q.add(choice.version);
    await writeState({ activeVersion: null, bootAttempts: 0, lastGoodAt: state.lastGoodAt, quarantined: [...q] });
    delete process.env['CALENDAR_OTA_ACTIVE'];
    delete process.env['CALENDAR_OTA_VERSION'];
    delete process.env['CALENDAR_PUBLIC_DIR'];
    await runImageBundle();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runLoader().catch((err: unknown) => {
    console.error('[ota-loader] fatal', err);
    process.exit(1);
  });
}
