/**
 * OTA manager (runtime orchestrator). Ties the pure OTA modules to the running
 * server: status for the Updates tab, manual/auto checks against GitHub
 * Releases, install of a verified core-compatible payload and a restart request
 * so the bootstrap loader picks it up. Best-effort: offline never blocks.
 *
 * Two channels:
 *   - stable       → latest full release, compared with isNewer.
 *   - experimental → latest prerelease, compared with isNewerWithBuild
 *                    (same X.Y.Z but newer +exp.<utc> build stamp counts).
 */
import {
  fetchLatestPrerelease,
  fetchLatestRelease,
  findOtaAssets,
  type FetchLike,
  type LatestRelease,
} from './github.js';
import { parseManifestJson, type OtaManifest } from './manifest.js';
import { installBundle, type InstallResult } from './installer.js';
import { readOtaState } from './state.js';
import { isAtLeast, isNewer, isNewerWithBuild } from './semver.js';
import { ENV_PREFIX } from '../pluginMeta.js';

export type UpdateMode = 'manual' | 'auto';
export type UpdateChannel = 'stable' | 'experimental';

export type LastResult =
  | 'installed'
  | 'already-current'
  | 'refused-core'
  | 'verify-failed'
  | 'offline'
  | 'quarantined'
  | null;

export interface OtaStatus {
  coreVersion: string;
  otaVersion: string;
  otaActive: boolean;
  channel: UpdateChannel;
  latest: string | null;
  updateAvailable: boolean;
  requiresCore: boolean;
  mode: UpdateMode;
  checkIntervalHours: number;
  lastCheck: string | null;
  lastResult: LastResult;
}

export interface OtaManagerDeps {
  readonly dataDir: string;
  readonly coreVersion: string;
  readonly getMode: () => UpdateMode;
  readonly getChannel: () => UpdateChannel;
  readonly getIntervalHours: () => number;
  readonly requestRestart: () => void;
  readonly fetchImpl?: FetchLike;
  readonly publicKeyPem?: string | undefined;
  readonly now?: () => Date;
  readonly logger?: (level: 'info' | 'warn', msg: string, ctx?: Record<string, unknown>) => void;
}

interface CheckOutcome {
  latest: string | null;
  manifest: OtaManifest | null;
  updateAvailable: boolean;
  requiresCore: boolean;
  result: LastResult;
}

function defaultFetch(): FetchLike {
  const g = globalThis as { fetch: (i: string, o?: unknown) => Promise<unknown> };
  return ((input: string, init?: unknown) => g.fetch(input, init)) as unknown as FetchLike;
}

export class OtaManager {
  private readonly deps: OtaManagerDeps;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;
  private lastCheck: string | null = null;
  private lastResult: LastResult = null;
  private cachedLatest: string | null = null;
  private cachedRequiresCore = false;
  private cachedUpdateAvailable = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  public constructor(deps: OtaManagerDeps) {
    this.deps = deps;
    this.fetchImpl = deps.fetchImpl ?? defaultFetch();
    this.now = deps.now ?? ((): Date => new Date());
  }

  /** Current running payload version (loader-provided env), else core. */
  private otaVersion(): string {
    return process.env[`${ENV_PREFIX}_OTA_VERSION`] ?? this.deps.coreVersion;
  }

  private otaActive(): boolean {
    return process.env[`${ENV_PREFIX}_OTA_ACTIVE`] === '1';
  }

  private resolveRelease(channel: UpdateChannel): Promise<LatestRelease | null> {
    return channel === 'experimental'
      ? fetchLatestPrerelease(this.fetchImpl)
      : fetchLatestRelease(this.fetchImpl);
  }

  private isNewerForChannel(candidate: string, current: string, channel: UpdateChannel): boolean {
    return channel === 'experimental'
      ? isNewerWithBuild(candidate, current)
      : isNewer(candidate, current);
  }

  public getStatus(): OtaStatus {
    return {
      coreVersion: this.deps.coreVersion,
      otaVersion: this.otaVersion(),
      otaActive: this.otaActive(),
      channel: this.deps.getChannel(),
      latest: this.cachedLatest,
      updateAvailable: this.cachedUpdateAvailable,
      requiresCore: this.cachedRequiresCore,
      mode: this.deps.getMode(),
      checkIntervalHours: this.deps.getIntervalHours(),
      lastCheck: this.lastCheck,
      lastResult: this.lastResult,
    };
  }

