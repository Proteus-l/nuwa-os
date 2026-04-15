import { DeviceType, DeviceState, DeviceCommand, DeviceResponse, DeviceData } from '../types.js';
import { VirtualDevice } from '../virtual-device.js';

export class VirtualThermometerDevice extends VirtualDevice {
  private minTemp = 18;
  private maxTemp = 30;
  private unit = 'celsius';

  constructor(id: string = 'vtherm-dev-1', name: string = 'Virtual Thermometer Device') {
    super(id, name, DeviceType.THERMOMETER, 'virtual');
  }

  async connect(): Promise<void> {
    await super.connect();
    this.startEmitting(2000, () => this.generateReading());
  }

  async disconnect(): Promise<void> {
    this.stopEmitting();
    await super.disconnect();
  }

  async handleCommand(command: DeviceCommand): Promise<DeviceResponse> {
    switch (command.type) {
      case 'read': {
        return {
          success: true,
          data: {
            temperature: this.generateTemperature(),
            unit: this.unit,
          },
        };
      }
      case 'get_range': {
        return {
          success: true,
          data: { min: this.minTemp, max: this.maxTemp },
        };
      }
      default:
        return { success: false, error: 'Unknown command' };
    }
  }

  private generateTemperature(): number {
    return this.minTemp + Math.random() * (this.maxTemp - this.minTemp);
  }

  private generateReading(): DeviceData {
    return {
      deviceId: this.id,
      type: 'temperature',
      payload: {
        temperature: this.generateTemperature(),
        unit: this.unit,
      },
      timestamp: Date.now(),
    };
  }
}
