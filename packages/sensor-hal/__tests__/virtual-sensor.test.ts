import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VirtualSensor } from '../src/virtual-sensor';
import { SensorType, SensorState, SensorReading } from '../src/types';

class TestSensor extends VirtualSensor<number> {
  private counter = 0;

  constructor(id = 'test-1', name = 'Test Sensor', interval?: number) {
    super({ id, name, type: SensorType.GENERIC, interval });
  }

  generateData(): number {
    return ++this.counter;
  }
}

describe('VirtualSensor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with IDLE state', () => {
    const sensor = new TestSensor();
    expect(sensor.state).toBe(SensorState.IDLE);
  });

  it('should have correct id, name, and type', () => {
    const sensor = new TestSensor('custom-id', 'Custom Sensor');
    expect(sensor.id).toBe('custom-id');
    expect(sensor.name).toBe('Custom Sensor');
    expect(sensor.type).toBe(SensorType.GENERIC);
  });

  it('should transition to ACTIVE state on start', async () => {
    const sensor = new TestSensor();
    await sensor.start();
    expect(sensor.state).toBe(SensorState.ACTIVE);
    await sensor.stop();
  });

  it('should transition to IDLE state on stop', async () => {
    const sensor = new TestSensor();
    await sensor.start();
    await sensor.stop();
    expect(sensor.state).toBe(SensorState.IDLE);
  });

  it('should notify subscribers at the default interval (1000ms)', async () => {
    const sensor = new TestSensor();
    const handler = vi.fn();
    sensor.subscribe(handler);

    await sensor.start();

    vi.advanceTimersByTime(999);
    expect(handler).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(1);
    expect(handler).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(handler).toHaveBeenCalledTimes(2);

    await sensor.stop();
  });

  it('should notify subscribers at a custom interval', async () => {
    const sensor = new TestSensor('test-1', 'Test Sensor', 500);
    const handler = vi.fn();
    sensor.subscribe(handler);

    await sensor.start();

    vi.advanceTimersByTime(500);
    expect(handler).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(500);
    expect(handler).toHaveBeenCalledTimes(2);

    await sensor.stop();
  });

  it('should stop notifying subscribers after stop is called', async () => {
    const sensor = new TestSensor();
    const handler = vi.fn();
    sensor.subscribe(handler);

    await sensor.start();
    vi.advanceTimersByTime(1000);
    expect(handler).toHaveBeenCalledTimes(1);

    await sensor.stop();
    vi.advanceTimersByTime(2000);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should return a valid SensorReading from read()', async () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const sensor = new TestSensor();
    const reading = await sensor.read();

    expect(reading.sensorId).toBe('test-1');
    expect(reading.sensorType).toBe(SensorType.GENERIC);
    expect(typeof reading.data).toBe('number');
    expect(reading.timestamp).toBe(Date.now());
  });

  it('should unsubscribe a handler when unsubscribe function is called', async () => {
    const sensor = new TestSensor();
    const handler = vi.fn();
    const unsubscribe = sensor.subscribe(handler);

    await sensor.start();
    vi.advanceTimersByTime(1000);
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    vi.advanceTimersByTime(1000);
    expect(handler).toHaveBeenCalledTimes(1);

    await sensor.stop();
  });

  it('should support multiple subscribers', async () => {
    const sensor = new TestSensor();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    sensor.subscribe(handler1);
    sensor.subscribe(handler2);

    await sensor.start();
    vi.advanceTimersByTime(1000);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    await sensor.stop();
  });

  it('should pass correct reading structure to subscribers', async () => {
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));
    const sensor = new TestSensor();
    const handler = vi.fn();
    sensor.subscribe(handler);

    await sensor.start();
    vi.advanceTimersByTime(1000);

    const reading: SensorReading<number> = handler.mock.calls[0][0];
    expect(reading.sensorId).toBe('test-1');
    expect(reading.sensorType).toBe(SensorType.GENERIC);
    expect(reading.data).toBe(1);
    expect(reading.timestamp).toBe(Date.now());

    await sensor.stop();
  });

  it('should call generateData() on each read', async () => {
    const sensor = new TestSensor();
    const r1 = await sensor.read();
    const r2 = await sensor.read();
    expect(r1.data).toBe(1);
    expect(r2.data).toBe(2);
  });
});
