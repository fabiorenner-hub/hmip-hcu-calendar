/**
 * Data-minimising telemetry ("HCU Plugin Analytics"). Default ON, with a
 * VISIBLE toggle in the dashboard (Appearance tab) and a one-line disclosure so
 * users always know it exists and can switch it off.
 *
 * What is sent (pseudonymous technical metadata only): a stable, hashed
 * installId, the pluginId, the running core/OTA versions, the build id, the CPU
 * architecture and the active UI language. NEVER sent: SGTIN/serials, IPs,
 * names, e-mail, location, rooms, device names/addresses, measurements,
 * automations, schedules, config contents, tokens or local network data.
 *
 * The transport is strictly fire-and-forget: HTTPS only, a short total timeout,
 * silent failures (logged locally at most), a slow retry backoff and no fast
 * looping. Telemetry must never block or crash plugin startup, and the plugin
 * works fully without the analytics server.
 */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { PLUGIN_ID } from '../pluginMeta.js';

/**
 * Fixed analytics endpoint. Intentionally hardcoded here (server-side only, not
 * in the shared config nor the SPA bundle) so it is neither shown in the
 * dashboard UI nor user-editable.
 */
const ANALYTICS_ENDPOINT = 'https://hcu.fabiorenner.de/ingest.php';
/** Non-secret, fixed salt so the installId is a hash and never a raw serial. */
const INSTALL_ID_SALT = 'de.fr.renner.hpa.v1';
/** Payloads above this many bytes drop their optional fields (spec: max 4096). */
const MAX_PAYLOAD_BYTES = 4096;
/** Total request timeout (spec: connect ~3s / overall ~5s). fetch only exposes a total. */
const REQUEST_TIMEOUT_MS = 5000;
/** Slow retry backoff after a failed send: 15 min, then a few hours. No fast retry. */
const RETRY_DELAYS_MS = [15 * 60_000, 4 * 3_600_000] as const;

export type TelemetryEvent = 'start' | 'heartbeat' | 'update';

export interface TelemetryPayload {
  schema: 1;
  event: TelemetryEvent;
  installId: string; // exactly 64 lowercase hex
  pluginId: string;
  coreVersion: string;
  otaVersion: string;
  buildId?: string;
  arch?: string;
  hcuFirmware?: string;
  lang?: string;
  ts: string;
}

/** Backwards-compatible alias for existing imports. */
export type AnalyticsPayload = TelemetryPayload;

export interface CallHomeConfig {
  /** The opt-out switch (default on). When false, nothing is ever sent. */
  enabled: boolean;
  intervalHours: number;
  /** Optional simple spam hurdle sent as X-HPA-Ping-Secret (not real auth). */
  pingSecret?: string;
}

/** The version/build/environment facts, supplied by the host at send time. */
export interface CallHomeBuildInfo {
  coreVersion: string;
  otaVersion: string;
  buildId?: string;
  arch?: string;
  hcuFirmware?: string;
  lang?: string;
}

interface TelemetryState {
  /** OTA/release version seen on the previous run — used to detect updates. */
  lastVersion?: string;
  lastTelemetryAttempt?: string;
  lastTelemetrySuccess?: string;
  lastTelemetryEvent?: TelemetryEvent;
  lastHeartbeatAt?: string;
}

export interface CallHomeDeps {
  dataDir: string;
  getConfig: () => CallHomeConfig;
  buildInfo: () => CallHomeBuildInfo;
  fetchImpl?: (
    url: string,
    init: unknown,
  ) => Promise<{ ok: boolean; status: number }>;
  logger?: (lvl: 'info' | 'warn', msg: string) => void;
  /** Injectable clock for tests. */
  now?: () => number;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Returns a stable, pseudonymous installId: exactly 64 lowercase hex from a
 * SHA-256 over a fixed salt plus a persisted per-install random seed. The seed
 * is never transmitted. Legacy ids (plain UUID from earlier builds) are
 * migrated to the hashed form in place so the value stays stable per HCU.
 */
async function loadInstallId(dataDir: string): Promise<string> {
  const p = path.join(dataDir, 'analytics-id');
  try {
    const v = (await fs.readFile(p, 'utf8')).trim();
    if (/^[0-9a-f]{64}$/.test(v)) return v;
    if (v.length >= 8) {
      const migrated = sha256Hex(INSTALL_ID_SALT + v);
      await writeFileAtomic(p, `${migrated}\n`);
      return migrated;
    }
  } catch {
    /* new install */
  }
  const seed = randomBytes(32).toString('hex');
  const id = sha256Hex(INSTALL_ID_SALT + seed);
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await writeFileAtomic(p, `${id}\n`);
  } catch {
    /* ignore — a non-persisted id still works for this run */
  }
  return id;
}

async function writeFileAtomic(file: string, content: string): Promise<void> {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, content, 'utf8');
  await fs.rename(tmp, file);
}

export class CallHome {
  private idPromise: Promise<string> | null = null;
  private state: TelemetryState = {};
  private stateLoaded = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private startTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly retryTimers = new Set<ReturnType<typeof setTimeout>>();

  public constructor(private readonly deps: CallHomeDeps) {}

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  private statePath(): string {
    return path.join(this.deps.dataDir, 'analytics-state.json');
  }

  private async loadState(): Promise<void> {
    if (this.stateLoaded) return;
    try {
      const raw = await fs.readFile(this.statePath(), 'utf8');
      this.state = JSON.parse(raw) as TelemetryState;
    } catch {
      this.state = {};
    }
    this.stateLoaded = true;
  }

  private async persistState(): Promise<void> {
    try {
      await fs.mkdir(this.deps.dataDir, { recursive: true });
      await writeFileAtomic(this.statePath(), `${JSON.stringify(this.state, null, 2)}\n`);
    } catch {
      /* ignore — state is a best-effort cache */
    }
  }

