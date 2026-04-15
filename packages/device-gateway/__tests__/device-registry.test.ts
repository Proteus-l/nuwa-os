import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviceRegistry } from '../src/device-registry';
import { DeviceType, DeviceState, IDevice } from '../src/types';

function createMockDevice(id: string, type: DeviceType = DeviceType.GENERIC): IDevice {
  return {
    id,
    name: `Mock ${id}`,
    type,
    protocol: 'mock',
    state: DeviceState.DISCONNECTED,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue({ success: true }),
    onData: vi.fn().mockReturnValue(() => {}),
  };
}

describe('DeviceRegistry', () => {
  let registry: DeviceRegistry;

  beforeEach(() => {
    registry = new DeviceRegistry();
  });

  it('should register a device', () => {
    const device = createMockDevice('d1');
    registry.register(device);
    expect(registry.getDevice('d1')).toBe(device);
  });

  it('should throw when registering a duplicate device ID', () => {
    const device1 = createMockDevice('d1');
    const device2 = createMockDevice('d1');
    registry.register(device1);
    expect(() => registry.register(device2)).toThrow("Device with ID 'd1' is already registered");
  });

  it('should unregister a device and return true', () => {
    const device = createMockDevice('d1');
    registry.register(device);
    expect(registry.unregister('d1')).toBe(true);
    expect(registry.getDevice('d1')).toBeUndefined();
  });

  it('should return false when unregistering a non-existent device', () => {
    expect(registry.unregister('nonexistent')).toBe(false);
  });

  it('should return undefined for a non-existent device', () => {
    expect(registry.getDevice('nonexistent')).toBeUndefined();
  });

  it('should get devices by type', () => {
    const cam1 = createMockDevice('cam1', DeviceType.CAMERA);
    const cam2 = createMockDevice('cam2', DeviceType.CAMERA);
    const thermo = createMockDevice('thermo1', DeviceType.THERMOMETER);
    registry.register(cam1);
    registry.register(cam2);
    registry.register(thermo);

    const cameras = registry.getDevicesByType(DeviceType.CAMERA);
    expect(cameras).toHaveLength(2);
    expect(cameras).toContain(cam1);
    expect(cameras).toContain(cam2);
  });

  it('should return all devices', () => {
    const d1 = createMockDevice('d1');
    const d2 = createMockDevice('d2');
    registry.register(d1);
    registry.register(d2);

    const all = registry.getAllDevices();
    expect(all).toHaveLength(2);
    expect(all).toContain(d1);
    expect(all).toContain(d2);
  });

  it('should call onDeviceRegistered callbacks and return unsubscribe function', () => {
    const callback = vi.fn();
    const unsub = registry.onDeviceRegistered(callback);

    const device = createMockDevice('d1');
    registry.register(device);
    expect(callback).toHaveBeenCalledWith(device);
    expect(callback).toHaveBeenCalledTimes(1);

    // Unsubscribe and verify callback is no longer called
    unsub();
    const device2 = createMockDevice('d2');
    registry.register(device2);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should call onDeviceUnregistered callbacks and return unsubscribe function', () => {
    const callback = vi.fn();
    const unsub = registry.onDeviceUnregistered(callback);

    const device = createMockDevice('d1');
    registry.register(device);
    registry.unregister('d1');
    expect(callback).toHaveBeenCalledWith('d1');
    expect(callback).toHaveBeenCalledTimes(1);

    // Unsubscribe and verify callback is no longer called
    unsub();
    const device2 = createMockDevice('d2');
    registry.register(device2);
    registry.unregister('d2');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not call onDeviceUnregistered when device does not exist', () => {
    const callback = vi.fn();
    registry.onDeviceUnregistered(callback);
    registry.unregister('nonexistent');
    expect(callback).not.toHaveBeenCalled();
  });

  it('should return empty array for getDevicesByType when no match', () => {
    const device = createMockDevice('d1', DeviceType.CAMERA);
    registry.register(device);
    expect(registry.getDevicesByType(DeviceType.THERMOMETER)).toHaveLength(0);
  });

  it('should track count via getCount()', () => {
    expect(registry.getCount()).toBe(0);
    registry.register(createMockDevice('d1'));
    expect(registry.getCount()).toBe(1);
    registry.register(createMockDevice('d2'));
    expect(registry.getCount()).toBe(2);
    registry.unregister('d1');
    expect(registry.getCount()).toBe(1);
  });
});
