import { pathToFileURL } from 'node:url';
import { ConnectClient } from '../connect/client.js';
import { DashboardController } from '../dashboard/controller.js';
import { NotificationService } from '../notifications/service.js';
import { ConfigStore } from '../persistence/store.js';
import { APP_VERSION, buildId } from '../shared/version.js';
import { msUntilNextMidnight } from './clock.js';
import { PLUGIN_ID, readEnv } from './env.js';
import { Orchestrator } from './orchestrator.js';
import { OtaManager } from './ota/manager.js';
import { CallHome } from './analytics/callHome.js';

// Safety net: a stray rejection or exception must NEVER terminate the plugin.
process.on('unhandledRejection', (reason) => {
  console.error('[calendar] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[calendar] uncaughtException:', err);
});

function markHealthy(): void {
  (globalThis as { __otaMarkHealthy?: () => void }).__otaMarkHealthy?.();
}

export async function main(): Promise<void> {
  const env = readEnv();
  const coreVersion = process.env['CALENDAR_VERSION'] ?? APP_VERSION;
  const otaActive = process.env['CALENDAR_OTA_ACTIVE'] === '1';
  console.log(
    `[calendar] start build=${buildId()} pluginId=${PLUGIN_ID} core=${coreVersion} ota=${otaActive} ` +
      `connectUrl=${env.connectUrl} dataDir=${env.dataDir} noConnect=${env.noConnect} hasToken=${Boolean(env.authToken)}`,
  );
  const store = new ConfigStore(env.dataDir);

  const notifications = new NotificationService(
    () => store.get().notificationLanguage,
    () => store.get().telegram,
  );

  const orchestrator = new Orchestrator(store, notifications);

  let connect: ConnectClient | undefined;
  if (!env.noConnect && env.authToken) {
    connect = new ConnectClient({
      url: env.connectUrl,
      pluginId: PLUGIN_ID,
      authToken: env.authToken,
      onMessage: (msg) => {
        orchestrator.handleMessage(msg).catch((err) => {
          console.error('[calendar] message handler error:', err);
        });
      },
      onStateChange: (state) => {
        if (state === 'connected') orchestrator.sendPluginState();
      },
    });
    orchestrator.attachClient(connect);
    connect.start();
  } else {
    console.log(
      `[calendar] Connect API disabled (noConnect=${env.noConnect}, hasToken=${Boolean(env.authToken)}). Dashboard only.`,
    );
  }

  // OTA update manager (channels stable/experimental) + opt-in analytics.
  const ota = new OtaManager({
    dataDir: env.dataDir,
    coreVersion,
    getMode: () => store.get().updates.mode,
    getChannel: () => store.get().updates.channel,
    getIntervalHours: () => store.get().updates.checkIntervalHours,
    requestRestart: () => {
      console.log('[calendar] restart requested (OTA install) — exiting for loader pickup');
      setTimeout(() => process.exit(0), 100);
    },
    logger: (lvl, msg) => console.log(`[calendar] ota ${lvl}: ${msg}`),
  });

  const callHome = new CallHome({
    dataDir: env.dataDir,
    getConfig: () => {
      const a = store.get().analytics;
      return {
        enabled: a.enabled,
        ...(a.endpoint ? { endpoint: a.endpoint } : {}),
        intervalHours: a.intervalHours,
        ...(a.pingSecret ? { pingSecret: a.pingSecret } : {}),
      };
    },
    buildInfo: () => ({
      coreVersion,
      otaVersion: process.env['CALENDAR_OTA_VERSION'] ?? coreVersion,
      buildId: buildId(),
      arch: process.arch,
      lang: store.get().notificationLanguage,
    }),
    logger: (lvl, msg) => console.log(`[calendar] analytics ${lvl}: ${msg}`),
  });

  const dashboard = new DashboardController(
    { orchestrator, notifications, connect, noConnect: env.noConnect || !env.authToken, ota, callHome },
    env.noDashboard,
    env.dashboardPortOverride,
  );
  if (env.noDashboard) console.log('[calendar] dashboard force-disabled (CALENDAR_NO_DASHBOARD)');
  orchestrator.setOnConfigApplied((cfg) => {
    void dashboard.reconcile(cfg.dashboard.enabled, cfg.dashboard.port);
  });
  const initial = store.get().dashboard;
  await dashboard.reconcile(initial.enabled, initial.port);

  await orchestrator.recompute().catch((err) => console.error('[calendar] recompute failed:', err));
  scheduleMidnight();

  // Start background loops after a successful boot, and mark the OTA payload
  // healthy so the loader resets its crash-loop counter.
  ota.start();
  callHome.start();
  markHealthy();

  function scheduleMidnight(): void {
    const tz = store.get().timezone;
    const delay = msUntilNextMidnight(tz);
    setTimeout(() => {
      orchestrator
        .recompute()
        .catch((err) => console.error('[calendar] recompute failed:', err))
        .finally(scheduleMidnight);
    }, delay).unref?.();
  }

  const shutdown = (): void => {
    connect?.stop();
    ota.stop();
    callHome.stop();
    void dashboard.stop().finally(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Direct-run guard: run main() only when this file is the entry point (local
// dev: `node dist/plugin/index.js`). In production the bootstrap loader imports
// this module and calls main() itself, so importing must not auto-run.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('[calendar] fatal during startup:', err);
    process.exit(1);
  });
}