  private fetch(u: string, i: unknown): Promise<{ ok: boolean; status: number }> {
    const impl =
      this.deps.fetchImpl
      ?? ((a: string, b: unknown) =>
        (
          globalThis as {
            fetch: (x: string, y: unknown) => Promise<{ ok: boolean; status: number }>;
          }
        ).fetch(a, b));
    return impl(u, i);
  }

  /** Build the exact payload for an event (also used by the UI preview). */
  public async preview(event: TelemetryEvent = 'heartbeat'): Promise<TelemetryPayload> {
    this.idPromise ??= loadInstallId(this.deps.dataDir);
    const info = this.deps.buildInfo();
    const full: TelemetryPayload = {
      schema: 1,
      event,
      installId: await this.idPromise,
      pluginId: PLUGIN_ID,
      coreVersion: info.coreVersion,
      otaVersion: info.otaVersion,
      ts: new Date(this.now()).toISOString(),
      ...(info.buildId ? { buildId: info.buildId } : {}),
      ...(info.arch ? { arch: info.arch } : {}),
      ...(info.hcuFirmware ? { hcuFirmware: info.hcuFirmware } : {}),
      ...(info.lang ? { lang: info.lang } : {}),
    };
    if (Buffer.byteLength(JSON.stringify(full), 'utf8') <= MAX_PAYLOAD_BYTES) return full;
    // Over the size cap: keep only the mandatory fields.
    return {
      schema: 1,
      event,
      installId: full.installId,
      pluginId: full.pluginId,
      coreVersion: full.coreVersion,
      otaVersion: full.otaVersion,
      ts: full.ts,
    };
  }

  /**
   * One transmission attempt. `ok` is true on HTTP 204 (or any 2xx). `retry`
   * signals whether a later retry makes sense: server errors (HTTP 5xx) and
   * network/timeout failures are retryable, but HTTP 4xx (e.g. 400 invalid
   * payload) is NOT — per the spec, an invalid body should not be resent.
   */
  private async send(event: TelemetryEvent = 'heartbeat'): Promise<{ ok: boolean; retry: boolean }> {
    const cfg = this.deps.getConfig();
    if (!cfg.enabled) return { ok: false, retry: false };

    await this.loadState();
    this.state.lastTelemetryAttempt = new Date(this.now()).toISOString();
    this.state.lastTelemetryEvent = event;
    void this.persistState();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    timer.unref?.();
    try {
      const body = JSON.stringify(await this.preview(event));
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cfg.pingSecret) headers['X-HPA-Ping-Secret'] = cfg.pingSecret;
      const res = await this.fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      const ok = res.status === 204 || res.ok;
      if (ok) {
        const nowIso = new Date(this.now()).toISOString();
        this.state.lastTelemetrySuccess = nowIso;
        if (event === 'heartbeat') this.state.lastHeartbeatAt = nowIso;
        void this.persistState();
      }
      this.deps.logger?.('info', `telemetry ${event} → ${res.status}`);
      // Retry only on server errors; 4xx (invalid) must not be resent.
      return { ok, retry: !ok && res.status >= 500 };
    } catch {
      // Fire-and-forget: swallow network/timeout errors, log locally only.
      this.deps.logger?.('warn', `telemetry ${event} failed (network/timeout)`);
      return { ok: false, retry: true };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Send an event, retrying only retryable failures with a slow backoff. */
  private dispatch(event: TelemetryEvent, attempt = 0): void {
    void this.send(event).then(({ ok, retry }) => {
      if (ok || !retry || attempt >= RETRY_DELAYS_MS.length) return;
      const delay = RETRY_DELAYS_MS[attempt];
      const timer = setTimeout(() => {
        this.retryTimers.delete(timer);
        this.dispatch(event, attempt + 1);
      }, delay);
      timer.unref?.();
      this.retryTimers.add(timer);
    });
  }

  /**
   * Start background telemetry: shortly after a healthy boot send a `start`
   * (or `update`, when the running version changed since the last run), then a
   * throttled `heartbeat` roughly every `intervalHours` (default 24h). The
   * heartbeat is NOT tied to any request/internal loop.
   */
  public start(): void {
    if (this.startTimer || this.heartbeatTimer) return;
    this.startTimer = setTimeout(() => {
      void (async () => {
        await this.loadState();
        const info = this.deps.buildInfo();
        const current = info.otaVersion || info.coreVersion;
        const isUpdate = Boolean(this.state.lastVersion) && this.state.lastVersion !== current;
        this.state.lastVersion = current;
        void this.persistState();
        this.dispatch(isUpdate ? 'update' : 'start');
      })();
    }, 60_000);
    this.startTimer.unref?.();

    const hours = Math.max(1, this.deps.getConfig().intervalHours);
    this.heartbeatTimer = setInterval(() => {
      void this.maybeHeartbeat();
    }, hours * 3_600_000);
    this.heartbeatTimer.unref?.();
  }

  /** Send a heartbeat only if enough time passed since the last one (dedup). */
  private async maybeHeartbeat(): Promise<void> {
    await this.loadState();
    const hours = Math.max(1, this.deps.getConfig().intervalHours);
    const lastIso = this.state.lastHeartbeatAt ?? this.state.lastTelemetrySuccess;
    const last = lastIso ? Date.parse(lastIso) : 0;
    if (this.now() - last < hours * 3_600_000 * 0.9) return;
    this.dispatch('heartbeat');
  }

  public stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.startTimer) {
      clearTimeout(this.startTimer);
      this.startTimer = null;
    }
    for (const t of this.retryTimers) clearTimeout(t);
    this.retryTimers.clear();
  }
}
