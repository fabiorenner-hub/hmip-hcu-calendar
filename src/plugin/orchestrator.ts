import { buildSnapshot, type Snapshot } from '../engine/index.js';
import { toIso } from '../engine/dates.js';
import {
  IncomingType,
  OutgoingType,
  makeEnvelope,
  readDeviceId,
  readSwitchTarget,
  switchDevice,
  type ConnectDevice,
  type PluginMessage,
} from '../connect/envelope.js';
import type { ConnectClient } from '../connect/client.js';
import type { NotificationService } from '../notifications/service.js';
import type { ConfigStore } from '../persistence/store.js';
import { type Config } from '../shared/config.js';
import { APP_VERSION } from '../shared/version.js';
import { localDateInTimezone } from './clock.js';
import { PLUGIN_ID } from './env.js';

export type SnapshotListener = (snapshot: Snapshot) => void;

/**
 * Central coordinator. Owns the current snapshot, reacts to Connect API
 * messages, detects day-boundary state changes and emits STATUS_EVENTs only
 * for changes it actually observes (never optimistic echoes of HCU commands).
 */
export class Orchestrator {
  private snapshot: Snapshot;
  private version = 0;
  private lastOn = new Map<string, boolean>();
  private readonly listeners = new Set<SnapshotListener>();
  private client: ConnectClient | undefined;
  private onConfigApplied: ((config: Config) => void) | undefined;

  constructor(
    private readonly store: ConfigStore,
    private readonly notifications: NotificationService,
  ) {
    this.snapshot = this.compute();
  }

  attachClient(client: ConnectClient): void {
    this.client = client;
  }

  /** Register a callback invoked (deferred) whenever the config is persisted. */
  setOnConfigApplied(fn: (config: Config) => void): void {
    this.onConfigApplied = fn;
  }

  private notifyConfigApplied(): void {
    const fn = this.onConfigApplied;
    if (!fn) return;
    const cfg = this.store.get();
    // Defer so any in-flight HTTP response flushes before the dashboard may
    // be restarted on a new port.
    setTimeout(() => fn(cfg), 200);
  }

  getSnapshot(): Snapshot {
    return this.snapshot;
  }

