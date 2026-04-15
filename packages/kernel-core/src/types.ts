export enum ProcessState {
  READY = 'ready',
  RUNNING = 'running',
  BLOCKED = 'blocked',
  TERMINATED = 'terminated',
}

export interface IProcess {
  readonly id: string;
  readonly name: string;
  priority: number; // lower number = higher priority
  state: ProcessState;
  onStart(): Promise<void>;
  onStop(): Promise<void>;
  onTick(tick: number): Promise<void>;
}
