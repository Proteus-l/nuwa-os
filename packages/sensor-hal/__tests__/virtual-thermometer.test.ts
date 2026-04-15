import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VirtualThermometer } from '../src/sensors/virtual-thermometer';
import { SensorType, SensorState } from '../src/types';

describe('VirtualThermometer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have default id and name', () => {
    const thermo = new VirtualThermometer();
    expect(thermo.id).toBe('vtherm-1');
    expect(thermo.name).toBe('Virtual Thermometer');
  });

  it('should accept custom id and name', () => {
    const thermo = new VirtualThermometer('t-2', 'Lab Thermo');
    expect(thermo.id).toBe('t-2');
    expect(thermo.name).toBe('Lab Thermo');
  });

  it('should have TEMPERATURE sensor type', () => {
    const thermo = new VirtualThermometer();
    expect(thermo.type).toBe(SensorType.TEMPERATURE);
  });

  it('should generate temperature in default range (18 to 30)', async () => {
    const thermo = new VirtualThermometer();
    for (let i = 0; i < 50; i++) {
      const reading = await thermo.read();
      expect(reading.data.celsius).toBeGreaterThanOrEqual(18);
      expect(reading.data.celsius).toBeLessThanOrEqual(30);
    }
  });

  it('should generate temperature in custom range', async () => {
    const thermo = new VirtualThermometer('t-1', 'Custom', {
      minTemp: 0,
      maxTemp: 5,
    });
    for (let i = 0; i < 50; i++) {
      const reading = await thermo.read();
      expect(reading.data.celsius).toBeGreaterThanOrEqual(0);
      expect(reading.data.celsius).toBeLessThanOrEqual(5);
    }
  });

  it('should have humidity undefined when not provided', async () => {
    const thermo = new VirtualThermometer();
    const reading = await thermo.read();
    expect(reading.data.humidity).toBeUndefined();
  });

  it('should include humidity when provided in options', async () => {
    const thermo = new VirtualThermometer('t-1', 'Humid', { humidity: 65 });
    const reading = await thermo.read();
    expect(reading.data.humidity).toBe(65);
  });

  it('should have unit set to celsius', async () => {
    const thermo = new VirtualThermometer();
    const reading = await thermo.read();
    expect(reading.data.unit).toBe('celsius');
  });

  it('should produce readings via start and subscriber', async () => {
    const thermo = new VirtualThermometer();
    const handler = vi.fn();
    thermo.subscribe(handler);

    await thermo.start();
    vi.advanceTimersByTime(1000);

    expect(handler).toHaveBeenCalledTimes(1);
    const reading = handler.mock.calls[0][0];
    expect(reading.sensorId).toBe('vtherm-1');
    expect(reading.sensorType).toBe(SensorType.TEMPERATURE);
    expect(reading.data.unit).toBe('celsius');

    await thermo.stop();
  });

  it('should start as IDLE', () => {
    const thermo = new VirtualThermometer();
    expect(thermo.state).toBe(SensorState.IDLE);
  });

  it('should return a reading via read()', async () => {
    const thermo = new VirtualThermometer();
    const reading = await thermo.read();
    expect(reading.sensorId).toBe('vtherm-1');
    expect(reading.sensorType).toBe(SensorType.TEMPERATURE);
    expect(typeof reading.data.celsius).toBe('number');
    expect(reading.data.unit).toBe('celsius');
  });
});
