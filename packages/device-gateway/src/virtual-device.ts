import {
  IDevice,
  DeviceType,
  DeviceState,
  DeviceCommand,
  DeviceResponse,
  DeviceData,
} from './types.js';

export abstract class VirtualDevice implements IDevice {
  public state: DeviceState = DeviceState.DISCONNECTED;
  public readonly protocol: string;
  protected dataHandlers: Set<(data: DeviceData) => void> = new Set();
  private _emitInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: DeviceType,
    protocol: string = 'virtual',
  ) {
    this.protocol = protocol;
  }

  async connect(): Promise<void> {
    this.state = DeviceState.CONNECTING;
    await new Promise(resolve => setTimeout(resolve, 10));
    this.state = DeviceState.CONNECTED;
  }

  async disconnect(): Promise<void> {
    this.stopEmitting();
    this.state = DeviceState.DISCONNECTED;
  }

  async send(command: DeviceCommand): Promise<DeviceResponse> {
    return this.handleCommand(command);
  }

  onData(handler: (data: DeviceData) => void): () => void {
    this.dataHandlers.add(handler);
    return () => {
      this.dataHandlers.delete(handler);
    };
  }

  protected emit(data: DeviceData): void {
    for (const handler of this.dataHandlers) {
      handler(data);
    }
  }

  abstract handleCommand(command: DeviceCommand): Promise<DeviceResponse>;

  protected startEmitting(interval: number, generateData: () => DeviceData): void {
    this.stopEmitting();
    this._emitInterval = setInterval(() => {
      const data = generateData();
      this.emit(data);
    }, interval);
  }

  protected stopEmitting(): void {
    if (this._emitInterval !== null) {
      clearInterval(this._emitInterval);
      this._emitInterval = null;
    }
  }
}
