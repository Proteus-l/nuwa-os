import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeviceGateway } from '../src/device-gateway';
import { DeviceType, DeviceState, IDevice, NuwaEvent, DeviceData } from '../src/types';
import { VirtualCameraDevice } from '../src/devices/virtual-camera-device';

function createMockDevice(id: string, type: DeviceType = DeviceType.GENERIC): IDevice & { _emit: (data: DeviceData) => void } {
  let state: DeviceState = DeviceState.DISCONNECTED;
  const dataHandlers = new Set<(data: DeviceData) => void>();
  return {
    get id() { return id; },
    name: `Mock ${id}`,
    type,
    protocol: 'mock',
    get state() { return state; },
    set state(s: DeviceState) { state = s; },
    connect: vi.fn(async () => { state = DeviceState.CONNECTED; }),
    disconnect: vi.fn(async () => { state = DeviceState.DISCONNECTED; }),
    send: vi.fn().mockResolvedValue({ success: true }),
    onData: vi.fn((handler: (data: DeviceData) => void) => {
      dataHandlers.add(handler);
      return () => { dataHandlers.delete(handler); };
    }),
    _emit(data: DeviceData) { dataHandlers.forEach(h => h(data)); },
  } as unknown as IDevice & { _emit: (data: DeviceData) => void };
}

describe('DeviceGateway', () => {
  let gateway: DeviceGateway;
  let publishFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    publishFn = vi.fn();
    gateway = new DeviceGateway(publishFn);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should add a device and retrieve it via registry', () => {
    const device = createMockDevice('d1');
    gateway.addDevice(device);
    expect(gateway.getRegistry().getDevice('d1')).toBe(device);
  });

  it('should remove a device and disconnect it', async () => {
    const device = createMockDevice('d1');
    gateway.addDevice(device);
    await gateway.removeDevice('d1');
    expect(gateway.getRegistry().getDevice('d1')).toBeUndefined();
    expect(device.disconnect).toHaveBeenCalled();
  });

  it('should handle removing a non-existent device gracefully', async () => {
    await expect(gateway.removeDevice('nonexistent')).resolves.not.toThrow();
  });

  it('should connect all registered devices via connectAll', async () => {
    const d1 = createMockDevice('d1');
    const d2 = createMockDevice('d2');
    gateway.addDevice(d1);
    gateway.addDevice(d2);

    await gateway.connectAll();

    expect(d1.connect).toHaveBeenCalled();
    expect(d2.connect).toHaveBeenCalled();
  });

  it('should disconnect all registered devices via disconnectAll', async () => {
    const d1 = createMockDevice('d1');
    gateway.addDevice(d1);
    await gateway.connectAll();

    await gateway.disconnectAll();
    expect(d1.disconnect).toHaveBeenCalled();
  });

  it('should bridge device data to publishFn when device emits', () => {
    const device = createMockDevice('d1', DeviceType.CAMERA);
    gateway.addDevice(device);

    const data: DeviceData = { deviceId: 'd1', type: 'frame', payload: { frameId: 1 }, timestamp: 1000 };
    device._emit(data);

    expect(publishFn).toHaveBeenCalledTimes(1);
    const published: NuwaEvent = publishFn.mock.calls[0][0];
    expect(published.type).toBe('device.data');
    expect(published.topic).toBe('device.frame.data');
    expect(published.source).toBe('d1');
    expect(published.data).toBe(data);
  });

  it('should set isRunning to true after start and call connectAll', async () => {
    const d1 = createMockDevice('d1');
    gateway.addDevice(d1);

    expect(gateway.isRunning()).toBe(false);
    await gateway.start();
    expect(gateway.isRunning()).toBe(true);
    expect(d1.connect).toHaveBeenCalled();
  });

  it('should set isRunning to false after stop and disconnect all', async () => {
    const d1 = createMockDevice('d1');
    gateway.addDevice(d1);
    await gateway.start();
    expect(gateway.isRunning()).toBe(true);

    await gateway.stop();
    expect(gateway.isRunning()).toBe(false);
    expect(d1.disconnect).toHaveBeenCalled();
  });

  it('should clean up data subscriptions on stop', async () => {
    const device = createMockDevice('d1');
    gateway.addDevice(device);
    await gateway.start();

    await gateway.stop();

    // Emitting after stop should not call publishFn (subscriptions cleared)
    device._emit({ deviceId: 'd1', type: 'test', payload: {}, timestamp: 1000 });
    expect(publishFn).not.toHaveBeenCalled();
  });

  it('should work without a publishFn', () => {
    const noPublishGateway = new DeviceGateway();
    const device = createMockDevice('d1');
    noPublishGateway.addDevice(device);

    // Should not throw even though there is no publishFn
    device._emit({ deviceId: 'd1', type: 'frame', payload: {}, timestamp: 1000 });
  });

  it('should clean up subscription when removing a device', async () => {
    const device = createMockDevice('d1');
    gateway.addDevice(device);

    // Emit before removal -- should bridge
    device._emit({ deviceId: 'd1', type: 'test', payload: {}, timestamp: 1000 });
    expect(publishFn).toHaveBeenCalledTimes(1);

    await gateway.removeDevice('d1');
    publishFn.mockClear();

    // Emit after removal -- should not bridge
    device._emit({ deviceId: 'd1', type: 'test', payload: {}, timestamp: 2000 });
    expect(publishFn).not.toHaveBeenCalled();
  });

  it('should work with real VirtualCameraDevice', async () => {
    const cam = new VirtualCameraDevice();
    gateway.addDevice(cam);

    const startPromise = gateway.start();
    await vi.advanceTimersByTimeAsync(20);
    await startPromise;

    expect(cam.state).toBe(DeviceState.CONNECTED);

    // Camera auto-emits every 200ms
    vi.advanceTimersByTime(200);
    expect(publishFn).toHaveBeenCalled();
  });
});
