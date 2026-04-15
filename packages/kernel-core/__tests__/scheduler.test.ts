import { describe, it, expect } from 'vitest';
import { Scheduler } from '../src/scheduler.js';
import { BaseProcess } from '../src/base-process.js';
import { ProcessState } from '../src/types.js';

class TestProcess extends BaseProcess {
  public ticks: number[] = [];

  async onTick(tick: number): Promise<void> {
    this.ticks.push(tick);
  }
}

describe('Scheduler', () => {
  it('should register a process', () => {
    const scheduler = new Scheduler();
    const proc = new TestProcess('p1', 'Process 1');

    scheduler.register(proc);
    expect(scheduler.getProcess('p1')).toBe(proc);
  });

  it('should unregister a process and return true', () => {
    const scheduler = new Scheduler();
    const proc = new TestProcess('p1', 'Process 1');

    scheduler.register(proc);
    expect(scheduler.unregister('p1')).toBe(true);
    expect(scheduler.getProcess('p1')).toBeUndefined();
  });

  it('should return false when unregistering a non-existent process', () => {
    const scheduler = new Scheduler();
    expect(scheduler.unregister('nonexistent')).toBe(false);
  });

  it('should return undefined for unknown process id', () => {
    const scheduler = new Scheduler();
    expect(scheduler.getProcess('unknown')).toBeUndefined();
  });

  it('should return all registered processes via getAllProcesses', () => {
    const scheduler = new Scheduler();
    const p1 = new TestProcess('p1', 'Process 1');
    const p2 = new TestProcess('p2', 'Process 2');
    const p3 = new TestProcess('p3', 'Process 3');

    scheduler.register(p1);
    scheduler.register(p2);
    scheduler.register(p3);

    const all = scheduler.getAllProcesses();
    expect(all).toHaveLength(3);
    expect(all).toContain(p1);
    expect(all).toContain(p2);
    expect(all).toContain(p3);
  });

  it('should return empty array when no processes registered', () => {
    const scheduler = new Scheduler();
    expect(scheduler.getAllProcesses()).toEqual([]);
    expect(scheduler.getReadyProcesses()).toEqual([]);
  });

  it('should overwrite a process with the same id on re-register', () => {
    const scheduler = new Scheduler();
    const p1 = new TestProcess('p1', 'Original');
    const p1b = new TestProcess('p1', 'Replacement');

    scheduler.register(p1);
    scheduler.register(p1b);

    expect(scheduler.getProcess('p1')).toBe(p1b);
    expect(scheduler.getAllProcesses()).toHaveLength(1);
  });

  it('getReadyProcesses should include READY processes', () => {
    const scheduler = new Scheduler();
    const proc = new TestProcess('p1', 'Process 1');
    // initial state is READY
    scheduler.register(proc);

    const ready = scheduler.getReadyProcesses();
    expect(ready).toHaveLength(1);
    expect(ready[0]).toBe(proc);
  });

  it('getReadyProcesses should include RUNNING processes', async () => {
    const scheduler = new Scheduler();
    const proc = new TestProcess('p1', 'Process 1');
    scheduler.register(proc);

    await proc.onStart(); // transitions to RUNNING
    expect(proc.state).toBe(ProcessState.RUNNING);

    const ready = scheduler.getReadyProcesses();
    expect(ready).toHaveLength(1);
    expect(ready[0]).toBe(proc);
  });

  it('getReadyProcesses should exclude BLOCKED and TERMINATED processes', async () => {
    const scheduler = new Scheduler();
    const running = new TestProcess('r1', 'Running');
    const blocked = new TestProcess('b1', 'Blocked');
    const terminated = new TestProcess('t1', 'Terminated');
    const ready = new TestProcess('rd1', 'Ready');

    scheduler.register(running);
    scheduler.register(blocked);
    scheduler.register(terminated);
    scheduler.register(ready);

    await running.onStart();
    blocked.state = ProcessState.BLOCKED;
    await terminated.onStop();

    const result = scheduler.getReadyProcesses();
    expect(result).toHaveLength(2);
    const ids = result.map((p) => p.id);
    expect(ids).toContain('r1');
    expect(ids).toContain('rd1');
    expect(ids).not.toContain('b1');
    expect(ids).not.toContain('t1');
  });

  it('getReadyProcesses should return processes sorted by priority ascending (lower number = higher priority)', async () => {
    const scheduler = new Scheduler();
    const low = new TestProcess('low', 'Low Priority', 20);
    const mid = new TestProcess('mid', 'Mid Priority', 10);
    const high = new TestProcess('high', 'High Priority', 1);

    scheduler.register(low);
    scheduler.register(mid);
    scheduler.register(high);

    await low.onStart();
    await mid.onStart();
    await high.onStart();

    const result = scheduler.getReadyProcesses();
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('high');
    expect(result[1].id).toBe('mid');
    expect(result[2].id).toBe('low');
  });

  it('getReadyProcesses should handle processes with equal priority', async () => {
    const scheduler = new Scheduler();
    const p1 = new TestProcess('p1', 'Process 1', 5);
    const p2 = new TestProcess('p2', 'Process 2', 5);

    scheduler.register(p1);
    scheduler.register(p2);

    await p1.onStart();
    await p2.onStart();

    const result = scheduler.getReadyProcesses();
    expect(result).toHaveLength(2);
    // Both have priority 5, so both should be present
    const ids = result.map((p) => p.id);
    expect(ids).toContain('p1');
    expect(ids).toContain('p2');
  });

  it('getAllProcesses should reflect unregistrations', () => {
    const scheduler = new Scheduler();
    const p1 = new TestProcess('p1', 'Process 1');
    const p2 = new TestProcess('p2', 'Process 2');

    scheduler.register(p1);
    scheduler.register(p2);
    scheduler.unregister('p1');

    expect(scheduler.getAllProcesses()).toHaveLength(1);
    expect(scheduler.getAllProcesses()[0]).toBe(p2);
  });
});
