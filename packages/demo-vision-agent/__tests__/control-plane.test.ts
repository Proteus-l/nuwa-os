import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { request } from 'node:http';
import { NuwaOS } from '../src/nuwa-os';
import { NuwaControlPlane } from '../src/control-plane';

function httpGet(url: string): Promise<{ statusCode: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk.toString();
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          body,
          headers: res.headers,
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('NuwaControlPlane', () => {
  let os: NuwaOS;
  let controlPlane: NuwaControlPlane;

  beforeEach(async () => {
    os = new NuwaOS();
    await os.boot();
    controlPlane = new NuwaControlPlane(os, { port: 0 });
    await controlPlane.start();
  });

  afterEach(async () => {
    await controlPlane.stop();
    await os.shutdown();
  });

  it('should expose /health endpoint', async () => {
    const response = await httpGet(`${controlPlane.getAddress()}/health`);
    const payload = JSON.parse(response.body) as Record<string, unknown>;

    expect(response.statusCode).toBe(200);
    expect(payload.status).toBe('ok');
    expect(payload.health).toBe('healthy');
  });

  it('should expose /status endpoint with diagnostics', async () => {
    const response = await httpGet(`${controlPlane.getAddress()}/status`);
    const payload = JSON.parse(response.body) as Record<string, unknown>;

    expect(response.statusCode).toBe(200);
    expect(payload.booted).toBe(true);
    expect(payload.diagnostics).toBeDefined();
  });

  it('should expose /metrics endpoint in prometheus format', async () => {
    const response = await httpGet(`${controlPlane.getAddress()}/metrics`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('nuwa_os_events_published_total');
    expect(response.body).toContain('nuwa_os_handler_errors_total');
  });

  it('should expose /audit/events endpoint', async () => {
    os.getEventBus().publish({
      id: os.getEventBus().generateEventId(),
      type: 'test',
      topic: 'test.audit.event',
      timestamp: Date.now(),
      source: 'control-plane-test',
      data: { ok: true },
    });

    const response = await httpGet(`${controlPlane.getAddress()}/audit/events?limit=5`);
    const payload = JSON.parse(response.body) as { records: Array<Record<string, unknown>> };

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(payload.records)).toBe(true);
    expect(payload.records.length).toBeGreaterThan(0);
  });
});
