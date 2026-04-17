/**
 * Semantic modality of a capability. This is the concept the agent/persona
 * reasons about ("I can see", "I can feel heat"), not the physical sensor type.
 */
export type Modality =
  | 'vision'
  | 'thermal'
  | 'audio'
  | 'proximity'
  | 'text-input'
  | 'actuator'
  | 'generic';

export interface Capability {
  id: string;
  modality: Modality;
  sourceKind: 'sensor' | 'device';
  sourceId: string;
  name: string;
  description?: string;
  attachedAt: number;
  metadata?: Record<string, unknown>;
}

export type CapabilityEventKind = 'attached' | 'detached';

export interface CapabilityEvent {
  kind: CapabilityEventKind;
  capability: Capability;
}

/** Inlined NuwaEvent to keep this package zero-dependency. */
export interface NuwaEvent {
  id: string;
  type: string;
  topic: string;
  timestamp: number;
  source: string;
  data: unknown;
  metadata?: Record<string, unknown>;
  priority?: 'HIGH' | 'NORMAL' | 'LOW';
}

/** Minimal publisher interface this package requires from the event bus. */
export interface IEventPublisher {
  publish(event: NuwaEvent): void;
}

/**
 * Structural shape of a sensor as seen by capability-registry.
 * We don't import @nuwa-os/sensor-hal to stay zero-dependency.
 */
export interface SensorSource {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}

export interface DeviceSource {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}

/** Structural shape of the sensor registry that capability-registry binds to. */
export interface SensorRegistryLike {
  getAllSensors(): readonly SensorSource[];
  onRegistered(cb: (sensor: SensorSource) => void): () => void;
  onUnregistered(cb: (sensorId: string) => void): () => void;
}

export interface DeviceRegistryLike {
  getAllDevices(): readonly DeviceSource[];
  onDeviceRegistered(cb: (device: DeviceSource) => void): () => void;
  onDeviceUnregistered(cb: (deviceId: string) => void): () => void;
}

export type ModalityMap<T extends { type: string }> = (item: T) => Modality;

export const CAPABILITY_TOPIC = {
  attached: 'capability.attached',
  detached: 'capability.detached',
} as const;
