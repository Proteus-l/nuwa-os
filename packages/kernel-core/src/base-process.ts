import { ProcessState } from './types.js';
import type { IProcess } from './types.js';

export abstract class BaseProcess implements IProcess {
  readonly id: string;
  readonly name: string;
  priority: number;
  state: ProcessState = ProcessState.READY;

  constructor(id: string, name: string, priority: number = 10) {
    this.id = id;
    this.name = name;
    this.priority = priority;
  }

  async onStart(): Promise<void> {
    this.state = ProcessState.RUNNING;
  }

  async onStop(): Promise<void> {
    this.state = ProcessState.TERMINATED;
  }

  abstract onTick(tick: number): Promise<void>;
}
