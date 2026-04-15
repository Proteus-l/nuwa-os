import { IProcess, ProcessState } from './types.js';
import { DeviceGateway } from './device-gateway.js';

export class GatewayProcess implements IProcess {
  readonly id = 'gateway-process';
  readonly name = 'DeviceGatewayProcess';
  priority: number;
  state: ProcessState = ProcessState.CREATED;
  private gateway: DeviceGateway;

  constructor(gateway: DeviceGateway, priority: number = 5) {
    this.gateway = gateway;
    this.priority = priority;
  }

  async onStart(): Promise<void> {
    await this.gateway.start();
    this.state = ProcessState.RUNNING;
  }

  async onStop(): Promise<void> {
    await this.gateway.stop();
    this.state = ProcessState.TERMINATED;
  }

  async onTick(_tick: number): Promise<void> {
    // No-op: gateway is event-driven via callbacks
  }
}
