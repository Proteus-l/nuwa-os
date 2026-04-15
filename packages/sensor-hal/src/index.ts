export {
  SensorType,
  SensorState,
  type SensorReading,
  type ISensor,
  type NuwaEvent,
} from './types.js';

export { SensorRegistry } from './sensor-registry.js';
export { VirtualSensor, type VirtualSensorOptions } from './virtual-sensor.js';
export {
  VirtualCamera,
  type CameraFrameData,
} from './sensors/virtual-camera.js';
export {
  VirtualThermometer,
  type TemperatureData,
  type VirtualThermometerOptions,
} from './sensors/virtual-thermometer.js';
export { toNuwaEvent } from './utils/event-converter.js';
