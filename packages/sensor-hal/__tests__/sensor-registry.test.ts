import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SensorRegistry } from '../src/sensor-registry';
import { SensorType, SensorState, ISensor } from '../src/types';

function createMockSensor(
  id: string,
  type: SensorType = SensorType.GENERIC,
): ISensor {
  return {
    id,
    name: `Mock ${id}`,
    type,
    state: SensorState.IDLE,
    start: async () => {},
    stop: async () => {},
    read: async () => ({
      sensorId: id,
      sensorType: type,
      timestamp: Date.now(),
      data: null,
    }),
    subscribe: () => () => {},
  };
}

describe('SensorRegistry', () => {
  let registry: SensorRegistry;

  beforeEach(() => {
    registry = new SensorRegistry();
  });

  it('should register a sensor', () => {
    const sensor = createMockSensor('s1');
    registry.register(sensor);
    expect(registry.getSensor('s1')).toBe(sensor);
  });

  it('should throw when registering a duplicate sensor ID', () => {
    const sensor1 = createMockSensor('s1');
    const sensor2 = createMockSensor('s1');
    registry.register(sensor1);
    expect(() => registry.register(sensor2)).toThrowError(
      "Sensor with id 's1' is already registered",
    );
  });

  it('should unregister a sensor and return true', () => {
    const sensor = createMockSensor('s1');
    registry.register(sensor);
    expect(registry.unregister('s1')).toBe(true);
    expect(registry.getSensor('s1')).toBeUndefined();
  });

  it('should return false when unregistering a non-existent sensor', () => {
    expect(registry.unregister('nonexistent')).toBe(false);
  });

  it('should return undefined for a non-existent sensor ID', () => {
    expect(registry.getSensor('unknown')).toBeUndefined();
  });

  it('should return all registered sensors', () => {
    const s1 = createMockSensor('s1');
    const s2 = createMockSensor('s2');
    registry.register(s1);
    registry.register(s2);
    const all = registry.getAllSensors();
    expect(all).toHaveLength(2);
    expect(all).toContain(s1);
    expect(all).toContain(s2);
  });

  it('should return sensors filtered by type', () => {
    const cam1 = createMockSensor('cam-1', SensorType.CAMERA);
    const cam2 = createMockSensor('cam-2', SensorType.CAMERA);
    const thermo = createMockSensor('thermo-1', SensorType.TEMPERATURE);
    registry.register(cam1);
    registry.register(cam2);
    registry.register(thermo);

    const cameras = registry.getSensorsByType(SensorType.CAMERA);
    expect(cameras).toHaveLength(2);
    expect(cameras).toContain(cam1);
    expect(cameras).toContain(cam2);
  });

  it('should call onRegistered callbacks when a sensor is registered', () => {
    const handler = vi.fn();
    registry.onRegistered(handler);
    const sensor = createMockSensor('s1');
    registry.register(sensor);
    expect(handler).toHaveBeenCalledWith(sensor);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should call onUnregistered callbacks when a sensor is unregistered', () => {
    const handler = vi.fn();
    registry.onUnregistered(handler);
    const sensor = createMockSensor('s1');
    registry.register(sensor);
    registry.unregister('s1');
    expect(handler).toHaveBeenCalledWith('s1');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not call onUnregistered when sensor does not exist', () => {
    const handler = vi.fn();
    registry.onUnregistered(handler);
    registry.unregister('nonexistent');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should unsubscribe from onRegistered callback', () => {
    const handler = vi.fn();
    const unsub = registry.onRegistered(handler);
    unsub();
    registry.register(createMockSensor('s1'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('should allow re-registering after unregister', () => {
    const sensor = createMockSensor('s1');
    registry.register(sensor);
    registry.unregister('s1');
    const sensor2 = createMockSensor('s1');
    registry.register(sensor2);
    expect(registry.getSensor('s1')).toBe(sensor2);
  });

  it('should return an empty array when no sensors match the type', () => {
    const sensor = createMockSensor('s1', SensorType.GENERIC);
    registry.register(sensor);
    expect(registry.getSensorsByType(SensorType.AUDIO)).toEqual([]);
  });
});
