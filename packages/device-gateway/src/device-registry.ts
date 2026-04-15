import { IDevice, DeviceType } from './types.js';

export class DeviceRegistry {
  private devices: Map<string, IDevice> = new Map();
  private onRegisterCallbacks: Set<(device: IDevice) => void> = new Set();
  private onUnregisterCallbacks: Set<(deviceId: string) => void> = new Set();

  register(device: IDevice): void {
    if (this.devices.has(device.id)) {
      throw new Error(`Device with ID '${device.id}' is already registered`);
    }
    this.devices.set(device.id, device);
    for (const callback of this.onRegisterCallbacks) {
      callback(device);
    }
  }

  unregister(deviceId: string): boolean {
    const existed = this.devices.delete(deviceId);
    if (existed) {
      for (const callback of this.onUnregisterCallbacks) {
        callback(deviceId);
      }
    }
    return existed;
  }

  getDevice(id: string): IDevice | undefined {
    return this.devices.get(id);
  }

  getDevicesByType(type: DeviceType): IDevice[] {
    return Array.from(this.devices.values()).filter(d => d.type === type);
  }

  getAllDevices(): IDevice[] {
    return Array.from(this.devices.values());
  }

  onDeviceRegistered(handler: (device: IDevice) => void): () => void {
    this.onRegisterCallbacks.add(handler);
    return () => {
      this.onRegisterCallbacks.delete(handler);
    };
  }

  onDeviceUnregistered(handler: (deviceId: string) => void): () => void {
    this.onUnregisterCallbacks.add(handler);
    return () => {
      this.onUnregisterCallbacks.delete(handler);
    };
  }

  getCount(): number {
    return this.devices.size;
  }
}
