import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NuwaOS } from '../src/nuwa-os';
import { AgentState } from '../src/types';

describe('NuwaOS', () => {
  let os: NuwaOS;

  beforeEach(() => {
    vi.useFakeTimers();
    os = new NuwaOS();
  });

  afterEach(async () => {
    try {
      await os.shutdown();
    } catch {
      // already shut down
    }
    vi.useRealTimers();
  });

  it('should report not booted before boot()', () => {
    const status = os.status();
    expect(status.booted).toBe(false);
  });

  it('should boot and initialize all layers', async () => {
    await os.boot();

    const status = os.status();
    expect(status.booted).toBe(true);
    expect((status.kernel as Record<string, unknown>).running).toBe(true);
    expect((status.gateway as Record<string, unknown>).running).toBe(true);
  });

  it('should register one sensor after boot', async () => {
    await os.boot();

    const status = os.status();
    const sensors = status.sensors as Record<string, unknown>;
    expect(sensors.total).toBe(1);
    expect(sensors.camera).toBe('active');
  });

  it('should register one device after boot', async () => {
    await os.boot();

    const status = os.status();
    const gateway = status.gateway as Record<string, unknown>;
    expect(gateway.devices).toBe(1);
  });

  it('should have VisionAgent in RUNNING state after boot', async () => {
    await os.boot();

    const agent = os.getVisionAgent();
    expect(agent.state).toBe(AgentState.RUNNING);
  });

  it('should provide access to the event bus', async () => {
    await os.boot();

    const bus = os.getEventBus();
    expect(bus).toBeDefined();
    expect(typeof bus.publish).toBe('function');
    expect(typeof bus.subscribe).toBe('function');
  });

  it('should shutdown cleanly and report not booted', async () => {
    await os.boot();
    await os.shutdown();

    const status = os.status();
    expect(status.booted).toBe(false);
    expect((status.kernel as Record<string, unknown>).running).toBe(false);
    expect((status.gateway as Record<string, unknown>).running).toBe(false);
  });

  it('should stop camera on shutdown', async () => {
    await os.boot();

    const statusBefore = os.status();
    expect((statusBefore.sensors as Record<string, unknown>).camera).toBe('active');

    await os.shutdown();

    const statusAfter = os.status();
    expect((statusAfter.sensors as Record<string, unknown>).camera).toBe('inactive');
  });

  it('should accumulate events in event bus history after boot and ticks', async () => {
    await os.boot();

    // Advance timers in small steps to let camera and kernel fire
    vi.advanceTimersByTime(500);
    // Flush microtasks
    await new Promise<void>((r) => { r(); });

    const status = os.status();
    const eventBusStatus = status.eventBus as Record<string, unknown>;
    expect(typeof eventBusStatus.historySize).toBe('number');
    expect(eventBusStatus.historySize as number).toBeGreaterThan(0);
  });

  it('should set VisionAgent to IDLE after shutdown', async () => {
    await os.boot();
    await os.shutdown();

    const agent = os.getVisionAgent();
    expect(agent.state).toBe(AgentState.IDLE);
  });
});
