import type { FastifyInstance } from 'fastify';
import { writeFileSync } from 'node:fs';
import { buildServer, type ServerDeps } from './server.js';

/** File read by the Docker HEALTHCHECK to learn the active dashboard port. */
const PORT_FILE = '/tmp/calendar-dashport';

/**
 * Manages the lifecycle of the dashboard HTTP server so it can be enabled,
 * disabled and moved to a different port at runtime in response to changes
 * made on the HCU plugin config page (CONFIG_UPDATE_REQUEST) or the dashboard
 * itself. Reconciliation is idempotent.
 */
export class DashboardController {
  private app: FastifyInstance | undefined;
  private currentPort: number | undefined;
  private busy: Promise<void> = Promise.resolve();

  constructor(
    private readonly deps: ServerDeps,
    private readonly forceDisabled: boolean,
    private readonly portOverride: number | undefined,
  ) {}

  getPort(): number | undefined {
    return this.currentPort;
  }

  private writePortFile(value: string): void {
    try {
      writeFileSync(PORT_FILE, value, 'utf8');
    } catch {
      // Best effort: the healthcheck falls back to the default port.
    }
  }

  /** Bring the server in line with the desired enabled/port state. */
  reconcile(enabled: boolean, port: number): Promise<void> {
    // Serialize reconciliations so overlapping config saves cannot race.
    this.busy = this.busy.then(() => this.doReconcile(enabled, port)).catch((err) => {
      console.error('[calendar] dashboard reconcile error:', err);
    });
    return this.busy;
  }

  private async doReconcile(enabled: boolean, port: number): Promise<void> {
    const wantEnabled = enabled && !this.forceDisabled;
    const wantPort = this.portOverride ?? port;

    if (!wantEnabled) {
      await this.stop();
      this.writePortFile('disabled');
      return;
    }
    if (this.app && this.currentPort === wantPort) return; // already correct
    await this.stop();
    await this.start(wantPort);
  }

  private async start(port: number): Promise<void> {
    const app = await buildServer(this.deps);
    try {
      await app.listen({ host: '0.0.0.0', port });
      this.app = app;
      this.currentPort = port;
      this.writePortFile(String(port));
      console.log(`[calendar] dashboard on :${port}`);
    } catch (err) {
      console.error(`[calendar] dashboard failed to bind :${port}:`, err);
      await app.close().catch(() => undefined);
      this.app = undefined;
      this.currentPort = undefined;
    }
  }

  async stop(): Promise<void> {
    if (this.app) {
      const app = this.app;
      this.app = undefined;
      this.currentPort = undefined;
      await app.close().catch(() => undefined);
    }
  }
}
