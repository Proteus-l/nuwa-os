import {
  CAPABILITY_TOPIC,
  Capability,
  CapabilityEvent,
  DeviceRegistryLike,
  DeviceSource,
  IEventPublisher,
  Modality,
  ModalityMap,
  NuwaEvent,
  SensorRegistryLike,
  SensorSource,
} from './types.js';

let capEventCounter = 0;

export interface CapabilityRegistryOptions {
  bus?: IEventPublisher;
  /** Custom map from sensor.type to Modality. Falls back to DEFAULT_SENSOR_MODALITY. */
  sensorModality?: ModalityMap<SensorSource>;
  /** Custom map from device.type to Modality. Falls back to DEFAULT_DEVICE_MODALITY. */
  deviceModality?: ModalityMap<DeviceSource>;
  now?: () => number;
}

export const DEFAULT_SENSOR_MODALITY: ModalityMap<SensorSource> = (s) => {
  switch (s.type) {
    case 'camera':
      return 'vision';
    case 'temperature':
      return 'thermal';
    case 'audio':
      return 'audio';
    case 'motion':
      return 'proximity';
    default:
      return 'generic';
  }
};

export const DEFAULT_DEVICE_MODALITY: ModalityMap<DeviceSource> = (d) => {
  switch (d.type) {
    case 'camera':
      return 'vision';
    case 'thermometer':
      return 'thermal';
    case 'microphone':
      return 'audio';
    case 'actuator':
      return 'actuator';
    default:
      return 'generic';
  }
};

export class CapabilityRegistry {
  private capabilities: Map<string, Capability> = new Map();
  private changeCallbacks: Set<(ev: CapabilityEvent) => void> = new Set();
  private bus?: IEventPublisher;
  private sensorModality: ModalityMap<SensorSource>;
  private deviceModality: ModalityMap<DeviceSource>;
  private now: () => number;

  constructor(opts: CapabilityRegistryOptions = {}) {
    this.bus = opts.bus;
    this.sensorModality = opts.sensorModality ?? DEFAULT_SENSOR_MODALITY;
    this.deviceModality = opts.deviceModality ?? DEFAULT_DEVICE_MODALITY;
    this.now = opts.now ?? (() => Date.now());
  }

  /** Imperative API: directly add a capability. */
  attach(cap: Omit<Capability, 'attachedAt'> & { attachedAt?: number }): Capability {
    if (this.capabilities.has(cap.id)) {
      throw new Error(`Capability '${cap.id}' already attached`);
    }
    const capability: Capability = {
      ...cap,
      attachedAt: cap.attachedAt ?? this.now(),
    };
    this.capabilities.set(capability.id, capability);
    this.emit({ kind: 'attached', capability });
    return capability;
  }

  /** Imperative API: remove by capability id. Returns true if present. */
  detach(id: string): boolean {
    const existing = this.capabilities.get(id);
    if (!existing) return false;
    this.capabilities.delete(id);
    this.emit({ kind: 'detached', capability: existing });
    return true;
  }

  list(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  byModality(m: Modality): Capability[] {
    return this.list().filter((c) => c.modality === m);
  }

  has(m: Modality): boolean {
    for (const c of this.capabilities.values()) {
      if (c.modality === m) return true;
    }
    return false;
  }

  get(id: string): Capability | undefined {
    return this.capabilities.get(id);
  }

  onChange(cb: (ev: CapabilityEvent) => void): () => void {
    this.changeCallbacks.add(cb);
    return () => {
      this.changeCallbacks.delete(cb);
    };
  }

  /**
   * Wire up a sensor registry: snapshot current sensors + subscribe to future
   * register/unregister callbacks. Returns an unsubscribe function.
   */
  bindSensorRegistry(reg: SensorRegistryLike): () => void {
    for (const sensor of reg.getAllSensors()) {
      this.attachFromSensor(sensor);
    }
    const offReg = reg.onRegistered((sensor) => {
      this.attachFromSensor(sensor);
    });
    const offUnreg = reg.onUnregistered((sensorId) => {
      this.detachBySourceId('sensor', sensorId);
    });
    return () => {
      offReg();
      offUnreg();
    };
  }

  bindDeviceRegistry(reg: DeviceRegistryLike): () => void {
    for (const device of reg.getAllDevices()) {
      this.attachFromDevice(device);
    }
    const offReg = reg.onDeviceRegistered((device) => {
      this.attachFromDevice(device);
    });
    const offUnreg = reg.onDeviceUnregistered((deviceId) => {
      this.detachBySourceId('device', deviceId);
    });
    return () => {
      offReg();
      offUnreg();
    };
  }

  private attachFromSensor(sensor: SensorSource): void {
    const id = this.buildId('sensor', sensor.id);
    if (this.capabilities.has(id)) return;
    this.attach({
      id,
      modality: this.sensorModality(sensor),
      sourceKind: 'sensor',
      sourceId: sensor.id,
      name: sensor.name,
      metadata: { sourceType: sensor.type },
    });
  }

  private attachFromDevice(device: DeviceSource): void {
    const id = this.buildId('device', device.id);
    if (this.capabilities.has(id)) return;
    this.attach({
      id,
      modality: this.deviceModality(device),
      sourceKind: 'device',
      sourceId: device.id,
      name: device.name,
      metadata: { sourceType: device.type },
    });
  }

  private detachBySourceId(kind: 'sensor' | 'device', sourceId: string): void {
    this.detach(this.buildId(kind, sourceId));
  }

  private buildId(kind: 'sensor' | 'device', sourceId: string): string {
    return `${kind}:${sourceId}`;
  }

  private emit(ev: CapabilityEvent): void {
    for (const cb of this.changeCallbacks) {
      try {
        cb(ev);
      } catch {
        // local callbacks are best-effort; do not let one consumer break the rest
      }
    }
    if (this.bus) {
      const evt: NuwaEvent = {
        id: `cap_${++capEventCounter}`,
        type: 'capability',
        topic:
          ev.kind === 'attached'
            ? CAPABILITY_TOPIC.attached
            : CAPABILITY_TOPIC.detached,
        timestamp: this.now(),
        source: 'capability-registry',
        data: ev.capability,
      };
      this.bus.publish(evt);
    }
  }
}
