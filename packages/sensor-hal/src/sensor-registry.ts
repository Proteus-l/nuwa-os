import { ISensor, SensorType } from './types.js';

export class SensorRegistry {
  private sensors: Map<string, ISensor> = new Map();
  private onRegisteredCallbacks: Set<(sensor: ISensor) => void> = new Set();
  private onUnregisteredCallbacks: Set<(sensorId: string) => void> = new Set();

  register(sensor: ISensor): void {
    if (this.sensors.has(sensor.id)) {
      throw new Error(`Sensor with id '${sensor.id}' is already registered`);
    }
    this.sensors.set(sensor.id, sensor);
    for (const cb of this.onRegisteredCallbacks) {
      cb(sensor);
    }
  }

  unregister(sensorId: string): boolean {
    const existed = this.sensors.delete(sensorId);
    if (existed) {
      for (const cb of this.onUnregisteredCallbacks) {
        cb(sensorId);
      }
    }
    return existed;
  }

  getSensor(id: string): ISensor | undefined {
    return this.sensors.get(id);
  }

  getAllSensors(): ISensor[] {
    return Array.from(this.sensors.values());
  }

  getSensorsByType(type: SensorType): ISensor[] {
    return Array.from(this.sensors.values()).filter(
      (sensor) => sensor.type === type,
    );
  }

  onRegistered(callback: (sensor: ISensor) => void): () => void {
    this.onRegisteredCallbacks.add(callback);
    return () => {
      this.onRegisteredCallbacks.delete(callback);
    };
  }

  onUnregistered(callback: (sensorId: string) => void): () => void {
    this.onUnregisteredCallbacks.add(callback);
    return () => {
      this.onUnregisteredCallbacks.delete(callback);
    };
  }
}
