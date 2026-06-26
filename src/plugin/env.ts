import { readFileSync } from 'node:fs';

/** Stable plugin identifier. Must match the Dockerfile metadata LABEL. */
export const PLUGIN_ID = 'de.fr.renner.plugin.calendar';

export interface Env {
  dataDir: string;
  /** Optional dev override of the dashboard port (else taken from config). */
  dashboardPortOverride: number | undefined;
  /** When true the Connect API WebSocket client is not started (local dev). */
  noConnect: boolean;
  /** When true the dashboard is force-disabled regardless of config (dev). */
  noDashboard: boolean;
  /** Fully qualified wss:// URL of the HCU Connect API endpoint. */
  connectUrl: string;
  /** Raw auth token (already resolved from env/file/mount), if available. */
  authToken: string | undefined;
}

function readToken(): string | undefined {
  const fromEnv = process.env.CALENDAR_AUTH_TOKEN;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  const candidates = [process.env.CALENDAR_TOKEN_PATH, '/TOKEN'].filter(
    (p): p is string => typeof p === 'string' && p.length > 0,
  );
  for (const path of candidates) {
    try {
      const content = readFileSync(path, 'utf8').trim();
      if (content) return content;
    } catch {
      // Ignore missing token files; resolution continues with the next candidate.
    }
  }
  return undefined;
}

function resolveConnectUrl(): string {
  if (process.env.CALENDAR_CONNECT_URL && process.env.CALENDAR_CONNECT_URL.trim()) {
    return process.env.CALENDAR_CONNECT_URL.trim();
  }
  // Remote-dev convenience: point at an HCU on the local network by host name.
  const host = process.env.CALENDAR_HCU_HOST?.trim();
  if (host) return `wss://${host}:9001`;
  // Installed default: the HCU exposes the Connect API to containers here.
  return 'wss://host.containers.internal:9001';
}

export function readEnv(): Env {
  const rawPort = process.env.CALENDAR_DASHBOARD_PORT;
  const port = rawPort ? Number(rawPort) : NaN;
  return {
    dataDir: process.env.CALENDAR_DATA_DIR?.trim() || '/data',
    dashboardPortOverride: Number.isFinite(port) ? port : undefined,
    noConnect: process.env.CALENDAR_NO_CONNECT === '1' || process.env.CALENDAR_NO_CONNECT === 'true',
    noDashboard:
      process.env.CALENDAR_NO_DASHBOARD === '1' || process.env.CALENDAR_NO_DASHBOARD === 'true',
    connectUrl: resolveConnectUrl(),
    authToken: readToken(),
  };
}
