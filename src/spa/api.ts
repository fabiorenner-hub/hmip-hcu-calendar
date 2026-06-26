import { signal } from '@preact/signals';
import type { Snapshot } from '../engine/index.js';
import type { Config } from '../shared/config.js';

export type { Snapshot, Config };
export type { DeviceSnapshot, UpcomingMatch } from '../engine/index.js';

export interface Diagnostics {
  pluginId: string;
  version: string;
  buildId: string;
  connect: { enabled: boolean; state: string };
  timezone: string;
  todayIso: string;
  node: string;
  uptimeSeconds: number;
}

export interface ConnectLogEntry {
  ts: string;
  dir: 'in' | 'out' | 'sys';
  type: string;
  detail?: string;
}

export interface NotificationMessage {
  id: string;
  ts: string;
  titleDe: string;
  titleEn: string;
  bodyDe: string;
  bodyEn: string;
  delivered: boolean;
}

export interface HolidayPreview {
  id: string;
  nameDe: string;
  nameEn: string;
  date: string;
  nationwide: boolean;
  states: string[];
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) detail = body.error.message;
    } catch {
      // Non-JSON error body; keep statusText.
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const api = {
  state: () => json<Snapshot>('/api/state'),
  getConfig: () => json<Config>('/api/config'),
  putConfig: (cfg: Config) => json<Config>('/api/config', { method: 'PUT', body: JSON.stringify(cfg) }),
  override: (id: string, body: { on?: boolean; clear?: boolean; until?: string }) =>
    json<Config>(`/api/devices/${id}/override`, { method: 'POST', body: JSON.stringify(body) }),
  diagnostics: () => json<Diagnostics>('/api/diagnostics'),
  connectLog: () => json<{ entries: ConnectLogEntry[] }>('/api/connect/log'),
  notifications: () => json<{ messages: NotificationMessage[] }>('/api/notifications'),
  holidays: (year: number, states: string[]) =>
    json<{ year: number; states: string[]; holidays: HolidayPreview[] }>(
      `/api/holidays?year=${year}&states=${states.join(',')}`,
    ),
};

/** Live snapshot, kept fresh via SSE with a polling fallback. */
export const snapshot = signal<Snapshot | null>(null);

export function startStream(): void {
  api.state().then((s) => (snapshot.value = s)).catch(() => undefined);
  try {
    const es = new EventSource('/api/stream');
    es.onmessage = (ev) => {
      try {
        snapshot.value = JSON.parse(ev.data) as Snapshot;
      } catch {
        // Ignore malformed frames.
      }
    };
    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do here.
    };
  } catch {
    // Environments without EventSource fall back to manual refresh/polling.
    setInterval(() => {
      api.state().then((s) => (snapshot.value = s)).catch(() => undefined);
    }, 15_000);
  }
}
