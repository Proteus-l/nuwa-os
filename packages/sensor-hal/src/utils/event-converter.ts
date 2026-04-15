import { NuwaEvent, SensorReading } from '../types.js';

export function toNuwaEvent(reading: SensorReading): NuwaEvent {
  return {
    id: crypto.randomUUID(),
    type: 'sensor',
    topic: `sensor.${reading.sensorType}.reading`,
    timestamp: reading.timestamp,
    source: reading.sensorId,
    data: reading.data,
    metadata: { sensorType: reading.sensorType, ...reading.metadata },
  };
}