  public async check(): Promise<CheckOutcome> {
    this.lastCheck = this.now().toISOString();
    const channel = this.deps.getChannel();
    const rel = await this.resolveRelease(channel);
    if (rel === null) {
      this.lastResult = 'offline';
      return {
        latest: this.cachedLatest,
        manifest: null,
        updateAvailable: false,
        requiresCore: false,
        result: 'offline',
      };
    }
    const assets = findOtaAssets(rel);
    if (assets.manifest === null || assets.bundle === null) {
      this.cachedLatest = rel.tagName.replace(/^v/iu, '');
      this.cachedUpdateAvailable = false;
      this.cachedRequiresCore = false;
      return {
        latest: this.cachedLatest,
        manifest: null,
        updateAvailable: false,
        requiresCore: false,
        result: null,
      };
    }
    let manifest: OtaManifest | null = null;
    try {
      const res = await this.fetchImpl(assets.manifest.url, {
        headers: { 'User-Agent': 'calendar-ota' },
      });
      if (res.ok) manifest = parseManifestJson(await res.text());
    } catch {
      manifest = null;
    }
    if (manifest === null) {
      this.lastResult = 'offline';
      return {
        latest: this.cachedLatest,
        manifest: null,
        updateAvailable: false,
        requiresCore: false,
        result: 'offline',
      };
    }

    const state = await readOtaState(this.deps.dataDir);
    const quarantined = state.quarantined.includes(manifest.version);
    const requiresCore = !isAtLeast(this.deps.coreVersion, manifest.minCoreVersion);
    const newer = this.isNewerForChannel(manifest.version, this.otaVersion(), channel);
    const updateAvailable = newer && !requiresCore && !quarantined;

    this.cachedLatest = manifest.version.replace(/^v/iu, '');
    this.cachedRequiresCore = newer && requiresCore;
    this.cachedUpdateAvailable = updateAvailable;

    let result: LastResult = null;
    if (!newer) result = 'already-current';
    else if (requiresCore) result = 'refused-core';
    else if (quarantined) result = 'quarantined';
    this.lastResult = result;

    return { latest: this.cachedLatest, manifest, updateAvailable, requiresCore: this.cachedRequiresCore, result };
  }

  public async install(): Promise<{
    status: OtaStatus;
    result: InstallResult | { ok: false; reason: LastResult; detail: string };
  }> {
    const outcome = await this.check();
    if (outcome.manifest === null || !outcome.updateAvailable) {
      const reason: LastResult = outcome.result ?? 'already-current';
      return { status: this.getStatus(), result: { ok: false, reason, detail: `not eligible: ${reason}` } };
    }
    const rel = await this.resolveRelease(this.deps.getChannel());
    const assets = rel !== null ? findOtaAssets(rel) : { manifest: null, bundle: null, sha256: null };
    if (assets.bundle === null) {
      this.lastResult = 'offline';
      return { status: this.getStatus(), result: { ok: false, reason: 'offline', detail: 'bundle asset missing' } };
    }
    const res = await installBundle(
      {
        dataDir: this.deps.dataDir,
        fetchImpl: this.fetchImpl,
        ...(this.deps.publicKeyPem !== undefined ? { publicKeyPem: this.deps.publicKeyPem } : {}),
        logger: (lvl, msg) => this.deps.logger?.(lvl, msg),
      },
      { manifest: outcome.manifest, bundle: assets.bundle, sha256: assets.sha256 },
    );
    if (res.ok) {
      this.lastResult = 'installed';
      this.deps.logger?.('info', `OTA ${res.version} installed; requesting restart`);
      setTimeout(() => this.deps.requestRestart(), 500);
    } else {
      this.lastResult = res.reason === 'verify-failed' ? 'verify-failed' : this.lastResult;
    }
    return { status: this.getStatus(), result: res };
  }

  public start(): void {
    if (this.timer !== null) return;
    const tick = (): void => {
      void this.autoTick().catch(() => undefined);
    };
    const intervalMs = Math.max(1, this.deps.getIntervalHours()) * 3_600_000;
    this.timer = setInterval(tick, intervalMs);
    setTimeout(tick, 30_000);
  }

  public stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async autoTick(): Promise<void> {
    if (this.deps.getMode() !== 'auto') {
      await this.check();
      return;
    }
    await this.install();
  }
}
