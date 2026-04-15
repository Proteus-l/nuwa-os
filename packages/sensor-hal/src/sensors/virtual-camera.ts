import { SensorType } from '../types.js';
import { VirtualSensor } from '../virtual-sensor.js';

export interface CameraFrameData {
  frameId: number;
  width: number;
  height: number;
  format: string;
  frameData: string;
}

export class VirtualCamera extends VirtualSensor<CameraFrameData> {
  private frameCounter: number = 0;

  constructor(id: string = 'vcam-1', name: string = 'Virtual Camera') {
    super({ id, name, type: SensorType.CAMERA });
  }

  generateData(): CameraFrameData {
    this.frameCounter++;
    return {
      frameId: this.frameCounter,
      width: 640,
      height: 480,
      format: 'rgb24',
      frameData: `frame_${this.frameCounter}`,
    };
  }
}
