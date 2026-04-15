import { describe, it, expect } from 'vitest';
import { BaseProcess } from '../src/base-process.js';
import { ProcessState } from '../src/types.js';

class ConcreteProcess extends BaseProcess {
  public tickLog: number[] = [];

  async onTick(tick: number): Promise<void> {
    this.tickLog.push(tick);
  }
}

class CustomStartStopProcess extends BaseProcess {
  public started = false;
  public stopped = false;

  async onStart(): Promise<void> {
    await super.onStart();
    this.started = true;
  }

  async onStop(): Promise<void> {
    await super.onStop();
    this.stopped = true;
  }

  async onTick(_tick: number): Promise<void> {
    // no-op
  }
}

describe('BaseProcess', () => {
  it('should construct with id, name, and default priority', () => {
    const proc = new ConcreteProcess('p1', 'Process One');
    expect(proc.id).toBe('p1');
    expect(proc.name).toBe('Process One');
    expect(proc.priority).toBe(10);
  });

  it('should construct with a custom priority', () => {
    const proc = new ConcreteProcess('p2', 'Process Two', 5);
    expect(proc.priority).toBe(5);
  });

  it('should have initial state READY', () => {
    const proc = new ConcreteProcess('p1', 'Test');
    expect(proc.state).toBe(ProcessState.READY);
  });

  it('should transition to RUNNING on onStart', async () => {
    const proc = new ConcreteProcess('p1', 'Test');
    expect(proc.state).toBe(ProcessState.READY);
    await proc.onStart();
    expect(proc.state).toBe(ProcessState.RUNNING);
  });

  it('should transition to TERMINATED on onStop', async () => {
    const proc = new ConcreteProcess('p1', 'Test');
    await proc.onStart();
    await proc.onStop();
    expect(proc.state).toBe(ProcessState.TERMINATED);
  });

  it('should allow priority to be mutated', () => {
    const proc = new ConcreteProcess('p1', 'Test', 10);
    proc.priority = 1;
    expect(proc.priority).toBe(1);
  });

  it('subclass onTick should receive tick number', async () => {
    const proc = new ConcreteProcess('p1', 'Test');
    await proc.onTick(1);
    await proc.onTick(2);
    await proc.onTick(3);
    expect(proc.tickLog).toEqual([1, 2, 3]);
  });

  it('subclass can override onStart and onStop while preserving state transitions', async () => {
    const proc = new CustomStartStopProcess('p1', 'Custom');
    await proc.onStart();
    expect(proc.started).toBe(true);
    expect(proc.state).toBe(ProcessState.RUNNING);

    await proc.onStop();
    expect(proc.stopped).toBe(true);
    expect(proc.state).toBe(ProcessState.TERMINATED);
  });

  it('id and name should be readonly', () => {
    const proc = new ConcreteProcess('p1', 'Test');
    // TypeScript enforces readonly at compile time; at runtime we verify the values are set
    expect(proc.id).toBe('p1');
    expect(proc.name).toBe('Test');
  });

  it('should allow state to be set directly to BLOCKED', () => {
    const proc = new ConcreteProcess('p1', 'Test');
    proc.state = ProcessState.BLOCKED;
    expect(proc.state).toBe(ProcessState.BLOCKED);
  });
});
