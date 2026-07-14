import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { ConnectClient } from '../connect/client.js';
import type { NotificationService } from '../notifications/service.js';
import { germanHolidays, holidaysForStates, toIso } from '../engine/index.js';
import { maskConfig } from '../shared/config.js';
import { APP_VERSION, buildId } from '../shared/version.js';
import type { Orchestrator } from '../plugin/orchestrator.js';
import { PLUGIN_ID } from '../plugin/env.js';
import type { OtaManager } from '../plugin/ota/manager.js';
import type { CallHome } from '../plugin/analytics/callHome.js';

export interface ServerDeps {
  orchestrator: Orchestrator;
  notifications: NotificationService;
  connect: ConnectClient | undefined;
  noConnect: boolean;
  /** Optional OTA manager; when absent the OTA endpoints return 503. */
  ota?: OtaManager | undefined;
  /** Optional analytics call-home (for the transparency preview endpoint). */
  callHome?: CallHome | undefined;
}

function publicDir(): string {
  // When running an OTA payload the loader points this at active/public.
  const fromEnv = process.env['CALENDAR_PUBLIC_DIR'];
  if (fromEnv && fromEnv.trim()) return fromEnv;
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/dashboard/server.js -> ../../public  (and src/dashboard -> ../../public)
  return join(here, '..', '..', 'public');
}

function errorBody(code: string, message: string): { error: { code: string; message: string } } {
  return { error: { code, message } };
}

export async function buildServer(deps: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(fastifyStatic, { root: publicDir(), prefix: '/' });

  app.get('/api/state', async () => deps.orchestrator.getSnapshot());

  app.get('/api/config', async () => maskConfig(deps.orchestrator.getConfig()));

  app.put('/api/config', async (req, reply) => {
    try {
      const incoming = req.body as Record<string, unknown>;
      const current = deps.orchestrator.getConfig();
      // Preserve the real bot token when the UI submits the masked placeholder.
      const merged = mergeSecrets(incoming, current);
      const saved = await deps.orchestrator.updateConfig(merged);
      return maskConfig(saved);
    } catch (err) {
      reply.code(400);
      return errorBody('INVALID_CONFIG', (err as Error).message);
    }
  });

  app.post('/api/devices/:id/override', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { on?: boolean; clear?: boolean; until?: string };
    const cfg = deps.orchestrator.getConfig();
    const exists = cfg.calendars.some((c) => c.id === id);
    if (!exists) {
      reply.code(404);
      return errorBody('UNKNOWN_DEVICE', `No calendar with id ${id}`);
    }
    const calendars = cfg.calendars.map((c) => {
      if (c.id !== id) return c;
      if (body.clear) {
        const { override: _omit, ...rest } = c;
        return rest;
      }
      return { ...c, override: { on: body.on === true, ...(body.until ? { until: body.until } : {}) } };
    });
    const saved = await deps.orchestrator.updateConfig({ ...cfg, calendars });
    return maskConfig(saved);
  });

  app.get('/api/diagnostics', async () => ({
    pluginId: PLUGIN_ID,
    version: APP_VERSION,
    buildId: buildId(),
    connect: {
      enabled: !deps.noConnect,
      state: deps.connect?.getState() ?? 'disconnected',
    },
    timezone: deps.orchestrator.getConfig().timezone,
    todayIso: deps.orchestrator.getSnapshot().todayIso,
    node: process.version,
    uptimeSeconds: Math.round(process.uptime()),
  }));

  app.get('/api/connect/log', async () => ({ entries: deps.connect?.getLog() ?? [] }));

  app.get('/api/notifications', async () => ({ messages: deps.notifications.getMessages() }));
  app.get('/api/messages', async () => ({ messages: deps.notifications.getMessages() }));

  // Plugin-specific: preview the public holidays for a year and states.
  app.get('/api/holidays', async (req) => {
    const q = req.query as { year?: string; states?: string };
    const year = Number(q.year) || new Date().getUTCFullYear();
    const states = (q.states ?? '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const list = (states.length ? holidaysForStates(year, states as never) : germanHolidays(year)).map(
      (h) => ({
        id: h.id,
        nameDe: h.nameDe,
        nameEn: h.nameEn,
        date: toIso(h.date),
        nationwide: h.nationwide,
        states: h.states,
      }),
    );
    list.sort((a, b) => a.date.localeCompare(b.date));
    return { year, states, holidays: list };
  });

  // OTA update endpoints. Return 503 when OTA is unavailable so the UI hides it.
  app.get('/api/ota/status', async (_req, reply) => {
    if (!deps.ota) {
      reply.code(503);
      return errorBody('OTA_UNAVAILABLE', 'OTA is not available');
    }
    return deps.ota.getStatus();
  });
  app.post('/api/ota/check', async (_req, reply) => {
    if (!deps.ota) {
      reply.code(503);
      return errorBody('OTA_UNAVAILABLE', 'OTA is not available');
    }
    await deps.ota.check();
    return deps.ota.getStatus();
  });
  app.post('/api/ota/install', async (_req, reply) => {
    if (!deps.ota) {
      reply.code(503);
      return errorBody('OTA_UNAVAILABLE', 'OTA is not available');
    }
    return deps.ota.install();
  });

  // Analytics transparency: exactly the payload that would be sent (or null).
  app.get('/api/analytics/preview', async () => {
    if (!deps.callHome) return { payload: null };
    return { payload: await deps.callHome.preview() };
  });

  // Server-Sent Events stream of live snapshots.
  app.get('/api/stream', (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const send = (data: unknown): void => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    send(deps.orchestrator.getSnapshot());
    const unsubscribe = deps.orchestrator.subscribe(send);
    const keepAlive = setInterval(() => reply.raw.write(': ping\n\n'), 25_000);
    req.raw.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });

  // SPA fallback: serve index.html for any non-API, non-asset route.
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      reply.code(404).send(errorBody('NOT_FOUND', `No route for ${req.url}`));
      return;
    }
    reply.sendFile('index.html');
  });

  return app;
}

/** Replace masked secret placeholders with the currently stored values. */
function mergeSecrets(incoming: Record<string, unknown>, current: { telegram: { botToken: string } }): unknown {
  const telegram = incoming.telegram as { botToken?: string } | undefined;
  if (telegram && telegram.botToken === '***') {
    return { ...incoming, telegram: { ...telegram, botToken: current.telegram.botToken } };
  }
  return incoming;
}
