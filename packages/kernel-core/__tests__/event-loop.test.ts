import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventLoop } from '../src/event-loop.js';
import { Scheduler } from '../src/scheduler.js';
import { BaseProcess } from '../src/base-process.js';
import { ProcessState } from '../src/types.js';

class TestProcess extends BaseProcess {
  public ticks: number[] = [];

  async onTick(tick: number): Promise<void> {
    this.ticks.push(tick);
  }
}

class ErrorProcess extends BaseProcess {
  async onTick(_tick: number): Promise<void> {
    throw new Error('process error');
  }
}

describe('EventLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not be running initially', () => {
    const scheduler = new Scheduler();
    const loop = new EventLoop(scheduler);

    expect(loop.isRunning).toBe(false);
  });

  it('should start and report isRunning as true', () => {
    const scheduler = new Scheduler();
    const loop = new EventLoop(scheduler);

    loop.start();
    expect(loop.isRunning).toBe(true);
  });

  it('should stop and report isRunning as false', () => {
    const scheduler = new Scheduler();
    const loop = new EventLoop(scheduler);

    loop.start();
    loop.stop();
    expect(loop.isRunning).toBe(false);
  });

  it('should have tick 0 before starting', () => {
    const scheduler = new Scheduler();
    const loop = new EventLoop(scheduler);

    expect(loop.tick).toBe(0);
  });

  it('should increment tick on each interval', () => {
    const scheduler = new Scheduler();
    const loop = new EventLoop(scheduler, { tickInterval: 16 });

    loop.start();

    vi.advanceTimersByTime(16);
    expect(loop.tick).toBe(1);

    vi.advanceTimersByTime(16);
    expect(loop.tick).toBe(2);

    vi.advanceTimersByTime(48);
    expect(loop.tick).toBe(5);

    loop.stop();
  });

  it('should default to 16ms tick interval', () => {
    const scheduler = new Scheduler();
    const loop = new EventLoop(scheduler);

    expect(loop.tickInterval).toBe(16);

    loop.start();

    vi.advanceTimersByTime(15);
    expect(loop.tick).toBe(0);

    vi.advanceTimersByTime(1);
    expect(loop.tick).toBe(1);

    loop.stop();
  });

  it('should call onTick on ready processes', async () => {
    const scheduler = new Scheduler();
    const proc = new TestProcess('p1', 'Test', 10);
    scheduler.register(proc);
    await proc.onStart();

    const loop = new EventLoop(scheduler, { tickInterval: 10 });
    loop.start();

    vi.advanceTimersByTime(10);
    // Give the async onTick promise a chance to resolve
    await vi.advanceTimersByTimeAsync(0);
    expect(proc.ticks).toContain(1);

    vi.advanceTimersByTime(10);
    await vi.advanceTimersByTimeAsync(0);
    expect(proc.ticks).toContain(2);

    loop.stop();
  });

  it('should call processes in priority order (lower number first)', async () => {
    const scheduler = new Scheduler();
    const order: string[] = [];

    class OrderProcess extends BaseProcess {
      async onTick(_tick: number): Promise<void> {
        order.push(this.name);
      }
    }

    const low = new OrderProcess('low', 'Low', 20);
    const mid = new OrderProcess('mid', 'Mid', 10);
    const high = new OrderProcess('high', 'High', 1);

    scheduler.register(low);
    scheduler.register(mid);
    scheduler.register(high);

    await low.onStart();
    await mid.onStart();
    await high.onStart();

    const loop = new EventLoop(scheduler, { tickInterval: 10 });
    loop.start();

    vi.advanceTimersByTime(10);
    await vi.advanceTimersByTimeAsync(0);

    expect(order).toEqual(['High', 'Mid', 'Low']);

    loop.stop();
  });

  it('should not call onTick on BLOCKED or TERMINATED processes', async () => {
    const scheduler = new Scheduler();
    const running = new TestProcess('r1', 'Running', 10);
    const blocked = new TestProcess('b1', 'Blocked', 10);
    const terminated = new TestProcess('t1', 'Terminated', 10);

    scheduler.register(running);
    scheduler.register(blocked);
    scheduler.register(terminated);

    await running.onStart();
    blocked.state = ProcessState.BLOCKED;
    terminated.state = ProcessState.TERMINATED;

    const loop = new EventLoop(scheduler, { tickInterval: 10 });
    loop.start();

    vi.advanceTimersByTime(10);
    await vi.advanceTimersByTimeAsync(0);

    expect(running.ticks).toEqual([1]);
    expect(blocked.ticks).toEqual([]);
    expect(terminated.ticks).toEqual([]);

    loop.stop();
  });

  it('error in one process should not stop others', async () => {
    const scheduler = new Scheduler();
    const good = new TestProcess('good', 'Good', 20);
    const bad = new ErrorProcess('bad', 'Bad', 1);

    scheduler.register(good);
    scheduler.register(bad);

    await good.onStart();
    await bad.onStart();

    const errors: Error[] = [];
    const loop = new EventLoop(scheduler, {
      tickInterval: 10,
      onError: (err) => {
        errors.push(err);
      },
    });
    loop.start();

    vi.advanceTimersByTime(10);
    await vi.advanceTimersByTimeAsync(0);

    // good process should still have received its tick
    expect(good.ticks).toEqual([1]);
    // error should have been caught
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]!.message).toBe('process error');

    loop.stop();
  });

  it('should invoke onTick callback each interval', () => {
    const scheduler = new Scheduler();
    const tickLog: number[] = [];

    const loop = new EventLoop(scheduler, {
      tickInterval: 10,
      onTick: (tick) => {
        tickLog.push(tick);
      },
    });
    loop.start();

    vi.advanceTimersByTime(30);
    expect(tickLog).toEqual([1, 2, 3]);

    loop.stop();
  });

  it('should invoke onError callback when a process throws', async () => {
    const scheduler = new Scheduler();
    const bad = new ErrorProcess('bad', 'Bad', 10);
    scheduler.register(bad);
    await bad.onStart();

    const capturedErrors: { error: Error; processId: string }[] = [];
    const loop = new EventLoop(scheduler, {
      tickInterval: 10,
      onError: (error, process) => {
        capturedErrors.push({ error, processId: process.id });
      },
    });
    loop.start();

    vi.advanceTimersByTime(10);
    await vi.advanceTimersByTimeAsync(0);

    expect(capturedErrors).toHaveLength(1);
    expect(capturedErrors[0]!.error.message).toBe('process error');
    expect(capturedErrors[0]!.processId).toBe('bad');

    loop.stop();
  });

  it('should stop incrementing ticks after stop', () => {
    const scheduler = new Scheduler();
    const loop = new EventLoop(scheduler, { tickInterval: 10 });

    loop.start();
    vi.advanceTimersByTime(30);
    expect(loop.tick).toBe(3);

    loop.stop();
    vi.advanceTimersByTime(50);
    expect(loop.tick).toBe(3);
  });

  it('start should be idempotent', () => {
    const scheduler = new Scheduler();
    const loop = new EventLoop(scheduler, { tickInterval: 10 });

    loop.start();
    loop.start(); // second call should be a no-op

    vi.advanceTimersByTime(10);
    expect(loop.tick).toBe(1); // not 2

    loop.stop();
  });

  it('stop should be safe to call when not running', () => {
    const scheduler = new Scheduler();
    const loop = new EventLoop(scheduler);

    // Should not throw
    loop.stop();
    expect(loop.isRunning).toBe(false);
  });

  it('should handle custom tickInterval', () => {
    const scheduler = new Scheduler();
    const loop = new EventLoop(scheduler, { tickInterval: 100 });

    expect(loop.tickInterval).toBe(100);

    loop.start();

    vi.advanceTimersByTime(99);
    expect(loop.tick).toBe(0);

    vi.advanceTimersByTime(1);
    expect(loop.tick).toBe(1);

    loop.stop();
  });

  it('should process READY state processes (not yet started)', () => {
    const scheduler = new Scheduler();
    const proc = new TestProcess('p1', 'Ready Process', 10);
    // Process is in READY state by default, not RUNNING
    scheduler.register(proc);

    const loop = new EventLoop(scheduler, { tickInterval: 10 });
    loop.start();

    vi.advanceTimersByTime(10);
    // READY processes should also be ticked (per getReadyProcesses spec)
    expect(proc.ticks).toEqual([1]);

    loop.stop();
  });
});
