import { DeviceType, DeviceState, DeviceCommand, DeviceResponse, DeviceData } from '../types.js';
import { VirtualDevice } from '../virtual-device.js';

export class VirtualCameraDevice extends VirtualDevice {
  private frameCounter = 0;
  private width = 640;
  private height = 480;

  constructor(id: string = 'vcam-1', name: string = 'Virtual Camera Device') {
    super(id, name, DeviceType.CAMERA, 'virtual');
  }

  async connect(): Promise<void> {
    await super.connect();
    this.startEmitting(200, () => this.generateFrame());
  }

  async handleCommand(command: DeviceCommand): Promise<DeviceResponse> {
    switch (command.type) {
      case 'capture': {
        this.frameCounter++;
        return {
          success: true,
          data: {
            frameId: this.frameCounter,
            width: this.width,
            height: this.height,
            format: 'rgb24',
            data: new Uint8Array(this.width * this.height * 3),
          },
        };
      }
      case 'get_resolution': {
        return {
          success: true,
          data: { width: this.width, height: this.height },
        };
      }
      case 'set_resolution': {
        const payload = command.payload as { width: number; height: number };
        if (payload && typeof payload.width === 'number' && typeof payload.height === 'number') {
          this.width = payload.width;
          this.height = payload.height;
          return {
            success: true,
            data: { width: this.width, height: this.height },
          };
        }
        return { success: false, error: 'Invalid resolution payload' };
      }
      default:
        return { success: false, error: 'Unknown command' };
    }
  }

  private generateFrame(): DeviceData {
    this.frameCounter++;
    return {
      deviceId: this.id,
      type: 'frame',
      payload: {
        frameId: this.frameCounter,
        width: this.width,
        height: this.height,
        format: 'rgb24',
        data: new Uint8Array(this.width * this.height * 3),
      },
      timestamp: Date.now(),
    };
  }
}
