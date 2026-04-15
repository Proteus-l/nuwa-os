import { IProcess, ProcessState } from './types';

export class SimpleKernel {
  private processes: IProcess[] = [];
  private _tick = 0;
  private _running = false;
  private _timer: ReturnType<typeof setInterval> | null = null;
  private tickInterval: number;

  constructor(tickInterval: number = 100) {
    this.tickInterval = tickInterval;
  }

  registerProcess(process: IProcess): void {
    this.processes.push(process);
  }

  start(): void {
    this._running = true;
    this.processes.forEach((p) => {
      p.state = ProcessState.RUNNING;
      p.onStart();
    });
    this._timer = setInterval(() => this.executeTick(), this.tickInterval);
  }

  stop(): void {
    this._running = false;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.processes.forEach((p) => p.onStop());
  }

  private async executeTick(): Promise<void> {
    this._tick++;
    const sorted = [...this.processes]
      .filter((p) => p.state === ProcessState.RUNNING)
      .sort((a, b) => a.priority - b.priority);
    for (const p of sorted) {
      try {
        await p.onTick(this._tick);
      } catch {
        // swallow tick errors
      }
    }
  }

  get isRunning(): boolean {
    return this._running;
  }

  get tick(): number {
    return this._tick;
  }
}
