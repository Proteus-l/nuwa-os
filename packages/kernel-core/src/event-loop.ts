import type { IProcess } from './types.js';
import type { Scheduler } from './scheduler.js';
import type { SystemClock } from './system-clock.js';

export interface EventLoopOptions {
  tickInterval?: number;
  clock?: SystemClock;
  onTick?: (tick: number) => void;
  onError?: (error: Error, process: IProcess) => void;
}

export class EventLoop {
  private scheduler: Scheduler;
  private _tick: number = 0;
  private _running: boolean = false;
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _tickInterval: number;
  private _clock: SystemClock | undefined;
  private _onTick: ((tick: number) => void) | undefined;
  private _onError: ((error: Error, process: IProcess) => void) | undefined;

  constructor(scheduler: Scheduler, options?: EventLoopOptions) {
    this.scheduler = scheduler;
    this._tickInterval = options?.tickInterval ?? 16;
    this._clock = options?.clock;
    this._onTick = options?.onTick;
    this._onError = options?.onError;
  }

  start(): void {
    if (this._running) {
      return;
    }
    this._running = true;

    this._timer = setInterval(() => {
      this._tick++;
      const processes = this.scheduler.getReadyProcesses();
      for (const process of processes) {
        try {
          const result = process.onTick(this._tick);
          result.catch((err: unknown) => {
            if (this._onError) {
              this._onError(
                err instanceof Error ? err : new Error(String(err)),
                process,
              );
            }
          });
        } catch (err: unknown) {
          if (this._onError) {
            this._onError(
              err instanceof Error ? err : new Error(String(err)),
              process,
            );
          }
        }
      }
      if (this._onTick) {
        this._onTick(this._tick);
      }
    }, this._tickInterval);
  }

  stop(): void {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._running = false;
  }

  get isRunning(): boolean {
    return this._running;
  }

  get tick(): number {
    return this._tick;
  }

  get tickInterval(): number {
    return this._tickInterval;
  }
}
