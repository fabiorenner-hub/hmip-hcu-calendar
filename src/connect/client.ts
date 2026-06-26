import WebSocket from 'ws';
import { makeEnvelope, type PluginMessage } from './envelope.js';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectLogEntry {
  ts: string;
  dir: 'in' | 'out' | 'sys';
  type: string;
  detail?: string;
}

export interface ConnectClientOptions {
  url: string;
  pluginId: string;
  authToken: string;
  onMessage: (msg: PluginMessage) => void;
  onStateChange?: (state: ConnectionState) => void;
}

const MAX_LOG = 200;
const MAX_BACKOFF_MS = 30_000;

/**
 * WebSocket client for the HCU Connect API. Handles the spec handshake
 * headers, automatic reconnection with exponential backoff and keeps a small
 * ring buffer of recent messages for the diagnostics UI.
 */
export class ConnectClient {
  private ws: WebSocket | undefined;
  private state: ConnectionState = 'disconnected';
  private backoff = 1000;
  private stopped = false;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private readonly log: ConnectLogEntry[] = [];

  constructor(private readonly opts: ConnectClientOptions) {}

  getState(): ConnectionState {
    return this.state;
  }

  getLog(): ConnectLogEntry[] {
    return [...this.log];
  }

  private pushLog(entry: Omit<ConnectLogEntry, 'ts'>): void {
    this.log.push({ ts: new Date().toISOString(), ...entry });
    if (this.log.length > MAX_LOG) this.log.splice(0, this.log.length - MAX_LOG);
  }

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.opts.onStateChange?.(state);
    }
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = undefined;
    this.setState('disconnected');
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  /** Send an already-built PluginMessage envelope. */
  send(msg: PluginMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pushLog({ dir: 'sys', type: 'send-skipped', detail: msg.type });
      return;
    }
    this.ws.send(JSON.stringify(msg));
    this.pushLog({ dir: 'out', type: msg.type, detail: msg.id });
  }

  private connect(): void {
    this.setState('connecting');
    this.pushLog({ dir: 'sys', type: 'connecting', detail: this.opts.url });
    console.log(`[calendar] connecting to ${this.opts.url} as plugin-id=${this.opts.pluginId}`);

    const ws = new WebSocket(this.opts.url, {
      // The HCU presents a self-signed certificate on the local network.
      rejectUnauthorized: false,
      headers: {
        authtoken: this.opts.authToken,
        'plugin-id': this.opts.pluginId,
      },
    });
    this.ws = ws;

    ws.on('open', () => {
      this.backoff = 1000;
      this.setState('connected');
      this.pushLog({ dir: 'sys', type: 'connected' });
      console.log('[calendar] connect: WebSocket OPEN');
    });

    ws.on('message', (data: WebSocket.RawData) => {
      const text = data.toString();
      let msg: PluginMessage;
      try {
        msg = JSON.parse(text) as PluginMessage;
      } catch {
        this.pushLog({ dir: 'in', type: 'parse-error', detail: text.slice(0, 120) });
        return;
      }
      this.pushLog({ dir: 'in', type: msg.type ?? 'unknown', detail: msg.id });
      console.log(`[calendar] connect: received ${msg.type} (id=${msg.id})`);
      try {
        this.opts.onMessage(msg);
      } catch (err) {
        this.pushLog({ dir: 'sys', type: 'handler-error', detail: String(err) });
        console.error('[calendar] connect: handler error', err);
      }
    });

    ws.on('close', (code, reason) => {
      this.pushLog({ dir: 'sys', type: 'closed', detail: String(code) });
      console.warn(`[calendar] connect: CLOSED code=${code} reason=${reason?.toString() || ''}`);
      this.scheduleReconnect();
    });

    ws.on('error', (err) => {
      this.setState('error');
      const detail = String((err as Error & { code?: string }).code ?? (err as Error).message ?? err);
      this.pushLog({ dir: 'sys', type: 'error', detail });
      console.error(`[calendar] connect: ERROR ${detail}`);
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped) {
      this.setState('disconnected');
      return;
    }
    this.setState('disconnected');
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
    this.pushLog({ dir: 'sys', type: 'reconnect-scheduled', detail: `${delay}ms` });
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}

export { makeEnvelope };