  getConfig(): Config {
    return this.store.get();
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private compute(): Snapshot {
    this.version += 1;
    const cfg = this.store.get();
    const today = localDateInTimezone(cfg.timezone);
    return buildSnapshot(cfg, today, this.version);
  }

  /**
   * Recompute the snapshot, fire notifications for transitions and emit
   * STATUS_EVENTs for observed changes. `suppressDeviceId` skips the event for
   * a device whose change was just requested by the HCU (anti optimistic echo).
   */
  async recompute(suppressDeviceId?: string): Promise<void> {
    const previousOn = this.lastOn;
    this.snapshot = this.compute();
    const next = new Map<string, boolean>();

    for (const dev of this.snapshot.devices) {
      next.set(dev.deviceId, dev.on);
      if (!dev.enabled) continue;
      const had = previousOn.has(dev.deviceId);
      const before = previousOn.get(dev.deviceId);
      const changed = had && before !== dev.on;

      if (changed && dev.deviceId !== suppressDeviceId) {
        this.emitStatusEvent(dev.deviceId, dev.on);
        await this.maybeNotify(dev.deviceId, dev.on);
      }
    }

    this.lastOn = next;
    this.broadcast();
  }

  private async maybeNotify(deviceId: string, on: boolean): Promise<void> {
    const cfg = this.store.get();
    const dev = this.snapshot.devices.find((d) => d.deviceId === deviceId);
    if (!dev) return;
    if (on && !cfg.notifyOn.dayStart) return;
    if (!on && !cfg.notifyOn.dayEnd) return;

    await this.notifications.notify({
      dedupeKey: `${deviceId}:${this.snapshot.todayIso}:${on ? 'on' : 'off'}`,
      titleDe: on ? `${dev.nameDe} aktiv` : `${dev.nameDe} beendet`,
      titleEn: on ? `${dev.nameEn} active` : `${dev.nameEn} ended`,
      bodyDe: on ? `Heute: ${dev.reasonDe}` : `${dev.nameDe} ist nicht mehr aktiv.`,
      bodyEn: on ? `Today: ${dev.reasonEn}` : `${dev.nameEn} is no longer active.`,
    });
  }

  private broadcast(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.snapshot);
      } catch {
        // A failing listener must not break the others.
      }
    }
  }

  private connectDevices(): ConnectDevice[] {
    return this.snapshot.devices
      .filter((d) => d.enabled)
      .map((d) => switchDevice(d.deviceId, d.on, d.nameDe, APP_VERSION));
  }

  private emitStatusEvent(deviceId: string, on: boolean): void {
    if (!this.client?.isConnected()) return;
    this.client.send(
      makeEnvelope(PLUGIN_ID, OutgoingType.STATUS_EVENT, {
        deviceId,
        features: [{ type: 'switchState', on }],
      }),
    );
  }

  /** Persist a new configuration coming from the web UI and recompute. */
  async updateConfig(next: unknown): Promise<Config> {
    const saved = this.store.save(next);
    await this.recompute();
    this.notifyConfigApplied();
    return saved;
  }

  /** Dispatch an incoming Connect API message. */
  async handleMessage(msg: PluginMessage): Promise<void> {
    if (!this.client) return;
    switch (msg.type) {
      case IncomingType.DISCOVER_REQUEST:
        this.client.send(
          makeEnvelope(
            PLUGIN_ID,
            OutgoingType.DISCOVER_RESPONSE,
            { devices: this.connectDevices(), success: true },
            msg.id,
          ),
        );
        break;

      case IncomingType.STATUS_REQUEST:
        this.client.send(
          makeEnvelope(
            PLUGIN_ID,
            OutgoingType.STATUS_RESPONSE,
            { devices: this.connectDevices(), success: true },
            msg.id,
          ),
        );
        break;

      case IncomingType.CONTROL_REQUEST:
        await this.handleControl(msg);
        break;

      case IncomingType.PLUGIN_STATE_REQUEST:
        this.sendPluginState(msg.id);
        break;

      case IncomingType.CONFIG_TEMPLATE_REQUEST:
        this.client.send(
          makeEnvelope(PLUGIN_ID, OutgoingType.CONFIG_TEMPLATE_RESPONSE, this.configTemplate(), msg.id),
        );
        break;

      case IncomingType.CONFIG_UPDATE_REQUEST:
        this.handleConfigUpdate(msg);
        break;

      default:
        // Unknown / unhandled message types are ignored on purpose.
        break;
    }
  }

  private async handleControl(msg: PluginMessage): Promise<void> {
    const deviceId = readDeviceId(msg.body);
    const target = readSwitchTarget(msg.body);
    const cfg = this.store.get();
    const cal = cfg.calendars.find((c) => c.id === deviceId);

    if (!deviceId || !cal || target === undefined) {
      this.client?.send(
        makeEnvelope(
          PLUGIN_ID,
          OutgoingType.CONTROL_RESPONSE,
          { success: false, error: { code: 'UNKNOWN_DEVICE', message: 'Unknown device or target' } },
          msg.id,
        ),
      );
      return;
    }

    // Apply a manual override that auto-expires at the next local midnight so
    // rule-based evaluation resumes the following day.
    const today = toIso(localDateInTimezone(cfg.timezone));
    const nextCalendars = cfg.calendars.map((c) =>
      c.id === deviceId ? { ...c, override: { on: target, until: today } } : c,
    );
    this.store.save({ ...cfg, calendars: nextCalendars });

    this.client?.send(
      makeEnvelope(PLUGIN_ID, OutgoingType.CONTROL_RESPONSE, { success: true }, msg.id),
    );

    // Recompute for our own UI but suppress the STATUS_EVENT for this device:
    // the HCU derives the new state from the control payload it just sent.
    await this.recompute(deviceId);
  }

  sendPluginState(id?: string): void {
    if (!this.client) return;
    console.log(`[calendar] sending PLUGIN_STATE_RESPONSE READY (echo id=${id ?? 'new'})`);
    this.client.send(
      makeEnvelope(
        PLUGIN_ID,
        OutgoingType.PLUGIN_STATE_RESPONSE,
        { pluginReadinessStatus: 'READY' },
        id,
      ),
    );
  }

  private configTemplate(): unknown {
    const cfg = this.store.get();
    const port = cfg.dashboard.port;
    return {
      groups: {
        dashboard: {
          friendlyName: 'Dashboard',
          description:
            'Das Plugin wird ueber sein eigenes Web-Dashboard konfiguriert (Feiertage, eigene Spezialtage, Sprache). / The plugin is configured via its own web dashboard.',
          order: 1,
        },
      },
      properties: {
        dashboardEnabled: {
          dataType: 'BOOLEAN',
          friendlyName: 'Dashboard aktivieren',
          description:
            'Aktiviert das Web-Dashboard des Plugins. / Enables the plugin web dashboard.',
          groupId: 'dashboard',
          currentValue: cfg.dashboard.enabled,
          defaultValue: true,
          order: 1,
        },
        dashboardPort: {
          dataType: 'INTEGER',
          friendlyName: 'Dashboard-Port',
          description:
            'Eindeutiger Port fuer das Dashboard. Darf nicht mit anderen Plugins kollidieren. / Unique port for the dashboard; must not collide with other plugins.',
          groupId: 'dashboard',
          minimum: 1,
          maximum: 65535,
          currentValue: port,
          defaultValue: 8092,
          order: 2,
        },
        dashboardInfo: {
          dataType: 'READONLY',
          friendlyName: 'Konfiguration',
          description:
            'Feiertage und besondere Tage werden im Web-Dashboard verwaltet. / Holidays and special days are managed in the web dashboard.',
          groupId: 'dashboard',
          currentValue: `http://<hcu>:${port}`,
          order: 3,
        },
      },
    };
  }

  /** Apply a config update from the HCU plugin config page. */
  private handleConfigUpdate(msg: PluginMessage): void {
    const lang = ((msg.body as { languageCode?: string } | undefined)?.languageCode ?? 'de') as
      | 'de'
      | 'en';
    const props = (msg.body as { properties?: Record<string, unknown> } | undefined)?.properties;
    const cfg = this.store.get();
    const dashboard = { ...cfg.dashboard };
    let message: string | undefined;

    if (props && typeof props === 'object') {
      if (typeof props.dashboardEnabled === 'boolean') {
        dashboard.enabled = props.dashboardEnabled;
      }
      if (props.dashboardPort !== undefined) {
        const p = Number(props.dashboardPort);
        if (Number.isInteger(p) && p >= 1 && p <= 65535) {
          dashboard.port = p;
        } else {
          message =
            lang === 'en' ? 'Port must be between 1 and 65535.' : 'Port muss zwischen 1 und 65535 liegen.';
          this.client?.send(
            makeEnvelope(
              PLUGIN_ID,
              OutgoingType.CONFIG_UPDATE_RESPONSE,
              { status: 'FAILED', message },
              msg.id,
            ),
          );
          return;
        }
      }
    }

    try {
      this.store.save({ ...cfg, dashboard });
    } catch (err) {
      this.client?.send(
        makeEnvelope(
          PLUGIN_ID,
          OutgoingType.CONFIG_UPDATE_RESPONSE,
          { status: 'FAILED', message: String((err as Error).message ?? err) },
          msg.id,
        ),
      );
      return;
    }

    this.client?.send(
      makeEnvelope(
        PLUGIN_ID,
        OutgoingType.CONFIG_UPDATE_RESPONSE,
        {
          status: 'APPLIED',
          message:
            lang === 'en'
              ? `Dashboard ${dashboard.enabled ? 'enabled' : 'disabled'} on port ${dashboard.port}.`
              : `Dashboard ${dashboard.enabled ? 'aktiviert' : 'deaktiviert'} auf Port ${dashboard.port}.`,
        },
        msg.id,
      ),
    );
    this.notifyConfigApplied();
  }
}
