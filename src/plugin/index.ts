import { ConnectClient } from '../connect/client.js';
import { DashboardController } from '../dashboard/controller.js';
import { NotificationService } from '../notifications/service.js';
import { ConfigStore } from '../persistence/store.js';
import { buildId } from '../shared/version.js';
import { msUntilNextMidnight } from './clock.js';
import { PLUGIN_ID, readEnv } from './env.js';
import { Orchestrator } from './orchestrator.js';

// Safety net: a stray rejection or exception must NEVER terminate the plugin.
// On Node >= 15 an unhandled promise rejection exits the process by default,
// which on the HCU surfaces as a plugin/setup crash. We log and keep running.
process.on('unhandledRejection', (reason) => {
  console.error('[calendar] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[calendar] uncaughtException:', err);
});

async function main(): Promise<void> {
  const env = readEnv();
  console.log(
    `[calendar] start build=${buildId()} pluginId=${PLUGIN_ID} connectUrl=${env.connectUrl} ` +
      `dataDir=${env.dataDir} noConnect=${env.noConnect} hasToken=${Boolean(env.authToken)}`,
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
        // Never let a handler rejection become an unhandled rejection.
        orchestrator.handleMessage(msg).catch((err) => {
          console.error('[calendar] message handler error:', err);
        });
      },
      onStateChange: (state) => {
        if (state === 'connected') {
          // Announce readiness on (re)connect per spec.
          orchestrator.sendPluginState();
        }
      },
    });
    orchestrator.attachClient(connect);
    connect.start();
  } else {
    console.log(
      `[calendar] Connect API disabled (noConnect=${env.noConnect}, hasToken=${Boolean(env.authToken)}). Dashboard only.`,
    );
  }

  // Dashboard lifecycle is driven by the persisted config (enabled + port),
  // which the HCU plugin config page and the dashboard itself can change at
  // runtime. Env vars only act as dev overrides. The dashboard is non-critical
  // for the HCU integration (purely the Connect API WebSocket), so a bind
  // failure never crashes the plugin.
  const dashboard = new DashboardController(
    { orchestrator, notifications, connect, noConnect: env.noConnect || !env.authToken },
    env.noDashboard,
    env.dashboardPortOverride,
  );
  if (env.noDashboard) console.log('[calendar] dashboard force-disabled (CALENDAR_NO_DASHBOARD)');
  orchestrator.setOnConfigApplied((cfg) => {
    void dashboard.reconcile(cfg.dashboard.enabled, cfg.dashboard.port);
  });
  const initial = store.get().dashboard;
  await dashboard.reconcile(initial.enabled, initial.port);

  // Initial evaluation and a self-rescheduling timer at every local midnight.
  await orchestrator.recompute().catch((err) => console.error('[calendar] recompute failed:', err));
  scheduleMidnight();

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
    void dashboard.stop().finally(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[calendar] fatal during startup:', err);
  process.exit(1);
});
