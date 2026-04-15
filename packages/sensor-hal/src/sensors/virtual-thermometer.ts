import { SensorType } from '../types.js';
import { VirtualSensor } from '../virtual-sensor.js';

export interface TemperatureData {
  celsius: number;
  humidity: number | undefined;
  unit: string;
}

export interface VirtualThermometerOptions {
  minTemp?: number;
  maxTemp?: number;
  humidity?: number;
}

export class VirtualThermometer extends VirtualSensor<TemperatureData> {
  private minTemp: number;
  private maxTemp: number;
  private humidity: number | undefined;

  constructor(
    id: string = 'vtherm-1',
    name: string = 'Virtual Thermometer',
    options: VirtualThermometerOptions = {},
  ) {
    super({ id, name, type: SensorType.TEMPERATURE });
    this.minTemp = options.minTemp ?? 18;
    this.maxTemp = options.maxTemp ?? 30;
    this.humidity = options.humidity;
  }

  generateData(): TemperatureData {
    const celsius =
      this.minTemp + Math.random() * (this.maxTemp - this.minTemp);
    return {
      celsius,
      humidity: this.humidity,
      unit: 'celsius',
    };
  }
}
