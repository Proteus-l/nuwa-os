import { SensorType, DeviceData } from './types';
import { SimpleEventBus } from './simple-event-bus';
import { SimpleKernel } from './simple-kernel';
import { SimpleSensorRegistry, SimpleVirtualCamera } from './simple-sensor';
import { SimpleDeviceGateway, SimpleVirtualCameraDevice } from './simple-gateway';
import { SimpleAgentRuntime, SimpleAgentProcess } from './simple-runtime';
import { VisionAgent } from './vision-agent';

export class NuwaOS {
  private eventBus: SimpleEventBus;
  private kernel: SimpleKernel;
  private sensorRegistry: SimpleSensorRegistry;
  private camera: SimpleVirtualCamera;
  private gateway: SimpleDeviceGateway;
  private cameraDevice: SimpleVirtualCameraDevice;
  private runtime: SimpleAgentRuntime;
  private visionAgent: VisionAgent;
  private agentProcess: SimpleAgentProcess;
  private _booted = false;

  constructor() {
    this.eventBus = new SimpleEventBus();
    this.kernel = new SimpleKernel(100);
    this.sensorRegistry = new SimpleSensorRegistry();
    this.camera = new SimpleVirtualCamera();
    this.gateway = new SimpleDeviceGateway(this.eventBus);
    this.cameraDevice = new SimpleVirtualCameraDevice();
    this.runtime = new SimpleAgentRuntime(this.eventBus);
    this.visionAgent = new VisionAgent();
    this.agentProcess = new SimpleAgentProcess(this.visionAgent, 5);
  }

  async boot(): Promise<void> {
    // 1. Event Bus ready (no init needed)

    // 2. Register sensors
    this.sensorRegistry.register({
      id: this.camera.id,
      name: this.camera.name,
      type: SensorType.CAMERA,
      state: this.camera.state,
    });
    this.camera.start(200);
    // Bridge camera readings to event bus
    this.camera.onReading((reading: Record<string, unknown>) => {
      this.eventBus.publish({
        id: this.eventBus.generateEventId(),
        type: 'sensor',
        topic: 'sensor.camera.frame',
        timestamp: Date.now(),
        source: this.camera.id,
        data: reading,
      });
    });

    // 3. Setup device gateway
    this.gateway.registerDevice(this.cameraDevice);
    await this.gateway.connectAll();
    this.gateway.start();
    // Bridge device data to event bus
    this.cameraDevice.onData((data: DeviceData) => {
      this.eventBus.publish({
        id: this.eventBus.generateEventId(),
        type: 'sensor',
        topic: `device.${this.cameraDevice.type}.data`,
        timestamp: Date.now(),
        source: data.deviceId,
        data: data.payload,
      });
    });

    // 4. Setup agent runtime
    await this.runtime.registerAgent(this.visionAgent);
    await this.runtime.startAll();

    // 5. Register processes and start kernel
    this.kernel.registerProcess(this.agentProcess);
    this.kernel.start();

    this._booted = true;
  }

  async shutdown(): Promise<void> {
    // Reverse order
    this.kernel.stop();
    await this.runtime.stopAll();
    this.gateway.stop();
    await this.gateway.disconnectAll();
    this.camera.stop();
    this._booted = false;
  }

  status(): Record<string, unknown> {
    return {
      booted: this._booted,
      eventBus: { historySize: this.eventBus.history().length },
      kernel: { running: this.kernel.isRunning, tick: this.kernel.tick },
      sensors: {
        total: this.sensorRegistry.getAllSensors().length,
        camera: this.camera.state,
      },
      gateway: {
        running: this.gateway.isRunning,
        devices: this.gateway.getAllDevices().length,
      },
      agent: this.visionAgent.getStats(),
    };
  }

  getEventBus(): SimpleEventBus {
    return this.eventBus;
  }

  getVisionAgent(): VisionAgent {
    return this.visionAgent;
  }
}
