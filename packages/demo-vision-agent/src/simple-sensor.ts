import { SensorType, SensorState } from './types';

export class SimpleSensorRegistry {
  private sensors = new Map<
    string,
    { id: string; name: string; type: SensorType; state: SensorState }
  >();

  register(sensor: {
    id: string;
    name: string;
    type: SensorType;
    state: SensorState;
  }): void {
    this.sensors.set(sensor.id, sensor);
  }

  getSensor(
    id: string,
  ): { id: string; name: string; type: SensorType; state: SensorState } | undefined {
    return this.sensors.get(id);
  }

  getAllSensors(): { id: string; name: string; type: SensorType; state: SensorState }[] {
    return Array.from(this.sensors.values());
  }
}

export class SimpleVirtualCamera {
  readonly id: string;
  readonly name = 'Virtual Camera';
  readonly type = SensorType.CAMERA;
  state = SensorState.INACTIVE;
  private frameCount = 0;
  private handlers = new Set<(data: Record<string, unknown>) => void>();
  private _timer: ReturnType<typeof setInterval> | null = null;

  constructor(id: string = 'cam-1') {
    this.id = id;
  }

  start(interval = 500): void {
    this.state = SensorState.ACTIVE;
    this._timer = setInterval(() => {
      const reading: Record<string, unknown> = {
        frameId: ++this.frameCount,
        width: 640,
        height: 480,
        format: 'RGB',
        timestamp: Date.now(),
      };
      this.handlers.forEach((h) => h(reading));
    }, interval);
  }

  stop(): void {
    this.state = SensorState.INACTIVE;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  onReading(handler: (data: Record<string, unknown>) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  get totalFrames(): number {
    return this.frameCount;
  }
}
