import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NuwaOS } from '../src/nuwa-os';
import { NuwaEvent, AgentState } from '../src/types';

/**
 * Helper to advance fake timers and flush microtasks/promises.
 * We advance in small steps to avoid infinite-loop detection that occurs
 * when vi.runAllTimersAsync() encounters repeating intervals.
 * Multiple microtask flushes ensure async handler chains complete.
 */
async function advanceAndFlush(ms: number): Promise<void> {
  const step = 100;
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    vi.advanceTimersByTime(step);
    // Flush microtasks multiple times to let async handler chains complete
    await new Promise<void>((r) => { r(); });
    await new Promise<void>((r) => { r(); });
  }
}

describe('Integration: Full NuwaOS lifecycle', () => {
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

  it('should complete a full boot -> run -> shutdown cycle', async () => {
    await os.boot();
    expect(os.status().booted).toBe(true);

    await advanceAndFlush(1000);

    await os.shutdown();
    expect(os.status().booted).toBe(false);
  });

  it('should have VisionAgent receive camera frames after running', async () => {
    await os.boot();

    // Advance time so camera fires frames (200ms interval) and kernel ticks (100ms)
    await advanceAndFlush(2000);

    const stats = os.getVisionAgent().getStats();
    expect(stats.framesProcessed).toBeGreaterThan(0);
  });

  it('should have VisionAgent produce actions after receiving frames', async () => {
    await os.boot();

    await advanceAndFlush(2000);

    const stats = os.getVisionAgent().getStats();
    expect(stats.actionsProduced).toBeGreaterThan(0);
  });

  it('should record events in the event bus during operation', async () => {
    await os.boot();

    await advanceAndFlush(1000);

    const history = os.getEventBus().history();
    expect(history.length).toBeGreaterThan(0);

    // Should contain sensor events
    const sensorEvents = history.filter((e: NuwaEvent) => e.type === 'sensor');
    expect(sensorEvents.length).toBeGreaterThan(0);
  });

  it('should have camera frame events with correct topic pattern', async () => {
    await os.boot();

    await advanceAndFlush(500);

    const history = os.getEventBus().history();
    const cameraFrames = history.filter((e: NuwaEvent) => e.topic === 'sensor.camera.frame');
    expect(cameraFrames.length).toBeGreaterThan(0);
  });

  it('should have agent action events after processing frames', async () => {
    await os.boot();

    await advanceAndFlush(2000);

    const history = os.getEventBus().history();
    const agentEvents = history.filter((e: NuwaEvent) =>
      e.topic.startsWith('agent.'),
    );
    expect(agentEvents.length).toBeGreaterThan(0);
  });

  it('should stop producing events after shutdown', async () => {
    await os.boot();

    await advanceAndFlush(1000);

    await os.shutdown();

    const historyAfterShutdown = os.getEventBus().history().length;

    await advanceAndFlush(1000);

    const historyLater = os.getEventBus().history().length;
    expect(historyLater).toBe(historyAfterShutdown);
  });

  it('should correctly report agent state transitions through the lifecycle', async () => {
    const agent = os.getVisionAgent();
    expect(agent.state).toBe(AgentState.IDLE);

    await os.boot();
    expect(agent.state).toBe(AgentState.RUNNING);

    await os.shutdown();
    expect(agent.state).toBe(AgentState.IDLE);
  });
});
