import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { NuwaOS } from './nuwa-os';

export interface ControlPlaneOptions {
  host?: string;
  port?: number;
}

export class NuwaControlPlane {
  private server: Server | null = null;
  private host: string;
  private port: number;

  constructor(
    private readonly os: NuwaOS,
    options?: ControlPlaneOptions,
  ) {
    this.host = options?.host ?? '127.0.0.1';
    this.port = options?.port ?? 18080;
  }

  async start(): Promise<number> {
    if (this.server) {
      return this.port;
    }

    this.server = createServer((req, res) => {
      this.route(req, res);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(this.port, this.host, () => {
        const addr = this.server?.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
        }
        resolve();
      });
    });

    return this.port;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => {
      this.server?.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    this.server = null;
  }

  getAddress(): string {
    return `http://${this.host}:${this.port}`;
  }

  private route(req: IncomingMessage, res: ServerResponse): void {
    const method = req.method ?? 'GET';
    const rawUrl = req.url ?? '/';
    const url = new URL(rawUrl, `http://${this.host}:${this.port}`);

    if (method !== 'GET') {
      this.sendJson(res, 405, { error: 'method_not_allowed' });
      return;
    }

    if (url.pathname === '/health') {
      const status = this.os.status();
      const diagnostics = status.diagnostics as Record<string, unknown>;
      this.sendJson(res, 200, {
        status: diagnostics.health === 'healthy' ? 'ok' : 'degraded',
        health: diagnostics.health,
        timestamp: Date.now(),
      });
      return;
    }

    if (url.pathname === '/status') {
      this.sendJson(res, 200, this.os.status());
      return;
    }

    if (url.pathname === '/audit/events') {
      const limit = Number(url.searchParams.get('limit') ?? '20');
      const eventBus = this.os.getEventBus();
      this.sendJson(res, 200, {
        records: eventBus.auditTrail(Number.isNaN(limit) ? 20 : Math.max(limit, 0)),
      });
      return;
    }

    if (url.pathname === '/metrics') {
      const status = this.os.status();
      const eventBus = status.eventBus as Record<string, unknown>;
      const diagnostics = status.diagnostics as Record<string, unknown>;
      const signal = diagnostics.signal as Record<string, unknown>;
      const health = diagnostics.health === 'healthy' ? 1 : 0;

      const lines = [
        '# HELP nuwa_os_health Runtime health status (1=healthy, 0=stopped).',
        '# TYPE nuwa_os_health gauge',
        `nuwa_os_health ${health}`,
        '# HELP nuwa_os_events_published_total Total published events.',
        '# TYPE nuwa_os_events_published_total counter',
        `nuwa_os_events_published_total ${eventBus.publishedEvents ?? 0}`,
        '# HELP nuwa_os_events_delivered_total Total delivered events.',
        '# TYPE nuwa_os_events_delivered_total counter',
        `nuwa_os_events_delivered_total ${eventBus.deliveredEvents ?? 0}`,
        '# HELP nuwa_os_events_unmatched_total Total unmatched events.',
        '# TYPE nuwa_os_events_unmatched_total counter',
        `nuwa_os_events_unmatched_total ${eventBus.unmatchedEvents ?? 0}`,
        '# HELP nuwa_os_handler_errors_total Total event handler errors.',
        '# TYPE nuwa_os_handler_errors_total counter',
        `nuwa_os_handler_errors_total ${eventBus.handlerErrors ?? 0}`,
        '# HELP nuwa_os_frames_processed_total Total frames processed by vision agent.',
        '# TYPE nuwa_os_frames_processed_total counter',
        `nuwa_os_frames_processed_total ${signal.framesProcessed ?? 0}`,
      ];

      this.sendText(res, 200, lines.join('\n'));
      return;
    }

    this.sendJson(res, 404, { error: 'not_found' });
  }

  private sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  }

  private sendText(res: ServerResponse, statusCode: number, payload: string): void {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.end(payload);
  }
}
