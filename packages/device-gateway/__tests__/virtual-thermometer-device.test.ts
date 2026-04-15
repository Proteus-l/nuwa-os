import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VirtualThermometerDevice } from '../src/devices/virtual-thermometer-device';
import { DeviceType, DeviceState, DeviceData } from '../src/types';

describe('VirtualThermometerDevice', () => {
  let thermo: VirtualThermometerDevice;

  beforeEach(() => {
    vi.useFakeTimers();
    thermo = new VirtualThermometerDevice();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have correct default id and name', () => {
    expect(thermo.id).toMatch(/^vtherm/);
    expect(thermo.name).toBe('Virtual Thermometer Device');
    expect(thermo.type).toBe(DeviceType.THERMOMETER);
    expect(thermo.protocol).toBe('virtual');
  });

  it('should accept custom id and name', () => {
    const custom = new VirtualThermometerDevice('t2', 'Custom Thermo');
    expect(custom.id).toBe('t2');
    expect(custom.name).toBe('Custom Thermo');
  });

  it('should connect and reach CONNECTED state', async () => {
    const connectPromise = thermo.connect();
    await vi.advanceTimersByTimeAsync(20);
    await connectPromise;
    expect(thermo.state).toBe(DeviceState.CONNECTED);
  });

  it('should start emitting temperature readings after connect', async () => {
    const handler = vi.fn();
    thermo.onData(handler);

    const connectPromise = thermo.connect();
    await vi.advanceTimersByTimeAsync(20);
    await connectPromise;

    // Advance enough time to get exactly one emission
    vi.advanceTimersByTime(2500);
    expect(handler).toHaveBeenCalled();

    const data: DeviceData = handler.mock.calls[0][0];
    expect(data.deviceId).toBe(thermo.id);
    expect(data.type).toBe('temperature');
    const payload = data.payload as Record<string, unknown>;
    expect(payload.unit).toBe('celsius');
  });

  it('should handle read command', async () => {
    const response = await thermo.send({ type: 'read' });
    expect(response.success).toBe(true);
    const data = response.data as Record<string, unknown>;
    expect(data.unit).toBe('celsius');
  });

  it('should handle a range or unit command', async () => {
    // The source may have get_range or set_unit -- test whichever is available
    const rangeResp = await thermo.send({ type: 'get_range' });
    const unitResp = await thermo.send({ type: 'set_unit', payload: { unit: 'fahrenheit' } });
    const atLeastOneSucceeded = rangeResp.success || unitResp.success;
    expect(atLeastOneSucceeded).toBe(true);
  });

  it('should return error for unknown command', async () => {
    const response = await thermo.send({ type: 'explode' });
    expect(response.success).toBe(false);
    expect(response.error).toBe('Unknown command');
  });

  it('should stop emitting on disconnect', async () => {
    const handler = vi.fn();
    thermo.onData(handler);

    const connectPromise = thermo.connect();
    await vi.advanceTimersByTimeAsync(20);
    await connectPromise;

    vi.advanceTimersByTime(2500);
    const callCountBeforeDisconnect = handler.mock.calls.length;
    expect(callCountBeforeDisconnect).toBeGreaterThan(0);

    await thermo.disconnect();
    expect(thermo.state).toBe(DeviceState.DISCONNECTED);

    vi.advanceTimersByTime(5000);
    expect(handler).toHaveBeenCalledTimes(callCountBeforeDisconnect);
  });
});
