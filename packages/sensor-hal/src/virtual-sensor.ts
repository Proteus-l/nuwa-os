import { ISensor, SensorReading, SensorState, SensorType } from './types.js';

export interface VirtualSensorOptions {
  id: string;
  name: string;
  type: SensorType;
  interval?: number;
}

export abstract class VirtualSensor<T> implements ISensor<T> {
  public readonly id: string;
  public readonly name: string;
  public readonly type: SensorType;
  public state: SensorState = SensorState.IDLE;

  private _intervalMs: number;
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _subscribers: Set<(reading: SensorReading<T>) => void> = new Set();

  constructor(options: VirtualSensorOptions) {
    this.id = options.id;
    this.name = options.name;
    this.type = options.type;
    this._intervalMs = options.interval ?? 1000;
  }

  abstract generateData(): T;

  private _createReading(): SensorReading<T> {
    return {
      sensorId: this.id,
      sensorType: this.type,
      timestamp: Date.now(),
      data: this.generateData(),
    };
  }

  async start(): Promise<void> {
    this.state = SensorState.ACTIVE;
    this._timer = setInterval(() => {
      const reading = this._createReading();
      for (const handler of this._subscribers) {
        handler(reading);
      }
    }, this._intervalMs);
  }

  async stop(): Promise<void> {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.state = SensorState.IDLE;
  }

  async read(): Promise<SensorReading<T>> {
    return this._createReading();
  }

  subscribe(callback: (reading: SensorReading<T>) => void): () => void {
    this._subscribers.add(callback);
    return () => {
      this._subscribers.delete(callback);
    };
  }
}
