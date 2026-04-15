import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VirtualDevice } from '../src/virtual-device';
import { DeviceType, DeviceState, DeviceCommand, DeviceResponse, DeviceData } from '../src/types';

class TestDevice extends VirtualDevice {
  constructor(id: string = 'test-1', name: string = 'Test Device') {
    super(id, name, DeviceType.GENERIC);
  }

  async handleCommand(command: DeviceCommand): Promise<DeviceResponse> {
    if (command.type === 'ping') {
      return { success: true, data: 'pong' };
    }
    return { success: false, error: 'Unknown command' };
  }

  // Expose emit for testing
  public testEmit(data: DeviceData): void {
    this.emit(data);
  }

  // Expose startEmitting for testing
  public testStartEmitting(interval: number, gen: () => DeviceData): void {
    this.startEmitting(interval, gen);
  }
}

describe('VirtualDevice', () => {
  let device: TestDevice;

  beforeEach(() => {
    device = new TestDevice();
  });

  it('should start in DISCONNECTED state', () => {
    expect(device.state).toBe(DeviceState.DISCONNECTED);
  });

  it('should transition through CONNECTING to CONNECTED on connect', async () => {
    expect(device.state).toBe(DeviceState.DISCONNECTED);
    const connectPromise = device.connect();
    // After calling connect synchronously, state should be CONNECTING
    expect(device.state).toBe(DeviceState.CONNECTING);
    await connectPromise;
    expect(device.state).toBe(DeviceState.CONNECTED);
  });

  it('should set state to DISCONNECTED on disconnect', async () => {
    await device.connect();
    await device.disconnect();
    expect(device.state).toBe(DeviceState.DISCONNECTED);
  });

  it('should send commands via handleCommand', async () => {
    const response = await device.send({ type: 'ping' });
    expect(response).toEqual({ success: true, data: 'pong' });
  });

  it('should return error for unknown commands', async () => {
    const response = await device.send({ type: 'unknown' });
    expect(response).toEqual({ success: false, error: 'Unknown command' });
  });

  it('should register data handlers and emit data to them', () => {
    const handler = vi.fn();
    device.onData(handler);

    const data: DeviceData = {
      deviceId: 'test-1',
      type: 'test',
      payload: { value: 42 },
      timestamp: Date.now(),
    };
    device.testEmit(data);

    expect(handler).toHaveBeenCalledWith(data);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe data handlers', () => {
    const handler = vi.fn();
    const unsub = device.onData(handler);

    const data: DeviceData = {
      deviceId: 'test-1',
      type: 'test',
      payload: {},
      timestamp: Date.now(),
    };

    device.testEmit(data);
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
    device.testEmit(data);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should support multiple data handlers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    device.onData(handler1);
    device.onData(handler2);

    const data: DeviceData = {
      deviceId: 'test-1',
      type: 'test',
      payload: {},
      timestamp: Date.now(),
    };
    device.testEmit(data);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should have correct id, name, type, and protocol', () => {
    expect(device.id).toBe('test-1');
    expect(device.name).toBe('Test Device');
    expect(device.type).toBe(DeviceType.GENERIC);
    expect(device.protocol).toBe('virtual');
  });

  it('should accept a custom protocol', () => {
    class CustomProtocolDevice extends VirtualDevice {
      constructor() {
        super('custom-1', 'Custom', DeviceType.GENERIC, 'bluetooth');
      }
      async handleCommand(): Promise<DeviceResponse> {
        return { success: true };
      }
    }
    const custom = new CustomProtocolDevice();
    expect(custom.protocol).toBe('bluetooth');
  });

  it('should stop emitting interval on disconnect', async () => {
    vi.useFakeTimers();
    try {
      const handler = vi.fn();
      device.onData(handler);

      device.testStartEmitting(100, () => ({
        deviceId: 'test-1',
        type: 'test',
        payload: {},
        timestamp: Date.now(),
      }));

      vi.advanceTimersByTime(100);
      expect(handler).toHaveBeenCalledTimes(1);

      await device.disconnect();

      vi.advanceTimersByTime(100);
      // No more emissions after disconnect
      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
