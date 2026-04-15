import { describe, it, expect } from 'vitest';
import { toNuwaEvent } from '../src/utils/event-converter';
import { SensorType, SensorReading } from '../src/types';

describe('toNuwaEvent', () => {
  it('should convert a reading to a NuwaEvent with correct fields', () => {
    const reading: SensorReading = {
      sensorId: 'cam-1',
      sensorType: SensorType.CAMERA,
      timestamp: 1700000000000,
      data: { frameId: 1 },
    };

    const event = toNuwaEvent(reading);

    expect(event.type).toBe('sensor');
    expect(event.source).toBe('cam-1');
    expect(event.timestamp).toBe(1700000000000);
    expect(event.data).toEqual({ frameId: 1 });
  });

  it('should generate a valid UUID for the event id', () => {
    const reading: SensorReading = {
      sensorId: 's1',
      sensorType: SensorType.GENERIC,
      timestamp: Date.now(),
      data: null,
    };

    const event = toNuwaEvent(reading);
    expect(event.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('should set topic to sensor.<sensorType>.reading', () => {
    const reading: SensorReading = {
      sensorId: 'therm-1',
      sensorType: SensorType.TEMPERATURE,
      timestamp: Date.now(),
      data: { celsius: 22.5 },
    };

    const event = toNuwaEvent(reading);
    expect(event.topic).toBe('sensor.temperature.reading');
  });

  it('should include sensorType in metadata', () => {
    const reading: SensorReading = {
      sensorId: 'mic-1',
      sensorType: SensorType.AUDIO,
      timestamp: Date.now(),
      data: { amplitude: 0.5 },
    };

    const event = toNuwaEvent(reading);
    expect(event.metadata).toBeDefined();
    expect(event.metadata!.sensorType).toBe(SensorType.AUDIO);
  });

  it('should merge reading metadata with sensorType', () => {
    const reading: SensorReading = {
      sensorId: 'motion-1',
      sensorType: SensorType.MOTION,
      timestamp: Date.now(),
      data: { detected: true },
      metadata: { zone: 'entrance', confidence: 0.95 },
    };

    const event = toNuwaEvent(reading);
    expect(event.metadata).toEqual({
      sensorType: SensorType.MOTION,
      zone: 'entrance',
      confidence: 0.95,
    });
  });

  it('should generate unique ids for different readings', () => {
    const reading1: SensorReading = {
      sensorId: 's1',
      sensorType: SensorType.GENERIC,
      timestamp: Date.now(),
      data: null,
    };
    const reading2: SensorReading = {
      sensorId: 's2',
      sensorType: SensorType.GENERIC,
      timestamp: Date.now(),
      data: null,
    };

    const event1 = toNuwaEvent(reading1);
    const event2 = toNuwaEvent(reading2);
    expect(event1.id).not.toBe(event2.id);
  });

  it('should handle reading with no metadata', () => {
    const reading: SensorReading = {
      sensorId: 's1',
      sensorType: SensorType.CAMERA,
      timestamp: Date.now(),
      data: 'test',
    };

    const event = toNuwaEvent(reading);
    expect(event.metadata).toEqual({ sensorType: SensorType.CAMERA });
  });
});
