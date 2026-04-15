import { DeviceType, DeviceState, DeviceData } from './types';
import { SimpleEventBus } from './simple-event-bus';

interface GatewayDevice {
  id: string;
  type: DeviceType;
  state: DeviceState;
  tick?: () => void;
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
}

export class SimpleDeviceGateway {
  private devices: GatewayDevice[] = [];
  private eventBus: SimpleEventBus;
  private _running = false;

  constructor(eventBus: SimpleEventBus) {
    this.eventBus = eventBus;
  }

  registerDevice(device: GatewayDevice): void {
    this.devices.push(device);
  }

  async connectAll(): Promise<void> {
    for (const d of this.devices) {
      if (d.connect) {
        await d.connect();
      }
    }
  }

  async disconnectAll(): Promise<void> {
    for (const d of this.devices) {
      if (d.disconnect) {
        await d.disconnect();
      }
    }
  }

  start(): void {
    this._running = true;
  }

  stop(): void {
    this._running = false;
  }

  tick(): void {
    for (const d of this.devices) {
      if (d.tick) d.tick();
    }
  }

  get isRunning(): boolean {
    return this._running;
  }

  getAllDevices(): { id: string; type: DeviceType; state: DeviceState }[] {
    return [...this.devices];
  }
}

export class SimpleVirtualCameraDevice {
  readonly id: string;
  readonly name = 'Virtual Camera Device';
  readonly type = DeviceType.CAMERA;
  state = DeviceState.DISCONNECTED;
  private frameCount = 0;
  private handlers = new Set<(data: DeviceData) => void>();

  constructor(id: string = 'vcam-1') {
    this.id = id;
  }

  async connect(): Promise<void> {
    this.state = DeviceState.CONNECTING;
    this.state = DeviceState.CONNECTED;
  }

  async disconnect(): Promise<void> {
    this.state = DeviceState.DISCONNECTED;
  }

  tick(): void {
    if (this.state !== DeviceState.CONNECTED) return;
    const data: DeviceData = {
      deviceId: this.id,
      type: 'frame',
      payload: { frameId: ++this.frameCount, width: 640, height: 480, format: 'RGB' },
      timestamp: Date.now(),
    };
    this.handlers.forEach((h) => h(data));
  }

  onData(handler: (data: DeviceData) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}
