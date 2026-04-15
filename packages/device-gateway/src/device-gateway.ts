import { IDevice, DeviceData, NuwaEvent } from './types.js';
import { DeviceRegistry } from './device-registry.js';

export class DeviceGateway {
  private registry: DeviceRegistry;
  private publishFn?: (event: NuwaEvent) => void;
  private dataUnsubscribes: Map<string, () => void> = new Map();
  private running = false;

  constructor(publishFn?: (event: NuwaEvent) => void) {
    this.registry = new DeviceRegistry();
    this.publishFn = publishFn;
  }

  addDevice(device: IDevice): void {
    this.registry.register(device);
    const unsub = device.onData((data: DeviceData) => {
      this.bridgeToEventBus(data);
    });
    this.dataUnsubscribes.set(device.id, unsub);
  }

  async removeDevice(deviceId: string): Promise<void> {
    const unsub = this.dataUnsubscribes.get(deviceId);
    if (unsub) {
      unsub();
      this.dataUnsubscribes.delete(deviceId);
    }
    const device = this.registry.getDevice(deviceId);
    if (device) {
      await device.disconnect();
    }
    this.registry.unregister(deviceId);
  }

  async connectAll(): Promise<void> {
    const devices = this.registry.getAllDevices();
    for (const device of devices) {
      await device.connect();
    }
  }

  async disconnectAll(): Promise<void> {
    const devices = this.registry.getAllDevices();
    for (const device of devices) {
      await device.disconnect();
    }
  }

  async start(): Promise<void> {
    this.running = true;
    await this.connectAll();
  }

  async stop(): Promise<void> {
    await this.disconnectAll();
    this.running = false;
    for (const [, unsub] of this.dataUnsubscribes) {
      unsub();
    }
    this.dataUnsubscribes.clear();
  }

  getRegistry(): DeviceRegistry {
    return this.registry;
  }

  getDevice(id: string): IDevice | undefined {
    return this.registry.getDevice(id);
  }

  getAllDevices(): IDevice[] {
    return this.registry.getAllDevices();
  }

  isRunning(): boolean {
    return this.running;
  }

  private bridgeToEventBus(data: DeviceData): void {
    if (this.publishFn) {
      const event: NuwaEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: 'device.data',
        topic: `device.${data.type}.data`,
        timestamp: Date.now(),
        source: data.deviceId,
        data: data,
      };
      this.publishFn(event);
    }
  }
}
